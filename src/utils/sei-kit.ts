// Sei Agent Kit Integration Utility
import { SeiAgentKit } from 'sei-agent-kit';
import { Address } from 'viem';
import { logger } from './logger';

// Cached agent kit instances
const agentKitCache = new Map<string, SeiAgentKit>();

/**
 * Creates or retrieves a cached SeiAgentKit instance
 */
export function getSeiAgentKit(privateKey: string, provider?: any): SeiAgentKit {
  if (agentKitCache.has(privateKey)) {
    return agentKitCache.get(privateKey)!;
  }

  const agentKit = new SeiAgentKit(privateKey, provider);
  agentKitCache.set(privateKey, agentKit);
  return agentKit;
}

/**
 * Helper function to safely execute sei-agent-kit operations
 */
export async function executeSeiOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  fallbackValue?: T
): Promise<T> {
  try {
    const result = await operation();
    logger.info(`✅ ${operationName} completed successfully`);
    return result;
  } catch (error) {
    logger.error(`❌ ${operationName} failed:`, error);
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw error;
  }
}

/**
 * Get token balance using sei-agent-kit
 */
export async function getTokenBalance(
  agentKit: SeiAgentKit,
  tokenAddress?: Address
): Promise<string> {
  return executeSeiOperation(
    () => agentKit.getERC20Balance(tokenAddress),
    `Get balance for ${tokenAddress || 'SEI'}`,
    '0'
  );
}

/**
 * Transfer tokens using sei-agent-kit
 */
export async function transferTokens(
  agentKit: SeiAgentKit,
  amount: string,
  recipient: Address,
  ticker?: string
): Promise<string> {
  return executeSeiOperation(
    () => agentKit.ERC20Transfer(amount, recipient, ticker),
    `Transfer ${amount} ${ticker || 'SEI'} to ${recipient}`
  );
}

/**
 * Swap tokens using sei-agent-kit Symphony integration
 */
export async function swapTokens(
  agentKit: SeiAgentKit,
  amount: string,
  tokenIn: Address,
  tokenOut: Address
): Promise<string> {
  return executeSeiOperation(
    () => agentKit.swap(amount, tokenIn, tokenOut),
    `Swap ${amount} from ${tokenIn} to ${tokenOut}`
  );
}

/**
 * Stake SEI tokens
 */
export async function stakeSei(
  agentKit: SeiAgentKit,
  amount: string
): Promise<string> {
  return executeSeiOperation(
    () => agentKit.stake(amount),
    `Stake ${amount} SEI`
  );
}

/**
 * Unstake SEI tokens
 */
export async function unstakeSei(
  agentKit: SeiAgentKit,
  amount: string
): Promise<string> {
  return executeSeiOperation(
    () => agentKit.unstake(amount),
    `Unstake ${amount} SEI`
  );
}

// Export types for use in other modules
export type { Address } from 'viem';
export { SeiAgentKit };