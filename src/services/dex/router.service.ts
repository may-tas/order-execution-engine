import { DexType } from '@prisma/client';
import { logger } from '../../utils';
import { DexQuoteRepository } from '../../repositories';
import { IDexProvider, DexQuote, SwapParams, SwapResult } from './types';
import { MockRaydiumProvider } from './raydium.provider';
import { MockMeteoraProvider } from './meteora.provider';

export interface RoutingResult {
  selectedDex: DexType;
  selectedQuote: DexQuote;
  allQuotes: DexQuote[];
  reason: string;
}

/**
 * DEX Router Service
 * Responsible for fetching quotes from multiple DEXs,
 * comparing them, and selecting the best route
 */
export class DexRouterService {
  private readonly providers: IDexProvider[];
  private readonly dexQuoteRepository: DexQuoteRepository;

  constructor() {
    // Initialize DEX providers
    this.providers = [new MockRaydiumProvider(), new MockMeteoraProvider()];

    this.dexQuoteRepository = new DexQuoteRepository();

    logger.info('DexRouterService initialized', {
      providers: this.providers.map((p) => p.getName()),
    });
  }

  /**
   * Get quotes from all DEX providers in parallel
   */
  async getAllQuotes(params: SwapParams): Promise<DexQuote[]> {
    logger.info('Fetching quotes from all DEXs', {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
    });

    try {
      // Fetch quotes from all providers in parallel
      const quotePromises = this.providers.map((provider) =>
        provider.getQuote(params).catch((error) => {
          logger.error(`Failed to get quote from ${provider.getName()}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        })
      );

      const quotes = await Promise.all(quotePromises);

      // Filter out failed quotes
      const validQuotes = quotes.filter((q): q is DexQuote => q !== null);

      logger.info('Quotes fetched successfully', {
        totalProviders: this.providers.length,
        successfulQuotes: validQuotes.length,
        quotes: validQuotes.map((q) => ({
          dex: q.dex,
          price: q.price,
          estimatedOutput: q.estimatedOutput,
          fee: q.fee,
        })),
      });

      return validQuotes;
    } catch (error) {
      logger.error('Error fetching quotes', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Find the best route based on estimated output
   */
  async findBestRoute(params: SwapParams, orderId?: string): Promise<RoutingResult> {
    const quotes = await this.getAllQuotes(params);

    if (quotes.length === 0) {
      throw new Error('No valid quotes available from any DEX');
    }

    // Sort by estimated output (highest first)
    const sortedQuotes = [...quotes].sort((a, b) => b.estimatedOutput - a.estimatedOutput);

    const bestQuote = sortedQuotes[0];
    const secondBestQuote = sortedQuotes[1];

    // Calculate improvement over second best
    let reason = `Best output: ${bestQuote.estimatedOutput.toFixed(6)} ${params.tokenOut}`;

    if (secondBestQuote) {
      const improvement =
        ((bestQuote.estimatedOutput - secondBestQuote.estimatedOutput) /
          secondBestQuote.estimatedOutput) *
        100;
      reason += ` (${improvement.toFixed(2)}% better than ${secondBestQuote.dex})`;
    }

    logger.info('Best route selected', {
      orderId,
      selectedDex: bestQuote.dex,
      selectedPrice: bestQuote.price,
      selectedOutput: bestQuote.estimatedOutput,
      reason,
      comparison: sortedQuotes.map((q, idx) => ({
        rank: idx + 1,
        dex: q.dex,
        price: q.price,
        output: q.estimatedOutput,
        fee: q.fee,
        latency: q.latencyMs,
      })),
    });

    // Persist quote logs if orderId is provided
    if (orderId) {
      await this.persistQuoteLogs(orderId, quotes, bestQuote.dex);
    }

    return {
      selectedDex: bestQuote.dex,
      selectedQuote: bestQuote,
      allQuotes: sortedQuotes,
      reason,
    };
  }

  /**
   * Execute swap on the selected DEX
   */
  async executeSwap(
    params: SwapParams,
    selectedDex: DexType,
    quote: DexQuote
  ): Promise<SwapResult> {
    logger.info('Executing swap', {
      dex: selectedDex,
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
    });

    const provider = this.providers.find((p) => p.getName() === selectedDex);

    if (!provider) {
      throw new Error(`DEX provider not found: ${selectedDex}`);
    }

    try {
      const result = await provider.executeSwap(params, quote);

      logger.info('Swap executed successfully', {
        dex: selectedDex,
        txHash: result.txHash,
        executedPrice: result.executedPrice,
        outputAmount: result.outputAmount,
        executionTimeMs: result.executionTimeMs,
      });

      return result;
    } catch (error) {
      logger.error('Swap execution failed', {
        dex: selectedDex,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get quote comparison for a given swap
   */
  async compareQuotes(params: SwapParams): Promise<{
    quotes: DexQuote[];
    bestDex: DexType;
    priceDifference: number;
  }> {
    const quotes = await this.getAllQuotes(params);

    if (quotes.length < 2) {
      const bestDex = quotes[0]?.dex || DexType.RAYDIUM;
      return {
        quotes,
        bestDex,
        priceDifference: 0,
      };
    }

    const sortedQuotes = [...quotes].sort((a, b) => b.estimatedOutput - a.estimatedOutput);
    const bestQuote = sortedQuotes[0];
    const worstQuote = sortedQuotes[sortedQuotes.length - 1];

    const priceDifference =
      ((bestQuote.estimatedOutput - worstQuote.estimatedOutput) / worstQuote.estimatedOutput) * 100;

    return {
      quotes: sortedQuotes,
      bestDex: bestQuote.dex,
      priceDifference,
    };
  }

  /**
   * Persist quote logs to database
   */
  private async persistQuoteLogs(
    orderId: string,
    quotes: DexQuote[],
    selectedDex: DexType
  ): Promise<void> {
    try {
      const quoteLogs = quotes.map((quote) => ({
        orderId,
        dex: quote.dex,
        price: quote.price,
        fee: quote.fee,
        estimatedOutput: quote.estimatedOutput,
        latencyMs: quote.latencyMs,
        selectedForExecution: quote.dex === selectedDex,
      }));

      await this.dexQuoteRepository.createMany(quoteLogs);

      logger.debug('Quote logs persisted', {
        orderId,
        quoteCount: quoteLogs.length,
      });
    } catch (error) {
      logger.error('Failed to persist quote logs', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - logging failure shouldn't break the flow
    }
  }
}
