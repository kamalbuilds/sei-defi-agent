import { parseAbi, Address } from 'viem';
import { SeiAgentKit } from '../agent';

const erc20Abi = parseAbi(['function decimals() view returns (uint8)']);

export async function getTokenDecimals(agent: SeiAgentKit, tokenAddress: Address): Promise<number> {
  const decimals = await agent.publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals'
  });

  return decimals;
}
