-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ROUTING', 'BUILDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT', 'SNIPER');

-- CreateEnum
CREATE TYPE "DexType" AS ENUM ('RAYDIUM', 'METEORA');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "tokenIn" TEXT NOT NULL,
    "tokenOut" TEXT NOT NULL,
    "amountIn" DOUBLE PRECISION NOT NULL,
    "slippage" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExecution" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dex" "DexType" NOT NULL,
    "txHash" TEXT NOT NULL,
    "executedPrice" DOUBLE PRECISION NOT NULL,
    "executedAmount" DOUBLE PRECISION NOT NULL,
    "inputAmount" DOUBLE PRECISION NOT NULL,
    "outputAmount" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "slippage" DOUBLE PRECISION NOT NULL,
    "executionTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DexQuoteLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dex" "DexType" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "estimatedOutput" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "selectedForExecution" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DexQuoteLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_createdAt_idx" ON "OrderStatusHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderExecution_orderId_key" ON "OrderExecution"("orderId");

-- CreateIndex
CREATE INDEX "OrderExecution_txHash_idx" ON "OrderExecution"("txHash");

-- CreateIndex
CREATE INDEX "OrderExecution_dex_idx" ON "OrderExecution"("dex");

-- CreateIndex
CREATE INDEX "OrderExecution_createdAt_idx" ON "OrderExecution"("createdAt");

-- CreateIndex
CREATE INDEX "DexQuoteLog_orderId_idx" ON "DexQuoteLog"("orderId");

-- CreateIndex
CREATE INDEX "DexQuoteLog_createdAt_idx" ON "DexQuoteLog"("createdAt");

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExecution" ADD CONSTRAINT "OrderExecution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
