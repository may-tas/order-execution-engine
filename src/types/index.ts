export enum OrderStatus {
  PENDING = 'pending',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  SNIPER = 'sniper',
}

export enum DexType {
  RAYDIUM = 'raydium',
  METEORA = 'meteora',
}

export interface Order {
  id: string;
  type: OrderType;
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DexQuote {
  dex: DexType;
  price: number;
  fee: number;
  estimatedOutput: number;
}

export interface ExecutionResult {
  orderId: string;
  txHash: string;
  executedPrice: number;
  executedAmount: number;
  dex: DexType;
  timestamp: Date;
}
