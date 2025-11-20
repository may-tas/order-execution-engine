import { OrderStatus } from '@prisma/client';
import { wsManager } from './websocket.manager';
import { OrderUpdateMessage } from './types';
import { logger } from '../../utils';

/**
 * WebSocket Service
 * Integrates WebSocket manager with order processing
 */
export class WebSocketService {
  /**
   * Broadcast order status update
   */
  static broadcastOrderUpdate(
    orderId: string,
    status: OrderStatus,
    message?: string,
    metadata?: Record<string, unknown>
  ): void {
    const update: OrderUpdateMessage = {
      orderId,
      status,
      message,
      metadata,
      timestamp: Date.now(),
    };

    wsManager.broadcastOrderUpdate(orderId, update);

    logger.debug('Order update broadcasted', {
      orderId,
      status,
      subscriberCount: wsManager.getStats().totalSubscriptions,
    });
  }

  /**
   * Get WebSocket statistics
   */
  static getStats(): {
    totalConnections: number;
    totalRooms: number;
    totalSubscriptions: number;
  } {
    return wsManager.getStats();
  }

  /**
   * Shutdown WebSocket service
   */
  static async shutdown(): Promise<void> {
    await wsManager.shutdown();
  }
}
