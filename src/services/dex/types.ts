import { DexType } from '@prisma/client';

export interface DexQuote {
  dex: DexType;
  price: number;
  fee: number;
  estimatedOutput: number;
  route?: string;
  latencyMs: number;
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage: number;
}

export interface SwapResult {
  txHash: string;
  executedPrice: number;
  inputAmount: number;
  outputAmount: number;
  fee: number;
  actualSlippage: number;
  executionTimeMs: number;
}

export interface IDexProvider {
  /**
   * Get a quote for swapping tokens
   */
  getQuote(params: SwapParams): Promise<DexQuote>;

  /**
   * Execute a swap on the DEX
   */
  executeSwap(params: SwapParams, quote: DexQuote): Promise<SwapResult>;

  /**
   * Get the DEX name
   */
  getName(): DexType;
}
