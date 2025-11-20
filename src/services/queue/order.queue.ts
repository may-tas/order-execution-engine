import { Queue, QueueOptions } from 'bullmq';
import { config } from '../../config';
import { logger } from '../../utils';
import { OrderJobData } from './types';

// BullMQ connection configuration
export const queueConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // BullMQ handles retries
};

// Queue configuration options
const queueOptions: QueueOptions = {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: config.order.maxRetryAttempts,
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1 second
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Keep for 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
      age: 7 * 24 * 3600, // Keep for 7 days
    },
  },
};

// Create the order processing queue
export const orderQueue = new Queue<OrderJobData>('order-processing', queueOptions);

// Queue event listeners
orderQueue.on('error', (error: Error) => {
  logger.error('Order queue error', { error: error.message });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  void (async () => {
    logger.info('Closing order queue...');
    await orderQueue.close();
  })();
});

process.on('SIGINT', () => {
  void (async () => {
    logger.info('Closing order queue...');
    await orderQueue.close();
  })();
});

logger.info('Order queue initialized', {
  queueName: orderQueue.name,
  maxRetries: config.order.maxRetryAttempts,
});

export default orderQueue;
