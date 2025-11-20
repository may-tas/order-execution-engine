import { DexType } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../utils';
import { IDexProvider, DexQuote, SwapParams, SwapResult } from './types';

/**
 * Mock implementation of Raydium DEX
 * Simulates network delays and realistic price variations
 */
export class MockRaydiumProvider implements IDexProvider {
  private readonly fee = config.dex.raydiumFee; // 0.3% default
  private readonly quoteDelayMs = 200; // Network delay for quote
  private readonly executeDelayMs = 2500; // Transaction execution time

  getName(): DexType {
    return DexType.RAYDIUM;
  }

  async getQuote(params: SwapParams): Promise<DexQuote> {
    const startTime = Date.now();

    // Simulate network delay
    await this.sleep(this.quoteDelayMs);

    // Calculate base price with some variance (-2% to +2%)
    const basePrice = this.calculateBasePrice(params.tokenIn, params.tokenOut);
    const variance = -0.02 + Math.random() * 0.04; // -2% to +2%
    const price = basePrice * (1 + variance);

    // Calculate estimated output after fees
    const estimatedOutput = params.amountIn * price * (1 - this.fee);

    const latencyMs = Date.now() - startTime;

    logger.debug('Raydium quote generated', {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      price,
      estimatedOutput,
      fee: this.fee,
      latencyMs,
    });

    return {
      dex: DexType.RAYDIUM,
      price,
      fee: this.fee,
      estimatedOutput,
      route: `${params.tokenIn} -> RAYDIUM_POOL -> ${params.tokenOut}`,
      latencyMs,
    };
  }

  async executeSwap(params: SwapParams, quote: DexQuote): Promise<SwapResult> {
    const startTime = Date.now();

    // Simulate transaction execution time
    await this.sleep(this.executeDelayMs);

    // Simulate slight price slippage during execution
    const executionSlippage = Math.random() * 0.005; // 0-0.5% additional slippage
    const actualPrice = quote.price * (1 - executionSlippage);
    const outputAmount = params.amountIn * actualPrice * (1 - this.fee);

    // Calculate actual slippage
    const expectedOutput = quote.estimatedOutput;
    const actualSlippage = (expectedOutput - outputAmount) / expectedOutput;

    // Generate mock transaction hash
    const txHash = this.generateMockTxHash();

    const executionTimeMs = Date.now() - startTime;

    logger.info('Raydium swap executed', {
      txHash,
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      inputAmount: params.amountIn,
      outputAmount,
      executedPrice: actualPrice,
      actualSlippage,
      executionTimeMs,
    });

    return {
      txHash,
      executedPrice: actualPrice,
      inputAmount: params.amountIn,
      outputAmount,
      fee: this.fee,
      actualSlippage,
      executionTimeMs,
    };
  }

  private calculateBasePrice(tokenIn: string, tokenOut: string): number {
    // Mock base prices for common pairs
    const pairs: Record<string, number> = {
      'SOL-USDC': 100.0,
      'SOL-USDT': 99.8,
      'USDC-USDT': 0.999,
      'SOL-RAY': 5.0,
      'RAY-USDC': 20.0,
    };

    const pairKey = `${tokenIn}-${tokenOut}`;
    const reversePairKey = `${tokenOut}-${tokenIn}`;

    if (pairs[pairKey]) {
      return pairs[pairKey];
    } else if (pairs[reversePairKey]) {
      return 1 / pairs[reversePairKey];
    }

    // Default fallback
    return 1.0;
  }

  private generateMockTxHash(): string {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let hash = '';
    for (let i = 0; i < 88; i++) {
      hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
