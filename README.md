# DEX Order Execution Engine

High-performance order execution engine with multi-DEX routing and real-time WebSocket updates for Solana. Uses mock DEX implementation with realistic delays and price variations.

**🌐 Live API:** `https://order-execution-engine-production-f800.up.railway.app` | **📮 Postman:** [Collection](https://www.postman.com/satyamj210/workspace/dex-order-engine/collection/37895746-d3c674dc-5ba4-42bc-9707-a731e0b7b865?action=share&creator=37895746&active-environment=37895746-bb4e7e1a-8676-48af-b100-bf41a1d1dd86) | **📺 Demo:** [Youtube](https://www.youtube.com/watch?v=nh5-0HXAovE)

---

## 🛠️ Tech Stack

| Category        | Technologies                           |
| --------------- | -------------------------------------- |
| **Backend**     | Node.js, TypeScript, Fastify           |
| **Database**    | PostgreSQL (Prisma ORM), Redis         |
| **Queue**       | BullMQ                                 |
| **WebSocket**   | @fastify/websocket                     |
| **Validation**  | Zod                                    |
| **Testing**     | Integration & E2E tests                |
| **Dev Tooling** | Docker Compose, ESLint, Winston Logger |

---

## 🏗️ Architecture

**Clean Architecture + Repository Pattern**

```
┌─────────────────┐
│   HTTP/WS API   │  ← Fastify routes
├─────────────────┤
│  Controllers    │  ← Request handlers
├─────────────────┤
│   Services      │  ← Business logic (DEX, Orders, Queue, WebSocket)
├─────────────────┤
│  Repositories   │  ← Data access (Database, Redis)
├─────────────────┤
│ PostgreSQL/Redis│  ← Persistent storage
└─────────────────┘
```

**Order Processing Flow:**

```
API Request → Validation → Queue (BullMQ) → Worker → DEX Router → Execution → WebSocket Broadcast
```

**Implementation:** Mock DEX providers (Option B) - simulates Raydium/Meteora with realistic delays (2-3s) and price variations (~2-5%). Focus on architecture and flow rather than real devnet execution.

---

## 📁 Project Structure

```
src/
├── server.ts                # Main entry point
├── config/                  # Environment config
├── controllers/             # Request handlers (health, orders)
├── routes/                  # API route definitions
├── services/
│   ├── dex/                # DEX providers (Raydium, Meteora) + routing
│   ├── orders/             # Order management & lifecycle
│   ├── queue/              # BullMQ queue + worker
│   └── websocket/          # WebSocket manager (subscriptions, broadcasts)
├── repositories/           # Database/Redis access layer
├── validators/             # Zod schemas
├── types/                  # TypeScript types
└── utils/                  # Logger, helpers

prisma/
├── schema.prisma           # Database schema
└── migrations/             # SQL migrations

tests/
├── integration/            # Service-level tests (no server)
└── e2e/                    # Full API tests (with server)
```

---

## 🚀 Installation

### Prerequisites

- Node.js ≥18.0.0
- Docker & Docker Compose
- pnpm v10+ (install with `npm install -g pnpm`)

### Setup Steps

**1. Clone the repository**

```bash
git clone <repository-url>
cd order-execution-engine
```

**2. Install dependencies**

```bash
pnpm install
```

**3. Configure environment**

```bash
cp .env.example .env
# Edit .env with your database credentials if needed
```

**4. Start services (PostgreSQL & Redis)**

```bash
pnpm docker:up
```

**5. Run database migrations**

```bash
pnpm db:migrate
```

**6. Start the server**

```bash
pnpm dev
# Server runs at http://localhost:3000
```

**7. Verify installation**

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":...}
```

---

## ⚡ Quick Start

```bash
pnpm install              # Install dependencies
pnpm docker:up            # Start PostgreSQL & Redis
pnpm db:migrate           # Run migrations
pnpm dev                  # Start server (http://localhost:3000)
```

---

## 📡 API Endpoints

### Health

| Method | Endpoint            | Description            |
| ------ | ------------------- | ---------------------- |
| `GET`  | `/health`           | Basic health check     |
| `GET`  | `/health/status`    | Detailed system status |
| `GET`  | `/health/websocket` | WebSocket stats        |
| `GET`  | `/health/queue`     | Queue statistics       |

### Orders

| Method | Endpoint               | Description              |
| ------ | ---------------------- | ------------------------ |
| `POST` | `/api/orders/execute`  | Execute market order     |
| `POST` | `/api/orders/simulate` | Simulate order (dry-run) |
| `GET`  | `/api/orders/:orderId` | Get order status         |
| `GET`  | `/api/orders/stats`    | Order statistics         |

### WebSocket

| Protocol | Endpoint | Description                                                     |
| -------- | -------- | --------------------------------------------------------------- |
| `WS`     | `/ws`    | Real-time order updates (subscribe to `orderId` or `*` for all) |

**Note:** WebSocket uses standard GET-based upgrade handshake (RFC 6455). POST requests cannot be upgraded to WebSocket on the same connection. Use separate POST for order execution, then connect via WebSocket for updates.

---

## 💡 Example Usage

### Execute Order

```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MARKET",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 2.0,
    "slippage": 0.01
  }'
```

### WebSocket Subscribe

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: 'subscribe',
      payload: { orderId: '*' },
    })
  );
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Order status:', data);
  // Receive: PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED
};
```

---

## 🔄 Order Lifecycle

```
PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED ✅
   ↓         ↓          ↓           ↓
 Queue   DEX Price  Build Tx   Send Tx
         (200ms)                 ↓
                              FAILED ❌
                           (on error)
```

Orders can fail at any stage (routing, building, submission) and transition directly to FAILED status.

---

## 🧪 Testing

### Run All Tests

```bash
# Integration tests (no server needed)
pnpm test:all:integration
```

```bash
# E2E tests (server must be running)
pnpm dev                  # Terminal 1
pnpm test:all:e2e         # Terminal 2
```

### Individual Tests

```bash
pnpm test:db              # Database & Redis
```

```bash
pnpm test:dex             # DEX routing
```

```bash
pnpm test:queue           # Queue processing
```

```bash
pnpm test:orders          # Order service
```

```bash
pnpm test:websocket       # WebSocket real-time
```

```bash
pnpm test:api             # API endpoints
```

```bash
pnpm test:integration     # Full integration
```

---

## 📋 Commands

### Development

```bash
pnpm dev                  # Start with hot reload
```

```bash
pnpm build                # Build for production
```

```bash
pnpm start                # Run production build
```

### Database

```bash
pnpm db:migrate           # Run migrations
```

```bash
pnpm db:push              # Push schema changes
```

```bash
pnpm db:studio            # Open Prisma Studio
```

### Docker

```bash
pnpm docker:up            # Start PostgreSQL & Redis
```

```bash
pnpm docker:down          # Stop services
```

```bash
pnpm docker:logs          # View logs
```

### Code Quality

```bash
pnpm lint                 # Check issues
```

```bash
pnpm lint:fix             # Auto-fix issues
```

```bash
pnpm format               # Format code
```

---

## ✨ Features

- ✅ Multi-DEX routing (Raydium, Meteora)
- ✅ Real-time WebSocket updates
- ✅ BullMQ queue with retries
- ✅ 10 concurrent order processing
- ✅ Health monitoring endpoints
- ✅ Zod validation
- ✅ PostgreSQL + Redis
- ✅ Docker Compose setup
- ✅ Integration & E2E tests

---

## 📦 Requirements

- Node.js ≥18.0.0
- PostgreSQL 14+
- Redis 6+
- pnpm v10+

---
