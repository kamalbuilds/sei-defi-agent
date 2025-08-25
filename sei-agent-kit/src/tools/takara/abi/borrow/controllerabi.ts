export const comptrollerAbi = [
  {
    inputs: [{ internalType: 'address[]', name: 'cTokens', type: 'address[]' }],
    name: 'enterMarkets',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }, { internalType: 'address', name: 'tToken', type: 'address' }],
    name: 'checkMembership',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'markets',
    outputs: [
      { internalType: 'bool', name: 'isListed', type: 'bool' },
      { internalType: 'uint256', name: 'collateralFactorMantissa', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function',
  }
] as const;