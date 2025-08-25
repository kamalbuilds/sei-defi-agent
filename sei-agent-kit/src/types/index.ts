export interface IToken {
  id: string,
  attributes: {
    address: `0x${string}`,
    name: string,
    symbol: string,
    decimals: number,
    initialSupply: string,
    logoUrl: string,
  },
};

/**
 * Supported model providers
 */
export enum ModelProviderName {
  ANTHROPIC = "anthropic",
  COHERE = "cohere",
  GOOGLE = "google",
  GROQ = "groq",
  MISTRAL = "mistral",
  OPENAI = "openai",
}