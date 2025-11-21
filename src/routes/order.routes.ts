import { FastifyInstance } from 'fastify';
import { OrderController } from '../controllers';

export function orderRoutes(fastify: FastifyInstance) {
  const orderController = new OrderController();

  // Execute market order
  fastify.post(
    '/execute',
    {
      schema: {
        description: 'Execute a market order',
        tags: ['orders'],
        body: {
          type: 'object',
          required: ['type', 'tokenIn', 'tokenOut', 'amountIn'],
          properties: {
            type: { type: 'string', enum: ['MARKET'] },
            tokenIn: { type: 'string' },
            tokenOut: { type: 'string' },
            amountIn: { type: 'number' },
            slippage: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
        response: {
          201: {
            description: 'Order created successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  orderId: { type: 'string' },
                  jobId: { type: 'string' },
                  status: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    orderController.executeOrder.bind(orderController)
  );

  // Simulate order
  fastify.post(
    '/simulate',
    {
      schema: {
        description: 'Simulate an order without executing',
        tags: ['orders'],
        body: {
          type: 'object',
          required: ['tokenIn', 'tokenOut', 'amountIn'],
          properties: {
            tokenIn: { type: 'string' },
            tokenOut: { type: 'string' },
            amountIn: { type: 'number' },
            slippage: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
    },
    orderController.simulateOrder.bind(orderController)
  );

  // Get order statistics (must be before /:orderId to avoid route conflict)
  fastify.get('/stats', orderController.getOrderStats.bind(orderController));

  // Get order by ID
  fastify.get(
    '/:orderId',
    {
      schema: {
        description: 'Get order by ID',
        tags: ['orders'],
        params: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
          },
        },
      },
    },
    orderController.getOrder.bind(orderController)
  );
}
