#!/usr/bin/env tsx
/**
 * WebSocket Client Test
 * Connects to WebSocket and listens for order updates in real-time
 */

import WebSocket from 'ws';
import { logger } from './utils';

const WS_URL = 'ws://localhost:3000/ws';

interface OrderUpdateMessage {
  orderId: string;
  status: string;
  message?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

async function testWebSocketClient() {
  logger.info('🔌 WebSocket Client Test\n');

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const receivedUpdates: OrderUpdateMessage[] = [];

    // Connection opened
    ws.on('open', () => {
      logger.info('✅ Connected to WebSocket server');
      logger.info(`   URL: ${WS_URL}\n`);

      // Subscribe to all orders (or specific order)
      const subscribeMessage = {
        type: 'subscribe',
        payload: { orderId: '*' }, // Subscribe to all orders
      };

      ws.send(JSON.stringify(subscribeMessage));
      logger.info('📡 Subscribed to all order updates\n');

      // Now create an order via HTTP to see the updates
      logger.info('📝 Creating test order via HTTP API...\n');
      createTestOrder()
        .then((id) => {
          logger.info(`✅ Order created: ${id}`);
          logger.info('   Waiting for WebSocket updates...\n');
        })
        .catch((error) => {
          logger.error('Failed to create order', { error });
          ws.close();
          reject(error);
        });
    });

    // Receive messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle different message types
        if (message.type === 'connected') {
          logger.info('📨 Server confirmed connection', {
            clientId: message.clientId,
          });
        } else if (message.type === 'subscribed') {
          logger.info('📨 Subscription confirmed', {
            orderId: message.orderId,
          });
        } else if (message.type === 'order-update') {
          const update = message.data as OrderUpdateMessage;
          receivedUpdates.push(update);

          logger.info(`📨 Order Update #${receivedUpdates.length}:`, {
            orderId: update.orderId,
            status: update.status,
            message: update.message,
            metadata: update.metadata,
            timestamp: new Date(update.timestamp).toISOString(),
          });

          // If order is completed or failed, close connection
          if (update.status === 'CONFIRMED' || update.status === 'FAILED') {
            setTimeout(() => {
              logger.info(`\n📊 Summary:`);
              logger.info(`   Total updates received: ${receivedUpdates.length}`);
              logger.info(`   Order ID: ${update.orderId}`);
              logger.info(`   Final status: ${update.status}`);
              logger.info(`   State transitions:`);
              receivedUpdates.forEach((u, idx) => {
                logger.info(`      ${idx + 1}. ${u.status} - ${u.message || 'No message'}`);
              });

              if (update.status === 'CONFIRMED' && update.metadata) {
                logger.info(`\n   ✅ Execution details:`);
                logger.info(`      TX Hash: ${update.metadata.txHash || 'N/A'}`);
                logger.info(`      Output: ${update.metadata.outputAmount || 'N/A'}`);
                logger.info(`      Price: ${update.metadata.executedPrice || 'N/A'}`);
                logger.info(`      DEX: ${update.metadata.dex || 'N/A'}`);
              }

              ws.close();
              resolve();
            }, 1000);
          }
        } else if (message.type === 'error') {
          logger.error('❌ Server error', { error: message.error });
        } else {
          logger.info('📨 Unknown message type', { message });
        }
      } catch (error) {
        logger.error('Failed to parse message', {
          error: error instanceof Error ? error.message : String(error),
          data: data.toString(),
        });
      }
    });

    // Connection closed
    ws.on('close', (code: number, reason: Buffer) => {
      logger.info(`\n🔌 WebSocket connection closed`, {
        code,
        reason: reason.toString() || 'No reason provided',
      });
    });

    // Connection error
    ws.on('error', (error: Error) => {
      logger.error('❌ WebSocket error', {
        error: error.message,
      });
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        logger.warn('\n⏰ Test timeout after 30 seconds');
        ws.close();
        resolve();
      }
    }, 30000);
  });
}

/**
 * Create a test order via HTTP API
 */
async function createTestOrder(): Promise<string> {
  const response = await fetch('http://localhost:3000/api/orders/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'MARKET',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 1.5,
      slippage: 0.01,
      userId: '123e4567-e89b-12d3-a456-426614174000',
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { data: { orderId: string } };
  return data.data.orderId;
}

// Run test
if (require.main === module) {
  testWebSocketClient()
    .then(() => {
      logger.info('\n✅ WebSocket client test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('WebSocket client test failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    });
}

export { testWebSocketClient };
