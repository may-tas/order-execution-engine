import { OrderType } from '@prisma/client';

export interface OrderJobData {
  orderId: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage: number;
  userId?: string;
  createdAt: Date;
}

export interface OrderJobResult {
  orderId: string;
  success: boolean;
  txHash?: string;
  executedPrice?: number;
  outputAmount?: number;
  error?: string;
}

export enum QueueEvents {
  ORDER_CREATED = 'order:created',
  ORDER_PROCESSING = 'order:processing',
  ORDER_COMPLETED = 'order:completed',
  ORDER_FAILED = 'order:failed',
  ORDER_RETRY = 'order:retry',
}
