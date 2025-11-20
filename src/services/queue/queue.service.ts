import { Job } from 'bullmq';
import { OrderType } from '@prisma/client';
import { logger } from '../../utils';
import { OrderRepository } from '../../repositories';
import { orderQueue } from './order.queue';
import { OrderJobData } from './types';

export interface CreateOrderInput {
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage?: number;
  userId?: string;
}

/**
 * Order Queue Service
 * Handles adding orders to the processing queue
 */
export class OrderQueueService {
  private orderRepository: OrderRepository;

  constructor() {
    this.orderRepository = new OrderRepository();
  }

  /**
   * Add an order to the processing queue
   */
  async addOrder(input: CreateOrderInput): Promise<{ orderId: string; jobId: string }> {
    try {
      // Create order in database
      const order = await this.orderRepository.create({
        type: input.type,
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
        amountIn: input.amountIn,
        slippage: input.slippage ?? 0.01,
        userId: input.userId,
      });

      logger.info('Order created', {
        orderId: order.id,
        type: order.type,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amountIn: order.amountIn,
      });

      // Add to queue
      const jobData: OrderJobData = {
        orderId: order.id,
        type: order.type,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amountIn: order.amountIn,
        slippage: order.slippage,
        userId: order.userId ?? undefined,
        createdAt: order.createdAt,
      };

      const job = await orderQueue.add('process-order', jobData, {
        jobId: `order-${order.id}`,
      });

      logger.info('Order added to queue', {
        orderId: order.id,
        jobId: job.id,
      });

      return {
        orderId: order.id,
        jobId: job.id ?? `order-${order.id}`,
      };
    } catch (error) {
      logger.error('Failed to add order to queue', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    state: string;
    progress: number;
    data?: OrderJobData;
  } | null> {
    try {
      const job = await orderQueue.getJob(jobId);

      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = job.progress as number;

      return {
        state,
        progress,
        data: job.data,
      };
    } catch (error) {
      logger.error('Failed to get job status', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        orderQueue.getWaitingCount(),
        orderQueue.getActiveCount(),
        orderQueue.getCompletedCount(),
        orderQueue.getFailedCount(),
        orderQueue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    } catch (error) {
      logger.error('Failed to get queue stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Remove a job from the queue
   */
  async removeJob(jobId: string): Promise<boolean> {
    try {
      const job = await orderQueue.getJob(jobId);

      if (!job) {
        return false;
      }

      await job.remove();

      logger.info('Job removed from queue', { jobId });
      return true;
    } catch (error) {
      logger.error('Failed to remove job', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await orderQueue.getJob(jobId);

      if (!job) {
        return false;
      }

      await job.retry();

      logger.info('Job retried', { jobId });
      return true;
    } catch (error) {
      logger.error('Failed to retry job', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(limit: number = 10): Promise<Job<OrderJobData>[]> {
    try {
      return await orderQueue.getFailed(0, limit - 1);
    } catch (error) {
      logger.error('Failed to get failed jobs', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Clean old jobs
   */
  async cleanJobs(grace: number = 24 * 3600 * 1000): Promise<void> {
    try {
      await orderQueue.clean(grace, 1000, 'completed');
      await orderQueue.clean(grace, 1000, 'failed');

      logger.info('Queue cleaned', { graceMs: grace });
    } catch (error) {
      logger.error('Failed to clean queue', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
