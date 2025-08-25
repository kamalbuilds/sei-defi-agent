import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";

const UnstakeInputSchema = z.object({
  amount: z.string().min(1, "Amount must not be empty"),
});

export class SeiUnstakeTool extends StructuredTool<typeof UnstakeInputSchema> {
  name = 'sei_unstake_tool';
  description = `Unstake SEI tokens.
    
    Parameters:
    - amount: The amount of SEI tokens to unstake as a string (e.g., "1.5").`;
  schema = UnstakeInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof UnstakeInputSchema>): Promise<string> {
    try {
      const unstake = await this.seiKit.unstake(input.amount);
      return JSON.stringify({
        status: "success",
        unstake,
        amount: input.amount,
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