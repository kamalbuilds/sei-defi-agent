import { z } from "zod";
import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";

const SeiRedeemTakaraInputSchema = z.object({
  ticker: z
    .string()
    .describe("The token ticker (e.g., 'USDC', 'SEI')"),
  redeemAmount: z
    .string()
    .describe("The amount to redeem in human-readable format (e.g., '50' for 50 USDC). Use 'MAX' to redeem all tTokens"),
  redeemType: z
    .enum(["underlying", "tokens"])
    .optional()
    .describe("Optional: The type of redemption - 'underlying' to redeem a specific amount of underlying tokens, or 'tokens' to redeem a specific amount of tTokens. Defaults to 'underlying'"),
});

/**
 * LangChain tool for redeeming Takara tokens
 */
export class SeiRedeemTakaraTool extends StructuredTool<typeof SeiRedeemTakaraInputSchema> {
  name = "redeem_takara";
  description = "Redeems tTokens from the Takara Protocol to get underlying tokens back. Use 'MAX' as redeemAmount to redeem all available tokens.";
  schema = SeiRedeemTakaraInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call({ ticker, redeemAmount, redeemType = "underlying" }: z.infer<typeof SeiRedeemTakaraInputSchema>): Promise<string> {
    try {
      const result = await this.seiKit.redeemTakara(ticker, redeemAmount, redeemType);

      return JSON.stringify({
        status: "success",
        message: `Successfully redeemed tTokens. Transaction hash: ${result}`,
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