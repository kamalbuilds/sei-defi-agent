import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { Address } from 'viem';
import { z } from "zod";

const SeiERC20TransferInputSchema = z.object({
  amount: z.string().min(1, "Amount must not be empty"),
  recipient: z.string(),
  ticker: z.string().optional(),
});

export class SeiERC20TransferTool extends StructuredTool<typeof SeiERC20TransferInputSchema> {
  name = "sei_erc20_transfer";
  description = `Transfer tokens to another Sei wallet.

  Parameters:
  - amount: The amount of tokens to transfer as a string (e.g., "1.5") (required).
  - recipient: The recipient's wallet address (required).
  - ticker: Optional. The token symbol/ticker (e.g., "USDC"). Do not specify for native SEI token transfers.`;
  schema = SeiERC20TransferInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof SeiERC20TransferInputSchema>): Promise<string> {
    try {
      const transfer = await this.seiKit.ERC20Transfer(input.amount, input.recipient as Address, input.ticker);
      if (!transfer) {
        throw new Error("Transfer failed");
      }
      return JSON.stringify({
        status: "success",
        transfer,
        token: input?.ticker ?? "SEI",
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error?.code ?? "UNKNOWN_ERROR",
      });
    }
  }
}
