import { StructuredTool } from "langchain/tools";
import { SeiAgentKit } from "../../agent";
import { Address } from 'viem';
import { getTokenAddressFromTicker } from "../../tools";
import { z } from "zod";

const SeiERC20BalanceInputSchema = z.object({
  contract_address: z.string().optional(),
  ticker: z.string().optional(),
});

export class SeiERC20BalanceTool extends StructuredTool<typeof SeiERC20BalanceInputSchema> {
  name = "sei_erc20_balance";
  description = `Get the balance of ERC20 tokens in a Sei wallet.

  This tool retrieves token balances without requiring a wallet address (uses connected wallet).

  If neither parameter is provided, returns the native SEI token balance.

  Parameters:
  - contract_address: Optional. The contract address of the token.
  - ticker: Optional. The token symbol/ticker (e.g., "USDC").

  One of these parameters can be used to specify a non-SEI token.`;
  schema = SeiERC20BalanceInputSchema;

  constructor(private readonly seiKit: SeiAgentKit) {
    super();
  }

  protected async _call(input: z.infer<typeof SeiERC20BalanceInputSchema>): Promise<string> {
    try {
      var balance;
      if (input) {
        let contract_address;
        if (input.ticker) {
          contract_address = await getTokenAddressFromTicker(input.ticker);
        }
        else if (input.contract_address) { contract_address = input.contract_address; }
        balance = await this.seiKit.getERC20Balance(contract_address as Address);
      } else {
        balance = await this.seiKit.getERC20Balance();
      }

      return JSON.stringify({
        status: "success",
        balance,
        token: input || "SEI",
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
