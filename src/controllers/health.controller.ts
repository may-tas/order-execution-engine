import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../repositories/database';
import { redis } from '../repositories/redis';
import { wsManager } from '../services/websocket';
import { OrderQueueService } from '../services/queue';
import { logger } from '../utils';

/**
 * Health Controller
 * Handles health check and system status endpoints
 */
export class HealthController {
  private queueService: OrderQueueService;

  constructor() {
    this.queueService = new OrderQueueService();
  }

  /**
   * Basic health check
   * GET /health
   */
  async healthCheck(_request: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  /**
   * Detailed system status
   * GET /health/status
   */
  async detailedStatus(_request: FastifyRequest, reply: FastifyReply) {
    const checks = {
      database: false,
      redis: false,
      websocket: false,
      queue: false,
    };

    try {
      // Check database connection
      try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = true;
      } catch (error) {
        logger.error('Database health check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Check Redis connection
      try {
        await redis.ping();
        checks.redis = true;
      } catch (error) {
        logger.error('Redis health check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Check WebSocket manager
      try {
        wsManager.getStats();
        checks.websocket = true;
      } catch (error) {
        logger.error('WebSocket health check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Check queue service
      try {
        await this.queueService.getQueueStats();
        checks.queue = true;
      } catch (error) {
        logger.error('Queue health check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const allHealthy = Object.values(checks).every((check) => check === true);
      const status = allHealthy ? 'healthy' : 'degraded';

      return reply.status(allHealthy ? 200 : 503).send({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks,
        version: process.env.npm_package_version || '1.0.0',
      });
    } catch (error) {
      logger.error('Health status check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Failed to perform health checks',
      });
    }
  }

  /**
   * WebSocket statistics
   * GET /health/websocket
   */
  async websocketStats(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = wsManager.getStats();

      return reply.status(200).send({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to fetch WebSocket stats', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch WebSocket statistics',
      });
    }
  }

  /**
   * Queue statistics
   * GET /health/queue
   */
  async queueStats(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await this.queueService.getQueueStats();

      return reply.status(200).send({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to fetch queue stats', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch queue statistics',
      });
    }
  }
}
