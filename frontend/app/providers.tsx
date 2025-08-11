'use client'

import React from 'react'
import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { Chain } from 'wagmi/chains'
import { RainbowKitProvider, getDefaultWallets, connectorsForWallets } from '@rainbow-me/rainbowkit'
import { publicProvider } from 'wagmi/providers/public'
import { alchemyProvider } from 'wagmi/providers/alchemy'
import '@rainbow-me/rainbowkit/styles.css'

// GraphQL client setup
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
})

const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
})

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

const SEI_NETWORKS = {
  mainnet: {
    chainId: 1329, // 0x531 in hex
    chainName: 'Sei Network',
    nativeCurrency: {
      name: 'Sei',
      symbol: 'SEI',
      decimals: 18,
    },
    rpcUrls: ['https://evm-rpc.sei-apis.com'],
    blockExplorerUrls: ['https://seistream.app'],
  },
  testnet: {
    chainId: 1328, // 0x530 in hex
    chainName: 'Sei Testnet (atlantic-2)',
    nativeCurrency: {
      name: 'Sei',
      symbol: 'SEI',
      decimals: 18,
    },
    rpcUrls: ['https://evm-rpc-testnet.sei-apis.com'],
    blockExplorerUrls: ['https://testnet.seistream.app'],
  },
} as const;


const seiMainnet : Chain = {
  id: SEI_NETWORKS.mainnet.chainId,
  name: SEI_NETWORKS.mainnet.chainName,
  nativeCurrency: SEI_NETWORKS.mainnet.nativeCurrency,
  rpcUrls: {
    default: {
      http: SEI_NETWORKS.mainnet.rpcUrls,
    },
    public: {
      http: SEI_NETWORKS.mainnet.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'SeiTrace',
      url: SEI_NETWORKS.mainnet.blockExplorerUrls[0],
    },
  },
  testnet: false,
  network: 'sei-mainnet',
};

// Wagmi configuration
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [ seiMainnet],
  [
    alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_ID || '' }),
    publicProvider(),
  ]
)

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || ''

const { wallets } = getDefaultWallets({
  appName: 'NEXUS AI',
  projectId,
  chains,
})

const connectors = connectorsForWallets(wallets)

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <ApolloProvider client={apolloClient}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ApolloProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  )
}