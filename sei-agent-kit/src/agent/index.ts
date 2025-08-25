import {
  WalletClient as ViemWalletClient,
  createPublicClient,
  http,
  PublicClient as ViemPublicClient,
  Address,
  createWalletClient,
} from "viem";
import { sei } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { TradeActionBNStr, PayableOverrides, StrategyUpdate, EncodedStrategyBNStr, Strategy } from '@bancor/carbon-sdk';
import { ContractsConfig } from '@bancor/carbon-sdk/contracts-api';
import { MarginalPriceOptions } from '@bancor/carbon-sdk/strategy-management';
import {
  get_erc20_balance, erc20_transfer, get_erc721_balance, erc721Transfer, erc721Mint, stakeSei, unstakeSei, getTokenAddressFromTicker,
  composeTradeBySourceTx,
  composeTradeByTargetTx,
  createBuySellStrategy,
  createOverlappingStrategy,
  deleteStrategy,
  getUserStrategies,
  updateStrategy,
  postTweet, TwitterPostTweetSchema, getAccountDetails, getAccountMentions, TwitterAccountMentionsSchema, postTweetReply, TwitterPostTweetReplySchema,
  citrexDeposit, citrexWithdraw, citrexGetProducts, citrexGetOrderBook, citrexGetAccountHealth, citrexGetTickers, citrexCalculateMarginRequirement, citrexGetKlines, citrexGetProduct, citrexGetServerTime, citrexGetTradeHistory, citrexCancelAndReplaceOrder, citrexCancelOpenOrdersForProduct, citrexCancelOrder, citrexCancelOrders, citrexListBalances, citrexListOpenOrders, citrexListPositions, citrexPlaceOrder, citrexPlaceOrders
} from '../tools';
import {
  mintTakara,
  borrowTakara,
  repayTakara,
  redeemTakara,
  getRedeemableAmount,
  getBorrowBalance,
  type RedeemTakaraParams,
  getTakaraTTokenAddress
} from '../tools/takara';
import { swap } from '../tools/symphony/swap';
import { StrategyType } from "../tools/carbon";
import { getTokenForProvider } from './modelProvider';
import { ModelProviderName } from '../types';
import { z } from 'zod';

export class SeiAgentKit {
  public publicClient: ViemPublicClient;
  public walletClient: ViemWalletClient;
  public wallet_address: Address;
  public token: string | undefined;
  /**
   * Creates a new SeiAgentKit instance
   * @param private_key The private key for the wallet
   * @param provider The model provider to use
   */
  constructor(
    private_key: string,
    provider: any,
  ) {
    const account = privateKeyToAccount(private_key as Address);
    this.publicClient = createPublicClient({
      chain: sei,
      transport: http()
    });
    this.wallet_address = account.address;
    this.walletClient = createWalletClient({
      account,
      chain: sei,
      transport: http()
    });

    this.token = getTokenForProvider(provider);
  }

  /**
   * Gets the ERC20 token balance
   * @param contract_address Optional ERC-20 token contract address. If not provided, gets native SEI balance
   * @returns Promise with formatted balance as string
   */
  async getERC20Balance(contract_address?: Address): Promise<string> {
    return get_erc20_balance(this, contract_address);
  }

  /**
   * Transfers SEI tokens or ERC-20 tokens
   * @param amount Amount to transfer as a string (e.g., "1.5" for 1.5 tokens)
   * @param recipient Recipient address
   * @param ticker Optional token ticker (if not provided, transfers native SEI)
   * @returns Promise with transaction result
   */
  async ERC20Transfer(
    amount: string,
    recipient: Address,
    ticker?: string,
  ): Promise<string> {
    return erc20_transfer(this, amount, recipient, ticker);
  }

  /**
   * Gets the ERC721 token balance
   * @param tokenAddress The ERC-721 token contract address
   * @returns Promise with balance as string
   */
  async getERC721Balance(tokenAddress: Address): Promise<string> {
    return get_erc721_balance(this, tokenAddress);
  }

  /**
   * Transfers an ERC721 token
   * @param amount Deprecated parameter (kept for compatibility)
   * @param recipient The recipient address
   * @param tokenAddress The ERC-721 token contract address
   * @param tokenId The token ID to transfer
   * @returns Promise with transaction details or error message
   */
  async ERC721Transfer(
    amount: string,
    recipient: Address,
    tokenAddress: Address,
    tokenId: string,
  ): Promise<string> {
    return erc721Transfer(this, BigInt(amount), recipient, tokenAddress, BigInt(tokenId));
  }

  /**
   * Mints an ERC721 token
   * @param recipient The recipient address that will receive the minted token
   * @param tokenAddress The ERC-721 token contract address
   * @param tokenId The token ID to mint
   * @returns Promise with transaction details or error message
   */
  async ERC721Mint(
    recipient: Address,
    tokenAddress: Address,
    tokenId: bigint,
  ): Promise<string> {
    return erc721Mint(this, recipient, tokenAddress, tokenId);
  }

  /**
   * Gets a token address from its ticker symbol
   * @param ticker The token ticker symbol (e.g., "SEI", "USDC")
   * @returns Promise with token address or null if not found
   */
  async getTokenAddressFromTicker(
    ticker: string,
  ): Promise<Address | null> {
    return getTokenAddressFromTicker(ticker);
  }

  /**
   * Stakes SEI tokens on the network
   * @param amount Amount of SEI to stake as a string (e.g., "1.5" for 1.5 SEI)
   * @returns Promise with transaction hash or error message
   */
  async stake(amount: string) {
    return stakeSei(this, amount);
  }

  /**
   * Unstakes SEI tokens from the network
   * @param amount Amount of SEI to unstake as a string (e.g., "1.5" for 1.5 SEI)
   * @returns Promise with transaction hash or error message
   */
  async unstake(amount: string) {
    return unstakeSei(this, amount);
  }

  /**
   * Swaps tokens using the Symphony aggregator
   * @param amount The amount of tokens to swap as a string (e.g., "1.5")
   * @param tokenIn The address of the token to swap from
   * @param tokenOut The address of the token to swap to
   * @returns Transaction details as a string
   */
  async swap(amount: string, tokenIn: Address, tokenOut: Address): Promise<string> {
    return swap(this, amount, tokenIn, tokenOut);
  }


  // Takara Protocol methods
  /**
   * Mints tTokens by depositing underlying tokens into the Takara Protocol
   * @param ticker The token ticker (e.g., "USDC")
   * @param mintAmount The amount to mint in human-readable format
   * @returns Transaction hash and expected tToken amount
   */
  async mintTakara(ticker: string, mintAmount: string) {
    return mintTakara(this, { ticker, mintAmount });
  }

  /**
   * Borrows underlying tokens from the Takara Protocol using tTokens as collateral
   * @param ticker The token ticker (e.g., "USDC")
   * @param borrowAmount The amount to borrow in human-readable format
   * @returns Transaction hash and borrowed amount
   */
  async borrowTakara(ticker: string, borrowAmount: string) {
    return borrowTakara(this, { ticker, borrowAmount });
  }

  /**
   * Repays borrowed tokens to the Takara Protocol
   * @param ticker The token ticker (e.g., "USDC")
   * @param repayAmount The amount to repay in human-readable format, or "MAX" to repay full balance
   * @returns Transaction hash and amount repaid
   */
  async repayTakara(ticker: string, repayAmount: string) {
    return repayTakara(this, { ticker, repayAmount });
  }

  /**
   * Redeems tTokens from the Takara Protocol to get underlying tokens back
   * @param ticker The token ticker (e.g., "USDC")
   * @param redeemAmount The amount to redeem in human-readable format, or "MAX" to redeem all
   * @param redeemType Whether to redeem underlying tokens or tTokens
   * @returns Transaction details and redemption status
   */
  async redeemTakara(ticker: string, redeemAmount: string, redeemType: RedeemTakaraParams['redeemType'] = 'underlying') {
    return redeemTakara(this, { ticker, redeemAmount, redeemType });
  }

  /**
   * Calculates the amount of underlying tokens that can be redeemed by a user
   * @param ticker The token ticker (e.g., "USDC")
   * @param userAddress Optional address of the user to check
   * @returns Information about redeemable amounts
   */
  async getRedeemableAmount(ticker: string, userAddress?: Address) {
    const tTokenAddress = getTakaraTTokenAddress(ticker);
    if (!tTokenAddress) {
      throw new Error(`No Takara tToken found for ticker: ${ticker}`);
    }
    return getRedeemableAmount(this, tTokenAddress, userAddress);
  }

  /**
   * Retrieves the current borrow balance for a user
   * @param ticker The token ticker (e.g., "USDC")
   * @param userAddress Optional address of the user to check
   * @returns Information about the borrow balance
   */
  async getBorrowBalance(ticker: string, userAddress?: Address) {
    const tTokenAddress = getTakaraTTokenAddress(ticker);
    if (!tTokenAddress) {
      throw new Error(`No Takara tToken found for ticker: ${ticker}`);
    }
    return getBorrowBalance(this, tTokenAddress, userAddress);
  }

  // Carbon SDK Methods
  /**
   * Composes a trade transaction based on the source token amount using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param sourceToken The address of the source token.
   * @param targetToken The address of the target token.
   * @param tradeActions An array of trade actions.
   * @param deadline The transaction deadline timestamp.
   * @param minReturn The minimum amount of target tokens to receive.
   * @param overrides Optional transaction overrides.
   * @returns Promise with the transaction hash or null.
   */
  async composeTradeBySourceTx(
    config: ContractsConfig,
    sourceToken: string,
    targetToken: string,
    tradeActions: TradeActionBNStr[],
    deadline: string,
    minReturn: string,
    overrides?: PayableOverrides
  ): Promise<string | null> {
    return composeTradeBySourceTx(this, config, sourceToken, targetToken, tradeActions, deadline, minReturn, overrides);
  }

  /**
   * Composes a trade transaction based on the target token amount using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param sourceToken The address of the source token.
   * @param targetToken The address of the target token.
   * @param tradeActions An array of trade actions.
   * @param deadline The transaction deadline timestamp.
   * @param maxInput The maximum amount of source tokens to spend.
   * @param overrides Optional transaction overrides.
   * @returns Promise with the transaction hash or null.
   */
  async composeTradeByTargetTx(
    config: ContractsConfig,
    sourceToken: string,
    targetToken: string,
    tradeActions: TradeActionBNStr[],
    deadline: string,
    maxInput: string,
    overrides?: PayableOverrides
  ): Promise<string | null> {
    return composeTradeByTargetTx(this, config, sourceToken, targetToken, tradeActions, deadline, maxInput, overrides);
  }

  /**
   * Posts a tweet to Twitter
   * @param tweet The tweet to post
   * @returns Transaction hash and tweet details
   */
  async postTweet(tweet: z.infer<typeof TwitterPostTweetSchema>) {
    return postTweet(tweet);
  }

  /**
   * Retrieves details about the authenticated user's Twitter account
   * @returns Account details as a string
   */
  async getAccountDetails() {
    return getAccountDetails();
  }

  /**
   * Retrieves mentions for the authenticated user's Twitter account
   * @returns Mentions as a string
   */
  async getAccountMentions(args: z.infer<typeof TwitterAccountMentionsSchema>) {
    return getAccountMentions(args);
  }

  /**
   * Posts a reply to a tweet on Twitter
   * @param args The arguments for posting a reply
   * @returns Transaction hash and reply details
   */
  async postTweetReply(args: z.infer<typeof TwitterPostTweetReplySchema>) {
    return postTweetReply(args);
  }

  // Citrex Protocol methods
  /**
   * Deposits USDC tokens into the Citrex Protocol
   * @param amount The amount of USDC to deposit as a string (e.g., "1.5" for 1.5 USDC)
   * @returns Promise with transaction hash or error message
   */
  async citrexDeposit(amount: string) {
    return citrexDeposit(amount);
  }

  /**
   * Withdraws USDC tokens from the Citrex Protocol
   * @param amount The amount of USDC to withdraw as a string (e.g., "1.5" for 1.5 USDC)
   * @returns Promise with transaction hash or error message
   */
  async citrexWithdraw(amount: string) {
    return citrexWithdraw(amount);
  }

  /**
   * Retrieves all products from the Citrex Protocol
   * @returns Promise with products or error message
   */
  async citrexGetProducts() {
    return citrexGetProducts();
  }

  /**
   * Retrieves the order book for a product from the Citrex Protocol
   * @param symbol The symbol of the product (e.g., "ethperp")
   * @returns Promise with order book or error message
   */
  async citrexGetOrderBook(symbol: string) {
    return citrexGetOrderBook(symbol);
  }

  /**
   * Retrieves the account health for the Citrex Protocol
   * @returns Promise with account health or error message
   */
  async citrexGetAccountHealth() {
    return citrexGetAccountHealth();
  }

  /**
   * Retrieves the tickers for the Citrex Protocol
   * @returns Promise with tickers or error message
   */
  async citrexGetTickers(symbol?: `${string}perp`) {
    if (symbol) {
      return citrexGetTickers(symbol);
    } else {
      return citrexGetTickers();
    }
  }

  /**
   * Calculates the required margin for a new order on Citrex Protocol
   * @param isBuy Whether to buy (true) or sell (false)
   * @param price The price of the asset for the order
   * @param productId The product ID of the asset
   * @param quantity The quantity of the asset to order
   * @returns Promise with the required margin calculation result
   */
  async citrexCalculateMarginRequirement(isBuy: boolean, price: number, productId: number, quantity: number) {
    return citrexCalculateMarginRequirement(isBuy, price, productId, quantity);
  }

  /**
   * Retrieves K-line (candlestick) chart data for a product on Citrex Protocol
   * @param productSymbol The product symbol (e.g., 'btcperp', 'ethperp')
   * @param optionalArgs Optional arguments for the query
   * @returns Promise with K-line data
   */
  async citrexGetKlines(productSymbol: `${string}perp`, optionalArgs?: any) {
    return citrexGetKlines(productSymbol, optionalArgs);
  }

  /**
   * Retrieves information about a specific product on Citrex Protocol
   * @param identifier The product ID or symbol
   * @returns Promise with product information
   */
  async citrexGetProduct(identifier: number | string) {
    return citrexGetProduct(identifier);
  }

  /**
   * Retrieves the current server time from Citrex Protocol
   * @returns Promise with server time information
   */
  async citrexGetServerTime() {
    return citrexGetServerTime();
  }

  /**
   * Retrieves trade history for a product on Citrex Protocol
   * @param productSymbol The product symbol (e.g., 'btcperp', 'ethperp')
   * @param quantity Optional number of trades to fetch
   * @returns Promise with trade history data
   */
  async citrexGetTradeHistory(productSymbol: `${string}perp`, quantity?: number) {
    return citrexGetTradeHistory(productSymbol, quantity);
  }

  /**
   * Cancels and replaces an order on Citrex Protocol
   * @param orderId The unique ID of the order to replace
   * @param orderArgs The new order arguments
   * @returns Promise with the new order information
   */
  async citrexCancelAndReplaceOrder(orderId: `0x${string}`, orderArgs: any) {
    return citrexCancelAndReplaceOrder(orderId, orderArgs);
  }

  /**
   * Cancels all open orders for a specific product on Citrex Protocol
   * @param productId The product ID for which to cancel all orders
   * @returns Promise with cancellation result
   */
  async citrexCancelOpenOrdersForProduct(productId: number) {
    return citrexCancelOpenOrdersForProduct(productId);
  }

  /**
   * Cancels a specific order on Citrex Protocol
   * @param orderId The unique ID of the order to cancel
   * @param productId The product ID of the order
   * @returns Promise with cancellation result
   */
  async citrexCancelOrder(orderId: `0x${string}`, productId: number) {
    return citrexCancelOrder(orderId, productId);
  }

  /**
   * Cancels multiple orders on Citrex Protocol
   * @param ordersArgs Array of [orderId, productId] pairs
   * @returns Promise with cancellation results
   */
  async citrexCancelOrders(ordersArgs: [`0x${string}`, number][]) {
    return citrexCancelOrders(ordersArgs);
  }

  /**
   * Lists all account balances on Citrex Protocol
   * @returns Promise with account balances
   */
  async citrexListBalances() {
    return citrexListBalances();
  }

  /**
   * Lists all open orders on Citrex Protocol
   * @param productSymbol Optional product symbol to filter orders
   * @returns Promise with open orders
   */
  async citrexListOpenOrders(productSymbol?: `${string}perp`) {
    return citrexListOpenOrders(productSymbol);
  }

  /**
   * Lists all positions on Citrex Protocol
   * @param productSymbol Optional product symbol to filter positions
   * @returns Promise with positions
   */
  async citrexListPositions(productSymbol?: `${string}perp`) {
    return citrexListPositions(productSymbol);
  }

  /**
   * Places a single order on Citrex Protocol
   * @param orderArgs The order arguments
   * @returns Promise with order placement result
   */
  async citrexPlaceOrder(orderArgs: any) {
    return citrexPlaceOrder(orderArgs);
  }

  /**
   * Places multiple orders on Citrex Protocol
   * @param ordersArgs Array of order arguments
   * @returns Promise with order placement results
   */
  async citrexPlaceOrders(ordersArgs: any[]) {
    return citrexPlaceOrders(ordersArgs);
  }

  /**
   * Creates a buy/sell strategy using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param baseToken The address of the base token.
   * @param quoteToken The address of the quote token.
   * @param buyPriceLow The lower bound of the buy price range.
   * @param buyPriceMarginal The marginal buy price.
   * @param buyPriceHigh The upper bound of the buy price range.
   * @param buyBudget The budget allocated for buying.
   * @param sellPriceLow The lower bound of the sell price range.
   * @param sellPriceMarginal The marginal sell price.
   * @param sellPriceHigh The upper bound of the sell price range.
   * @param sellBudget The budget allocated for selling.
   * @param overrides Optional transaction overrides.
   * @returns Promise with the transaction hash or null.
   */
  async createBuySellStrategy(
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
    return createBuySellStrategy(this, config, type, baseToken, quoteToken, buyRange, sellRange, buyBudget, sellBudget, overrides);
  }

  /**
   * Creates an overlapping LP strategy using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param baseToken The address of the base token.
   * @param quoteToken The address of the quote token.
   * @param sellPriceHigh The lower bound of the sell price range.
   * @param buyPriceLow The upper bound of the buy price range.
   * @param buyBudget The budget allocated for buying.
   * @param sellBudget The budget allocated for selling.
   * @param overrides Optional transaction overrides.
   * @returns Promise with the transaction hash or null.
   */
  async createOverlappingStrategy(
    config: ContractsConfig,
    baseToken: Address,
    quoteToken: Address,
    buyPriceLow: string | undefined,
    sellPriceHigh: string | undefined,
    buyBudget: string | undefined,
    sellBudget: string | undefined,
    fee: number,
    range: number,
    marketPriceOverride: string | undefined,
    overrides?: PayableOverrides,
  ): Promise<string | null> {
    return createOverlappingStrategy(this, config, baseToken, quoteToken, buyPriceLow, sellPriceHigh, buyBudget, sellBudget, fee, range, marketPriceOverride, overrides);
  }

  /**
   * Deletes a strategy using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param strategyId The ID of the strategy to delete.
   * @returns Promise with the transaction hash or null.
   */
  async deleteStrategy(
    config: ContractsConfig,
    strategyId: string,
  ): Promise<string | null> {
    return deleteStrategy(this, config, strategyId);
  }

  /**
   * Gets the strategies for a user using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param user Optional user address. Defaults to the agent's wallet address.
   * @returns Promise with the user's strategies or null.
   */
  async getUserStrategies(
    config: ContractsConfig,
    user: `0x${string}`,
  ): Promise<Strategy[] | null> {
    return getUserStrategies(config, user);
  }

  /**
   * Updates a strategy using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param strategyId The ID of the strategy to update.
   * @param update The strategy update data.
   * @param encoded The encoded strategy data.
   * @param buyPriceMarginal Optional marginal buy price options.
   * @param sellPriceMarginal Optional marginal sell price options.
   * @param overrides Optional transaction overrides.
   * @returns Promise with the transaction hash or null.
   */
  async updateStrategy(
    config: ContractsConfig,
    strategyId: string,
    update: StrategyUpdate,
    encoded: EncodedStrategyBNStr,
    buyPriceMarginal?: MarginalPriceOptions | string,
    sellPriceMarginal?: MarginalPriceOptions | string,
    overrides?: PayableOverrides
  ): Promise<string | null> {
    return updateStrategy(this, config, strategyId, update, encoded, buyPriceMarginal, sellPriceMarginal, overrides);
  }

}