import { DexType } from '@prisma/client';
import { prisma } from './database';

export interface CreateExecutionInput {
  orderId: string;
  dex: DexType;
  txHash: string;
  executedPrice: number;
  executedAmount: number;
  inputAmount: number;
  outputAmount: number;
  fee: number;
  slippage: number;
  executionTimeMs: number;
}

export class ExecutionRepository {
  async create(data: CreateExecutionInput) {
    return prisma.orderExecution.create({
      data,
    });
  }

  async findByOrderId(orderId: string) {
    return prisma.orderExecution.findUnique({
      where: { orderId },
      include: {
        order: true,
      },
    });
  }

  async findByTxHash(txHash: string) {
    return prisma.orderExecution.findFirst({
      where: { txHash },
      include: {
        order: true,
      },
    });
  }

  async getRecentExecutions(limit: number = 50) {
    return prisma.orderExecution.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        order: true,
      },
    });
  }

  async getExecutionsByDex(dex: DexType, limit: number = 50) {
    return prisma.orderExecution.findMany({
      where: { dex },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getExecutionStats() {
    const [total, byDex, avgExecutionTime] = await Promise.all([
      prisma.orderExecution.count(),
      prisma.orderExecution.groupBy({
        by: ['dex'],
        _count: true,
      }),
      prisma.orderExecution.aggregate({
        _avg: {
          executionTimeMs: true,
        },
      }),
    ]);

    return {
      total,
      byDex: byDex.reduce(
        (acc, item) => {
          acc[item.dex] = item._count;
          return acc;
        },
        {} as Record<DexType, number>
      ),
      avgExecutionTimeMs: avgExecutionTime._avg.executionTimeMs ?? 0,
    };
  }
}
