/**
 * Test Helpers
 * Common utilities for integration and E2E tests
 */

import { OrderType } from '@prisma/client';

/**
 * Base URL for API tests
 */
export const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

/**
 * WebSocket URL for tests
 */
export const WS_URL = process.env.TEST_WS_URL || 'ws://localhost:3000/ws';

/**
 * Sleep helper for async delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a test UUID (valid format)
 */
export function generateTestUserId(): string {
  return '123e4567-e89b-12d3-a456-426614174000';
}

/**
 * Create a valid test order payload
 */
export function createTestOrderPayload(overrides?: Partial<TestOrderPayload>): TestOrderPayload {
  return {
    type: OrderType.MARKET,
    tokenIn: 'SOL',
    tokenOut: 'USDC',
    amountIn: 1.5,
    slippage: 0.01,
    userId: generateTestUserId(),
    ...overrides,
  };
}

/**
 * Make HTTP request with error handling
 */
export async function makeRequest<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T; status: number }> {
  const response = await fetch(url, options);
  const data = (await response.json()) as T;
  return { data, status: response.status };
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitForCondition(
  conditionFn: () => Promise<boolean> | boolean,
  timeoutMs: number = 10000,
  intervalMs: number = 500
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await conditionFn()) {
      return true;
    }
    await sleep(intervalMs);
  }

  return false;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(delayMs * attempt); // Exponential backoff
      }
    }
  }

  throw lastError;
}

/**
 * Types
 */
export interface TestOrderPayload {
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage: number;
  userId?: string;
}

export interface TestOrderResponse {
  success: boolean;
  data: {
    orderId: string;
    jobId: string;
    status: string;
    message: string;
  };
}

export interface TestOrderDetailsResponse {
  success: boolean;
  data: {
    id: string;
    type: string;
    status: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    slippage: number;
    execution?: {
      txHash: string;
      executedPrice: number;
      outputAmount: number;
      dex: string;
      executionTimeMs: number;
    } | null;
  };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

export interface DetailedHealthResponse {
  status: string;
  uptime: number;
  checks: {
    database: boolean;
    redis: boolean;
    websocket: boolean;
    queue: boolean;
  };
  version: string;
}
