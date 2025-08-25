import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { Address } from 'viem';
import { z } from "zod";

const SeiERC721MintInputSchema = z.object({
  recipient: z.string(),
  tokenAddress: z.string(),
  tokenId: z.string().or(z.number()),
});

export class SeiERC721MintTool extends StructuredTool<typeof SeiERC721MintInputSchema> {
  name = "sei_erc721_mint";
  description = `Mint an NFT (ERC721 token).

    Parameters:
    - recipient: The wallet address that will receive the minted NFT.
    - tokenAddress: The NFT contract address.
    - tokenId: The ID of the NFT to mint.`;
  schema = SeiERC721MintInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof SeiERC721MintInputSchema>): Promise<string> {
    try {
      const mint = await this.seiKit.ERC721Mint(
        input.recipient as Address,
        input.tokenAddress as Address,
        BigInt(input.tokenId)
      );

      if (mint === "") {
        throw new Error("Minting failed");
      }

      return JSON.stringify({
        status: "success",
        mint,
        recipient: input.recipient,
        tokenAddress: input.tokenAddress,
        tokenId: input.tokenId,
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
