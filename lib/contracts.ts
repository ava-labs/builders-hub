// Known contract addresses for popular Avalanche C-Chain dApps
// All addresses are lowercase for easy comparison

export interface ContractInfo {
  address: string;
  name: string;
  protocol: string;
  category: 'dex' | 'lending' | 'derivatives' | 'bridge' | 'nft' | 'yield' | 'gaming' | 'token' | 'infrastructure' | 'icm' | 'mev' | 'other';
  type: 'router' | 'factory' | 'pool' | 'vault' | 'token' | 'staking' | 'rewards' | 'orderbook' | 'controller' | 'other';
}

// Contract registry - comprehensive list of Avalanche contracts
export const CONTRACT_REGISTRY: Record<string, ContractInfo> = {
  // ============ TRADER JOE / LFJ ============
  '0x60ae616a2155ee3d9a68541ba4544862310933d4': {
    address: '0x60ae616a2155ee3d9a68541ba4544862310933d4',
    name: 'Joe Router V1',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'router',
  },
  '0x9ad6c38be94206ca50bb0d90783181662f0cfa10': {
    address: '0x9ad6c38be94206ca50bb0d90783181662f0cfa10',
    name: 'Joe Factory V1',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'factory',
  },
  '0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd': {
    address: '0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd',
    name: 'JOE Token',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'token',
  },
  '0x57319d41f71e81f3c65f2a47ca4e001ebafd4f33': {
    address: '0x57319d41f71e81f3c65f2a47ca4e001ebafd4f33',
    name: 'JoeBar (xJOE)',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'staking',
  },
  '0xd6a4f121ca35509af06a0be99093d08462f53052': {
    address: '0xd6a4f121ca35509af06a0be99093d08462f53052',
    name: 'MasterChefJoeV2',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'staking',
  },
  '0x188bed1968b795d5c9022f6a0bb5931ac4c18f00': {
    address: '0x188bed1968b795d5c9022f6a0bb5931ac4c18f00',
    name: 'MasterChefJoeV3',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'staking',
  },
  // LB Proxy
  '0x7bfd7192e76d950832c77bb412aae841049d8d9b': {
    address: '0x7bfd7192e76d950832c77bb412aae841049d8d9b',
    name: 'TransparentUpgradeableProxy (LB)',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'router',
  },
  // LB (Liquidity Book) V2.0
  '0x6e77932a92582f504ff6c4bdbcef7da6c198aeef': {
    address: '0x6e77932a92582f504ff6c4bdbcef7da6c198aeef',
    name: 'LB Factory V2.0',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'factory',
  },
  '0xe3ffc583dc176575eea7fd9df2a7c65f7e23f4c3': {
    address: '0xe3ffc583dc176575eea7fd9df2a7c65f7e23f4c3',
    name: 'LB Router V2.0',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'router',
  },
  // LB V2.1
  '0x8e42f2f4101563bf679975178e880fd87d3efd4e': {
    address: '0x8e42f2f4101563bf679975178e880fd87d3efd4e',
    name: 'LB Factory V2.1',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'factory',
  },
  '0xb4315e873dbcf96ffd0acd8ea43f689d8c20fb30': {
    address: '0xb4315e873dbcf96ffd0acd8ea43f689d8c20fb30',
    name: 'LB Router V2.1',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'router',
  },
  '0xd76019a16606fda4651f636d9751f500ed776250': {
    address: '0xd76019a16606fda4651f636d9751f500ed776250',
    name: 'LB Quoter V2.1',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'other',
  },
  // LB V2.2
  '0xb43120c4745967fa9b93e79c149e66b0f2d6fe0c': {
    address: '0xb43120c4745967fa9b93e79c149e66b0f2d6fe0c',
    name: 'LB Factory V2.2',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'factory',
  },
  '0x18556da13313f3532c54711497a8fedac273220e': {
    address: '0x18556da13313f3532c54711497a8fedac273220e',
    name: 'LB Router V2.2',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'router',
  },
  '0x9a550a522bbadfb69019b0432800ed17855a51c3': {
    address: '0x9a550a522bbadfb69019b0432800ed17855a51c3',
    name: 'LB Quoter V2.2',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'other',
  },
  // Joe Aggregator
  '0x45a62b090df48243f12a21897e7ed91863e2c86b': {
    address: '0x45a62b090df48243f12a21897e7ed91863e2c86b',
    name: 'Joe Aggregator',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'router',
  },
  '0x46ba84780f9a7b34c8b0e24df07a260fa952195d': {
    address: '0x46ba84780f9a7b34c8b0e24df07a260fa952195d',
    name: 'LimitOrderManager',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'orderbook',
  },
  '0xa3d87597fdafc3b8f3ac6b68f90cd1f4c05fa960': {
    address: '0xa3d87597fdafc3b8f3ac6b68f90cd1f4c05fa960',
    name: 'Vault Factory',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'factory',
  },
  '0x57ff9d1a7cf23fd1a9fd9dc07823f950a22a718c': {
    address: '0x57ff9d1a7cf23fd1a9fd9dc07823f950a22a718c',
    name: 'APTFarm',
    protocol: 'Trader Joe',
    category: 'dex',
    type: 'staking',
  },

  // ============ PANGOLIN ============
  '0xe54ca86531e17ef3616d22ca28b0d458b6c89106': {
    address: '0xe54ca86531e17ef3616d22ca28b0d458b6c89106',
    name: 'Pangolin Router',
    protocol: 'Pangolin',
    category: 'dex',
    type: 'router',
  },
  '0xefa94de7a4656d787667c749f7e1223d71e9fd88': {
    address: '0xefa94de7a4656d787667c749f7e1223d71e9fd88',
    name: 'Pangolin Factory',
    protocol: 'Pangolin',
    category: 'dex',
    type: 'factory',
  },
  '0x60781c2586d68229fde47564546784ab3faca982': {
    address: '0x60781c2586d68229fde47564546784ab3faca982',
    name: 'PNG Token',
    protocol: 'Pangolin',
    category: 'dex',
    type: 'token',
  },
  '0x88afdae1a9f58da3e68584421937e5f564a0135b': {
    address: '0x88afdae1a9f58da3e68584421937e5f564a0135b',
    name: 'PNG Staking',
    protocol: 'Pangolin',
    category: 'dex',
    type: 'staking',
  },
  '0x1f806f7c8ded893fd3cae279191ad7aa3798e928': {
    address: '0x1f806f7c8ded893fd3cae279191ad7aa3798e928',
    name: 'Pangolin MiniChef V2',
    protocol: 'Pangolin',
    category: 'dex',
    type: 'staking',
  },

  // ============ GMX ============
  '0x9ab2de34a33fb459b538c43f251eb825645e8595': {
    address: '0x9ab2de34a33fb459b538c43f251eb825645e8595',
    name: 'GMX Vault',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'vault',
  },
  '0x5f719c2f1095f7b9fc68a68e35b51194f4b6abe8': {
    address: '0x5f719c2f1095f7b9fc68a68e35b51194f4b6abe8',
    name: 'GMX Router',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'router',
  },
  '0xfff6d276bc37c61a23f06410dce4a400f66420f8': {
    address: '0xfff6d276bc37c61a23f06410dce4a400f66420f8',
    name: 'GMX Position Router',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'router',
  },
  '0x4296e307f108b2f583ff2f7b7270ee7831574ae5': {
    address: '0x4296e307f108b2f583ff2f7b7270ee7831574ae5',
    name: 'GMX OrderBook',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'orderbook',
  },
  '0x62edc0692bd897d2295872a9ffcac5425011c661': {
    address: '0x62edc0692bd897d2295872a9ffcac5425011c661',
    name: 'GMX Token',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'token',
  },
  '0xd152c7f25db7f4b95b7658323c5f33d176818ee4': {
    address: '0xd152c7f25db7f4b95b7658323c5f33d176818ee4',
    name: 'GLP Manager',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'vault',
  },
  '0xb70b91ce0771d3f4c81d87660f71da31d48eb3b3': {
    address: '0xb70b91ce0771d3f4c81d87660f71da31d48eb3b3',
    name: 'GMX Reward Router V2',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'rewards',
  },
  '0x01234181085565ed162a948b6a5e88758cd7c7b8': {
    address: '0x01234181085565ed162a948b6a5e88758cd7c7b8',
    name: 'GLP',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'token',
  },

  // ============ BENQI ============
  '0x486af39519b4dc9a7fccd318217352830e8ad9b4': {
    address: '0x486af39519b4dc9a7fccd318217352830e8ad9b4',
    name: 'Benqi Comptroller',
    protocol: 'Benqi',
    category: 'lending',
    type: 'controller',
  },
  '0x5c0401e81bc07ca70fad469b451682c0d747ef1c': {
    address: '0x5c0401e81bc07ca70fad469b451682c0d747ef1c',
    name: 'qiAVAX',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0xf362fea9659cf036792c9cb02f8ff8198e21b4cb': {
    address: '0xf362fea9659cf036792c9cb02f8ff8198e21b4cb',
    name: 'qisAVAX',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0x89a415b3d20098e6a6c8f7a59001c67bd3129821': {
    address: '0x89a415b3d20098e6a6c8f7a59001c67bd3129821',
    name: 'qiBTC.b',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0xe194c4c5ac32a3c9ffdb358d9bfd523a0b6d1568': {
    address: '0xe194c4c5ac32a3c9ffdb358d9bfd523a0b6d1568',
    name: 'qiBTC (WBTC.e)',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0x334ad834cd4481bb02d09615e7c11a00579a7909': {
    address: '0x334ad834cd4481bb02d09615e7c11a00579a7909',
    name: 'qiETH',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0x4e9f683a27a6bdad3fc2764003759277e93696e6': {
    address: '0x4e9f683a27a6bdad3fc2764003759277e93696e6',
    name: 'qiLINK',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0xc9e5999b8e75c3feb117f6f73e664b9f3c8ca65c': {
    address: '0xc9e5999b8e75c3feb117f6f73e664b9f3c8ca65c',
    name: 'qiUSDT',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0xbeb5d47a3f720ec0a390d04b4d41ed7d9688bc7f': {
    address: '0xbeb5d47a3f720ec0a390d04b4d41ed7d9688bc7f',
    name: 'qiUSDC',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0xd8fcda6ec4bdc547c0827b8804e89acd817d56ef': {
    address: '0xd8fcda6ec4bdc547c0827b8804e89acd817d56ef',
    name: 'qiUSDTn',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0xb715808a78f6041e46d61cb123c9b4a27056ae9c': {
    address: '0xb715808a78f6041e46d61cb123c9b4a27056ae9c',
    name: 'qiUSDCn',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0x835866d37afb8cb8f8334dccaf66cf01832ff5d': {
    address: '0x835866d37afb8cb8f8334dccaf66cf01832ff5d',
    name: 'qiDAI',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0x872670ccae8c19557cc9443eff587d7086b8043a': {
    address: '0x872670ccae8c19557cc9443eff587d7086b8043a',
    name: 'qiBUSD',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0x35bd6aeda81a7e5fc7a7832490e71f757b0cd9ce': {
    address: '0x35bd6aeda81a7e5fc7a7832490e71f757b0cd9ce',
    name: 'qiQI',
    protocol: 'Benqi',
    category: 'lending',
    type: 'pool',
  },
  '0x8729438eb15e2c8b576fcc6aecda6a148776c0f5': {
    address: '0x8729438eb15e2c8b576fcc6aecda6a148776c0f5',
    name: 'QI Token',
    protocol: 'Benqi',
    category: 'lending',
    type: 'token',
  },
  '0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be': {
    address: '0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be',
    name: 'sAVAX',
    protocol: 'Benqi',
    category: 'lending',
    type: 'token',
  },
  '0x784da19e61cf348a8c54547531795ecfee2affd1': {
    address: '0x784da19e61cf348a8c54547531795ecfee2affd1',
    name: 'LP Staking Contract',
    protocol: 'Benqi',
    category: 'lending',
    type: 'staking',
  },

  // ============ AAVE V3 ============
  '0x794a61358d6845594f94dc1db02a252b5b4814ad': {
    address: '0x794a61358d6845594f94dc1db02a252b5b4814ad',
    name: 'Aave Pool V3',
    protocol: 'Aave',
    category: 'lending',
    type: 'pool',
  },
  '0xa97684ead0e402dc232d5a977953df7ecbab3cdb': {
    address: '0xa97684ead0e402dc232d5a977953df7ecbab3cdb',
    name: 'Aave Pool Provider V3',
    protocol: 'Aave',
    category: 'lending',
    type: 'controller',
  },
  '0x69fa688f1dc47d4b5d8029d5a35fb7a548310654': {
    address: '0x69fa688f1dc47d4b5d8029d5a35fb7a548310654',
    name: 'Aave Pool Data Provider V3',
    protocol: 'Aave',
    category: 'lending',
    type: 'other',
  },
  '0x8145edddf43f50276641b55bd3ad95944510021e': {
    address: '0x8145edddf43f50276641b55bd3ad95944510021e',
    name: 'Aave Pool Configurator',
    protocol: 'Aave',
    category: 'lending',
    type: 'controller',
  },

  // ============ STARGATE ============
  '0x45a01e4e04f14f7a4a6702c74187c5f6222033cd': {
    address: '0x45a01e4e04f14f7a4a6702c74187c5f6222033cd',
    name: 'Stargate Router',
    protocol: 'Stargate',
    category: 'bridge',
    type: 'router',
  },
  '0x9d1b1669c73b033dfe47ae5a0164ab96df25b944': {
    address: '0x9d1b1669c73b033dfe47ae5a0164ab96df25b944',
    name: 'Stargate Bridge',
    protocol: 'Stargate',
    category: 'bridge',
    type: 'router',
  },
  '0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590': {
    address: '0x2f6f07cdcf3588944bf4c42ac74ff24bf56e7590',
    name: 'STG Token',
    protocol: 'Stargate',
    category: 'bridge',
    type: 'token',
  },
  '0x1205f31718499dbf1fca446663b532ef87481fe1': {
    address: '0x1205f31718499dbf1fca446663b532ef87481fe1',
    name: 'Stargate USDC Pool',
    protocol: 'Stargate',
    category: 'bridge',
    type: 'pool',
  },
  '0x29e38769f23701a2e4a8ef0492e19da4604be62c': {
    address: '0x29e38769f23701a2e4a8ef0492e19da4604be62c',
    name: 'Stargate USDT Pool',
    protocol: 'Stargate',
    category: 'bridge',
    type: 'pool',
  },

  // ============ LAYERZERO ============
  '0x3c2269811836af69497e5f486a85d7316753cf62': {
    address: '0x3c2269811836af69497e5f486a85d7316753cf62',
    name: 'LayerZero Endpoint V1',
    protocol: 'LayerZero',
    category: 'bridge',
    type: 'router',
  },
  '0x1a44076050125825900e736c501f859c50fe728c': {
    address: '0x1a44076050125825900e736c501f859c50fe728c',
    name: 'LayerZero Endpoint V2',
    protocol: 'LayerZero',
    category: 'bridge',
    type: 'router',
  },

  // ============ WOOFI ============
  '0x020630613e296c3e9b06186f630d1bf97a2b6ad1': {
    address: '0x020630613e296c3e9b06186f630d1bf97a2b6ad1',
    name: 'WooRouterV2',
    protocol: 'WOOFi',
    category: 'dex',
    type: 'router',
  },
  '0x3b3e4b4741e91af52d0e9ad8660573e951c88524': {
    address: '0x3b3e4b4741e91af52d0e9ad8660573e951c88524',
    name: 'WooPPV2',
    protocol: 'WOOFi',
    category: 'dex',
    type: 'pool',
  },
  '0x5aa6a4e96a9129562e2fc06660d07feddaaf7854': {
    address: '0x5aa6a4e96a9129562e2fc06660d07feddaaf7854',
    name: 'WooRouter Legacy',
    protocol: 'WOOFi',
    category: 'dex',
    type: 'router',
  },
  '0xe47fec1c72850d867a1655c4c5902de7728ca205': {
    address: '0xe47fec1c72850d867a1655c4c5902de7728ca205',
    name: 'CrossswapRouterV3',
    protocol: 'WOOFi',
    category: 'bridge',
    type: 'router',
  },

  // ============ YIELD YAK ============
  '0x0cf605484a512d3f3435fed77ab5ddc0525daf5f': {
    address: '0x0cf605484a512d3f3435fed77ab5ddc0525daf5f',
    name: 'Yield Yak Router',
    protocol: 'Yield Yak',
    category: 'yield',
    type: 'router',
  },
  '0x59414b3089ce2af0010e7523dea7e2b35d776ec7': {
    address: '0x59414b3089ce2af0010e7523dea7e2b35d776ec7',
    name: 'YAK Token',
    protocol: 'Yield Yak',
    category: 'yield',
    type: 'token',
  },
  '0xc63a7d9c22e5ab8c3f8ec958f7bc7f91b2494c17': {
    address: '0xc63a7d9c22e5ab8c3f8ec958f7bc7f91b2494c17',
    name: 'YY Staking',
    protocol: 'Yield Yak',
    category: 'yield',
    type: 'staking',
  },

  // ============ PLATYPUS ============
  '0x66357dcace80431aee0a7507e2e361b7e2402370': {
    address: '0x66357dcace80431aee0a7507e2e361b7e2402370',
    name: 'Platypus Router',
    protocol: 'Platypus',
    category: 'dex',
    type: 'router',
  },
  '0x22d4002028f537599be9f666d1c4fa138522f9c8': {
    address: '0x22d4002028f537599be9f666d1c4fa138522f9c8',
    name: 'PTP Token',
    protocol: 'Platypus',
    category: 'dex',
    type: 'token',
  },
  '0xb8e567fc23c39c94a1f6359509d7b43d1fbed824': {
    address: '0xb8e567fc23c39c94a1f6359509d7b43d1fbed824',
    name: 'Platypus Main Pool',
    protocol: 'Platypus',
    category: 'dex',
    type: 'pool',
  },
  '0xc007f27b752a6e0d9746e77ec52c20b92c6b5a5c': {
    address: '0xc007f27b752a6e0d9746e77ec52c20b92c6b5a5c',
    name: 'Platypus MasterPlatypus',
    protocol: 'Platypus',
    category: 'dex',
    type: 'staking',
  },

  // ============ PARASWAP ============
  '0xdef171fe48cf0115b1d80b88dc8eab59176fee57': {
    address: '0xdef171fe48cf0115b1d80b88dc8eab59176fee57',
    name: 'ParaSwap V5 Router',
    protocol: 'ParaSwap',
    category: 'dex',
    type: 'router',
  },

  // ============ 1INCH ============
  '0x1111111254eeb25477b68fb85ed929f73a960582': {
    address: '0x1111111254eeb25477b68fb85ed929f73a960582',
    name: '1inch Router V5',
    protocol: '1inch',
    category: 'dex',
    type: 'router',
  },
  '0x111111125421ca6dc452d289314280a0f8842a65': {
    address: '0x111111125421ca6dc452d289314280a0f8842a65',
    name: '1inch Router V6',
    protocol: '1inch',
    category: 'dex',
    type: 'router',
  },

  // ============ KYBERSWAP ============
  '0x6131b5fae19ea4f9d964eac0408e4408b66337b5': {
    address: '0x6131b5fae19ea4f9d964eac0408e4408b66337b5',
    name: 'KyberSwap Router',
    protocol: 'KyberSwap',
    category: 'dex',
    type: 'router',
  },

  // ============ ODOS ============
  '0xa669e7a0d4b3e4fa48af2de86bd4cd7126be4e13': {
    address: '0xa669e7a0d4b3e4fa48af2de86bd4cd7126be4e13',
    name: 'Odos Router V2',
    protocol: 'Odos',
    category: 'dex',
    type: 'router',
  },

  // ============ DEXALOT ============
  '0xb32c0a3fb2c4c2be40f7e2c7f8d5b4ef2d9c8d2f': {
    address: '0xb32c0a3fb2c4c2be40f7e2c7f8d5b4ef2d9c8d2f',
    name: 'Dexalot MainnetRFQ',
    protocol: 'Dexalot',
    category: 'dex',
    type: 'router',
  },

  // ============ OPENOCEAN ============
  '0x6352a56caadc4f1e25cd6c75970fa768a3304e64': {
    address: '0x6352a56caadc4f1e25cd6c75970fa768a3304e64',
    name: 'OpenOcean Exchange',
    protocol: 'OpenOcean',
    category: 'dex',
    type: 'router',
  },

  // ============ SUSHISWAP ============
  '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506': {
    address: '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506',
    name: 'SushiSwap Router',
    protocol: 'SushiSwap',
    category: 'dex',
    type: 'router',
  },
  '0xc35dadb65012ec5796536bd9864ed8773abc74c4': {
    address: '0xc35dadb65012ec5796536bd9864ed8773abc74c4',
    name: 'SushiSwap Factory',
    protocol: 'SushiSwap',
    category: 'dex',
    type: 'factory',
  },
  '0x4c5e62f95b6686ffef2d6753e05a47fa0dc7bdc7': {
    address: '0x4c5e62f95b6686ffef2d6753e05a47fa0dc7bdc7',
    name: 'SushiSwap BentoBox',
    protocol: 'SushiSwap',
    category: 'dex',
    type: 'vault',
  },

  // ============ CURVE ============
  '0x7f90122bf0700f9e7e1f688fe926940e8839f353': {
    address: '0x7f90122bf0700f9e7e1f688fe926940e8839f353',
    name: 'Curve Registry',
    protocol: 'Curve',
    category: 'dex',
    type: 'other',
  },
  '0x0994206dfe8de6ec6920ff4d779b0d950605fb53': {
    address: '0x0994206dfe8de6ec6920ff4d779b0d950605fb53',
    name: 'Curve Router',
    protocol: 'Curve',
    category: 'dex',
    type: 'router',
  },

  // ============ BALANCER ============
  '0xba12222222228d8ba445958a75a0704d566bf2c8': {
    address: '0xba12222222228d8ba445958a75a0704d566bf2c8',
    name: 'Balancer Vault',
    protocol: 'Balancer',
    category: 'dex',
    type: 'vault',
  },

  // ============ AVALANCHE BRIDGE / CORE ============
  '0x8eb8a3b98659cce290402893d0123abb75e3ab28': {
    address: '0x8eb8a3b98659cce290402893d0123abb75e3ab28',
    name: 'Avalanche Bridge',
    protocol: 'Avalanche Bridge',
    category: 'bridge',
    type: 'router',
  },

  // ============ BTCB BRIDGE ============
  '0x152b9d0fdc40c096757f570a51e494bd4b943e50': {
    address: '0x152b9d0fdc40c096757f570a51e494bd4b943e50',
    name: 'BTC.b Token',
    protocol: 'Bitcoin Bridge',
    category: 'bridge',
    type: 'token',
  },

  // ============ COMMON TOKENS ============
  '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7': {
    address: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
    name: 'WAVAX',
    protocol: 'Avalanche',
    category: 'token',
    type: 'token',
  },
  '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': {
    address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
    name: 'USDC',
    protocol: 'Circle',
    category: 'token',
    type: 'token',
  },
  '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7': {
    address: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
    name: 'USDt',
    protocol: 'Tether',
    category: 'token',
    type: 'token',
  },
  '0xc7198437980c041c805a1edcba50c1ce5db95118': {
    address: '0xc7198437980c041c805a1edcba50c1ce5db95118',
    name: 'USDT.e',
    protocol: 'Tether',
    category: 'token',
    type: 'token',
  },
  '0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664': {
    address: '0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664',
    name: 'USDC.e',
    protocol: 'Circle',
    category: 'token',
    type: 'token',
  },
  '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab': {
    address: '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
    name: 'WETH.e',
    protocol: 'Avalanche Bridge',
    category: 'token',
    type: 'token',
  },
  '0x50b7545627a5162f82a992c33b87adc75187b218': {
    address: '0x50b7545627a5162f82a992c33b87adc75187b218',
    name: 'WBTC.e',
    protocol: 'Avalanche Bridge',
    category: 'token',
    type: 'token',
  },
  '0xd586e7f844cea2f87f50152665bcbc2c279d8d70': {
    address: '0xd586e7f844cea2f87f50152665bcbc2c279d8d70',
    name: 'DAI.e',
    protocol: 'Avalanche Bridge',
    category: 'token',
    type: 'token',
  },
  '0x5947bb275c521040051d82396192181b413227a3': {
    address: '0x5947bb275c521040051d82396192181b413227a3',
    name: 'LINK.e',
    protocol: 'Avalanche Bridge',
    category: 'token',
    type: 'token',
  },
  '0x63a72806098bd3d9520cc43356dd78afe5d386d9': {
    address: '0x63a72806098bd3d9520cc43356dd78afe5d386d9',
    name: 'AAVE.e',
    protocol: 'Avalanche Bridge',
    category: 'token',
    type: 'token',
  },
  '0xabc9547b534519ff73921b1fba6e672b5f58d083': {
    address: '0xabc9547b534519ff73921b1fba6e672b5f58d083',
    name: 'WOO Token',
    protocol: 'WOOFi',
    category: 'token',
    type: 'token',
  },

  // ============ GAMING - CRABADA ============
  '0xa32608e873f9ddef944b24798db69d80bbb4d1ed': {
    address: '0xa32608e873f9ddef944b24798db69d80bbb4d1ed',
    name: 'CRA Token',
    protocol: 'Crabada',
    category: 'gaming',
    type: 'token',
  },
  '0xf693248f96fe03422fea95ac0afbbbc4a8fdd172': {
    address: '0xf693248f96fe03422fea95ac0afbbbc4a8fdd172',
    name: 'TUS Token',
    protocol: 'Crabada',
    category: 'gaming',
    type: 'token',
  },

  // ============ GAMING - CHIKN ============
  '0x7761e2338b35bceb6bda6ce477ef012bde7ae611': {
    address: '0x7761e2338b35bceb6bda6ce477ef012bde7ae611',
    name: 'EGG Token',
    protocol: 'Chikn',
    category: 'gaming',
    type: 'token',
  },

  // ============ GAMING - STEP APP ============
  '0x714f020c54cc9d104b6f4f6998c63ce2a31d1888': {
    address: '0x714f020c54cc9d104b6f4f6998c63ce2a31d1888',
    name: 'FITFI Token',
    protocol: 'Step App',
    category: 'gaming',
    type: 'token',
  },

  // ============ NFT - JOEPEGS / COLLECTIONS ============
  '0x54c800d2331e10467143911aabca092d68bf4166': {
    address: '0x54c800d2331e10467143911aabca092d68bf4166',
    name: 'Dokyo NFT',
    protocol: 'Dokyo',
    category: 'nft',
    type: 'token',
  },
  '0x4275d1ec739fe25e845f5a67c963f0c0f1722023': {
    address: '0x4275d1ec739fe25e845f5a67c963f0c0f1722023',
    name: 'Dokyo Summit POP',
    protocol: 'Dokyo',
    category: 'nft',
    type: 'token',
  },

  // ============ SOCIAL GAMING - MYPRIZE ============
  '0x6b5ef55f617c8419fa2829924b67e2b5c3205555': {
    address: '0x6b5ef55f617c8419fa2829924b67e2b5c3205555',
    name: 'MyPrize Game Contract',
    protocol: 'MyPrize',
    category: 'gaming',
    type: 'other',
  },

  // ============ UPTOP ============
  '0xf1d7f5723de7980ab2a988c2eed1be620a30bc6d': {
    address: '0xf1d7f5723de7980ab2a988c2eed1be620a30bc6d',
    name: 'UpTop Contract',
    protocol: 'UpTop',
    category: 'other',
    type: 'other',
  },
  '0x076a53abaa556073a8be7135c5a29d4b70e504a5': {
    address: '0x076a53abaa556073a8be7135c5a29d4b70e504a5',
    name: 'UpTop Contract',
    protocol: 'UpTop',
    category: 'other',
    type: 'other',
  },

  // ============ AVANT PROTOCOL ============
  // Stable-value tokens and yield-bearing assets
  '0x24de8771bc5ddb3362db529fc3358f2df3a0e346': {
    address: '0x24de8771bc5ddb3362db529fc3358f2df3a0e346',
    name: 'avUSD',
    protocol: 'Avant',
    category: 'yield',
    type: 'token',
  },
  '0x06d47f3fb376649c3a9dafe069b3d6e35572219e': {
    address: '0x06d47f3fb376649c3a9dafe069b3d6e35572219e',
    name: 'savUSD',
    protocol: 'Avant',
    category: 'yield',
    type: 'token',
  },
  '0xdd1cdfa52e7d8474d434cd016fd346701db6b3b9': {
    address: '0xdd1cdfa52e7d8474d434cd016fd346701db6b3b9',
    name: 'avUSDx',
    protocol: 'Avant',
    category: 'yield',
    type: 'token',
  },
  '0xfd2c2a98009d0cbed715882036e43d26c4289053': {
    address: '0xfd2c2a98009d0cbed715882036e43d26c4289053',
    name: 'avBTC',
    protocol: 'Avant',
    category: 'yield',
    type: 'token',
  },
  '0x649342c6bff544d82df1b2ba3c93e0c22cdeba84': {
    address: '0x649342c6bff544d82df1b2ba3c93e0c22cdeba84',
    name: 'savBTC',
    protocol: 'Avant',
    category: 'yield',
    type: 'token',
  },
  '0xa7c10c510df4b1702e1f36451dd29d7c3edc760c': {
    address: '0xa7c10c510df4b1702e1f36451dd29d7c3edc760c',
    name: 'avBTCx',
    protocol: 'Avant',
    category: 'yield',
    type: 'token',
  },
  '0x223767286be11d09ae778ff608687fe858d3a2b4': {
    address: '0x223767286be11d09ae778ff608687fe858d3a2b4',
    name: 'avETH',
    protocol: 'Avant',
    category: 'yield',
    type: 'token',
  },
  '0x260c0c715a279f239cf44e2f73e964ab550738f3': {
    address: '0x260c0c715a279f239cf44e2f73e964ab550738f3',
    name: 'savETH',
    protocol: 'Avant',
    category: 'yield',
    type: 'token',
  },
  '0xda63630094aa23b7a49368b713d68dd98f547f98': {
    address: '0xda63630094aa23b7a49368b713d68dd98f547f98',
    name: 'avETHx',
    protocol: 'Avant',
    category: 'yield',
    type: 'token',
  },
  '0x5f0aef33a03bf0028fc46dddd4a86ee3d29e2972': {
    address: '0x5f0aef33a03bf0028fc46dddd4a86ee3d29e2972',
    name: 'Avant Contract',
    protocol: 'Avant',
    category: 'yield',
    type: 'other',
  },
  '0x58c32c34fd4ae48a7d45ec4b3c940b41d676cc04': {
    address: '0x58c32c34fd4ae48a7d45ec4b3c940b41d676cc04',
    name: 'Avant Contract',
    protocol: 'Avant',
    category: 'yield',
    type: 'other',
  },
  '0x4c129d3aa27272211d151ca39a0a01e4c16fc887': {
    address: '0x4c129d3aa27272211d151ca39a0a01e4c16fc887',
    name: 'Avant Contract',
    protocol: 'Avant',
    category: 'yield',
    type: 'other',
  },
  '0xcb43139e90f019624e3b76c56fb05394b162a49c': {
    address: '0xcb43139e90f019624e3b76c56fb05394b162a49c',
    name: 'Avant Contract',
    protocol: 'Avant',
    category: 'yield',
    type: 'other',
  },

  // ============ ACCOUNT ABSTRACTION (ERC-4337) ============
  '0x0000000071727de22e5e9d8baf0edac6f37da032': {
    address: '0x0000000071727de22e5e9d8baf0edac6f37da032',
    name: 'EntryPoint v0.7',
    protocol: 'ERC-4337',
    category: 'infrastructure',
    type: 'router',
  },
  '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789': {
    address: '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789',
    name: 'EntryPoint v0.6',
    protocol: 'ERC-4337',
    category: 'infrastructure',
    type: 'router',
  },

  // ============ BIG ADS ============
  '0x06e9b71283700d1a319070f14976d3aba6c27745': {
    address: '0x06e9b71283700d1a319070f14976d3aba6c27745',
    name: 'Big Ads Contract',
    protocol: 'Big Ads',
    category: 'other',
    type: 'other',
  },

  // ============ RED CAST ============
  '0x50538bbeaf3040fec0b13d9c39bc0521237f15a5': {
    address: '0x50538bbeaf3040fec0b13d9c39bc0521237f15a5',
    name: 'Red Cast Contract',
    protocol: 'Red Cast',
    category: 'other',
    type: 'other',
  },
  '0x9cb91a034e144c87f71038d8a3322cbdcc1fb480': {
    address: '0x9cb91a034e144c87f71038d8a3322cbdcc1fb480',
    name: 'Red Cast Contract',
    protocol: 'Red Cast',
    category: 'other',
    type: 'other',
  },

  // ============ BANZA ============
  '0x11fbe9e637c4a3deca3453f2925aaaa18e16963e': {
    address: '0x11fbe9e637c4a3deca3453f2925aaaa18e16963e',
    name: 'Banza Contract',
    protocol: 'Banza',
    category: 'other',
    type: 'other',
  },
  '0xae0bfb23ddf753949fe00cd93a1bde45769dc7e9': {
    address: '0xae0bfb23ddf753949fe00cd93a1bde45769dc7e9',
    name: 'Banza Contract',
    protocol: 'Banza',
    category: 'other',
    type: 'other',
  },

  // ============ PANGOLIN EXCHANGE (Additional) ============
  '0x1128f23d0bc0a8396e9fbc3c0c68f5ea228b8256': {
    address: '0x1128f23d0bc0a8396e9fbc3c0c68f5ea228b8256',
    name: 'Pangolin Contract',
    protocol: 'Pangolin',
    category: 'dex',
    type: 'other',
  },

  // ============ LI.FI ============
  '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae': {
    address: '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae',
    name: 'LiFi Diamond Proxy',
    protocol: 'LI.FI',
    category: 'bridge',
    type: 'router',
  },

  // ============ PARASWAP (Additional) ============
  '0x216b4b4ba9f3e719726886d34a177484278bfcae': {
    address: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
    name: 'TokenTransferProxy',
    protocol: 'ParaSwap',
    category: 'dex',
    type: 'other',
  },

  // ============ AVALANCHE ICM ============
  '0x253b2784c75e510dd0ff1da844684a1ac0aa5fcf': {
    address: '0x253b2784c75e510dd0ff1da844684a1ac0aa5fcf',
    name: 'TeleporterMessenger',
    protocol: 'Avalanche ICM',
    category: 'icm',
    type: 'router',
  },
  '0x7c43605e14f391720e1b37e49c78c4b03a488d98': {
    address: '0x7c43605e14f391720e1b37e49c78c4b03a488d98',
    name: 'TeleporterRegistry',
    protocol: 'Avalanche ICM',
    category: 'icm',
    type: 'other',
  },

  // ============ INFRASTRUCTURE ============
  '0xca11bde05977b3631167028862be2a173976ca11': {
    address: '0xca11bde05977b3631167028862be2a173976ca11',
    name: 'Multicall3',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'other',
  },

  // ============ OPENSEA ============
  '0x00000000006c3852cbef3e08e8df289169ede581': {
    address: '0x00000000006c3852cbef3e08e8df289169ede581',
    name: 'Seaport 1.1',
    protocol: 'OpenSea',
    category: 'nft',
    type: 'router',
  },
  '0x00000000000001ad428e4906ae43d8f9852d0dd6': {
    address: '0x00000000000001ad428e4906ae43d8f9852d0dd6',
    name: 'Seaport 1.4',
    protocol: 'OpenSea',
    category: 'nft',
    type: 'router',
  },
  '0x00000000000000adc04c56bf30ac9d3c0aaf14dc': {
    address: '0x00000000000000adc04c56bf30ac9d3c0aaf14dc',
    name: 'Seaport 1.5',
    protocol: 'OpenSea',
    category: 'nft',
    type: 'router',
  },

  // ============ YIELD YAK (Additional) ============
  '0xddaaad7366b455aff8e7c82940c43ceb5829b604': {
    address: '0xddaaad7366b455aff8e7c82940c43ceb5829b604',
    name: 'MiniYak (mYAK)',
    protocol: 'Yield Yak',
    category: 'yield',
    type: 'token',
  },

  // ============ XEN CRYPTO ============
  '0x18ae1a33044b9b4ccc85dc44da8bb03b86f06600': {
    address: '0x18ae1a33044b9b4ccc85dc44da8bb03b86f06600',
    name: 'MCT XenProxy',
    protocol: 'XEN Crypto',
    category: 'token',
    type: 'other',
  },
  '0x9ec1c3dcf667f2035fb4cd2eb42a1566fd54d2b7': {
    address: '0x9ec1c3dcf667f2035fb4cd2eb42a1566fd54d2b7',
    name: 'CoinTool XEN Batch Minter',
    protocol: 'XEN Crypto',
    category: 'token',
    type: 'other',
  },
  '0x94d9e02d115646dfc407abde75fa45256d66e043': {
    address: '0x94d9e02d115646dfc407abde75fa45256d66e043',
    name: 'XENTorrent (aXENT)',
    protocol: 'XEN Crypto',
    category: 'token',
    type: 'token',
  },
  '0x0000000000771a79d0fc7f3b7fe270eb4498f20b': {
    address: '0x0000000000771a79d0fc7f3b7fe270eb4498f20b',
    name: 'MCT MctXenft',
    protocol: 'XEN Crypto',
    category: 'token',
    type: 'other',
  },

  // ============ MOVEQUEST ============
  '0xd14f01bfa5999e65780167a0ea530ecf3d0aa24d': {
    address: '0xd14f01bfa5999e65780167a0ea530ecf3d0aa24d',
    name: 'MINING',
    protocol: 'MoveQuest',
    category: 'gaming',
    type: 'other',
  },
  '0x26dd09be22676a6905c27ea8fac7c7eee59c893f': {
    address: '0x26dd09be22676a6905c27ea8fac7c7eee59c893f',
    name: 'MINING V2',
    protocol: 'MoveQuest',
    category: 'gaming',
    type: 'other',
  },

  // ============ PHARAOH EXCHANGE ============
  '0x3fed017ec0f5517cdf2e8a9a4156c64d74252146': {
    address: '0x3fed017ec0f5517cdf2e8a9a4156c64d74252146',
    name: 'NonfungiblePositionManager',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'router',
  },
  '0xa47ad2c95fae476a73b85a355a5855adb4b3a449': {
    address: '0xa47ad2c95fae476a73b85a355a5855adb4b3a449',
    name: 'FarmingCenter',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'staking',
  },

  // ============ BLACKHOLE DEX ============
  '0xeac562811cc6abdbb2c9ee88719eca4ee79ad763': {
    address: '0xeac562811cc6abdbb2c9ee88719eca4ee79ad763',
    name: 'VotingEscrow',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'staking',
  },
  '0xe6e554b14892d5cf91df9ce9cd7fe936d2194441': {
    address: '0xe6e554b14892d5cf91df9ce9cd7fe936d2194441',
    name: 'Liquidity Manager Bot',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'other',
  },

  // ============ ODOS (V3) ============
  '0x0d05a7d3448512b78fa8a9e46c4872c88c4a0d05': {
    address: '0x0d05a7d3448512b78fa8a9e46c4872c88c4a0d05',
    name: 'Odos Router V3',
    protocol: 'Odos',
    category: 'dex',
    type: 'router',
  },

  // ============ GMX V2 (Additional) ============
  '0x823b558b4bc0a2c4974a0d8d7885aa1102d15dec': {
    address: '0x823b558b4bc0a2c4974a0d8d7885aa1102d15dec',
    name: 'GMX V2 OrderHandler',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'orderbook',
  },

  // ============ VFAT / SICKLE ============
  '0x5fe05d2c877670ad1fca8f1f8482fd9ded2c9279': {
    address: '0x5fe05d2c877670ad1fca8f1f8482fd9ded2c9279',
    name: 'Sickle Automation',
    protocol: 'vfat.io',
    category: 'yield',
    type: 'other',
  },

  // ============ MEV / ARBITRAGE BOTS ============
  // Note: MEV bots are ephemeral and get redeployed frequently.
  // These are the top gas-consuming bots as of Feb 2026.
  '0x0b622725625d7b6bf6fe2d66755d75033e26008c': {
    address: '0x0b622725625d7b6bf6fe2d66755d75033e26008c',
    name: 'MEV Bot (0x977a deployer)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x922135e61c07c650dc406dc9d7722f403cf4935b': {
    address: '0x922135e61c07c650dc406dc9d7722f403cf4935b',
    name: 'MEV Bot (0x2222 deployer)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x10922755586c35180cdec7a1a38e2b60c800d3c8': {
    address: '0x10922755586c35180cdec7a1a38e2b60c800d3c8',
    name: 'MEV Bot (failed ops)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x99b69659f70470bbd32ae59ddf952f157a598a44': {
    address: '0x99b69659f70470bbd32ae59ddf952f157a598a44',
    name: 'MEV Bot (multi-protocol)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x612a722ac5eff60004a0d8e83fbe768690540176': {
    address: '0x612a722ac5eff60004a0d8e83fbe768690540176',
    name: 'MEV Bot (0x977a deployer #2)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x07d25044cbe0524c0617267d6bfaf2fa6a0a0efe': {
    address: '0x07d25044cbe0524c0617267d6bfaf2fa6a0a0efe',
    name: 'MEV Bot (Gnosis Safe backed)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x25090cd3c1f3dd6377348f58408d2ddc96acf201': {
    address: '0x25090cd3c1f3dd6377348f58408d2ddc96acf201',
    name: 'MEV Bot (0x977a deployer #3)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },

  // Round 2 MEV bots
  '0xd1f6ca075b345c3532ee3957f0a32a0a0c881449': {
    address: '0xd1f6ca075b345c3532ee3957f0a32a0a0c881449',
    name: 'MEV Bot (flash loan arb)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x5d6d9811919598981367ac45134f9586d4f04bff': {
    address: '0x5d6d9811919598981367ac45134f9586d4f04bff',
    name: 'MEV Bot (pausable trading)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x278d858f05b94576c1e6f73285886876ff6ef8d2': {
    address: '0x278d858f05b94576c1e6f73285886876ff6ef8d2',
    name: 'MEV Bot (SafeProxy arb)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x42104e66a93da581dd06ebd434ff1c47176ff2d7': {
    address: '0x42104e66a93da581dd06ebd434ff1c47176ff2d7',
    name: 'MEV Bot (JIT liquidity)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x5b05e50f8d2942cbc7f89dd5b07cc2fa610caf9d': {
    address: '0x5b05e50f8d2942cbc7f89dd5b07cc2fa610caf9d',
    name: 'MEV Bot (Coinbase funded #1)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0xf163ca4c6931141ee115db0b192ed6c37d491714': {
    address: '0xf163ca4c6931141ee115db0b192ed6c37d491714',
    name: 'MEV Bot (Coinbase funded #2)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },

  // ============ PHARAOH EXCHANGE (Additional) ============
  '0x0b4478e810d48b5882d4019d435a2f864bab4f39': {
    address: '0x0b4478e810d48b5882d4019d435a2f864bab4f39',
    name: 'RamsesV3PositionManager',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'router',
  },
  '0xd0175063773f80910c87c4a69663a00e622b0745': {
    address: '0xd0175063773f80910c87c4a69663a00e622b0745',
    name: 'ALM Vault (Liquidity Manager)',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'vault',
  },

  // ============ ODOS (Additional V2 deployment) ============
  '0x88de50b233052e4fb783d4f6db78cc34fea3e9fc': {
    address: '0x88de50b233052e4fb783d4f6db78cc34fea3e9fc',
    name: 'Odos Router V2 (alt)',
    protocol: 'Odos',
    category: 'dex',
    type: 'router',
  },

  // ============ GAMING ============
  '0x8ab13fda47bf057205ca1299acebff26a07cec56': {
    address: '0x8ab13fda47bf057205ca1299acebff26a07cec56',
    name: 'CapyVault Proxy',
    protocol: 'CapyVault',
    category: 'gaming',
    type: 'other',
  },

  // ============ RWA / LENDING (from PR #3839) ============
  '0xe25cb545bdd47a8ec2d08001cb5661b00d47621a': {
    address: '0xe25cb545bdd47a8ec2d08001cb5661b00d47621a',
    name: 'OatFi Tranche Pool',
    protocol: 'OatFi',
    category: 'lending',
    type: 'pool',
  },
  '0x41d9569610dae2b6696797382fb26b5156db426f': {
    address: '0x41d9569610dae2b6696797382fb26b5156db426f',
    name: 'OatFi Borrower Operating',
    protocol: 'OatFi',
    category: 'lending',
    type: 'other',
  },
  '0xe3cde6f051872e67d0a7c2124e9a024d80e2733f': {
    address: '0xe3cde6f051872e67d0a7c2124e9a024d80e2733f',
    name: 'Valinor Lender',
    protocol: 'Valinor',
    category: 'lending',
    type: 'vault',
  },
  '0x7a75539cd0647625217ef93302855ddeb02f7093': {
    address: '0x7a75539cd0647625217ef93302855ddeb02f7093',
    name: 'Avalanche Foundation Lender',
    protocol: 'OatFi',
    category: 'lending',
    type: 'vault',
  },

  // ============ FLY.TRADE (prev. MAGPIE PROTOCOL) ============
  '0x3611b82c7b13e72b26eb0e9be0613bee7a45ac7c': {
    address: '0x3611b82c7b13e72b26eb0e9be0613bee7a45ac7c',
    name: 'MagpieRouterV3_1',
    protocol: 'Fly.trade',
    category: 'dex',
    type: 'router',
  },

  // ============ DODO ============
  '0xd4e8db2e3e4fa8dff01244d89d5b593b0a03f74b': {
    address: '0xd4e8db2e3e4fa8dff01244d89d5b593b0a03f74b',
    name: 'DPPOneShotSwap',
    protocol: 'DODO',
    category: 'dex',
    type: 'pool',
  },

  // ============ 0x PROTOCOL ============
  '0x0000000000001ff3684f28c67538d4d072c22734': {
    address: '0x0000000000001ff3684f28c67538d4d072c22734',
    name: 'AllowanceHolder',
    protocol: '0x Protocol',
    category: 'dex',
    type: 'router',
  },

  // ============ PARASWAP V6 ============
  '0x6a000f20005980200259b80c5102003040001068': {
    address: '0x6a000f20005980200259b80c5102003040001068',
    name: 'AugustusV6',
    protocol: 'ParaSwap',
    category: 'dex',
    type: 'router',
  },

  // ============ CHAOS LABS ============
  '0x0efb5a96ed1b33308a73355c56aa1bc1aa7e4a8e': {
    address: '0x0efb5a96ed1b33308a73355c56aa1bc1aa7e4a8e',
    name: 'Risk Oracle',
    protocol: 'Chaos Labs',
    category: 'infrastructure',
    type: 'other',
  },

  // ============ CHAINLINK ============
  '0x4fa197129e3260e3cc514b68011c5b23bab7475d': {
    address: '0x4fa197129e3260e3cc514b68011c5b23bab7475d',
    name: 'Batch VRF Coordinator V2 Plus',
    protocol: 'Chainlink',
    category: 'infrastructure',
    type: 'other',
  },

  // ============ DEX ROUTER (unbranded aggregator) ============
  '0x8adfb0d24cdb09c6eb6b001a41820ece98831b91': {
    address: '0x8adfb0d24cdb09c6eb6b001a41820ece98831b91',
    name: 'DexRouter',
    protocol: 'DexRouter',
    category: 'dex',
    type: 'router',
  },

  // ============ PHARAOH (Additional) ============
  '0xc8b8fcbdb5c019d7802ffb0b39603395d7d3915c': {
    address: '0xc8b8fcbdb5c019d7802ffb0b39603395d7d3915c',
    name: 'Ramses V3 SwapRouter',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'router',
  },

  // ============ VFAT / SICKLE (Additional) ============
  '0x0bf0f966a8c1676d2d76c1863cbd84170b949d53': {
    address: '0x0bf0f966a8c1676d2d76c1863cbd84170b949d53',
    name: 'NftFarmStrategy',
    protocol: 'vfat.io',
    category: 'yield',
    type: 'other',
  },

  // ============ MEV / ARBITRAGE BOTS (Round 3) ============
  '0x8b1bc05128f49af0562998ce7bbdffb26bb0e421': {
    address: '0x8b1bc05128f49af0562998ce7bbdffb26bb0e421',
    name: 'MEV Bot (0x2222 deployer #3)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
  '0x31e05ba0fca0a9447a2eb1065c1cc57cb722a924': {
    address: '0x31e05ba0fca0a9447a2eb1065c1cc57cb722a924',
    name: 'MEV Bot (0x2222 deployer #4)',
    protocol: 'MEV / Arbitrage',
    category: 'mev',
    type: 'other',
  },
};

// Protocol slug mapping for linking to dApp pages (canonical slug per protocol)
export const PROTOCOL_SLUGS: Record<string, string> = {
  'Trader Joe': 'trader-joe',
  'Pangolin': 'pangolin',
  'GMX': 'gmx',
  'Benqi': 'benqi',
  'Aave': 'aave-v3',
  'Stargate': 'stargate',
  'LayerZero': 'layerzero',
  'Yield Yak': 'yield-yak',
  'Platypus': 'platypus-finance',
  'WOOFi': 'woofi',
  'ParaSwap': 'paraswap',
  '1inch': '1inch-network',
  'KyberSwap': 'kyberswap',
  'Odos': 'odos',
  'SushiSwap': 'sushi',
  'Curve': 'curve-dex',
  'Balancer': 'balancer-v2',
  'OpenOcean': 'openocean',
  'Dexalot': 'dexalot',
  // Bridge / Cross-chain
  'LI.FI': 'lifi',
  // ICM
  'Avalanche ICM': 'avalanche-icm',
  // Infrastructure
  'Infrastructure': 'infrastructure',
  // NFT
  'OpenSea': 'opensea',
  // Gaming
  'Crabada': 'crabada',
  'Chikn': 'chikn',
  'Step App': 'step-app',
  'MyPrize': 'myprize',
  'UpTop': 'uptop',
  // Yield
  'Avant': 'avant-protocol',
  // NFT
  'Dokyo': 'dokyo',
  'Joepegs': 'joepegs',
  'Salvor': 'salvor',
  'Kalao': 'kalao',
  // Token
  'XEN Crypto': 'xen-crypto',
  // DEX
  'Pharaoh': 'pharaoh',
  'Blackhole DEX': 'blackhole-dex',
  // Yield
  'vfat.io': 'vfat',
  // Gaming
  'MoveQuest': 'movequest',
  // Gaming
  'CapyVault': 'capyvault',
  // MEV
  'MEV / Arbitrage': 'mev-arbitrage',
  // RWA / Lending
  'OatFi': 'oatfi',
  'Valinor': 'valinor',
  // Other
  'Big Ads': 'big-ads',
  'Red Cast': 'red-cast',
  'Banza': 'banza',
  // DEX Aggregators
  'Fly.trade': 'fly-trade',
  'DODO': 'dodo',
  '0x Protocol': '0x-protocol',
  'DexRouter': 'dexrouter',
  // Infrastructure
  'Chaos Labs': 'chaos-labs',
  'Chainlink': 'chainlink',
};

// Map alternative DefiLlama slugs to canonical protocol names
// This allows multiple DefiLlama entries to share the same on-chain data
export const SLUG_ALIASES: Record<string, string> = {
  // Benqi variations
  'benqi-lending': 'Benqi',
  'benqi-staked-avax': 'Benqi',
  'benqi': 'Benqi',
  // Aave variations
  'aave-v3': 'Aave',
  'aave-v2': 'Aave',
  'aave': 'Aave',
  // Trader Joe variations (DefiLlama uses 'joe-*' slugs)
  'trader-joe': 'Trader Joe',
  'trader-joe-lend': 'Trader Joe',
  'trader-joe-v2': 'Trader Joe',
  'trader-joe-v2.1': 'Trader Joe',
  'joe-v2': 'Trader Joe',
  'joe-v2.1': 'Trader Joe',
  'joe-v2.2': 'Trader Joe',
  'joe-dex': 'Trader Joe',
  'joe-lend': 'Trader Joe',
  'joe-stek': 'Trader Joe',
  // GMX variations
  'gmx': 'GMX',
  'gmx-v2': 'GMX',
  'gmx-v1-perps': 'GMX',
  'gmx-v2-perps': 'GMX',
  // Stargate variations
  'stargate': 'Stargate',
  'stargate-v1': 'Stargate',
  'stargate-v2': 'Stargate',
  'stargate-finance': 'Stargate',
  // Yield Yak
  'yield-yak': 'Yield Yak',
  'yak-swap': 'Yield Yak',
  'yield-yak-aggregator': 'Yield Yak',
  'yield-yak-staked-avax': 'Yield Yak',
  // Platypus
  'platypus-finance': 'Platypus',
  'platypus': 'Platypus',
  // SushiSwap
  'sushi': 'SushiSwap',
  'sushiswap': 'SushiSwap',
  'sushiswap-v3': 'SushiSwap',
  // Curve
  'curve-dex': 'Curve',
  'curve': 'Curve',
  'curve-finance': 'Curve',
  // Balancer
  'balancer-v2': 'Balancer',
  'balancer-v3': 'Balancer',
  'balancer': 'Balancer',
  // 1inch
  '1inch-network': '1inch',
  '1inch': '1inch',
  // KyberSwap
  'kyberswap': 'KyberSwap',
  'kyberswap-elastic': 'KyberSwap',
  'kyberswap-classic': 'KyberSwap',
  // Pangolin
  'pangolin': 'Pangolin',
  'pangolin-exchange': 'Pangolin',
  'pangolin-v2': 'Pangolin',
  'pangolin-v3': 'Pangolin',
  // WOOFi
  'woofi': 'WOOFi',
  'woo-network': 'WOOFi',
  'woofi-earn': 'WOOFi',
  'woofi-swap': 'WOOFi',
  // ParaSwap
  'paraswap': 'ParaSwap',
  // OpenOcean
  'openocean': 'OpenOcean',
  // Odos
  'odos': 'Odos',
  // Dexalot
  'dexalot': 'Dexalot',
  // LayerZero
  'layerzero': 'LayerZero',
  // LI.FI
  'lifi': 'LI.FI',
  'li-fi': 'LI.FI',
  // Avalanche ICM
  'avalanche-icm': 'Avalanche ICM',
  'teleporter': 'Avalanche ICM',
  // Infrastructure
  'infrastructure': 'Infrastructure',
  'multicall': 'Infrastructure',
  // OpenSea
  'opensea': 'OpenSea',
  'seaport': 'OpenSea',
  // Gaming
  'crabada': 'Crabada',
  'chikn': 'Chikn',
  'step-app': 'Step App',
  'myprize': 'MyPrize',
  'uptop': 'UpTop',
  // Yield
  'avant-protocol': 'Avant',
  // NFT
  'dokyo': 'Dokyo',
  'joepegs': 'Joepegs',
  'salvor': 'Salvor',
  'kalao': 'Kalao',
  // Token
  'xen-crypto': 'XEN Crypto',
  'xen': 'XEN Crypto',
  // DEX
  'pharaoh': 'Pharaoh',
  'pharaoh-exchange': 'Pharaoh',
  'blackhole-dex': 'Blackhole DEX',
  'blackhole': 'Blackhole DEX',
  // Yield
  'vfat': 'vfat.io',
  'vfat-io': 'vfat.io',
  'sickle': 'vfat.io',
  // Gaming
  'movequest': 'MoveQuest',
  'getfit-mining': 'MoveQuest',
  // Gaming
  'capyvault': 'CapyVault',
  // MEV
  'mev-arbitrage': 'MEV / Arbitrage',
  'mev': 'MEV / Arbitrage',
  // RWA / Lending
  'oatfi': 'OatFi',
  'valinor': 'Valinor',
  // Other
  'big-ads': 'Big Ads',
  'red-cast': 'Red Cast',
  'banza': 'Banza',
  // DEX Aggregators
  'fly-trade': 'Fly.trade',
  'fly': 'Fly.trade',
  'magpie-protocol': 'Fly.trade',
  'magpie': 'Fly.trade',
  'dodo': 'DODO',
  'dodo-exchange': 'DODO',
  '0x-protocol': '0x Protocol',
  '0x': '0x Protocol',
  'dexrouter': 'DexRouter',
  // Infrastructure
  'chaos-labs': 'Chaos Labs',
  'chainlink': 'Chainlink',
};

// Get contract info by address
export function getContractInfo(address: string): ContractInfo | null {
  return CONTRACT_REGISTRY[address.toLowerCase()] || null;
}

// Get all contracts for a protocol
export function getProtocolContracts(protocol: string): ContractInfo[] {
  return Object.values(CONTRACT_REGISTRY).filter(
    (c) => c.protocol.toLowerCase() === protocol.toLowerCase()
  );
}

// Get protocol slug for linking
export function getProtocolSlug(protocol: string): string | null {
  return PROTOCOL_SLUGS[protocol] || null;
}

// Get protocol name from slug (using alias mapping)
export function getProtocolNameBySlug(slug: string): string | null {
  // First check the alias mapping (comprehensive)
  if (SLUG_ALIASES[slug]) {
    return SLUG_ALIASES[slug];
  }
  // Fallback: try to match by iterating PROTOCOL_SLUGS (for any missed entries)
  for (const [name, protocolSlug] of Object.entries(PROTOCOL_SLUGS)) {
    if (protocolSlug === slug) {
      return name;
    }
  }
  return null;
}

// Get local protocol info by slug (for protocols not in DefiLlama)
export function getLocalProtocolInfo(slug: string): {
  name: string;
  slug: string;
  category: string;
  contracts: ContractInfo[];
} | null {
  const protocolName = getProtocolNameBySlug(slug);
  if (!protocolName) {
    return null;
  }

  const contracts = getProtocolContracts(protocolName);
  if (contracts.length === 0) {
    return null;
  }

  // Get category from first contract
  const category = contracts[0].category;

  return {
    name: protocolName,
    slug,
    category,
    contracts,
  };
}

// Check if address is a known router (likely swap/trade)
export function isRouter(address: string): boolean {
  const info = getContractInfo(address);
  return info?.type === 'router';
}

// Check if address is a known token
export function isToken(address: string): boolean {
  const info = getContractInfo(address);
  return info?.type === 'token';
}

// Check if address is a known pool
export function isPool(address: string): boolean {
  const info = getContractInfo(address);
  return info?.type === 'pool';
}
