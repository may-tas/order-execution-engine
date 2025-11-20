import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { OrderService } from '../services/orders';
import { marketOrderSchema } from '../validators';
import { logger } from '../utils';

/**
 * Order Controller
 * Handles HTTP requests for order operations
 */
export class OrderController {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  /**
   * Create and execute a market order
   * POST /api/orders/execute
   */
  async executeOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedInput = marketOrderSchema.parse(request.body);

      logger.info('Executing order request', {
        tokenIn: validatedInput.tokenIn,
        tokenOut: validatedInput.tokenOut,
        amountIn: validatedInput.amountIn,
        ip: request.ip,
      });

      const result = await this.orderService.createMarketOrder(validatedInput);

      return reply.status(201).send({
        success: true,
        data: {
          orderId: result.order.id,
          jobId: result.jobId,
          status: 'PENDING',
          message: 'Order submitted successfully',
        },
      });
    } catch (error) {
      logger.error('Failed to execute order', {
        error: error instanceof Error ? error.message : String(error),
        body: request.body,
      });

      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.issues,
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process order',
        },
      });
    }
  }

  /**
   * Simulate an order without executing
   * POST /api/orders/simulate
   */
  async simulateOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedInput = marketOrderSchema.parse(request.body);

      logger.info('Simulating order request', {
        tokenIn: validatedInput.tokenIn,
        tokenOut: validatedInput.tokenOut,
        amountIn: validatedInput.amountIn,
        ip: request.ip,
      });

      const result = await this.orderService.simulateOrder(validatedInput);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to simulate order', {
        error: error instanceof Error ? error.message : String(error),
        body: request.body,
      });

      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.issues,
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to simulate order',
        },
      });
    }
  }

  /**
   * Get order by ID
   * GET /api/orders/:orderId
   */
  async getOrder(request: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) {
    try {
      const { orderId } = request.params;

      logger.debug('Fetching order', { orderId });

      const order = await this.orderService.getOrderById(orderId);

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Order not found',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: order,
      });
    } catch (error) {
      logger.error('Failed to fetch order', {
        error: error instanceof Error ? error.message : String(error),
        orderId: request.params.orderId,
      });

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch order',
        },
      });
    }
  }

  /**
   * Get order statistics
   * GET /api/orders/stats
   */
  async getOrderStats(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await this.orderService.getOrderStats();

      return reply.status(200).send({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to fetch order stats', {
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch statistics',
        },
      });
    }
  }
}
