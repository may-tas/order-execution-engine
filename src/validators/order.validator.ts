import { z } from 'zod';
import { OrderType } from '@prisma/client';

/**
 * Create Order Request Schema
 */
export const createOrderSchema = z.object({
  type: z.nativeEnum(OrderType, {
    message: 'Order type must be MARKET, LIMIT, or SNIPER',
  }),
  tokenIn: z
    .string()
    .min(1, 'Token In is required')
    .max(50, 'Token In must be less than 50 characters')
    .regex(/^[A-Z0-9]+$/, 'Token In must contain only uppercase letters and numbers'),
  tokenOut: z
    .string()
    .min(1, 'Token Out is required')
    .max(50, 'Token Out must be less than 50 characters')
    .regex(/^[A-Z0-9]+$/, 'Token Out must contain only uppercase letters and numbers'),
  amountIn: z
    .number()
    .positive('Amount In must be greater than 0')
    .finite('Amount In must be a finite number')
    .max(1000000000, 'Amount In is too large'),
  slippage: z
    .number()
    .min(0.0001, 'Slippage must be at least 0.01%')
    .max(0.5, 'Slippage cannot exceed 50%')
    .optional()
    .default(0.01),
  userId: z.string().uuid().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Market Order specific validation
 */
export const marketOrderSchema = createOrderSchema.extend({
  type: z.literal(OrderType.MARKET),
});

export type MarketOrderInput = z.infer<typeof marketOrderSchema>;

/**
 * Order ID parameter schema
 */
export const orderIdSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
});

export type OrderIdParam = z.infer<typeof orderIdSchema>;

/**
 * Order Status Query Schema
 */
export const orderStatusQuerySchema = z.object({
  status: z.enum(['PENDING', 'ROUTING', 'BUILDING', 'SUBMITTED', 'CONFIRMED', 'FAILED']).optional(),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .pipe(z.number().int().positive().max(100))
    .optional()
    .default(10),
  offset: z
    .string()
    .regex(/^\d+$/, 'Offset must be a number')
    .transform(Number)
    .pipe(z.number().int().min(0))
    .optional()
    .default(0),
});

export type OrderStatusQuery = z.infer<typeof orderStatusQuerySchema>;

/**
 * Token Pair Validation Schema
 */
export const tokenPairSchema = z.object({
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
});

export type TokenPair = z.infer<typeof tokenPairSchema>;

/**
 * Order Response DTO
 */
export const orderResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(OrderType),
  tokenIn: z.string(),
  tokenOut: z.string(),
  amountIn: z.number(),
  slippage: z.number(),
  status: z.enum(['PENDING', 'ROUTING', 'BUILDING', 'SUBMITTED', 'CONFIRMED', 'FAILED']),
  userId: z.string().uuid().nullable(),
  retryCount: z.number().int().min(0),
  failureReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type OrderResponse = z.infer<typeof orderResponseSchema>;

/**
 * Order Execution Result DTO
 */
export const orderExecutionResultSchema = z.object({
  orderId: z.string().uuid(),
  success: z.boolean(),
  status: z.enum(['PENDING', 'ROUTING', 'BUILDING', 'SUBMITTED', 'CONFIRMED', 'FAILED']),
  txHash: z.string().optional(),
  executedPrice: z.number().optional(),
  outputAmount: z.number().optional(),
  dex: z.enum(['RAYDIUM', 'METEORA']).optional(),
  error: z.string().optional(),
  executionTimeMs: z.number().int().optional(),
});

export type OrderExecutionResult = z.infer<typeof orderExecutionResultSchema>;

/**
 * Validation helper function
 */
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe validation helper (returns errors instead of throwing)
 */
export function safeValidateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
