import { PayableOverrides } from "@bancor/carbon-sdk";
import { Toolkit } from "@bancor/carbon-sdk/strategy-management";
import { initSyncedCache } from "@bancor/carbon-sdk/chain-cache";
import {
  ContractsApi,
  ContractsConfig,
} from "@bancor/carbon-sdk/contracts-api";
import { JsonRpcProvider } from "@ethersproject/providers";

import { SeiAgentKit } from "../../index";
import { SEI_RPC_URL, MAX_BLOCK_AGE } from "../../constants";
import {
  type StrategyType,
  carbonERC20InfiniteApproval,
  getStrategyTypeParams,
} from "./utils";
import { Account, Address } from "viem";

/**
 
 */
export async function createBuySellStrategy(
  agent: SeiAgentKit,
  config: ContractsConfig,
  type: StrategyType,
  baseToken: Address,
  quoteToken: Address,
  buyRange: string | string[] | undefined,
  sellRange: string | string[] | undefined,
  buyBudget: string | undefined,
  sellBudget: string | undefined,
  overrides?: PayableOverrides,
): Promise<string | null> {
  const provider = new JsonRpcProvider(SEI_RPC_URL);
  const api = new ContractsApi(provider, config);
  const { cache } = initSyncedCache(api.reader, undefined, MAX_BLOCK_AGE);
  const carbonSDK = new Toolkit(api, cache, undefined);

  const {
    buyPriceLow,
    buyPriceMarginal,
    buyPriceHigh,
    buyBudget: parsedBuyBudget,
    sellPriceLow,
    sellPriceMarginal,
    sellPriceHigh,
    sellBudget: parsedSellBudget,
  } = await getStrategyTypeParams(
    type,
    baseToken,
    quoteToken,
    buyBudget,
    sellBudget,
    buyRange,
    sellRange,
  );

  // 1. Approve required tokens
  console.log(`Setting approval for ${baseToken} and ${quoteToken}`);
  const carbonController = config.carbonControllerAddress as `0x${string}`;
  if (!carbonController) {
    throw new Error("Carbon Controller Address cannot be undefined");
  }
  if (sellBudget !== "0") {
    carbonERC20InfiniteApproval(
      agent,
      baseToken,
      carbonController as `0x${string}`,
    );
  }
  if (buyBudget !== "0") {
    carbonERC20InfiniteApproval(
      agent,
      quoteToken,
      carbonController as `0x${string}`,
    );
  }

  // 2. Create strategy populated tx
  console.log(`
    Creating Buy/Sell Strategy
    
    baseToken is ${baseToken}
    quoteToken is ${quoteToken}
    buyBudget is ${parsedBuyBudget}
    buyPriceLow is ${buyPriceLow}
    buyPriceMarginal is ${buyPriceMarginal}
    buyPriceHigh is ${buyPriceHigh}
    sellBudget is ${parsedSellBudget}
    sellPriceLow is ${sellPriceLow}
    sellPriceMarginal is ${sellPriceMarginal}
    sellPriceHigh is ${sellPriceHigh}
    `);
  const populatedTx = await carbonSDK.createBuySellStrategy(
    baseToken,
    quoteToken,
    buyPriceLow,
    buyPriceMarginal,
    buyPriceHigh,
    parsedBuyBudget,
    sellPriceLow,
    sellPriceMarginal,
    sellPriceHigh,
    parsedSellBudget,
    overrides,
  );

  const viemTx = {
    chain: agent.walletClient.chain,
    account: agent.walletClient.account as Account,
    to: populatedTx.to as `0x${string}`,
    data: populatedTx.data as `0x${string}`,
    value: populatedTx.value ? BigInt(populatedTx.value.toString()) : 0n,
    gas: populatedTx.gasLimit
      ? BigInt(populatedTx.gasLimit.toString())
      : undefined,
    nonce: populatedTx.nonce,
  };

  const txHash = await agent.walletClient.sendTransaction(viemTx);
  return txHash;
}
