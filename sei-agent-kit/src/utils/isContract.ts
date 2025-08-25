import { SeiAgentKit } from '../agent';

export async function isContract(agent: SeiAgentKit, address: `0x${string}`): Promise<boolean> {
  try {
    const code = await agent.publicClient.getCode({ address });
    return code !== '0x';
  } catch (error) {
    return false;
  }
}