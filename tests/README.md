# Test Suite

Tests for the DEX Order Execution Engine.

## Structure

```
tests/
├── integration/     # Service-level tests (no server)
├── e2e/            # API & WebSocket tests (requires server)
```

## Integration Tests

Test services directly without the HTTP layer.

**Files:**

- `database.test.ts` - DB & Redis connectivity
- `dex-router.test.ts` - DEX routing logic
- `queue.test.ts` - Job queue processing
- `order-service.test.ts` - Order management

**Run:**

```bash
pnpm test:all:integration   # all tests
pnpm test:db                # database only
pnpm test:dex               # DEX router
pnpm test:queue             # queue
pnpm test:orders            # order service
```

**Requires:** PostgreSQL + Redis running

## E2E Tests

Test the full system through HTTP/WebSocket.

**Files:**

- `api.test.ts` - HTTP endpoints
- `full-integration.test.ts` - Full flow (100+ orders)
- `realtime-websocket.test.ts` - WebSocket lifecycle
- `websocket-client.test.ts` - WS client behavior

**Run:**

```bash
pnpm test:all:e2e           # all tests (auto-starts server)
pnpm test:api               # API endpoints
pnpm test:integration       # full integration
pnpm test:realtime          # WebSocket real-time
pnpm test:websocket         # WebSocket client
```

**Requires:** PostgreSQL + Redis + server (auto-starts for `test:all:e2e`)

## Quick Commands

```bash
# Integration only
pnpm test:all:integration

# E2E only (starts server automatically with help of script "test-e2e.sh")
pnpm test:all:e2e

# Everything
pnpm test:all
```

## Writing Tests

**Integration test pattern:**

```typescript
import { OrderService } from '../../src/services/orders';
import { logger } from '../../src/utils';

async function testFeature() {
  const service = new OrderService();
  const result = await service.doSomething();
  logger.info('✅ Test passed', { result });
}

testFeature()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

**E2E test pattern:**

```typescript
async function testEndpoint() {
  const response = await fetch('http://localhost:3000/api/endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'test' }),
  });

  const result = await response.json();
  console.log(result.success ? '✅ Passed' : '❌ Failed');
}
```
