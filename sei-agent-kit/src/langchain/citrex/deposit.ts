import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { z } from "zod";

const CitrexDepositInputSchema = z.object({
  amount: z.string().min(1),
});

export class SeiCitrexDepositTool extends StructuredTool<typeof CitrexDepositInputSchema> {
  name = "citrex_deposit";
  description = "Deposits USDC tokens into the Citrex Protocol. Returns a success flag and transaction hash if the deposit was successful.";
  schema = CitrexDepositInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  async _call(input: z.infer<typeof CitrexDepositInputSchema>): Promise<string> {
    const { amount } = input;
    return this.seiKit.citrexDeposit(amount);
  }
}