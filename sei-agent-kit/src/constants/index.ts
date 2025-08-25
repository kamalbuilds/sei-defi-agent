import { IToken } from "../types";

export const SEI_RPC_URL = "https://evm-rpc.sei-apis.com/";
export const MAX_BLOCK_AGE = 2000; // past this many blocks, the SDK won't attempt to catch up by processing events and instead call the contracts for strategy info.

export const TOKENS: { [key: `0x${string}`]: IToken } = {
  "0x0": {
    id: "sei_native_sei",
    attributes: {
      address: "0x0",
      name: "sei",
      symbol: "sei",
      decimals: 18,
      initialSupply: "",
      logoUrl:
        "https://raw.githubusercontent.com/Sei-Public-Goods/sei-assetlist/main/images/Sei.png",
    },
  },
  "0x5f0e07dfee5832faa00c63f2d33a0d79150e8598": {
    id: "sei_0x5f0e07dfee5832faa00c63f2d33a0d79150e8598",
    attributes: {
      address: "0x5f0e07dfee5832faa00c63f2d33a0d79150e8598",
      name: "seiyan",
      symbol: "seiyan",
      decimals: 6,
      initialSupply: "1000000000000000000000",
      logoUrl:
        "https://raw.githubusercontent.com/Sei-Public-Goods/sei-assetlist/main/images/SEIYAN.png",
    },
  },
  "0xe30fedd158a2e3b13e9badaeabafc5516e95e8c7": {
    id: "sei_0xe30fedd158a2e3b13e9badaeabafc5516e95e8c7",
    attributes: {
      address: "0xe30fedd158a2e3b13e9badaeabafc5516e95e8c7",
      name: "wrapped sei",
      symbol: "wsei",
      decimals: 18,
      initialSupply: "10000000000000000000",
      logoUrl:
        "https://raw.githubusercontent.com/Sei-Public-Goods/sei-assetlist/main/images/Sei.png",
    },
  },
  "0x5cf6826140c1c56ff49c808a1a75407cd1df9423": {
    id: "sei_0x5cf6826140c1c56ff49c808a1a75407cd1df9423",
    attributes: {
      address: "0x5cf6826140c1c56ff49c808a1a75407cd1df9423",
      name: "isei",
      symbol: "isei",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://raw.githubusercontent.com/Sei-Public-Goods/sei-assetlist/main/images/iSEI.png",
    },
  },
  "0x3894085ef7ff0f0aedf52e2a2704928d1ec074f1": {
    id: "sei_0x3894085ef7ff0f0aedf52e2a2704928d1ec074f1",
    attributes: {
      address: "0x3894085ef7ff0f0aedf52e2a2704928d1ec074f1",
      name: "usd coin",
      symbol: "usdc",
      decimals: 6,
      initialSupply: "10000000000000000000",
      logoUrl:
        "https://raw.githubusercontent.com/Sei-Public-Goods/sei-assetlist/main/images/USDCoin.svg",
    },
  },
  "0xb75d0b03c06a926e488e2659df1a861f860bd3d1": {
    id: "sei_0xb75d0b03c06a926e488e2659df1a861f860bd3d1",
    attributes: {
      address: "0xb75d0b03c06a926e488e2659df1a861f860bd3d1",
      name: "tether usd",
      symbol: "usdt",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.coingecko.com/coins/images/325/standard/Tether.png?1696501661",
    },
  },
  "0x160345fc359604fc6e70e3c5facbde5f7a9342d8": {
    id: "sei_0x160345fc359604fc6e70e3c5facbde5f7a9342d8",
    attributes: {
      address: "0x160345fc359604fc6e70e3c5facbde5f7a9342d8",
      name: "bridged wrapped ether (stargate)",
      symbol: "weth",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://raw.githubusercontent.com/Sei-Public-Goods/sei-assetlist/main/images/BridgedWrappedEther(Stargate).png",
    },
  },
  "0xc18b6a15fb0ceaf5eb18696eefcb5bc7b9107149": {
    id: "sei_0xc18b6a15fb0ceaf5eb18696eefcb5bc7b9107149",
    attributes: {
      address: "0xc18b6a15fb0ceaf5eb18696eefcb5bc7b9107149",
      name: "popo",
      symbol: "popo",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.coingecko.com/coins/images/39686/standard/8a872ee5-dfc6-4139-a157-9cdcbbeb2f59.jpeg?1723658023",
    },
  },
  "0x95597eb8d227a7c4b4f5e807a815c5178ee6dbe1": {
    id: "sei_0x95597eb8d227a7c4b4f5e807a815c5178ee6dbe1",
    attributes: {
      address: "0x95597eb8d227a7c4b4f5e807a815c5178ee6dbe1",
      name: "milli",
      symbol: "milli",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/milli.png",
    },
  },
  "0x64445f0aecc51e94ad52d8ac56b7190e764e561a": {
    id: "sei_0x64445f0aecc51e94ad52d8ac56b7190e764e561a",
    attributes: {
      address: "0x64445f0aecc51e94ad52d8ac56b7190e764e561a",
      name: "fxs",
      symbol: "fxs",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.coingecko.com/coins/images/13423/standard/Frax_Shares_icon.png?1696513183",
    },
  },
  "0x5c85726f71afb7e26d769fb559ce0168ce1f8f4e": {
    id: "sei_0x5c85726f71afb7e26d769fb559ce0168ce1f8f4e",
    attributes: {
      address: "0x5c85726f71afb7e26d769fb559ce0168ce1f8f4e",
      name: "sei usagi",
      symbol: "usa",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/usa.png",
    },
  },

  "0x9c367a272f8e318d10118c6367fd69def30e430e": {
    id: "sei_0x9c367a272f8e318d10118c6367fd69def30e430e",
    attributes: {
      address: "0x9c367a272f8e318d10118c6367fd69def30e430e",
      name: "pepei",
      symbol: "pepei",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/pepei.png",
    },
  },
  "0xecf7f1efc9620a911339619c91c9fa0f71e0600e": {
    id: "sei_0xecf7f1efc9620a911339619c91c9fa0f71e0600e",
    attributes: {
      address: "0xecf7f1efc9620a911339619c91c9fa0f71e0600e",
      name: "seiyun",
      symbol: "seiyun",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/seiyun.png",
    },
  },
  "0xd78be621436e69c81e4d0e9f29be14c5ec51e6ae": {
    id: "sei_0xd78be621436e69c81e4d0e9f29be14c5ec51e6ae",
    attributes: {
      address: "0xd78be621436e69c81e4d0e9f29be14c5ec51e6ae",
      name: "$gonad",
      symbol: "$gonad",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/gonad.png",
    },
  },
  "0x9134d733aac991b96e899af657c717276a627e32": {
    id: "sei_0x9134d733aac991b96e899af657c717276a627e32",
    attributes: {
      address: "0x9134d733aac991b96e899af657c717276a627e32",
      name: "fuck roy lopez",
      symbol: "$froy",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/froy.png",
    },
  },
  "0xb8d41db605a3258010d531429e85b13c7abde579": {
    id: "sei_0xb8d41db605a3258010d531429e85b13c7abde579",
    attributes: {
      address: "0xb8d41db605a3258010d531429e85b13c7abde579",
      name: "chuckcoin",
      symbol: "chuck",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/chuck.png",
    },
  },
  "0xc6bc81a0e287cc8103cc002147a9d76cae4cd6e5": {
    id: "sei_0xc6bc81a0e287cc8103cc002147a9d76cae4cd6e5",
    attributes: {
      address: "0xc6bc81a0e287cc8103cc002147a9d76cae4cd6e5",
      name: "seiballz",
      symbol: "ballz",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/ballz.png",
    },
  },
  "0xf5020dc8ec5e0ef8869ecc3044933356650b61cf": {
    id: "sei_0xf5020dc8ec5e0ef8869ecc3044933356650b61cf",
    attributes: {
      address: "0xf5020dc8ec5e0ef8869ecc3044933356650b61cf",
      name: "jay jeo",
      symbol: "jayjeo",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/jayjeo.png",
    },
  },
  "0x6291148ae49e0f0d847bb97c4e060e49d87638ba": {
    id: "sei_0x6291148ae49e0f0d847bb97c4e060e49d87638ba",
    attributes: {
      address: "0x6291148ae49e0f0d847bb97c4e060e49d87638ba",
      name: "inspector",
      symbol: "rex",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/rex.png",
    },
  },
  "0x80eede496655fb9047dd39d9f418d5483ed600df": {
    id: "sei_0x80eede496655fb9047dd39d9f418d5483ed600df",
    attributes: {
      address: "0x80eede496655fb9047dd39d9f418d5483ed600df",
      name: "frax",
      symbol: "frax",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.coingecko.com/coins/images/13422/standard/FRAX_icon.png",
    },
  },
  "0x3ec3849c33291a9ef4c5db86de593eb4a37fde45": {
    id: "sei_0x3ec3849c33291a9ef4c5db86de593eb4a37fde45",
    attributes: {
      address: "0x3ec3849c33291a9ef4c5db86de593eb4a37fde45",
      name: "staked frax ether",
      symbol: "sfrxeth",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.coingecko.com/coins/images/28285/standard/sfrxETH_icon.png",
    },
  },

  "0x43edd7f3831b08fe70b7555ddd373c8bf65a9050": {
    id: "sei_0x43edd7f3831b08fe70b7555ddd373c8bf65a9050",
    attributes: {
      address: "0x43edd7f3831b08fe70b7555ddd373c8bf65a9050",
      name: "frax ether",
      symbol: "frxeth",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.coingecko.com/coins/images/28284/standard/frxETH_icon.png",
    },
  },

  "0x9faaea2cdd810b21594e54309dc847842ae301ce": {
    id: "sei_0x9faaea2cdd810b21594e54309dc847842ae301ce",
    attributes: {
      address: "0x9faaea2cdd810b21594e54309dc847842ae301ce",
      name: "seiyaneth",
      symbol: "seiyaneth",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl: "https://sei.dinero.xyz/images/seiEth.svg",
    },
  },
  "0xa8a3a5013104e093245164ea56588dbe10a3eb48": {
    id: "sei_0xa8a3a5013104e093245164ea56588dbe10a3eb48",
    attributes: {
      address: "0xa8a3a5013104e093245164ea56588dbe10a3eb48",
      name: "sseth",
      symbol: "sseth",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.coingecko.com/coins/images/50331/standard/2024-09-18_19.52.53.jpg",
    },
  },
  "0xdd7d5e4ea2125d43c16eed8f1ffefffa2f4b4af6": {
    id: "sei_0xdd7d5e4ea2125d43c16eed8f1ffefffa2f4b4af6",
    attributes: {
      address: "0xdd7d5e4ea2125d43c16eed8f1ffefffa2f4b4af6",
      name: "jelly token",
      symbol: "jly",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.coingecko.com/coins/images/31805/standard/short.png",
    },
  },
  "0x51121bcae92e302f19d06c193c95e1f7b81a444b": {
    id: "sei_0x51121bcae92e302f19d06c193c95e1f7b81a444b",
    attributes: {
      address: "0x51121bcae92e302f19d06c193c95e1f7b81a444b",
      name: "yaka",
      symbol: "yaka",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.coingecko.com/markets/images/1695/large/yaka-finance.png",
    },
  },
  "0x37a4dd9ced2b19cfe8fac251cd727b5787e45269": {
    id: "sei_0x37a4dd9ced2b19cfe8fac251cd727b5787e45269",
    attributes: {
      address: "0x37a4dd9ced2b19cfe8fac251cd727b5787e45269",
      name: "fastusd",
      symbol: "fastusd",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://assets.coingecko.com/coins/images/50766/standard/2024-10-16_14.54.03.jpg",
    },
  },
  "0x0dd9e6a6aeb91f1e3596f69d5443b6ca2e864896": {
    id: "sei_0x0dd9e6a6aeb91f1e3596f69d5443b6ca2e864896",
    attributes: {
      address: "0x0dd9e6a6aeb91f1e3596f69d5443b6ca2e864896",
      name: "shenrn",
      symbol: "shenrn",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1845176239599833100/49Zri2GZ_400x400.jpg",
    },
  },
  "0xbd82f3bfe1df0c84faec88a22ebc34c9a86595dc": {
    id: "sei_0xbd82f3bfe1df0c84faec88a22ebc34c9a86595dc",
    attributes: {
      address: "0xbd82f3bfe1df0c84faec88a22ebc34c9a86595dc",
      name: "chips",
      symbol: "chips",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1844775184827310080/nBYzvxO__400x400.jpg",
    },
  },
  "0xe85dc0cceca105755753fef452c091def5324138": {
    id: "sei_0xe85dc0cceca105755753fef452c091def5324138",
    attributes: {
      address: "0xe85dc0cceca105755753fef452c091def5324138",
      name: "SAKEINU",
      symbol: "SAKE",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1788072882423410688/SfbieS0D_400x400.jpg",
    },
  },
  "0x3ea30c06f4ba6f696d3ba4b660c39da96ed8f686": {
    id: "sei_0x3ea30c06f4ba6f696d3ba4b660c39da96ed8f686",
    attributes: {
      address: "0x3ea30c06f4ba6f696d3ba4b660c39da96ed8f686",
      name: "Seibacca",
      symbol: "SBC",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1848737046749138945/zfzUen47_400x400.jpg",
    },
  },
  "0xd0d622de44a521404dc50e4abef08de82269dcbf": {
    id: "sei_0xd0d622de44a521404dc50e4abef08de82269dcbf",
    attributes: {
      address: "0xd0d622de44a521404dc50e4abef08de82269dcbf",
      name: "SEIFUN",
      symbol: "SFN",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1821502633259008000/38s9t5Is_400x400.jpg",
    },
  },
  "0x893cc8a006b88beef66c79bbb1c14b9c6c0ad7cc": {
    id: "sei_0x893cc8a006b88beef66c79bbb1c14b9c6c0ad7cc",
    attributes: {
      address: "0x893cc8a006b88beef66c79bbb1c14b9c6c0ad7cc",
      name: "UMI",
      symbol: "UMI",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1841830626577600512/GvjRXEdp_400x400.jpg",
    },
  },
  "0x962aae191622498bca205c1c1b73e59ac7d295f2": {
    id: "sei_0x962aae191622498bca205c1c1b73e59ac7d295f2",
    attributes: {
      address: "0x962aae191622498bca205c1c1b73e59ac7d295f2",
      name: "WILSON",
      symbol: "WILSON",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://i.seipex.fi/upload/w_100,q_90/https://i.imgur.com/DkSqxty.jpeg",
    },
  },
  "0x3a0a7a3ca25c17d15e8d51332fb25bfea274d107": {
    id: "sei_0x3a0a7a3ca25c17d15e8d51332fb25bfea274d107",
    attributes: {
      address: "0x3a0a7a3ca25c17d15e8d51332fb25bfea274d107",
      name: "SEIPEX CREDITS",
      symbol: "SPEX",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://dzyb4dm7r8k8w.cloudfront.net/prod/logos/0x3A0A7a3cA25C17D15E8d51332fb25BFEA274d107/logo.png",
    },
  },
  "0x67da7010c6c231ad620e3940e707adb6c1a08f23": {
    id: "sei_0x67da7010c6c231ad620e3940e707adb6c1a08f23",
    attributes: {
      address: "0x67da7010c6c231ad620e3940e707adb6c1a08f23",
      name: "SeiWhale",
      symbol: "SEIWHALE",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://dzyb4dm7r8k8w.cloudfront.net/prod/logos/0x67DA7010C6c231AD620E3940e707adB6c1a08f23/logo.png",
    },
  },
  "0xf20903d034b12a7266055fe97cebdb9199ec6925": {
    id: "sei_0xf20903d034b12a7266055fe97cebdb9199ec6925",
    attributes: {
      address: "0xf20903d034b12a7266055fe97cebdb9199ec6925",
      name: "BOOBLE",
      symbol: "BOOBLE",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://dzyb4dm7r8k8w.cloudfront.net/prod/logos/0xF20903d034B12a7266055FE97cEBdB9199Ec6925/logo.png",
    },
  },
  "0x51c8f5d0305ac6880b775eedd217e400485c6a19": {
    id: "sei_0x51c8f5d0305ac6880b775eedd217e400485c6a19",
    attributes: {
      address: "0x51c8f5d0305ac6880b775eedd217e400485c6a19",
      name: "NAPCAT",
      symbol: "NAPCAT",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1835266232876208128/B639XW3h_400x400.jpg",
    },
  },
  "0x490736a46aaba689db5265510b5c53af4c23ded4": {
    id: "sei_0x490736a46aaba689db5265510b5c53af4c23ded4",
    attributes: {
      address: "0x490736a46aaba689db5265510b5c53af4c23ded4",
      name: "Happy Ape",
      symbol: "HAPE",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://i.seipex.fi/upload/w_100,q_90/https://hapecoin.s3.eu-west-3.amazonaws.com/closeup.png",
    },
  },
  "0xc972106ca2560fa0065e1ca01c9dc6d6e80cc7a1": {
    id: "sei_0xc972106ca2560fa0065e1ca01c9dc6d6e80cc7a1",
    attributes: {
      address: "0xc972106ca2560fa0065e1ca01c9dc6d6e80cc7a1",
      name: "SLOW",
      symbol: "SLOW",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://i.seipex.fi/upload/w_100,q_90/https://pbs.twimg.com/profile_images/1839829156970016770/YNmmnFN2_400x400.jpg",
    },
  },
  "0x8c5529ad032c48bc6413df8e8dc83d26dc680079": {
    id: "sei_0x8c5529ad032c48bc6413df8e8dc83d26dc680079",
    attributes: {
      address: "0x8c5529ad032c48bc6413df8e8dc83d26dc680079",
      name: "Sei Less",
      symbol: "LESS",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1845438832008671234/yWw7EH2__400x400.jpg",
    },
  },
  "0xd0c7edf2109be009364ac3db76c6fe8a75728657": {
    id: "sei_0xd0c7edf2109be009364ac3db76c6fe8a75728657",
    attributes: {
      address: "0xd0c7edf2109be009364ac3db76c6fe8a75728657",
      name: "LORD SHISHO",
      symbol: "SHISHO",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://dzyb4dm7r8k8w.cloudfront.net/prod/logos/0xd0c7edf2109be009364ac3db76c6fe8a75728657/logo.png",
    },
  },
  "0x74547390fe40d5cea666008d44febe1340e7a3b0": {
    id: "sei_0x74547390fe40d5cea666008d44febe1340e7a3b0",
    attributes: {
      address: "0x74547390fe40d5cea666008d44febe1340e7a3b0",
      name: "Oolong",
      symbol: "OOLONG",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1840370770914029569/SbcQWwcE_400x400.jpg",
    },
  },
  "0x69e48ce9cf965acc1de2ad5ad2fdbc3bdb51509b": {
    id: "sei_0x69e48ce9cf965acc1de2ad5ad2fdbc3bdb51509b",
    attributes: {
      address: "0x69e48ce9cf965acc1de2ad5ad2fdbc3bdb51509b",
      name: "COOK",
      symbol: "COOK",
      decimals: 6,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://dzyb4dm7r8k8w.cloudfront.net/prod/logos/0x69e48ce9cf965acc1de2ad5ad2fdbc3bdb51509b/logo.png",
    },
  },
  "0xf9bdbf259ece5ae17e29bf92eb7abd7b8b465db9": {
    id: "sei_0xf9bdbf259ece5ae17e29bf92eb7abd7b8b465db9",
    attributes: {
      address: "0xf9bdbf259ece5ae17e29bf92eb7abd7b8b465db9",
      name: "Froggy",
      symbol: "FROG",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1856897634872528896/4J-jziSw_400x400.jpg",
    },
  },
  "0xcf40acbed3f6307c33bf00680c9edae8f7d789ff": {
    id: "sei_0xcf40acbed3f6307c33bf00680c9edae8f7d789ff",
    attributes: {
      address: "0xcf40acbed3f6307c33bf00680c9edae8f7d789ff",
      name: "POCHITA",
      symbol: "POCHITA",
      decimals: 18,
      initialSupply: "10000000000000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1847462818582581253/UG-_IaNJ_400x400.jpg",
    },
  },
  "0x9d9b12c69555669966d36596c56061b6cc0a937d": {
    id: "sei_0x9D9b12c69555669966D36596C56061B6Cc0A937D",
    attributes: {
      address: "0x9D9b12c69555669966D36596C56061B6Cc0A937D",
      name: "xSEIYAN",
      symbol: "xSEIYAN",
      decimals: 18,
      initialSupply: "1000000000000000000000",
      logoUrl: "https://i.ibb.co/jg4GKKN/SEIYAN-V2-Logo.png",
    },
  },
  "0x57fba850efca7c72c270a252383767d741c3017f": {
    id: "sei_0x57fBA850EfcA7c72c270A252383767D741C3017F",
    attributes: {
      address: "0x57fBA850EfcA7c72c270A252383767D741C3017F",
      name: "KOSEI",
      symbol: "KOSEI",
      decimals: 6,
      initialSupply: "1000000000000000000000",
      logoUrl:
        "https://pbs.twimg.com/profile_images/1848321890269487104/fvfAQPxi_400x400.jpg",
    },
  },
  "0x00bc9af972b5fb3b7fa04827bd3c17d4599bad8b": {
    id: "sei_0x00bc9aF972B5fb3b7fA04827bD3C17d4599BAd8b",
    attributes: {
      address: "0x00bc9aF972B5fb3b7fA04827bD3C17d4599BAd8b",
      name: "WAIT",
      symbol: "WAIT",
      decimals: 6,
      initialSupply: "1000000000000000000000",
      logoUrl:
        "https://dd.dexscreener.com/ds-data/tokens/seiv2/0x00bc9af972b5fb3b7fa04827bd3c17d4599bad8b.png",
    },
  },
  "0x0555e30da8f98308edb960aa94c0db47230d2b9c": {
    id: "sei_0x0555e30da8f98308edb960aa94c0db47230d2b9c",
    attributes: {
      address: "0x0555e30da8f98308edb960aa94c0db47230d2b9c",
      name: "Wrapped BTC",
      symbol: "WBTC",
      decimals: 8,
      initialSupply: "1000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/wbtc.png",
    },
  },
  "0x83c82f0f959ad3eff528ee513b43808aa53f4b37": {
    id: "sei_0x83c82f0f959ad3eff528ee513b43808aa53f4b37",
    attributes: {
      address: "0x83c82f0f959ad3eff528ee513b43808aa53f4b37",
      name: "Rock",
      symbol: "ROCK",
      decimals: 6,
      initialSupply: "1000000000000000000000",
      logoUrl:
        "https://assets.cambrian.wtf/logos/rock.png",
    },
  },
  "0x09d9420332bff75522a45fcff4855f82a0a3ff50": {
    id: "sei_0x09d9420332bff75522a45fcff4855f82a0a3ff50",
    attributes: {
      address: "0x09d9420332bff75522a45fcff4855f82a0a3ff50",
      name: "Dinero",
      symbol: "DINERO",
      decimals: 18,
      initialSupply: "1000000000000000000000",
      logoUrl: "https://cdn.jellyverse.org/tokens/dinero-token.svg",
    },
  },
} as const;
