## 🛠️ Creating Your First Tool

### 1. Setup Your Tool Structure

Create a new directory for your tool under `src/tools/`:

```bash
mkdir -p src/tools/your-tool-name
```

Then create the necessary files:

```bash
touch src/tools/your-tool-name/index.ts
touch src/tools/your-tool-name/your-function.ts
```

### 2. Tool Structure

Your tool should follow this structure:

```
src/tools/your-tool-name/
├── index.ts              # Exports all functions from your tool
└── your-function.ts      # Implementation of your tool functionality
```

### 3. Implement Your Tool Logic

First, create your main function in `your-function.ts`:

```typescript
import { SeiAgentKit } from "../../index";

/**
 * Performs some action with your protocol
 * @param agent SeiAgentKit instance
 * @param param1 Description of parameter
 * @returns Result data or transaction hash
 */
export async function yourToolFunction(
  agent: SeiAgentKit,
  param1: string  // Add any parameters your function needs
): Promise<any> {
  // Implement your logic here
  
  // Example: Connect to a protocol, make a transaction, etc.
  
  return { success: true, message: "Operation completed" };
}
```

Then, export your function in your tool's `index.ts`:

```typescript
export { yourToolFunction } from "./your-function";
```

### 4. Update the Main Tools Index

Add your tool to the main tools index file at `src/tools/index.ts`:

```typescript
// ... existing exports
export * from './your-tool-name';
```

### 5. Create LangChain Integration

For LangChain integration, create a corresponding directory structure under `src/langchain/`:

```bash
mkdir -p src/langchain/your-tool-name
touch src/langchain/your-tool-name/index.ts
touch src/langchain/your-tool-name/your-function.ts
```

### 6. Implement LangChain Tool

In the LangChain tool file (`src/langchain/your-tool-name/your-function.ts`), implement a LangChain tool wrapper:

```typescript
import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";
import { yourToolFunction } from "../../tools/your-tool-name/your-function";

const YourToolInputSchema = z.object({
  param1: z.string().describe("Description of parameter"),
  // Add additional parameters as needed
});

export class YourTool extends StructuredTool<typeof YourToolInputSchema> {
  name = "your_tool_function";
  description = `
    Descriptive text about what your tool does.
    
    Parameters:
    - param1: Description of what this parameter does
  `;
  schema = YourToolInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof YourToolInputSchema>): Promise<string> {
    try {
      const result = await yourToolFunction(this.seiKit, input.param1);
      
      return JSON.stringify({
        status: "success",
        result,
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}
```

Export your LangChain tool in `src/langchain/your-tool-name/index.ts`:

```typescript
export { YourTool } from "./your-function";
```

### 7. Update the Main LangChain Index

Add your LangChain tool to the main LangChain index file at `src/langchain/index.ts`:

```typescript
// ... existing exports
export * from './your-tool-name';

// ... existing imports
import {
  // ... existing imports
  YourTool
} from './index';

export function createSeiTools(seiKit: SeiAgentKit) {
  return [
    // ... existing tools
    new YourTool(seiKit),
  ];
}
```

### 8. Add Method to SeiAgentKit

Integrate your function with the SeiAgentKit class by adding a method in `src/agent/index.ts`:

```typescript
// 1. Import your tool function
import { yourToolFunction } from '../tools/your-tool-name';

export class SeiAgentKit {
  // Existing properties and methods...
  
  // 2. Add a method that wraps your tool function
  async yourTool(param1: string): Promise<any> {
    return yourToolFunction(this, param1);
  }
}
```

## 📌 Best Practices

### Function Design

1. **Clear naming**: Use descriptive function names that indicate the action
2. **Input validation**: Always validate input parameters
3. **Error handling**: Implement proper error handling with informative messages
4. **Documentation**: Include JSDoc comments for all functions
5. **Type safety**: Use TypeScript types for all parameters and return values

### Code Example

```typescript
import { SeiAgentKit } from "../../index";
import { Address } from "viem";

/**
 * Stakes tokens in the protocol
 * @param agent SeiAgentKit instance
 * @param amount Amount to stake (in full tokens, not micro)
 * @returns Transaction hash
 */
export async function stakeTokens(
  agent: SeiAgentKit,
  amount: number
): Promise<string> {
  // 1. Input validation
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error(`Invalid amount: ${amount}. Must be a positive number.`);
  }

  try {
    // 2. Your implementation
    // ...

    // 3. Return result
    return "tx_hash_here";
  } catch (error) {
    // 4. Error handling
    console.error(`Error in stakeTokens: ${error}`);
    throw error;
  }
}
```

## 🧪 Testing Your Tool

### 1. Set Up Environment Variables

Before testing your tool, you need to set up your environment variables:

1. Copy the example environment file to create your own `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Open the `.env` file and add your SEI wallet private key:
   ```
   SEI_PRIVATE_KEY=your_private_key_here
   ```
   
   > ⚠️ **IMPORTANT**: Never commit your `.env` file with your private key to version control.

### 2. Testing Direct Tool Usage

Update the test file at `test/test.ts` to call your new method:

```typescript
import { SeiAgentKit } from "../src";
import * as dotenv from "dotenv";

dotenv.config();

// Environment validation and setup...

const agent = new SeiAgentKit(
  process.env.SEI_PRIVATE_KEY!,
  {
    OPENAI_API_KEY: "",
  },
);

async function main() {
  try {
    // Test your tool function
    console.log("Testing your tool...");
    const result = await agent.yourTool("test parameter");
    console.log("Result:", result);
  } catch (err) {
    console.error("Error testing tool:", err);
    return null;
  }
}

// Execute the test...
```

### 3. Testing LangChain Integration

To test your LangChain integration, you can use a test file that leverages LangChain's tools:

```typescript
import { SeiAgentKit, createSeiTools } from "../src";
import * as dotenv from "dotenv";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "langchain/prompts";

dotenv.config();

async function testLangChainIntegration() {
  // Initialize SeiAgentKit
  const agent = new SeiAgentKit(
    process.env.SEI_PRIVATE_KEY!,
    {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    },
  );

  // Create tools
  const tools = createSeiTools(agent);
  
  // Create LangChain model
  const model = new ChatOpenAI({
    modelName: "gpt-4-turbo",
    temperature: 0,
  });
  
  // Create agent with tools
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant that can use Sei blockchain tools."],
    ["human", "{input}"],
  ]);
  
  const agent = await createOpenAIFunctionsAgent({
    llm: model,
    tools,
    prompt,
  });
  
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });
  
  // Test the agent
  const result = await agentExecutor.invoke({
    input: "Use the your_tool_function tool with parameter 'test'",
  });
  
  console.log("Agent result:", result);
}

testLangChainIntegration();
```

### 4. Run the Test

Execute your test using the provided npm script:

```bash
npm run test
```

### 5. Debugging Tips

- Check console logs for any errors
- Verify that your method is correctly importing and calling your tool function
- Ensure all required parameters are passed correctly
- For blockchain interactions, consider using a testnet environment first
- Make sure your LangChain tool description is clear and comprehensive

## 🔄 Tool Integration Flow

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│     Step 1    │     │     Step 2    │     │     Step 3    │
│  Create Tool  │────▶│  Create Lang- │────▶│  Integrate    │
│  Functions    │     │  Chain Tools  │     │  with SeiKit  │
└───────────────┘     └───────────────┘     └───────────────┘
                                                    │
                                                    ▼
                      ┌───────────────┐     ┌───────────────┐
                      │     Step 5    │     │     Step 4    │
                      │  Contribute   │◀────│  Test Your    │
                      │  to Repo      │     │  Tool         │
                      └───────────────┘     └───────────────┘
```