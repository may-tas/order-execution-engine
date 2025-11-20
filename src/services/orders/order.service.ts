import { Order, OrderType, OrderStatus } from '@prisma/client';
import { logger } from '../../utils';
import { OrderRepository } from '../../repositories';
import { OrderQueueService } from '../queue';
import { DexRouterService } from '../dex';
import {
  MarketOrderInput,
  OrderExecutionResult,
  createOrderSchema,
  marketOrderSchema,
} from '../../validators';

/**
 * Order Service
 * Handles order creation, validation, and orchestration
 */
export class OrderService {
  private orderRepository: OrderRepository;
  private queueService: OrderQueueService;
  private dexRouter: DexRouterService;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.queueService = new OrderQueueService();
    this.dexRouter = new DexRouterService();
  }

  /**
   * Create and submit a market order
   */
  async createMarketOrder(input: unknown): Promise<{
    order: Order;
    jobId: string;
    estimatedOutput?: number;
  }> {
    try {
      // Validate input
      const validatedInput = marketOrderSchema.parse(input);

      logger.info('Creating market order', {
        tokenIn: validatedInput.tokenIn,
        tokenOut: validatedInput.tokenOut,
        amountIn: validatedInput.amountIn,
      });

      // Simulate transaction to get estimated output
      const simulation = await this.simulateOrder(validatedInput);

      if (!simulation.success) {
        throw new Error(`Order simulation failed: ${simulation.error}`);
      }

      logger.info('Order simulation successful', {
        estimatedOutput: simulation.estimatedOutput,
        selectedDex: simulation.selectedDex,
      });

      // Create order and add to queue
      const { orderId, jobId } = await this.queueService.addOrder({
        type: validatedInput.type,
        tokenIn: validatedInput.tokenIn,
        tokenOut: validatedInput.tokenOut,
        amountIn: validatedInput.amountIn,
        slippage: validatedInput.slippage ?? 0.01,
        userId: validatedInput.userId,
      });

      // Fetch created order
      const order = await this.orderRepository.findById(orderId);

      if (!order) {
        throw new Error('Failed to retrieve created order');
      }

      logger.info('Market order created and queued', {
        orderId,
        jobId,
        estimatedOutput: simulation.estimatedOutput,
      });

      return {
        order,
        jobId,
        estimatedOutput: simulation.estimatedOutput,
      };
    } catch (error) {
      logger.error('Failed to create market order', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create any order type (extensible for LIMIT and SNIPER)
   */
  async createOrder(input: unknown): Promise<{
    order: Order;
    jobId: string;
  }> {
    try {
      // Validate input
      const validatedInput = createOrderSchema.parse(input);

      // Route to specific order handler based on type
      switch (validatedInput.type) {
        case OrderType.MARKET:
          return await this.createMarketOrder(validatedInput);

        case OrderType.LIMIT:
          throw new Error('LIMIT orders not yet implemented');

        case OrderType.SNIPER:
          throw new Error('SNIPER orders not yet implemented');

        default:
          throw new Error(`Unsupported order type: ${validatedInput.type}`);
      }
    } catch (error) {
      logger.error('Failed to create order', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Simulate order execution (get quotes and estimate output)
   */
  async simulateOrder(input: MarketOrderInput): Promise<{
    success: boolean;
    estimatedOutput?: number;
    selectedDex?: string;
    error?: string;
  }> {
    try {
      logger.info('Simulating order execution', {
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
        amountIn: input.amountIn,
      });

      // Get quotes from all DEXs
      const quotes = await this.dexRouter.getAllQuotes({
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
        amountIn: input.amountIn,
        slippage: input.slippage ?? 0.01,
      });

      if (quotes.length === 0) {
        return {
          success: false,
          error: 'No valid quotes available from any DEX',
        };
      }

      // Find best quote
      const bestQuote = quotes.reduce((best, current) =>
        current.estimatedOutput > best.estimatedOutput ? current : best
      );

      logger.info('Order simulation completed', {
        estimatedOutput: bestQuote.estimatedOutput,
        selectedDex: bestQuote.dex,
        totalQuotes: quotes.length,
      });

      return {
        success: true,
        estimatedOutput: bestQuote.estimatedOutput,
        selectedDex: bestQuote.dex,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Order simulation failed', { error: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get order by ID with full details
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      return await this.orderRepository.findById(orderId);
    } catch (error) {
      logger.error('Failed to get order', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get order execution result
   */
  async getOrderExecutionResult(orderId: string): Promise<OrderExecutionResult | null> {
    try {
      const order = await this.orderRepository.findById(orderId);

      if (!order) {
        return null;
      }

      const result: OrderExecutionResult = {
        orderId: order.id,
        success: order.status === OrderStatus.CONFIRMED,
        status: order.status,
      };

      // Add execution details if order is confirmed
      if (order.execution) {
        result.txHash = order.execution.txHash;
        result.executedPrice = order.execution.executedPrice;
        result.outputAmount = order.execution.outputAmount;
        result.dex = order.execution.dex;
        result.executionTimeMs = order.execution.executionTimeMs;
      }

      // Add error if order failed
      if (order.status === OrderStatus.FAILED && order.failureReason) {
        result.error = order.failureReason;
      }

      return result;
    } catch (error) {
      logger.error('Failed to get order execution result', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(status: OrderStatus, limit: number = 10): Promise<Order[]> {
    try {
      return await this.orderRepository.getOrdersByStatus(status, limit);
    } catch (error) {
      logger.error('Failed to get orders by status', {
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get order statistics
   */
  async getOrderStats(): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    failed: number;
  }> {
    try {
      return await this.orderRepository.getOrderStats();
    } catch (error) {
      logger.error('Failed to get order stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Cancel pending order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const order = await this.orderRepository.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // Can only cancel pending orders
      if (order.status !== OrderStatus.PENDING) {
        throw new Error(`Cannot cancel order with status: ${order.status}`);
      }

      // Remove from queue
      const jobId = `order-${orderId}`;
      const removed = await this.queueService.removeJob(jobId);

      if (removed) {
        // Mark as failed in database
        await this.orderRepository.markAsFailed(orderId, 'Order cancelled by user');

        logger.info('Order cancelled', { orderId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to cancel order', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Retry failed order
   */
  async retryOrder(orderId: string): Promise<{ jobId: string }> {
    try {
      const order = await this.orderRepository.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // Can only retry failed orders
      if (order.status !== OrderStatus.FAILED) {
        throw new Error(`Cannot retry order with status: ${order.status}`);
      }

      // Reset order status
      await this.orderRepository.updateStatus({
        orderId,
        status: OrderStatus.PENDING,
        message: 'Order retried manually',
      });

      // Add back to queue
      const { jobId } = await this.queueService.addOrder({
        type: order.type,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amountIn: order.amountIn,
        slippage: order.slippage,
        userId: order.userId ?? undefined,
      });

      logger.info('Order retried', { orderId, jobId });

      return { jobId };
    } catch (error) {
      logger.error('Failed to retry order', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
