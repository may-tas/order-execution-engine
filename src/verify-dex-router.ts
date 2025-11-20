import { DexRouterService } from './services/dex';
import { logger } from './utils';

async function verifyDexRouter() {
  logger.info('🔍 Verifying DEX Router Service...\n');

  try {
    const router = new DexRouterService();

    // Test swap parameters
    const swapParams = {
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 10,
      slippage: 0.01,
    };

    logger.info('1. Testing quote fetching from all DEXs...');
    const quotes = await router.getAllQuotes(swapParams);
    logger.info(`✅ Received ${quotes.length} quotes`, {
      quotes: quotes.map((q) => ({
        dex: q.dex,
        price: q.price.toFixed(4),
        output: q.estimatedOutput.toFixed(4),
        fee: `${(q.fee * 100).toFixed(2)}%`,
        latency: `${q.latencyMs}ms`,
      })),
    });

    logger.info('\n2. Testing best route selection...');
    const routingResult = await router.findBestRoute(swapParams);
    logger.info('✅ Best route selected', {
      selectedDex: routingResult.selectedDex,
      reason: routingResult.reason,
      estimatedOutput: routingResult.selectedQuote.estimatedOutput.toFixed(6),
    });

    logger.info('\n3. Testing quote comparison...');
    const comparison = await router.compareQuotes(swapParams);
    logger.info('✅ Quote comparison completed', {
      bestDex: comparison.bestDex,
      priceDifference: `${comparison.priceDifference.toFixed(2)}%`,
      totalQuotes: comparison.quotes.length,
    });

    logger.info('\n4. Testing swap execution...');
    const swapResult = await router.executeSwap(
      swapParams,
      routingResult.selectedDex,
      routingResult.selectedQuote
    );
    logger.info('✅ Swap executed successfully', {
      txHash: swapResult.txHash.substring(0, 16) + '...',
      executedPrice: swapResult.executedPrice.toFixed(4),
      outputAmount: swapResult.outputAmount.toFixed(6),
      actualSlippage: `${(swapResult.actualSlippage * 100).toFixed(3)}%`,
      executionTime: `${swapResult.executionTimeMs}ms`,
    });

    logger.info('\n✅ All DEX Router tests passed!\n');
    logger.info('DEX Router is ready for Step 4! 🚀\n');
  } catch (error) {
    logger.error('❌ DEX Router verification failed:', error);
    throw error;
  }
}

verifyDexRouter()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Verification failed:', error);
    process.exit(1);
  });
