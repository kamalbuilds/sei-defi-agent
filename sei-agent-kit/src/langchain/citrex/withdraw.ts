import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";

const CitrexWithdrawInputSchema = z.object({
  amount: z.string().min(1),
});

export class SeiCitrexWithdrawTool extends StructuredTool<typeof CitrexWithdrawInputSchema> {
  name = "citrex_withdraw";
  description = "Withdraws USDC tokens from the Citrex Protocol. Returns a success flag and transaction hash if the withdrawal was successful.";
  schema = CitrexWithdrawInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  async _call(input: z.infer<typeof CitrexWithdrawInputSchema>): Promise<string> {
    const { amount } = input;
    return this.seiKit.citrexWithdraw(amount);
  }
}