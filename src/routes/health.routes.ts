import { FastifyInstance } from 'fastify';
import { HealthController } from '../controllers';

export async function healthRoutes(fastify: FastifyInstance) {
  const healthController = new HealthController();

  // Basic health check
  fastify.get('/', healthController.healthCheck.bind(healthController));

  // Detailed status
  fastify.get('/status', healthController.detailedStatus.bind(healthController));

  // WebSocket statistics
  fastify.get('/websocket', healthController.websocketStats.bind(healthController));

  // Queue statistics
  fastify.get('/queue', healthController.queueStats.bind(healthController));
}
