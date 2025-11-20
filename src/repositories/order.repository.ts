import { OrderStatus, OrderType, Prisma } from '@prisma/client';
import { prisma } from './database';

export interface CreateOrderInput {
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage?: number;
  userId?: string;
}

export interface UpdateOrderStatusInput {
  orderId: string;
  status: OrderStatus;
  message?: string;
  metadata?: Record<string, unknown>;
}

export class OrderRepository {
  async create(data: CreateOrderInput) {
    return prisma.order.create({
      data: {
        type: data.type,
        tokenIn: data.tokenIn,
        tokenOut: data.tokenOut,
        amountIn: data.amountIn,
        slippage: data.slippage ?? 0.01,
        userId: data.userId,
        status: OrderStatus.PENDING,
      },
    });
  }

  async findById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        execution: true,
      },
    });
  }

  async updateStatus(data: UpdateOrderStatusInput) {
    const { orderId, status, message, metadata } = data;

    // Update order status and create history record in a transaction
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: { status, updatedAt: new Date() },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status,
          message,
          metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });

      return order;
    });
  }

  async incrementRetryCount(orderId: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: {
        retryCount: { increment: 1 },
      },
    });
  }

  async markAsFailed(orderId: string, reason: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.FAILED,
        failureReason: reason,
        updatedAt: new Date(),
      },
    });
  }

  async findPendingOrders(limit: number = 10) {
    return prisma.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PENDING, OrderStatus.ROUTING, OrderStatus.BUILDING],
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async getOrdersByStatus(status: OrderStatus, limit: number = 100) {
    return prisma.order.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getOrderStats() {
    const [total, pending, confirmed, failed] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }),
      prisma.order.count({ where: { status: OrderStatus.FAILED } }),
    ]);

    return { total, pending, confirmed, failed };
  }
}
