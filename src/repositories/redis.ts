import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  // Connection success is logged in logger
});

redis.on('error', (err) => {
  // Redis errors are handled by logger
  void err;
});

// Graceful shutdown
process.on('beforeExit', () => {
  void redis.quit();
});

// Helper functions for order caching
export class RedisCache {
  private readonly ORDER_PREFIX = 'order:';
  private readonly ORDER_STATUS_PREFIX = 'order:status:';
  private readonly ACTIVE_ORDERS_SET = 'active:orders';
  private readonly DEFAULT_TTL = 3600; // 1 hour

  async setOrder(orderId: string, orderData: unknown): Promise<void> {
    const key = `${this.ORDER_PREFIX}${orderId}`;
    await redis.setex(key, this.DEFAULT_TTL, JSON.stringify(orderData));
    await redis.sadd(this.ACTIVE_ORDERS_SET, orderId);
  }

  async getOrder<T>(orderId: string): Promise<T | null> {
    const key = `${this.ORDER_PREFIX}${orderId}`;
    const data = await redis.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async deleteOrder(orderId: string): Promise<void> {
    const key = `${this.ORDER_PREFIX}${orderId}`;
    await redis.del(key);
    await redis.srem(this.ACTIVE_ORDERS_SET, orderId);
  }

  async setOrderStatus(orderId: string, status: string): Promise<void> {
    const key = `${this.ORDER_STATUS_PREFIX}${orderId}`;
    await redis.setex(key, this.DEFAULT_TTL, status);
  }

  async getOrderStatus(orderId: string): Promise<string | null> {
    const key = `${this.ORDER_STATUS_PREFIX}${orderId}`;
    return redis.get(key);
  }

  async getActiveOrders(): Promise<string[]> {
    return redis.smembers(this.ACTIVE_ORDERS_SET);
  }

  async getActiveOrdersCount(): Promise<number> {
    return redis.scard(this.ACTIVE_ORDERS_SET);
  }

  async clearActiveOrders(): Promise<void> {
    const orders = await this.getActiveOrders();
    if (orders.length > 0) {
      const pipeline = redis.pipeline();
      for (const orderId of orders) {
        pipeline.del(`${this.ORDER_PREFIX}${orderId}`);
        pipeline.del(`${this.ORDER_STATUS_PREFIX}${orderId}`);
      }
      pipeline.del(this.ACTIVE_ORDERS_SET);
      await pipeline.exec();
    }
  }

  // Rate limiting helper
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    return current <= limit;
  }

  // Lock helper for distributed locking
  async acquireLock(lockKey: string, ttlSeconds: number = 10): Promise<boolean> {
    const result = await redis.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(lockKey: string): Promise<void> {
    await redis.del(lockKey);
  }
}

export const redisCache = new RedisCache();
