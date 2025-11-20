import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/order_execution_db',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10', 10),
    rateLimit: parseInt(process.env.QUEUE_RATE_LIMIT || '100', 10),
  },
  order: {
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
    executionTimeoutMs: parseInt(process.env.EXECUTION_TIMEOUT_MS || '30000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  dex: {
    mockExecutionDelayMs: parseInt(process.env.MOCK_EXECUTION_DELAY_MS || '2500', 10),
    raydiumFee: parseFloat(process.env.RAYDIUM_FEE || '0.003'),
    meteoraFee: parseFloat(process.env.METEORA_FEE || '0.002'),
  },
} as const;
