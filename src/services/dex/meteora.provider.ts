import { DexType } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../utils';
import { IDexProvider, DexQuote, SwapParams, SwapResult } from './types';

/**
 * Mock implementation of Meteora DEX
 * Simulates network delays and realistic price variations
 */
export class MockMeteoraProvider implements IDexProvider {
  private readonly fee = config.dex.meteoraFee; // 0.2% default (lower than Raydium)
  private readonly quoteDelayMs = 250; // Slightly slower network delay
  private readonly executeDelayMs = 2800; // Slightly slower execution

  getName(): DexType {
    return DexType.METEORA;
  }

  async getQuote(params: SwapParams): Promise<DexQuote> {
    const startTime = Date.now();

    // Simulate network delay
    await this.sleep(this.quoteDelayMs);

    // Calculate base price with different variance (-3% to +3%)
    const basePrice = this.calculateBasePrice(params.tokenIn, params.tokenOut);
    const variance = -0.03 + Math.random() * 0.06; // -3% to +3%
    const price = basePrice * (1 + variance);

    // Calculate estimated output after fees
    const estimatedOutput = params.amountIn * price * (1 - this.fee);

    const latencyMs = Date.now() - startTime;

    logger.debug('Meteora quote generated', {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      price,
      estimatedOutput,
      fee: this.fee,
      latencyMs,
    });

    return {
      dex: DexType.METEORA,
      price,
      fee: this.fee,
      estimatedOutput,
      route: `${params.tokenIn} -> METEORA_POOL -> ${params.tokenOut}`,
      latencyMs,
    };
  }

  async executeSwap(params: SwapParams, quote: DexQuote): Promise<SwapResult> {
    const startTime = Date.now();

    // Simulate transaction execution time
    await this.sleep(this.executeDelayMs);

    // Simulate slight price slippage during execution
    const executionSlippage = Math.random() * 0.004; // 0-0.4% additional slippage
    const actualPrice = quote.price * (1 - executionSlippage);
    const outputAmount = params.amountIn * actualPrice * (1 - this.fee);

    // Calculate actual slippage
    const expectedOutput = quote.estimatedOutput;
    const actualSlippage = (expectedOutput - outputAmount) / expectedOutput;

    // Generate mock transaction hash
    const txHash = this.generateMockTxHash();

    const executionTimeMs = Date.now() - startTime;

    logger.info('Meteora swap executed', {
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
    // Mock base prices for common pairs (slightly different from Raydium)
    const pairs: Record<string, number> = {
      'SOL-USDC': 100.5,
      'SOL-USDT': 100.2,
      'USDC-USDT': 1.001,
      'SOL-RAY': 5.1,
      'RAY-USDC': 19.8,
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
