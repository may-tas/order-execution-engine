import { prisma, redis, redisCache } from './repositories';
import { OrderType } from '@prisma/client';

async function verifyDatabaseLayer() {
  console.log('🔍 Verifying Database Layer Setup...\n');

  try {
    // Test PostgreSQL connection
    console.log('1. Testing PostgreSQL connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('   ✅ PostgreSQL connected\n');

    // Test Redis connection
    console.log('2. Testing Redis connection...');
    await redis.ping();
    console.log('   ✅ Redis connected\n');

    // Test Order creation
    console.log('3. Testing Order creation...');
    const testOrder = await prisma.order.create({
      data: {
        type: OrderType.MARKET,
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amountIn: 1.0,
        slippage: 0.01,
      },
    });
    console.log('   ✅ Order created:', testOrder.id);

    // Test Redis cache
    console.log('4. Testing Redis cache...');
    await redisCache.setOrder(testOrder.id, testOrder);
    const cachedOrder = await redisCache.getOrder(testOrder.id);
    if (!cachedOrder) throw new Error('Cache retrieval failed');
    console.log('   ✅ Order cached and retrieved\n');

    // Cleanup
    console.log('5. Cleaning up test data...');
    await prisma.order.delete({ where: { id: testOrder.id } });
    await redisCache.deleteOrder(testOrder.id);
    console.log('   ✅ Test data cleaned up\n');

    console.log('✅ All database layer tests passed!\n');
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
    console.log('Database layer is ready for Step 3! 🚀');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
