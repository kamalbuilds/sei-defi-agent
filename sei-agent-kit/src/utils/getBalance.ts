import { parseAbi, Address } from 'viem';
import { SeiAgentKit } from '../agent';

const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

export async function getBalance(agent: SeiAgentKit, tokenAddress: Address): Promise<bigint> {
  const balance = await agent.publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [agent.wallet_address],
  });

  return balance;
}