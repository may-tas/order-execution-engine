import { OrderStatus } from '@prisma/client';

export enum WebSocketMessageType {
  // Client to Server
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  PING = 'ping',

  // Server to Client
  ORDER_UPDATE = 'order-update',
  ERROR = 'error',
  PONG = 'pong',
  CONNECTED = 'connected',
  SUBSCRIBED = 'subscribed',
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload?: unknown;
  timestamp?: number;
}

export interface SubscribeMessage {
  orderId: string;
}

export interface OrderUpdateMessage {
  orderId: string;
  status: OrderStatus;
  message?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface ErrorMessage {
  error: string;
  code?: string;
}

export interface ConnectionInfo {
  connectionId: string;
  subscribedOrders: Set<string>;
  lastPing: number;
  connected: boolean;
}
