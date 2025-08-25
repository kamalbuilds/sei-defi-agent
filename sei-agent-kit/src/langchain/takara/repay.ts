import { z } from "zod";
import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";

const SeiRepayTakaraInputSchema = z.object({
  ticker: z
    .string()
    .describe("The token ticker (e.g., 'USDC', 'SEI')"),
  repayAmount: z
    .string()
    .describe("The amount to repay in human-readable format (e.g., '50' for 50 USDC). Use 'MAX' to repay full balance"),
});

/**
 * LangChain tool for repaying borrowed Takara tokens
 */
export class SeiRepayTakaraTool extends StructuredTool<typeof SeiRepayTakaraInputSchema> {
  name = "repay_takara";
  description = "Repays borrowed tokens to the Takara Protocol. Use 'MAX' as repayAmount to repay the full borrow balance.";
  schema = SeiRepayTakaraInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call({ ticker, repayAmount }: z.infer<typeof SeiRepayTakaraInputSchema>): Promise<string> {
    try {
      const result = await this.seiKit.repayTakara(ticker, repayAmount);

      return JSON.stringify({
        status: "success",
        message: `Successfully repaid tokens. Transaction hash: ${result}`,
        txHash: result,
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