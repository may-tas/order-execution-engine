import { prisma, redis, redisCache } from '../../src/repositories';
import { OrderType } from '@prisma/client';
import { logger } from '../../src/utils';

async function verifyDatabaseLayer() {
  logger.info('🔍 Verifying Database Layer Setup...\n');

  try {
    // Test PostgreSQL connection
    logger.info('1. Testing PostgreSQL connection...');
    await prisma.$queryRaw`SELECT 1`;
    logger.info('   ✅ PostgreSQL connected\n');

    // Test Redis connection
    logger.info('2. Testing Redis connection...');
    await redis.ping();
    logger.info('   ✅ Redis connected\n');

    // Test Order creation
    logger.info('3. Testing Order creation...');
    const testOrder = await prisma.order.create({
      data: {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 1.0,
        slippage: 0.01,
      },
    });
    logger.info('   ✅ Order created:', testOrder.id);

    // Test Redis cache
    logger.info('4. Testing Redis cache...');
    await redisCache.setOrder(testOrder.id, testOrder);
    const cachedOrder = await redisCache.getOrder(testOrder.id);
    if (!cachedOrder) throw new Error('Cache retrieval failed');
    logger.info('   ✅ Order cached and retrieved\n');

    // Cleanup
    logger.info('5. Cleaning up test data...');
    await prisma.order.delete({ where: { id: testOrder.id } });
    await redisCache.deleteOrder(testOrder.id);
    logger.info('   ✅ Test data cleaned up\n');

    logger.info('✅ All database layer tests passed!\n');
  } catch (error) {
    console.error('❌ Database layer verification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await redis.quit();
  }
}

verifyDatabaseLayer()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
