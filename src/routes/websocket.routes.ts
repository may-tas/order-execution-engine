import { FastifyInstance } from 'fastify';
import { wsManager } from '../services/websocket';
import { logger } from '../utils';

export async function websocketRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/ws',
    { websocket: true },
    (connection, request) => {
      logger.info('WebSocket connection request', {
        ip: request.ip,
        headers: request.headers,
      });

      try {
        wsManager.handleConnection(connection, request);
      } catch (error) {
        logger.error('Failed to handle WebSocket connection', {
          error: error instanceof Error ? error.message : String(error),
          ip: request.ip,
        });
      }
    }
  );
}
