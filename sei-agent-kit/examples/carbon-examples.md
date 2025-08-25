# CarbonDeFi Protocol Integration Examples

This document provides examples of how to use the CarbonDeFi Protocol tools in the SEI Agent Kit.

## Basic Operations

## Strategy Management

### Create a Disposable Strategy

```typescript
// Example: create a one-time sell strategy from SEI to USDC on Carbon
const disposableResult = await agent.createBuySellStrategy(
  config,
  "disposable", // type
  "SEI", // baseToken
  "USDC", // quoteToken
  undefined, // buyRange can be kept as undefined as we're only selling
  ["0.26", "0.27"], // sellRange - sell SEI for USDC between these prices
  undefined, // buyBudget can be kept as undefined as we're only selling
  "100" // sellBudget: SEI
);
console.log("Disposable strategy result:", disposableResult);
```

### Create a Recurring Strategy
```typescript
const recurringResult = await agent.createBuySellStrategy(
  config,
  "recurring", // type
  "SEI", // baseToken
  "USDC", // quoteToken
  "0.14", // buyRange - buy Low
  ["0.35", "0.40"], // sellRange
  "50", // buyBudget in USDC
  "100" // sellBudget in SEI
);
console.log("Recurring strategy result:", recurringResult);
```

### Create an Overlapping Strategy
```typescript
const overlappingResult = await agent.createOverlappingStrategy({
  config,
  "SEI", // baseToken
  "USDC", // quoteToken
  '0.1', // buyPriceLow - min price that the strategy will be active, will override the range param if it represents a smaller range when sellPriceHigh is not specified
  '0.5', // sellPriceHigh - if both buyPriceLow and sellPriceHigh are specified, range is ignored
  "50", // buyBudget - USDC Will use this buyBudget to calculate the required sellBudget, and vice-versa
  "100", // sellBudget - if both budgets are provided, the budgets that lead to less amount spent on both tokens will be chosen
  '1', // fee or spread in % between each strategy against the current market price
  '10', // range in % between marketPrice - range and marketPrice + range, the strategy will be active
  '0.25', // marketPriceOverride - if you wish to specify a marketPrice and ignore the fetched one, in case it's not available or you want a liquidity position around a different price
});
console.log("Overlapping strategy result:", overlappingResult);
```

### List Your Strategies
```typescript
// List all your Carbon strategies
const user = 'YOUR_WALLET_HERE';
const strategies = await agent.getUserStrategies(config, user);
console.log("Your Carbon strategies:", strategies);

// The agent will format and summarize your strategies for easy review.
```

### Delete Strategies
```typescript
// Delete a strategy by its ID
await agent.deleteStrategy(strategyId);

// When interacting with the agent, it remembers your previous context, so you can refer to strategies by number for a faster workflow, simply ask it to list the user's strategies beforehand.
```

### Using Carbon Tools with LangChain

#### Setup

```typescript
import { createSeiTools } from "../src/langchain";
import { SeiAgentKit } from "../src/agent";

// Create the SeiAgentKit instance
const seiKit = new SeiAgentKit(process.env.PRIVATE_KEY, "openai");

// Create tools for LangChain
const tools = createSeiTools(seiKit);

// Now you can use these tools with your LangChain agent
const agent = createOpenAIAgent({ tools });
```

#### Strategy Management via LangChain

```typescript
// Ask what you can do with Carbon
const carbonFunctionality = await agent.invoke("What can I do with the Carbon tool?");
console.log(carbonFunctionality);

// Create Disposable strategy
// The agent will help clarify if you provide a single value instead of a range,
// ensuring you don't make mistakes with your strategy parameters.
const resultDisposable = await agent.invoke("Create a disposable strategy selling SEI for USDC with a sell range of [0.26, 0.27] and a sell budget of 50 SEI");
console.log(resultDisposable);

// Create Recurring strategy
// The agent will help clarify if you provide a single value instead of a range,
// ensuring you don't make mistakes with your strategy parameters.
const resultRecurring = await agent.invoke("Create a recurring strategy selling SEI for USDC, with a sell range of [0.3, 0.4] and a buy range of [0.15, 0.25], a sellBudget of 100 SEI and a buyBudget of 100 USDC");
console.log(resultRecurring);

// Create Overlapping strategy
// The agent can fill in default values for advanced strategies,
// making it easy to provide only the parameters you care about.
const resultOverlapping = await agent.invoke("Create an overlapping strategy selling SEI for USDC, with a sellBudget of 100 SEI. Use default values for all other parameters");
console.log(resultOverlapping);

// Get user list of strategies
const strategies = await agent.invoke("List all my strategies on Carbon");
console.log(strategies);

// Delete specific strategy
// x can be the strategyId or the internal ID if the list of user strategies was asked beforehand and is in the agent's context 
const resultDelete = await agent.invoke("Delete strategy id x");
console.log(resultDelete);
```