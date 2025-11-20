import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from '../config';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: config.database.url,
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Create Prisma Client with adapter
export const prisma = new PrismaClient({
  adapter,
  log: config.server.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', () => {
  void (async () => {
    await prisma.$disconnect();
    await pool.end();
  })();
});
