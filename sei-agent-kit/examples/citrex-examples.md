# Citrex Protocol Integration Examples

This document provides examples of how to use the Citrex Protocol tools in the SEI Agent Kit.

## Basic Market Data

### Get Server Time
```typescript
// Get the current server time
const serverTime = await agent.citrexGetServerTime();
console.log("Server time:", serverTime);
```

### Get Products
```typescript
// Get all available products
const products = await agent.citrexGetProducts();
console.log("Available products:", products);
```

### Get Specific Product
```typescript
// Get details for a specific product by ID
const ethProduct = await agent.citrexGetProduct(1002); // ETH product ID
console.log("ETH product details:", ethProduct);

// Alternatively, get by symbol
const btcProduct = await agent.citrexGetProduct("btcperp");
console.log("BTC product details:", btcProduct);
```

### Get Order Book
```typescript
// Get order book for ETH
const ethOrderBook = await agent.citrexGetOrderBook("ethperp");
console.log("ETH order book:", ethOrderBook);
```

### Get Candlestick Data
```typescript
// Get 1 hour candles for the last day for BTC
const btcKlines = await agent.citrexGetKlines("btcperp", {
  interval: "1h",
  limit: 24,
});
console.log("BTC hourly candles:", btcKlines);
```

### Get Trade History
```typescript
// Get the last 20 trades for ETH
const ethTrades = await agent.citrexGetTradeHistory("ethperp", 20);
console.log("ETH recent trades:", ethTrades);
```

## Account Information

### Get Account Health
```typescript
// Check account health metrics
const accountHealth = await agent.citrexGetAccountHealth();
console.log("Account health:", accountHealth);
```

### List Balances
```typescript
// Get all margin balances
const balances = await agent.citrexListBalances();
console.log("Account balances:", balances);
```

### List Positions
```typescript
// Get all open positions
const allPositions = await agent.citrexListPositions();
console.log("All positions:", allPositions);

// Get positions for a specific product
const ethPositions = await agent.citrexListPositions("ethperp");
console.log("ETH positions:", ethPositions);
```

### List Open Orders
```typescript
// Get all open orders
const allOrders = await agent.citrexListOpenOrders();
console.log("All open orders:", allOrders);

// Get open orders for a specific product
const btcOrders = await agent.citrexListOpenOrders("btcperp");
console.log("BTC open orders:", btcOrders);
```

## Trading Operations

### Deposit Funds
```typescript
// Deposit 100 USDC to Citrex
const depositResult = await agent.citrexDeposit("100");
console.log("Deposit result:", depositResult);
```

### Withdraw Funds
```typescript
// Withdraw 50 USDC from Citrex
const withdrawResult = await agent.citrexWithdraw("50");
console.log("Withdraw result:", withdrawResult);
```

### Calculate Margin Requirement
```typescript
// Calculate margin required for a trade
const marginRequired = await agent.citrexCalculateMarginRequirement(
  true, // isBuy
  3000, // price
  1002, // ETH product ID
  0.5   // quantity
);
console.log("Margin required:", marginRequired);
```

### Place an Order
```typescript
// Place a limit buy order for ETH
const orderResult = await agent.citrexPlaceOrder({
  isBuy: true,
  orderType: "LIMIT",
  price: 3000,
  productId: 1002, // ETH
  quantity: 0.5,
  timeInForce: "GTC"
});
console.log("Order result:", orderResult);
```

### Place Multiple Orders
```typescript
// Place multiple orders at once
const ordersResult = await agent.citrexPlaceOrders([
  {
    isBuy: true,
    orderType: "LIMIT",
    price: 3000,
    productId: 1002, // ETH
    quantity: 0.3,
    timeInForce: "GTC"
  },
  {
    isBuy: false,
    orderType: "LIMIT",
    price: 3300,
    productId: 1002, // ETH
    quantity: 0.3,
    timeInForce: "GTC"
  }
]);
console.log("Multiple orders result:", ordersResult);
```

### Cancel an Order
```typescript
// Cancel a specific order
const cancelResult = await agent.citrexCancelOrder(
  "0x123456789abcdef...", // order ID
  1002 // product ID
);
console.log("Cancel result:", cancelResult);
```

### Cancel Multiple Orders
```typescript
// Cancel multiple orders at once
const cancelMultipleResult = await agent.citrexCancelOrders([
  ["0x123456789abcdef...", 1002], // [orderId, productId]
  ["0x987654321fedcba...", 1002]
]);
console.log("Multiple cancellations result:", cancelMultipleResult);
```

### Cancel All Orders for a Product
```typescript
// Cancel all open orders for ETH
const cancelAllResult = await agent.citrexCancelOpenOrdersForProduct(1002);
console.log("Cancel all ETH orders result:", cancelAllResult);
```

### Cancel and Replace an Order
```typescript
// Update an existing order with new parameters
const replaceResult = await agent.citrexCancelAndReplaceOrder(
  "0x123456789abcdef...", // order ID to replace
  {
    isBuy: true,
    price: 3050, // new price
    productId: 1002,
    quantity: 0.5
  }
);
console.log("Replace order result:", replaceResult);
```

## Using the LangChain Tools

These tools can also be accessed through LangChain when using an AI agent.

### Examples

```typescript
// Creating an agent with Citrex tools
import { createSeiTools } from "../src/langchain";
import { SeiAgentKit } from "../src/agent";

// Create the SeiAgentKit instance
const seiKit = new SeiAgentKit(process.env.PRIVATE_KEY, "openai");

// Create tools for LangChain
const tools = createSeiTools(seiKit);

// Now you can use these tools with your LangChain agent
const agent = createOpenAIAgent({ tools });

// Example agent execution
const result = await agent.invoke("Show me the current price of ETH on Citrex");
console.log(result);
``` 