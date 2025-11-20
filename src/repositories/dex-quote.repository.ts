import { DexType } from '@prisma/client';
import { prisma } from './database';

export interface CreateDexQuoteLogInput {
  orderId: string;
  dex: DexType;
  price: number;
  fee: number;
  estimatedOutput: number;
  latencyMs: number;
  selectedForExecution?: boolean;
}

export class DexQuoteRepository {
  async create(data: CreateDexQuoteLogInput) {
    return prisma.dexQuoteLog.create({
      data: {
        orderId: data.orderId,
        dex: data.dex,
        price: data.price,
        fee: data.fee,
        estimatedOutput: data.estimatedOutput,
        latencyMs: data.latencyMs,
        selectedForExecution: data.selectedForExecution ?? false,
      },
    });
  }

  async createMany(quotes: CreateDexQuoteLogInput[]) {
    return prisma.dexQuoteLog.createMany({
      data: quotes,
    });
  }

  async findByOrderId(orderId: string) {
    return prisma.dexQuoteLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getSelectedQuote(orderId: string) {
    return prisma.dexQuoteLog.findFirst({
      where: {
        orderId,
        selectedForExecution: true,
      },
    });
  }

  async getQuoteStats() {
    const [total, avgLatency, byDex] = await Promise.all([
      prisma.dexQuoteLog.count(),
      prisma.dexQuoteLog.aggregate({
        _avg: {
          latencyMs: true,
        },
      }),
      prisma.dexQuoteLog.groupBy({
        by: ['dex'],
        _count: true,
        _avg: {
          latencyMs: true,
          price: true,
        },
      }),
    ]);

    return {
      total,
      avgLatencyMs: avgLatency._avg.latencyMs ?? 0,
      byDex: byDex.map((item) => ({
        dex: item.dex,
        count: item._count,
        avgLatencyMs: item._avg.latencyMs ?? 0,
        avgPrice: item._avg.price ?? 0,
      })),
    };
  }
}
