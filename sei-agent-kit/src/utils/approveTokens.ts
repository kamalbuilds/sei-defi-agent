import { Address, erc20Abi } from "viem";
import { SeiAgentKit } from "../agent";


export async function approveToken(
  agent: SeiAgentKit,
  tokenAddress: Address,
  spender: Address,
  amount: bigint
): Promise<void> {
  try {
    // Check current allowance
    const allowance = await agent.publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [agent.wallet_address, spender]
    });

    // If allowance is already sufficient, skip approval
    if (allowance >= amount) {
      return;
    }

    // Prepare approval transaction
    await agent.walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount]
    } as any); // Using 'as any' to bypass type-checking issues
  } catch (error) {
    throw new Error(`Failed to approve token: ${error instanceof Error ? error.message : String(error)}`);
  }
}