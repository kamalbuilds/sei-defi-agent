import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { Address } from 'viem';
import { z } from "zod";

const SeiERC721BalanceInputSchema = z.object({
  tokenAddress: z.string(),
});

export class SeiERC721BalanceTool extends StructuredTool<typeof SeiERC721BalanceInputSchema> {
  name = "sei_erc721_balance";
  description = `Get the balance of ERC721 tokens (NFTs) for the connected wallet.

  Parameters:
  - tokenAddress: The contract address of the NFT collection.`;
  schema = SeiERC721BalanceInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof SeiERC721BalanceInputSchema>): Promise<string> {
    try {
      /**There was a comment here saying CHANGE THIS */
      const balance = await this.seiKit.getERC721Balance(input.tokenAddress as Address);

      return JSON.stringify({
        status: "success",
        balance,
        tokenAddress: input.tokenAddress,
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
