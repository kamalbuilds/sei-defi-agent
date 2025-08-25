import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";

const StakeInputSchema = z.object({
  amount: z.string().min(1, "Amount must not be empty"),
});

export class SeiStakeTool extends StructuredTool<typeof StakeInputSchema> {
  name = 'sei_stake_tool';
  description = `Stake SEI tokens.
    
    Parameters:
    - amount: The amount of SEI tokens to stake as a string (e.g., "1.5").`;
  schema = StakeInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof StakeInputSchema>): Promise<string> {
    try {
      const stake = await this.seiKit.stake(input.amount);
      return JSON.stringify({
        status: "success",
        stake,
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