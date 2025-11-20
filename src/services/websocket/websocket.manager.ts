/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/require-await */
import { FastifyRequest } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { randomUUID } from 'crypto';
import { OrderStatus } from '@prisma/client';
import { logger } from '../../utils';
import {
  WebSocketMessageType,
  WebSocketMessage,
  SubscribeMessage,
  OrderUpdateMessage,
  ErrorMessage,
  ConnectionInfo,
} from './types';

interface SocketStream {
  socket: WebSocket;
}

/**
 * WebSocket Manager
 * Handles WebSocket connections, room-based broadcasting, and heartbeat
 * Note: ESLint rules disabled due to type inference issues with @fastify/websocket
 */
export class WebSocketManager {
  private connections: Map<string, SocketStream>;
  private connectionInfo: Map<string, ConnectionInfo>;
  private orderRooms: Map<string, Set<string>>; // orderId -> Set of connectionIds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 60000; // 60 seconds

  constructor() {
    this.connections = new Map();
    this.connectionInfo = new Map();
    this.orderRooms = new Map();
    this.startHeartbeat();

    logger.info('WebSocket Manager initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(connection: SocketStream, request: FastifyRequest): string {
    const connectionId = randomUUID();
    const clientIp = request.ip;
    const socket = connection.socket as WebSocket;

    this.connections.set(connectionId, connection);
    this.connectionInfo.set(connectionId, {
      connectionId,
      subscribedOrders: new Set(),
      lastPing: Date.now(),
      connected: true,
    });

    logger.info('WebSocket connection established', {
      connectionId,
      clientIp,
      totalConnections: this.connections.size,
    });

    // Send connected message
    this.sendMessage(connectionId, {
      type: WebSocketMessageType.CONNECTED,
      payload: { connectionId },
      timestamp: Date.now(),
    });

    // Setup message handler
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      if (Buffer.isBuffer(data)) {
        this.handleMessage(connectionId, data);
      }
    });

    // Setup close handler
    socket.on('close', () => {
      this.handleDisconnect(connectionId);
    });

    // Setup error handler
    socket.on('error', (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('WebSocket error', {
        connectionId,
        error: errorMessage,
      });
      this.handleDisconnect(connectionId);
    });

    return connectionId;
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(connectionId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      const info = this.connectionInfo.get(connectionId);

      if (!info) {
        logger.warn('Message from unknown connection', { connectionId });
        return;
      }

      // Update last ping time
      info.lastPing = Date.now();

      logger.debug('WebSocket message received', {
        connectionId,
        type: message.type,
      });

      switch (message.type) {
        case WebSocketMessageType.SUBSCRIBE:
          this.handleSubscribe(connectionId, message.payload as SubscribeMessage);
          break;

        case WebSocketMessageType.UNSUBSCRIBE:
          this.handleUnsubscribe(connectionId, message.payload as SubscribeMessage);
          break;

        case WebSocketMessageType.PING:
          this.handlePing(connectionId);
          break;

        default:
          logger.warn('Unknown message type', {
            connectionId,
            type: message.type,
          });
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });

      this.sendError(connectionId, 'Invalid message format');
    }
  }

  /**
   * Handle subscribe to order updates
   */
  private handleSubscribe(connectionId: string, payload: SubscribeMessage): void {
    const { orderId } = payload;
    const info = this.connectionInfo.get(connectionId);

    if (!info) return;

    // Add connection to order room
    if (!this.orderRooms.has(orderId)) {
      this.orderRooms.set(orderId, new Set());
    }
    this.orderRooms.get(orderId)!.add(connectionId);

    // Add order to connection's subscriptions
    info.subscribedOrders.add(orderId);

    logger.info('Client subscribed to order', {
      connectionId,
      orderId,
      roomSize: this.orderRooms.get(orderId)!.size,
    });

    // Send confirmation
    this.sendMessage(connectionId, {
      type: WebSocketMessageType.ORDER_UPDATE,
      payload: {
        orderId,
        status: OrderStatus.PENDING,
        message: 'Subscribed to order updates',
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle unsubscribe from order updates
   */
  private handleUnsubscribe(connectionId: string, payload: SubscribeMessage): void {
    const { orderId } = payload;
    const info = this.connectionInfo.get(connectionId);

    if (!info) return;

    // Remove connection from order room
    const room = this.orderRooms.get(orderId);
    if (room) {
      room.delete(connectionId);
      if (room.size === 0) {
        this.orderRooms.delete(orderId);
      }
    }

    // Remove order from connection's subscriptions
    info.subscribedOrders.delete(orderId);

    logger.info('Client unsubscribed from order', {
      connectionId,
      orderId,
    });
  }

  /**
   * Handle ping message
   */
  private handlePing(connectionId: string): void {
    this.sendMessage(connectionId, {
      type: WebSocketMessageType.PONG,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle connection disconnect
   */
  private handleDisconnect(connectionId: string): void {
    const info = this.connectionInfo.get(connectionId);

    if (info) {
      // Remove from all subscribed order rooms
      info.subscribedOrders.forEach((orderId) => {
        const room = this.orderRooms.get(orderId);
        if (room) {
          room.delete(connectionId);
          if (room.size === 0) {
            this.orderRooms.delete(orderId);
          }
        }
      });

      logger.info('WebSocket connection closed', {
        connectionId,
        subscribedOrders: info.subscribedOrders.size,
        totalConnections: this.connections.size - 1,
      });
    }

    this.connections.delete(connectionId);
    this.connectionInfo.delete(connectionId);
  }

  /**
   * Broadcast order update to all subscribers in the room
   */
  broadcastOrderUpdate(orderId: string, update: OrderUpdateMessage): void {
    const room = this.orderRooms.get(orderId);

    if (!room || room.size === 0) {
      logger.debug('No subscribers for order update', { orderId });
      return;
    }

    const message: WebSocketMessage = {
      type: WebSocketMessageType.ORDER_UPDATE,
      payload: update,
      timestamp: Date.now(),
    };

    logger.info('Broadcasting order update', {
      orderId,
      status: update.status,
      subscriberCount: room.size,
    });

    room.forEach((connectionId) => {
      this.sendMessage(connectionId, message);
    });
  }

  /**
   * Send message to specific connection
   */
  private sendMessage(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);

    if (!connection || (connection.socket as WebSocket).readyState !== 1) {
      // WebSocket.OPEN = 1
      return;
    }

    try {
      (connection.socket as WebSocket).send(JSON.stringify(message));
    } catch (error) {
      logger.error('Error sending WebSocket message', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send error message to connection
   */
  private sendError(connectionId: string, error: string, code?: string): void {
    const errorPayload: ErrorMessage = { error, code };

    this.sendMessage(connectionId, {
      type: WebSocketMessageType.ERROR,
      payload: errorPayload,
      timestamp: Date.now(),
    });
  }

  /**
   * Start heartbeat to check connection health
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      this.connectionInfo.forEach((info, connectionId) => {
        const timeSinceLastPing = now - info.lastPing;

        // Check if connection is stale
        if (timeSinceLastPing > this.CONNECTION_TIMEOUT) {
          logger.warn('Connection timeout, closing', {
            connectionId,
            timeSinceLastPing,
          });
          this.closeConnection(connectionId);
        }
      });

      logger.debug('Heartbeat check completed', {
        activeConnections: this.connections.size,
      });
    }, this.HEARTBEAT_INTERVAL);

    logger.info('WebSocket heartbeat started', {
      interval: this.HEARTBEAT_INTERVAL,
      timeout: this.CONNECTION_TIMEOUT,
    });
  }

  /**
   * Close a specific connection
   */
  private closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);

    if (connection) {
      try {
        (connection.socket as WebSocket).close();
      } catch (error) {
        logger.error('Error closing connection', {
          connectionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.handleDisconnect(connectionId);
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    totalRooms: number;
    totalSubscriptions: number;
  } {
    let totalSubscriptions = 0;
    this.connectionInfo.forEach((info) => {
      totalSubscriptions += info.subscribedOrders.size;
    });

    return {
      totalConnections: this.connections.size,
      totalRooms: this.orderRooms.size,
      totalSubscriptions,
    };
  }

  /**
   * Shutdown the WebSocket manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket manager');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    await Promise.all(
      Array.from(this.connections.entries()).map(async ([connectionId, connection]) => {
        try {
          (connection.socket as WebSocket).close();
        } catch (error) {
          logger.error('Error closing connection during shutdown', {
            connectionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
    );

    this.connections.clear();
    this.connectionInfo.clear();
    this.orderRooms.clear();

    logger.info('WebSocket manager shut down');
  }
}

// Create singleton instance
export const wsManager = new WebSocketManager();
