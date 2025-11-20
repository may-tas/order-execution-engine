import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { config } from './config';
import { logger } from './utils';
import { orderRoutes, healthRoutes, websocketRoutes } from './routes';
import { OrderWorker } from './services/queue';

// Create Fastify instance
const fastify = Fastify({
  logger: false, // Use Winston logger instead
  trustProxy: true,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
  bodyLimit: 1048576, // 1MB
});

// Request logging middleware
fastify.addHook('onRequest', (request, _reply, done) => {
  logger.info('Incoming request', {
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  });
  done();
});

// Response time tracking
fastify.addHook('onRequest', (request, _reply, done) => {
  (request as unknown as Record<string, unknown>)['startTime'] = Date.now();
  done();
});

fastify.addHook('onResponse', async (request, reply) => {
  const startTime = (request as unknown as Record<string, unknown>)['startTime'] as number;
  const responseTime = Date.now() - startTime;

  logger.info('Request completed', {
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    responseTime: `${responseTime}ms`,
  });
});

// Error handler
fastify.setErrorHandler((error: Error & { validation?: unknown; statusCode?: number }, request, reply) => {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    method: request.method,
    url: request.url,
  });

  // Validation errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.validation,
      },
    });
  }

  // Rate limit errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    });
  }

  // Generic server errors
  const statusCode = error.statusCode || 500;
  return reply.status(statusCode).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.server.nodeEnv === 'development' ? error.message : 'Internal server error',
    },
  });
});

// Not found handler
fastify.setNotFoundHandler((request, reply) => {
  logger.warn('Route not found', {
    method: request.method,
    url: request.url,
  });

  return reply.status(404).send({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

// Start function
async function start() {
  try {
    // Register WebSocket plugin
    await fastify.register(fastifyWebsocket, {
      options: {
        maxPayload: 1048576, // 1MB
        clientTracking: true,
      },
    });

    // Register routes
    await fastify.register(healthRoutes, { prefix: '/health' });
    await fastify.register(orderRoutes, { prefix: '/api/orders' });
    await fastify.register(websocketRoutes);

    // Initialize order worker
    const worker = new OrderWorker();
    logger.info('Order worker initialized');

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info('Server started', {
      port: config.server.port,
      host: config.server.host,
      environment: config.server.nodeEnv,
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down server...');

      try {
        await worker.close();
        await fastify.close();
        logger.info('Server shut down successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => {
      void shutdown();
    });
    process.on('SIGINT', () => {
      void shutdown();
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Start the server
void start();
