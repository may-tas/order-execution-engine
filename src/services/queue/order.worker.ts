import { Worker, Job, QueueEvents } from 'bullmq';
import { OrderStatus } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../utils';
import { OrderRepository } from '../../repositories';
import { DexRouterService } from '../dex';
import { queueConnection } from './order.queue';
import { OrderJobData, OrderJobResult } from './types';

/**
 * Order Processing Worker
 * Processes orders from the queue with concurrency control
 */
export class OrderWorker {
  private worker: Worker<OrderJobData, OrderJobResult>;
  private queueEvents: QueueEvents;
  private orderRepository: OrderRepository;
  private dexRouter: DexRouterService;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.dexRouter = new DexRouterService();

    // Create worker with concurrency settings
    this.worker = new Worker<OrderJobData, OrderJobResult>(
      'order-processing',
      async (job) => this.processOrder(job),
      {
        connection: queueConnection,
        concurrency: config.queue.concurrency, // Process 10 orders concurrently
        limiter: {
          max: config.queue.rateLimit, // 100 orders
          duration: 60000, // per minute (60000ms)
        },
      }
    );

    // Setup queue events for monitoring
    this.queueEvents = new QueueEvents('order-processing', {
      connection: queueConnection,
    });

    this.setupEventListeners();

    logger.info('Order worker initialized', {
      concurrency: config.queue.concurrency,
      rateLimit: `${config.queue.rateLimit}/min`,
      maxRetries: config.order.maxRetryAttempts,
    });
  }

  /**
   * Process a single order
   */
  private async processOrder(job: Job<OrderJobData>): Promise<OrderJobResult> {
    const { orderId, tokenIn, tokenOut, amountIn, slippage } = job.data;

    logger.info('Processing order', {
      jobId: job.id,
      orderId,
      tokenIn,
      tokenOut,
      amountIn,
      attempt: job.attemptsMade + 1,
    });

    try {
      // Update status to ROUTING
      await this.orderRepository.updateStatus({
        orderId,
        status: OrderStatus.ROUTING,
        message: 'Comparing DEX prices',
      });

      // Find best route
      const routingResult = await this.dexRouter.findBestRoute(
        { tokenIn, tokenOut, amountIn, slippage },
        orderId
      );

      logger.info('Best route found', {
        orderId,
        selectedDex: routingResult.selectedDex,
        reason: routingResult.reason,
      });

      // Update status to BUILDING
      await this.orderRepository.updateStatus({
        orderId,
        status: OrderStatus.BUILDING,
        message: `Building transaction on ${routingResult.selectedDex}`,
        metadata: {
          dex: routingResult.selectedDex,
          estimatedOutput: routingResult.selectedQuote.estimatedOutput,
        },
      });

      // Update status to SUBMITTED
      await this.orderRepository.updateStatus({
        orderId,
        status: OrderStatus.SUBMITTED,
        message: 'Transaction submitted to network',
      });

      // Execute swap
      const swapResult = await this.dexRouter.executeSwap(
        { tokenIn, tokenOut, amountIn, slippage },
        routingResult.selectedDex,
        routingResult.selectedQuote
      );

      logger.info('Swap executed successfully', {
        orderId,
        txHash: swapResult.txHash,
        executedPrice: swapResult.executedPrice,
        outputAmount: swapResult.outputAmount,
      });

      // Update status to CONFIRMED
      await this.orderRepository.updateStatus({
        orderId,
        status: OrderStatus.CONFIRMED,
        message: 'Order executed successfully',
        metadata: {
          txHash: swapResult.txHash,
          executedPrice: swapResult.executedPrice,
          outputAmount: swapResult.outputAmount,
          dex: routingResult.selectedDex,
        },
      });

      return {
        orderId,
        success: true,
        txHash: swapResult.txHash,
        executedPrice: swapResult.executedPrice,
        outputAmount: swapResult.outputAmount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Order processing failed', {
        orderId,
        error: errorMessage,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts,
      });

      // Increment retry count
      await this.orderRepository.incrementRetryCount(orderId);

      // If this was the last attempt, mark as failed
      if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
        await this.orderRepository.markAsFailed(orderId, errorMessage);

        logger.error('Order marked as failed after max retries', {
          orderId,
          totalAttempts: job.attemptsMade + 1,
        });
      } else {
        logger.info('Order will be retried', {
          orderId,
          nextAttempt: job.attemptsMade + 2,
          maxAttempts: job.opts.attempts,
        });
      }

      return {
        orderId,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Setup event listeners for worker and queue events
   */
  private setupEventListeners(): void {
    // Worker events
    this.worker.on('completed', (job, result) => {
      logger.info('Worker completed job', {
        jobId: job.id,
        orderId: result.orderId,
        success: result.success,
        duration: Date.now() - job.timestamp,
      });
    });

    this.worker.on('failed', (job, error) => {
      if (job) {
        logger.error('Worker failed job', {
          jobId: job.id,
          orderId: job.data.orderId,
          error: error.message,
          attemptsMade: job.attemptsMade,
        });
      }
    });

    this.worker.on('error', (error) => {
      logger.error('Worker error', { error: error.message });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('Job stalled', { jobId });
    });

    // Queue events for monitoring
    this.queueEvents.on('waiting', ({ jobId }) => {
      logger.debug('Job waiting', { jobId });
    });

    this.queueEvents.on('active', ({ jobId }) => {
      logger.debug('Job active', { jobId });
    });

    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info('Job completed via queue events', {
        jobId,
        result: returnvalue,
      });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed via queue events', {
        jobId,
        reason: failedReason,
      });
    });

    this.queueEvents.on('retries-exhausted', ({ jobId }) => {
      logger.error('Job retries exhausted', { jobId });
    });
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    logger.info('Closing order worker...');
    await this.worker.close();
    await this.queueEvents.close();
    logger.info('Order worker closed');
  }

  /**
   * Get worker instance
   */
  getWorker(): Worker<OrderJobData, OrderJobResult> {
    return this.worker;
  }

  /**
   * Get queue events instance
   */
  getQueueEvents(): QueueEvents {
    return this.queueEvents;
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down worker...');
  process.exit(0);
});
