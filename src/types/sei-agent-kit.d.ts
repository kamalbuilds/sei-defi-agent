// Type declarations for sei-agent-kit
declare module 'sei-agent-kit' {
  import { Address, WalletClient as ViemWalletClient, PublicClient as ViemPublicClient } from 'viem';
  
  export class SeiAgentKit {
    publicClient: ViemPublicClient;
    walletClient: ViemWalletClient;
    wallet_address: Address;
    token: string | undefined;
    
    constructor(private_key: string, provider?: any);
    
    getERC20Balance(contract_address?: Address): Promise<string>;
    ERC20Transfer(amount: string, recipient: Address, ticker?: string): Promise<string>;
    getERC721Balance(tokenAddress: Address): Promise<string>;
    ERC721Transfer(amount: string, recipient: Address, tokenAddress: Address, tokenId: string): Promise<string>;
    ERC721Mint(recipient: Address, tokenAddress: Address, tokenId: bigint): Promise<string>;
    getTokenAddressFromTicker(ticker: string): Promise<Address | null>;
    stake(amount: string): Promise<string>;
    unstake(amount: string): Promise<string>;
    swap(amount: string, tokenIn: Address, tokenOut: Address): Promise<string>;
    
    // Takara methods
    mintTakara(ticker: string, mintAmount: string): Promise<`0x${string}`>;
    borrowTakara(ticker: string, borrowAmount: string): Promise<`0x${string}`>;
    repayTakara(ticker: string, repayAmount: string): Promise<any>;
    redeemTakara(ticker: string, redeemAmount: string, redeemType?: any): Promise<any>;
    getRedeemableAmount(ticker: string, userAddress?: Address): Promise<any>;
    getBorrowBalance(ticker: string, userAddress?: Address): Promise<any>;
    
    // Citrex methods
    citrexDeposit(amount: string): Promise<string>;
    citrexWithdraw(amount: string): Promise<"Withdrawal successful" | "Withdrawal failed">;
    citrexGetProducts(): Promise<any>;
    citrexGetOrderBook(symbol: string): Promise<any>;
    citrexGetAccountHealth(): Promise<any>;
    citrexGetTickers(symbol?: `${string}perp`): Promise<any>;
    citrexPlaceOrder(orderArgs: any): Promise<any>;
    citrexCancelOrder(orderId: `0x${string}`, productId: number): Promise<any>;
    citrexListBalances(): Promise<any>;
    citrexListOpenOrders(productSymbol?: `${string}perp`): Promise<any>;
    citrexListPositions(productSymbol?: `${string}perp`): Promise<any>;
    
    // Twitter methods
    postTweet(tweet: any): Promise<string>;
    getAccountDetails(): Promise<string>;
    getAccountMentions(args: any): Promise<string>;
    postTweetReply(args: any): Promise<string>;
  }
  
  export function createSeiTools(): any;
  
  export * from './types';
}