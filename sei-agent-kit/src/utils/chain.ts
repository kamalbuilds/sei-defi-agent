export type ChainConfig = {
  chainId?: number;
  rpcUrl: string;
  evmRpcUrl: string;
  restUrl: string;
  contractAddress: string;
  explorerUrl: string;
  evmEnabled: boolean;
};

const chainIdConfigMap: Record<string, ChainConfig> = {
  'silo-test': {
    rpcUrl: 'https://silo-test.seinetwork.io/',
    evmRpcUrl: '',
    restUrl: 'http://3.137.205.53:1317/',
    contractAddress:
      'sei14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9sh9m79m',
    explorerUrl: '',
    evmEnabled: true,
  },
  'atlantic-2': {
    rpcUrl: 'https://rpc.atlantic-2.seinetwork.io/',
    evmRpcUrl: '',
    restUrl: 'https://rest.atlantic-2.seinetwork.io/',
    contractAddress:
      'sei1yfaa3wp2znmn8943pefcmm6kzcguvm4e7gvujk5vf6rze3uvgfjskql4d3',
    explorerUrl: 'https://www.seiscan.app/atlantic-2/txs/',
    evmEnabled: true,
  },
  'arctic-1': {
    chainId: 713715,
    rpcUrl: 'https://rpc-arctic-1.sei-apis.com/',
    evmRpcUrl: 'https://evm-rpc-arctic-1.sei-apis.com',
    restUrl: 'https://rest-arctic-1.sei-apis.com/',
    contractAddress:
      'sei1dkcsehtk7vq2ta9x4kdazlcpr4s58xfxt3dvuj98025rmleg4g2qqwe5fx',
    explorerUrl: 'https://seistream.app/transactions/',
    evmEnabled: true,
  },
  'pacific-1': {
    chainId: 0x531, // 1329
    rpcUrl: 'https://rpc.sei-apis.com/',
    evmRpcUrl: 'https://evm-rpc.sei-apis.com/',
    restUrl: 'https://rest.sei-apis.com/',
    contractAddress:
      'sei1e3gttzq5e5k49f9f5gzvrl0rltlav65xu6p9xc0aj7e84lantdjqp7cncc',
    explorerUrl: 'https://seitrace.com/tx/',
    evmEnabled: true,
  },
};

export function getChainConfig(chainId: string = 'mainnet'): ChainConfig {
  // Map 'mainnet' to 'pacific-1' as it's the main SEI network
  const effectiveChainId = chainId === 'mainnet' ? 'pacific-1' : chainId;
  return chainIdConfigMap[effectiveChainId] ?? chainIdConfigMap['pacific-1'];
}