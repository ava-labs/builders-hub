// Known contract addresses for popular Avalanche C-Chain dApps
// All addresses are lowercase for easy comparison

export interface ContractInfo {
  address: string;
  name: string;
  protocol: string;
  category: 'dex' | 'lending' | 'derivatives' | 'bridge' | 'nft' | 'yield' | 'gaming' | 'rwa' | 'token' | 'infrastructure' | 'icm' | 'mev' | 'other';
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
  // NFT-based loyalty badges (Mastercard-backed, Empire State Building partnership)
  '0xf1d7f5723de7980ab2a988c2eed1be620a30bc6d': {
    address: '0xf1d7f5723de7980ab2a988c2eed1be620a30bc6d',
    name: 'UpTop Contract',
    protocol: 'UpTop',
    category: 'nft',
    type: 'other',
  },
  '0x076a53abaa556073a8be7135c5a29d4b70e504a5': {
    address: '0x076a53abaa556073a8be7135c5a29d4b70e504a5',
    name: 'UpTop Contract',
    protocol: 'UpTop',
    category: 'nft',
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
  // In-game ad microtransaction network, Avalanche-funded
  '0x06e9b71283700d1a319070f14976d3aba6c27745': {
    address: '0x06e9b71283700d1a319070f14976d3aba6c27745',
    name: 'Big Ads Contract',
    protocol: 'Big Ads',
    category: 'gaming',
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
  // AI data platform using blockchain for rewards and privacy
  '0x11fbe9e637c4a3deca3453f2925aaaa18e16963e': {
    address: '0x11fbe9e637c4a3deca3453f2925aaaa18e16963e',
    name: 'Banza Contract',
    protocol: 'Banza',
    category: 'infrastructure',
    type: 'other',
  },
  '0xae0bfb23ddf753949fe00cd93a1bde45769dc7e9': {
    address: '0xae0bfb23ddf753949fe00cd93a1bde45769dc7e9',
    name: 'Banza Contract',
    protocol: 'Banza',
    category: 'infrastructure',
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

  // ============ VALINOR-OATFI (RWA) ============
  '0xe25cb545bdd47a8ec2d08001cb5661b00d47621a': {
    address: '0xe25cb545bdd47a8ec2d08001cb5661b00d47621a',
    name: 'Tranche Pool',
    protocol: 'Valinor OatFi',
    category: 'rwa',
    type: 'vault',
  },
  '0x41d9569610dae2b6696797382fb26b5156db426f': {
    address: '0x41d9569610dae2b6696797382fb26b5156db426f',
    name: 'Borrower Operating',
    protocol: 'Valinor OatFi',
    category: 'rwa',
    type: 'other',
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
    protocol: 'MEV Bot (0x977a deployer)',
    category: 'mev',
    type: 'other',
  },
  '0x922135e61c07c650dc406dc9d7722f403cf4935b': {
    address: '0x922135e61c07c650dc406dc9d7722f403cf4935b',
    name: 'MEV Bot (0x2222 deployer)',
    protocol: 'MEV Bot (0x2222 deployer)',
    category: 'mev',
    type: 'other',
  },
  '0x10922755586c35180cdec7a1a38e2b60c800d3c8': {
    address: '0x10922755586c35180cdec7a1a38e2b60c800d3c8',
    name: 'MEV Bot (failed ops)',
    protocol: 'MEV Bot (failed ops)',
    category: 'mev',
    type: 'other',
  },
  '0x99b69659f70470bbd32ae59ddf952f157a598a44': {
    address: '0x99b69659f70470bbd32ae59ddf952f157a598a44',
    name: 'MEV Bot (multi-protocol)',
    protocol: 'MEV Bot (multi-protocol)',
    category: 'mev',
    type: 'other',
  },
  '0x612a722ac5eff60004a0d8e83fbe768690540176': {
    address: '0x612a722ac5eff60004a0d8e83fbe768690540176',
    name: 'MEV Bot (0x977a deployer #2)',
    protocol: 'MEV Bot (0x977a deployer #2)',
    category: 'mev',
    type: 'other',
  },
  '0x07d25044cbe0524c0617267d6bfaf2fa6a0a0efe': {
    address: '0x07d25044cbe0524c0617267d6bfaf2fa6a0a0efe',
    name: 'MEV Bot (Gnosis Safe backed)',
    protocol: 'MEV Bot (Gnosis Safe backed)',
    category: 'mev',
    type: 'other',
  },
  '0x25090cd3c1f3dd6377348f58408d2ddc96acf201': {
    address: '0x25090cd3c1f3dd6377348f58408d2ddc96acf201',
    name: 'MEV Bot (0x977a deployer #3)',
    protocol: 'MEV Bot (0x977a deployer #3)',
    category: 'mev',
    type: 'other',
  },

  // Round 2 MEV bots
  '0xd1f6ca075b345c3532ee3957f0a32a0a0c881449': {
    address: '0xd1f6ca075b345c3532ee3957f0a32a0a0c881449',
    name: 'MEV Bot (flash loan arb)',
    protocol: 'MEV Bot (flash loan arb)',
    category: 'mev',
    type: 'other',
  },
  '0x5d6d9811919598981367ac45134f9586d4f04bff': {
    address: '0x5d6d9811919598981367ac45134f9586d4f04bff',
    name: 'PumpSpace Pool',
    protocol: 'PumpSpace',
    category: 'dex',
    type: 'pool',
  },
  '0x278d858f05b94576c1e6f73285886876ff6ef8d2': {
    address: '0x278d858f05b94576c1e6f73285886876ff6ef8d2',
    name: 'MEV Bot (SafeProxy arb)',
    protocol: 'MEV Bot (SafeProxy arb)',
    category: 'mev',
    type: 'other',
  },
  '0x42104e66a93da581dd06ebd434ff1c47176ff2d7': {
    address: '0x42104e66a93da581dd06ebd434ff1c47176ff2d7',
    name: 'MEV Bot (JIT liquidity)',
    protocol: 'MEV Bot (JIT liquidity) (0x42104e)',
    category: 'mev',
    type: 'other',
  },
  '0x5b05e50f8d2942cbc7f89dd5b07cc2fa610caf9d': {
    address: '0x5b05e50f8d2942cbc7f89dd5b07cc2fa610caf9d',
    name: 'MEV Bot (Coinbase funded #1)',
    protocol: 'MEV Bot (Coinbase funded #1)',
    category: 'mev',
    type: 'other',
  },
  '0xf163ca4c6931141ee115db0b192ed6c37d491714': {
    address: '0xf163ca4c6931141ee115db0b192ed6c37d491714',
    name: 'MEV Bot (Coinbase funded #2)',
    protocol: 'MEV Bot (Coinbase funded #2)',
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

  // (Valinor OatFi additional addresses — main entries in VALINOR-OATFI section above)
  '0xe3cde6f051872e67d0a7c2124e9a024d80e2733f': {
    address: '0xe3cde6f051872e67d0a7c2124e9a024d80e2733f',
    name: 'Valinor Lender',
    protocol: 'Valinor OatFi',
    category: 'rwa',
    type: 'vault',
  },
  '0x7a75539cd0647625217ef93302855ddeb02f7093': {
    address: '0x7a75539cd0647625217ef93302855ddeb02f7093',
    name: 'Avalanche Foundation Lender',
    protocol: 'Valinor OatFi',
    category: 'rwa',
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
    protocol: 'MEV Bot (0x2222 deployer #3)',
    category: 'mev',
    type: 'other',
  },
  '0x31e05ba0fca0a9447a2eb1065c1cc57cb722a924': {
    address: '0x31e05ba0fca0a9447a2eb1065c1cc57cb722a924',
    name: 'MEV Bot (0x2222 deployer #4)',
    protocol: 'MEV Bot (0x2222 deployer #4)',
    category: 'mev',
    type: 'other',
  },

  // ============ AVAXPIXEL ============
  '0x1edf79e77693561e80072becbcce1e16dc356aca': {
    address: '0x1edf79e77693561e80072becbcce1e16dc356aca',
    name: 'APIX Token',
    protocol: 'AvaxPixel',
    category: 'gaming',
    type: 'token',
  },

  // ============ MEV / ARBITRAGE BOTS (Round 4 — deployer 0x2d75) ============
  '0x10604ec3d66bd86db80d1782d4df3396902f67f3': {
    address: '0x10604ec3d66bd86db80d1782d4df3396902f67f3',
    name: 'MEV Bot (0x2d75 deployer #1)',
    protocol: 'MEV Bot (0x2d75 deployer #1)',
    category: 'mev',
    type: 'other',
  },
  '0xf7a9af4b028448a78aefc589aaa41d1728dc7421': {
    address: '0xf7a9af4b028448a78aefc589aaa41d1728dc7421',
    name: 'MEV Bot (0x2d75 deployer #2)',
    protocol: 'MEV Bot (0x2d75 deployer #2)',
    category: 'mev',
    type: 'other',
  },
  '0xc0bbe7e1ea440600cadcbee83640bb60b8f985fb': {
    address: '0xc0bbe7e1ea440600cadcbee83640bb60b8f985fb',
    name: 'MEV Bot (0x2d75 deployer #3)',
    protocol: 'MEV Bot (0x2d75 deployer #3)',
    category: 'mev',
    type: 'other',
  },

  // ============ MEV / ARBITRAGE BOTS (Round 4 — misc) ============
  '0x04e1dee021cd12bba022a72806441b43d8212fec': {
    address: '0x04e1dee021cd12bba022a72806441b43d8212fec',
    name: 'RouterV2',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'router',
  },
  '0x0ac011eb02a44d3fd7ad2e837a9f5a330913af13': {
    address: '0x0ac011eb02a44d3fd7ad2e837a9f5a330913af13',
    name: 'MEV Bot (Uniswap V4 #1)',
    protocol: 'MEV Bot (Uniswap V4 #1)',
    category: 'mev',
    type: 'other',
  },
  '0x56c47ff7e63cc0ebb2038ce5822d19fdc8f4be27': {
    address: '0x56c47ff7e63cc0ebb2038ce5822d19fdc8f4be27',
    name: 'MEV Bot (Uniswap V4 #2)',
    protocol: 'MEV Bot (Uniswap V4 #2)',
    category: 'mev',
    type: 'other',
  },
  '0x964bd4f472882d0d4120a4b3c859e43ffb459291': {
    address: '0x964bd4f472882d0d4120a4b3c859e43ffb459291',
    name: 'MEV Bot (CAPY holder)',
    protocol: 'MEV Bot (CAPY holder)',
    category: 'mev',
    type: 'other',
  },

  // ============ BLACKHOLE DEX (Round 5) ============
  '0x5862cfede966e4f34fc42026214ebeddb0298b00': {
    address: '0x5862cfede966e4f34fc42026214ebeddb0298b00',
    name: 'CL Position Manager',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'controller',
  },
  '0xff29b2a3fdea7528e3015e7673736a8fb0e2a777': {
    address: '0xff29b2a3fdea7528e3015e7673736a8fb0e2a777',
    name: 'Core Proxy',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'other',
  },
  '0x84a6df8cf36799ad5d46f466a7d24798dee3c116': {
    address: '0x84a6df8cf36799ad5d46f466a7d24798dee3c116',
    name: 'Core Proxy (Voter/Gauge)',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'controller',
  },
  '0x3ade52f9779c07471f4b6d5997444c3c2124c1c0': {
    address: '0x3ade52f9779c07471f4b6d5997444c3c2124c1c0',
    name: 'GaugeV2 Deposit',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'staking',
  },
  '0x5122f5154df20e5f29df53e633ce1ac5b6623558': {
    address: '0x5122f5154df20e5f29df53e633ce1ac5b6623558',
    name: 'BlackholeLoanV2',
    protocol: 'Blackhole DEX',
    category: 'lending',
    type: 'pool',
  },
  '0xb5e5a51e176f91e089185885d6f36382bd47bb12': {
    address: '0xb5e5a51e176f91e089185885d6f36382bd47bb12',
    name: 'Blackhole Contract',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'other',
  },
  '0xabfc48e8bed7b26762745f3139555f320119709d': {
    address: '0xabfc48e8bed7b26762745f3139555f320119709d',
    name: 'Algebra SwapRouter',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'router',
  },
  '0x6eb07c70a96fa912ba34a3c3fa9382b799808876': {
    address: '0x6eb07c70a96fa912ba34a3c3fa9382b799808876',
    name: 'Blackhole Contract',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'other',
  },
  '0x25723828ed32916e24b662ec481c8444232613ab': {
    address: '0x25723828ed32916e24b662ec481c8444232613ab',
    name: 'Blackhole Gauge/Staking',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'staking',
  },
  '0x12e3f95ed406ca77519bcd70ef2c3ac9ac5484e4': {
    address: '0x12e3f95ed406ca77519bcd70ef2c3ac9ac5484e4',
    name: 'Blackhole Gauge/Staking',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'staking',
  },
  '0x59aa177312ff6bdf39c8af6f46dae217bf76cbf6': {
    address: '0x59aa177312ff6bdf39c8af6f46dae217bf76cbf6',
    name: 'GaugeManager v1.0.2',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'controller',
  },
  '0x367a1b456a4d25d83f1a6c1855b0217c473fe3a8': {
    address: '0x367a1b456a4d25d83f1a6c1855b0217c473fe3a8',
    name: 'Blackhole Proxy',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'other',
  },
  '0x7c7bd86baf240db3dbcc3f7a22b35c5baa83ba28': {
    address: '0x7c7bd86baf240db3dbcc3f7a22b35c5baa83ba28',
    name: 'RewardsDistributor',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'rewards',
  },

  // ============ OKX DEX ============
  '0xe81e61cbc5ab6184f33cde9d9ff54411b1fd0899': {
    address: '0xe81e61cbc5ab6184f33cde9d9ff54411b1fd0899',
    name: 'OKX Swap Bot',
    protocol: 'OKX DEX',
    category: 'dex',
    type: 'router',
  },

  // ============ GMX (Round 5) ============
  '0x8f550e53dfe96c055d5bdb267c21f268fcaf63b2': {
    address: '0x8f550e53dfe96c055d5bdb267c21f268fcaf63b2',
    name: 'GMX V2 ExchangeRouter',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'router',
  },
  '0xee2d3339cbce7a42573c96acc1298a79a5c996df': {
    address: '0xee2d3339cbce7a42573c96acc1298a79a5c996df',
    name: 'GelatoRelayRouter',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'router',
  },

  // ============ RAIN (Payments) ============
  '0x5bbb435ec20154f016ee96041c3fdfe46354603a': {
    address: '0x5bbb435ec20154f016ee96041c3fdfe46354603a',
    name: 'Coordinator',
    protocol: 'Rain',
    category: 'infrastructure',
    type: 'other',
  },

  // ============ RELAY (Bridge) ============
  '0xccc88a9d1b4ed6b0eaba998850414b24f1c315be': {
    address: '0xccc88a9d1b4ed6b0eaba998850414b24f1c315be',
    name: 'RelayApprovalProxyV3',
    protocol: 'Relay',
    category: 'bridge',
    type: 'router',
  },

  // ============ METAMASK SWAPS ============
  '0x1a1ec25dc08e98e5e93f1104b5e5cdd298707d31': {
    address: '0x1a1ec25dc08e98e5e93f1104b5e5cdd298707d31',
    name: 'MetaMask Swap Router',
    protocol: 'MetaMask Swaps',
    category: 'infrastructure',
    type: 'router',
  },

  // ============ AQUASPACE ============
  '0xee9d947e164b459ea1abb0d49dfaadb20d6fca06': {
    address: '0xee9d947e164b459ea1abb0d49dfaadb20d6fca06',
    name: 'AquaSpace Position NFT',
    protocol: 'AquaSpace',
    category: 'dex',
    type: 'other',
  },
  '0x00f8a3b9395b4b02d12ee26536046c3c52459674': {
    address: '0x00f8a3b9395b4b02d12ee26536046c3c52459674',
    name: 'AquaSpace Pool/Vault',
    protocol: 'AquaSpace',
    category: 'dex',
    type: 'pool',
  },
  '0xadcae606ada101d6c20b6df57954eef00f370a8e': {
    address: '0xadcae606ada101d6c20b6df57954eef00f370a8e',
    name: 'AquaSpace Pool/Vault',
    protocol: 'AquaSpace',
    category: 'dex',
    type: 'pool',
  },

  // ============ SEALFI ============
  '0xb32d01e1a7cc2220fcf4c354f7c83cf1c309b7bc': {
    address: '0xb32d01e1a7cc2220fcf4c354f7c83cf1c309b7bc',
    name: 'Sealfi',
    protocol: 'Sealfi',
    category: 'gaming',
    type: 'other',
  },

  // ============ FESTIVAL GREETINGS ============
  '0x822f7cb652beff262ec5ae9f4203dd066e3174cd': {
    address: '0x822f7cb652beff262ec5ae9f4203dd066e3174cd',
    name: 'FestivalGreetings (FGRT)',
    protocol: 'FestivalGreetings',
    category: 'nft',
    type: 'token',
  },

  // ============ BLACKHOLE DEX (Round 6) ============
  '0x246c186f20b8a9b7847ff2c66b32405cac6b52fd': {
    address: '0x246c186f20b8a9b7847ff2c66b32405cac6b52fd',
    name: 'Blackhole Proxy (BLACK holder)',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'other',
  },

  // ============ TRESR ============
  '0x5926b1979f6603f8675a15392417835133f1697c': {
    address: '0x5926b1979f6603f8675a15392417835133f1697c',
    name: 'Tresr Key Rewards Pool',
    protocol: 'Tresr',
    category: 'gaming',
    type: 'rewards',
  },

  // ============ UNISWAP (Additional) ============
  '0xbb00ff08d01d300023c629e8ffffcb65a5a578ce': {
    address: '0xbb00ff08d01d300023c629e8ffffcb65a5a578ce',
    name: 'SwapRouter02',
    protocol: 'Uniswap',
    category: 'dex',
    type: 'router',
  },

  // ============ LI.FI (Additional) ============
  '0x89c6340b1a1f4b25d36cd8b063d49045caf3f818': {
    address: '0x89c6340b1a1f4b25d36cd8b063d49045caf3f818',
    name: 'Permit2Proxy',
    protocol: 'LI.FI',
    category: 'bridge',
    type: 'router',
  },

  // ============ WOOFI (Additional) ============
  '0x2a375567f5e13f6bd74fda7627df3b1af6bfa5a6': {
    address: '0x2a375567f5e13f6bd74fda7627df3b1af6bfa5a6',
    name: 'Wooracle v2.2.1',
    protocol: 'WOOFi',
    category: 'dex',
    type: 'other',
  },

  // ============ YIELD YAK (Additional Round 6) ============
  '0x3bc36a0ea51b95597174bce8b05025d1a5c0df9e': {
    address: '0x3bc36a0ea51b95597174bce8b05025d1a5c0df9e',
    name: 'Yield Yak: Black (YRT)',
    protocol: 'Yield Yak',
    category: 'yield',
    type: 'vault',
  },

  // ============ COW PROTOCOL ============
  '0x9008d19f58aabd9ed0d60971565aa8510560ab41': {
    address: '0x9008d19f58aabd9ed0d60971565aa8510560ab41',
    name: 'GPv2Settlement',
    protocol: 'CoW Protocol',
    category: 'dex',
    type: 'router',
  },

  // ============ PYTH ============
  '0x4305fb66699c3b2702d4d05cf36551390a4c69c6': {
    address: '0x4305fb66699c3b2702d4d05cf36551390a4c69c6',
    name: 'Pyth Price Feed Proxy',
    protocol: 'Pyth',
    category: 'infrastructure',
    type: 'other',
  },

  // ============ MAYAN FINANCE ============
  '0xbc0663ef63add180609944c58ba7d4851890ca45': {
    address: '0xbc0663ef63add180609944c58ba7d4851890ca45',
    name: 'Mayan Fulfill Helper',
    protocol: 'Mayan Finance',
    category: 'bridge',
    type: 'router',
  },

  // ============ SALVOR (Additional) ============
  '0x05c1813ec7beb8bf744ac43fea25cafb650ac966': {
    address: '0x05c1813ec7beb8bf744ac43fea25cafb650ac966',
    name: 'Salvor NFT Lending V2',
    protocol: 'Salvor',
    category: 'lending',
    type: 'pool',
  },

  // ============ DODO (Additional) ============
  '0xde5c314a604b3445349222156c6ec9d83880270f': {
    address: '0xde5c314a604b3445349222156c6ec9d83880270f',
    name: 'DPPAdvancedAdmin',
    protocol: 'DODO',
    category: 'dex',
    type: 'controller',
  },

  // ============ MEV / ARBITRAGE BOTS (Round 5) ============
  '0x127e15568359a6f549039a567ecb8a7396151ca5': {
    address: '0x127e15568359a6f549039a567ecb8a7396151ca5',
    name: 'MEV Bot (WAVAX arb)',
    protocol: 'MEV Bot (WAVAX arb)',
    category: 'mev',
    type: 'other',
  },
  '0x777c18ca58845793701db19845b5f70086000000': {
    address: '0x777c18ca58845793701db19845b5f70086000000',
    name: 'MEV Bot (vanity 0x777)',
    protocol: 'MEV Bot (vanity 0x777)',
    category: 'mev',
    type: 'other',
  },
  '0x31775b7cf5e046cb47c3d5336ce3f3e34066a96b': {
    address: '0x31775b7cf5e046cb47c3d5336ce3f3e34066a96b',
    name: 'MEV Bot (batch executor)',
    protocol: 'MEV Bot (batch executor)',
    category: 'mev',
    type: 'other',
  },
  '0x62f9016c97ef9255c8ba16dda7f531656015daea': {
    address: '0x62f9016c97ef9255c8ba16dda7f531656015daea',
    name: 'MEV Bot (factory/router)',
    protocol: 'MEV Bot (factory/router)',
    category: 'mev',
    type: 'other',
  },
  '0xef114c8710330751ae2cd84066cfd85412b6d30d': {
    address: '0xef114c8710330751ae2cd84066cfd85412b6d30d',
    name: 'MEV Bot (Aave flash loan arb)',
    protocol: 'MEV Bot (Aave flash loan arb)',
    category: 'mev',
    type: 'other',
  },
  '0x9cde401c8f19fd7648c1fca95438062ee3600bbd': {
    address: '0x9cde401c8f19fd7648c1fca95438062ee3600bbd',
    name: 'MEV Bot (Uniswap V4 #3)',
    protocol: 'MEV Bot (Uniswap V4 #3)',
    category: 'mev',
    type: 'other',
  },
  '0xc8e0d6ddec98078bf0a12c6e445631f02727cd22': {
    address: '0xc8e0d6ddec98078bf0a12c6e445631f02727cd22',
    name: 'MEV Bot (multi-DEX arb)',
    protocol: 'MEV Bot (multi-DEX arb)',
    category: 'mev',
    type: 'other',
  },
  '0x92fc2e2c2a672bf8c88119c75832104440802b18': {
    address: '0x92fc2e2c2a672bf8c88119c75832104440802b18',
    name: 'MEV Bot (Uniswap V4 #4)',
    protocol: 'MEV Bot (Uniswap V4 #4)',
    category: 'mev',
    type: 'other',
  },
  '0xc208d89afaf82722138c890774cdd4cc4137b55a': {
    address: '0xc208d89afaf82722138c890774cdd4cc4137b55a',
    name: 'MEV Bot (Uniswap V4 #5)',
    protocol: 'MEV Bot (Uniswap V4 #5)',
    category: 'mev',
    type: 'other',
  },
  '0x53c4bcbebf25cc4243e1640cf76ed4411d640e55': {
    address: '0x53c4bcbebf25cc4243e1640cf76ed4411d640e55',
    name: 'MEV Bot (Uniswap V4 #6)',
    protocol: 'MEV Bot (Uniswap V4 #6)',
    category: 'mev',
    type: 'other',
  },
  '0x4f9647f643f547c553b27e611ba97d12d681566b': {
    address: '0x4f9647f643f547c553b27e611ba97d12d681566b',
    name: 'MEV Bot (multi-protocol arb)',
    protocol: 'MEV Bot (multi-protocol arb)',
    category: 'mev',
    type: 'other',
  },
  '0x337cdbcc3c5756e75bfe0326deb067a901bdd1ca': {
    address: '0x337cdbcc3c5756e75bfe0326deb067a901bdd1ca',
    name: 'MEV Bot (JIT liquidity)',
    protocol: 'MEV Bot (JIT liquidity) (0x337cdb)',
    category: 'mev',
    type: 'other',
  },
  '0x38aa1b1c65531fde294d2ada1af94c9d3fb30e54': {
    address: '0x38aa1b1c65531fde294d2ada1af94c9d3fb30e54',
    name: 'Gauge',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'staking',
  },
  '0x99ca040580837a2158bfd0c8d84fcd4b85b6393b': {
    address: '0x99ca040580837a2158bfd0c8d84fcd4b85b6393b',
    name: 'MEV Bot (multi-pool arb)',
    protocol: 'MEV Bot (multi-pool arb)',
    category: 'mev',
    type: 'other',
  },
  '0xd1448508f221b53ea26c74d384f123e085f9ab2d': {
    address: '0xd1448508f221b53ea26c74d384f123e085f9ab2d',
    name: 'MEV Bot (cross-protocol arb)',
    protocol: 'MEV Bot (cross-protocol arb)',
    category: 'mev',
    type: 'other',
  },
  '0x14843971c9918b5f762c309ac21bc2554981ec9d': {
    address: '0x14843971c9918b5f762c309ac21bc2554981ec9d',
    name: 'MEV Bot (SushiSwap arb)',
    protocol: 'MEV Bot (SushiSwap arb)',
    category: 'mev',
    type: 'other',
  },
  '0xdcd54f57d21e73c8bb197ee0fb207690b408dad7': {
    address: '0xdcd54f57d21e73c8bb197ee0fb207690b408dad7',
    name: 'MEV Bot (single-method arb)',
    protocol: 'MEV Bot (single-method arb)',
    category: 'mev',
    type: 'other',
  },
  '0xf3d455d5e756efcec05c49e5721b539265466bbb': {
    address: '0xf3d455d5e756efcec05c49e5721b539265466bbb',
    name: 'MEV Bot (swap bot)',
    protocol: 'MEV Bot (swap bot)',
    category: 'mev',
    type: 'other',
  },
  '0x5eba459213546091e74e1fb6d2e7ae05fb65ec0f': {
    address: '0x5eba459213546091e74e1fb6d2e7ae05fb65ec0f',
    name: 'MEV Bot (multi-asset trader)',
    protocol: 'MEV Bot (multi-asset trader)',
    category: 'mev',
    type: 'other',
  },
  '0xb9b75851b729cebd6f7c0d98fc564395449cba73': {
    address: '0xb9b75851b729cebd6f7c0d98fc564395449cba73',
    name: 'Gauge',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'staking',
  },

  // ============ MEV / ARBITRAGE BOTS (Round 6) ============
  // Top 10 unclassified by gas (30d ending 2026-03-04). All single-caller, unverified.
  '0x17768456b8e8b26d06bf5e99a77c4c0c9d2bfb2a': {
    address: '0x17768456b8e8b26d06bf5e99a77c4c0c9d2bfb2a',
    name: 'MEV Bot (multi-hop arb, 5.9M avg gas)',
    protocol: 'MEV Bot (multi-hop arb, 5.9M avg gas)',
    category: 'mev',
    type: 'other',
  },
  '0xac3b57bd239b1ff49d07be4f7cf48f64b7462811': {
    address: '0xac3b57bd239b1ff49d07be4f7cf48f64b7462811',
    name: 'MEV Bot (high-freq, 0x977a caller)',
    protocol: 'MEV Bot (high-freq, 0x977a caller)',
    category: 'mev',
    type: 'other',
  },
  '0x350b239e26690202e2a2d46f55a844e4396f0485': {
    address: '0x350b239e26690202e2a2d46f55a844e4396f0485',
    name: 'MEV Bot (heavy arb, 4.1M avg gas)',
    protocol: 'MEV Bot (heavy arb, 4.1M avg gas)',
    category: 'mev',
    type: 'other',
  },
  '0x181870d61c0e5a6985c873485de8297426f4aed4': {
    address: '0x181870d61c0e5a6985c873485de8297426f4aed4',
    name: 'MEV Bot (JIT liquidity #1)',
    protocol: 'MEV Bot (JIT liquidity #1)',
    category: 'mev',
    type: 'other',
  },
  '0x9ad4c21765e3b18930227a97481fb30293486f3a': {
    address: '0x9ad4c21765e3b18930227a97481fb30293486f3a',
    name: 'MEV Bot (template A #1)',
    protocol: 'MEV Bot (template A #1)',
    category: 'mev',
    type: 'other',
  },
  '0xcf03a2eeda67d775ebc2fcd799d67ed01cd80599': {
    address: '0xcf03a2eeda67d775ebc2fcd799d67ed01cd80599',
    name: 'MEV Bot (template A #2)',
    protocol: 'MEV Bot (template A #2)',
    category: 'mev',
    type: 'other',
  },
  '0x4f7b47d5998bd53f63786ffb6e42becda7eec4ab': {
    address: '0x4f7b47d5998bd53f63786ffb6e42becda7eec4ab',
    name: 'MEV Bot (template A #3)',
    protocol: 'MEV Bot (template A #3)',
    category: 'mev',
    type: 'other',
  },
  '0x87f7129ab8cd0f5d438bfe31a7f5eb097e73acf2': {
    address: '0x87f7129ab8cd0f5d438bfe31a7f5eb097e73acf2',
    name: 'MEV Bot (template A #4)',
    protocol: 'MEV Bot (template A #4)',
    category: 'mev',
    type: 'other',
  },
  '0x12f62e3cee07524fd3368c1d63b5d61f227d2b78': {
    address: '0x12f62e3cee07524fd3368c1d63b5d61f227d2b78',
    name: 'MEV Bot (arb bot)',
    protocol: 'MEV Bot (arb bot)',
    category: 'mev',
    type: 'other',
  },
  '0xe7c679e7488bb8a3ac0e7eeb511cee3f580bf1e1': {
    address: '0xe7c679e7488bb8a3ac0e7eeb511cee3f580bf1e1',
    name: 'MEV Bot (JIT liquidity #2)',
    protocol: 'MEV Bot (JIT liquidity #2)',
    category: 'mev',
    type: 'other',
  },

  // ============ AUTO-CLASSIFIED (Round 7) ============

  // --- ERC-4337 ---
  '0x40ac2e93d1257196a418fce7d6edacde65aaf2ba': {
    address: '0x40ac2e93d1257196a418fce7d6edacde65aaf2ba',
    name: 'EntryPoint',
    protocol: 'ERC-4337',
    category: 'infrastructure',
    type: 'other',
  },

  // --- Chainlink (CCIP / VRF / Infrastructure) ---
  '0xf0f791901854fab16adebd60f0639b960b6ea0cf': {
    address: '0xf0f791901854fab16adebd60f0639b960b6ea0cf',
    name: 'CommitStore',
    protocol: 'Chainlink',
    category: 'infrastructure',
    type: 'other',
  },
  '0x23e23958d220b774680f91c2c91a6f2b2f610d7e': {
    address: '0x23e23958d220b774680f91c2c91a6f2b2f610d7e',
    name: 'CommitStore',
    protocol: 'Chainlink',
    category: 'infrastructure',
    type: 'other',
  },
  '0xe72d25add538e8ef9cef85622ea8912a6cb98be6': {
    address: '0xe72d25add538e8ef9cef85622ea8912a6cb98be6',
    name: 'OffRamp',
    protocol: 'Chainlink',
    category: 'infrastructure',
    type: 'other',
  },
  '0x78b69899c8cd252126cbb1a50171ec37286c3877': {
    address: '0x78b69899c8cd252126cbb1a50171ec37286c3877',
    name: 'BlockhashStore',
    protocol: 'Chainlink',
    category: 'infrastructure',
    type: 'other',
  },
  '0x76c9cf548b4179f8901cda1f8623568b58215e62': {
    address: '0x76c9cf548b4179f8901cda1f8623568b58215e62',
    name: 'KeystoneForwarder',
    protocol: 'Chainlink',
    category: 'infrastructure',
    type: 'other',
  },
  '0xb8ce5e56972b53ed20887a43d49e01b4842848b9': {
    address: '0xb8ce5e56972b53ed20887a43d49e01b4842848b9',
    name: 'AuthorizedForwarder',
    protocol: 'Chainlink',
    category: 'infrastructure',
    type: 'other',
  },
  '0x311efd3602f91436384d5f879588fe9ac99ca43c': {
    address: '0x311efd3602f91436384d5f879588fe9ac99ca43c',
    name: 'KeystoneForwarder',
    protocol: 'Chainlink',
    category: 'infrastructure',
    type: 'other',
  },

  // --- Pharaoh (Gauges + ve helpers) ---
  '0x19d860b389260f3ff31ca77b1c91c92f2236429b': {
    address: '0x19d860b389260f3ff31ca77b1c91c92f2236429b',
    name: 'GaugeCL',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'staking',
  },
  '0xe384f4bd5a482f301d9caf0038a06625a81296c5': {
    address: '0xe384f4bd5a482f301d9caf0038a06625a81296c5',
    name: 'GaugeCL',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'staking',
  },
  '0x014d8de7fa79320c1750c4702b7830c3987f8b51': {
    address: '0x014d8de7fa79320c1750c4702b7830c3987f8b51',
    name: 'GaugeCL',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'staking',
  },
  '0x5b5f9c34409ff4b5af47a4373c8dc5a49866a20f': {
    address: '0x5b5f9c34409ff4b5af47a4373c8dc5a49866a20f',
    name: 'GaugeCL',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'staking',
  },
  '0xe5214c3ccb4b7a832601ec108096b7e0d6787771': {
    address: '0xe5214c3ccb4b7a832601ec108096b7e0d6787771',
    name: 'GaugeCL',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'staking',
  },
  '0x033562d55e6229ac3e37de8fe4d5df178f268e0b': {
    address: '0x033562d55e6229ac3e37de8fe4d5df178f268e0b',
    name: 'GaugeCL',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'staking',
  },
  '0x060a9038133745d281934f82ae0f4bd92a065af1': {
    address: '0x060a9038133745d281934f82ae0f4bd92a065af1',
    name: 'GaugeCL',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'staking',
  },
  '0x1d67c7729135583f2ee11fd34c7921a8ae500e6f': {
    address: '0x1d67c7729135583f2ee11fd34c7921a8ae500e6f',
    name: 'VotingEscrowSplitHelper',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'other',
  },

  // --- Blackhole DEX (Strategy vaults) ---
  '0xe3c3d89b47f32c0c442cb3c8dae053ecec484cde': {
    address: '0xe3c3d89b47f32c0c442cb3c8dae053ecec484cde',
    name: 'BlackholeStrategy',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'vault',
  },
  '0xa0b7996b22b37c5bbffcaaf56e60dc4e9df2b7eb': {
    address: '0xa0b7996b22b37c5bbffcaaf56e60dc4e9df2b7eb',
    name: 'BlackholeStrategy',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'vault',
  },
  '0x5f75b397c63efa31302aa7fa155ddec4f1253437': {
    address: '0x5f75b397c63efa31302aa7fa155ddec4f1253437',
    name: 'BlackholeStrategy',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'vault',
  },
  '0x7ff774af8c9bf8cf43a0d92e6a052f17e5f604db': {
    address: '0x7ff774af8c9bf8cf43a0d92e6a052f17e5f604db',
    name: 'BlackholeStrategy',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'vault',
  },
  '0x1188bcefbfd37e4f5b775d3add2101cfa00ebf4a': {
    address: '0x1188bcefbfd37e4f5b775d3add2101cfa00ebf4a',
    name: 'BlackholeStrategy',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'vault',
  },
  '0x1b0d20acf582ab9b1063c71dc8eb8d1573ddaf34': {
    address: '0x1b0d20acf582ab9b1063c71dc8eb8d1573ddaf34',
    name: 'BlackholeStrategy',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'vault',
  },
  '0xedb267c865dcaf4c84dc9797d87841c7994c56c3': {
    address: '0xedb267c865dcaf4c84dc9797d87841c7994c56c3',
    name: 'BlackholeStrategy',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'vault',
  },
  '0xa369fa24c4fff56b92d729aa024d728f05cf76a8': {
    address: '0xa369fa24c4fff56b92d729aa024d728f05cf76a8',
    name: 'BlackholeStrategy',
    protocol: 'Blackhole DEX',
    category: 'dex',
    type: 'vault',
  },

  // --- GMX (V2 handlers) ---
  '0x441541167b041ec507b5308b7005075a13a28aa7': {
    address: '0x441541167b041ec507b5308b7005075a13a28aa7',
    name: 'GlvShiftHandler',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'controller',
  },
  '0xfabeb65bb877600be3a2c2a03aa56a95f9f845b9': {
    address: '0xfabeb65bb877600be3a2c2a03aa56a95f9f845b9',
    name: 'SubaccountGelatoRelayRouter',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'controller',
  },
  '0xad7f00b4080bacffaae7f44d67560c818d8e5468': {
    address: '0xad7f00b4080bacffaae7f44d67560c818d8e5468',
    name: 'LiquidationHandler',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'controller',
  },
  '0x334237f7d75497a22b1443f44ddccf95e72904a0': {
    address: '0x334237f7d75497a22b1443f44ddccf95e72904a0',
    name: 'WithdrawalHandler',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'controller',
  },

  // --- DODO (Private Pools) ---
  '0x6203c968ae2c15a562c53e0258fcb62e8139bd3e': {
    address: '0x6203c968ae2c15a562c53e0258fcb62e8139bd3e',
    name: 'DPPAdvancedAdmin',
    protocol: 'DODO',
    category: 'dex',
    type: 'pool',
  },
  '0x7b3ef1b432b016d9a0ba354fa01672f91ca27ba4': {
    address: '0x7b3ef1b432b016d9a0ba354fa01672f91ca27ba4',
    name: 'DPPAdvancedAdmin',
    protocol: 'DODO',
    category: 'dex',
    type: 'pool',
  },

  // --- Relay (Bridge routers) ---
  '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f': {
    address: '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f',
    name: 'RelayRouterV3',
    protocol: 'Relay',
    category: 'bridge',
    type: 'router',
  },
  '0xf5042e6ffac5a625d4e7848e0b01373d8eb9e222': {
    address: '0xf5042e6ffac5a625d4e7848e0b01373d8eb9e222',
    name: 'RelayRouter',
    protocol: 'Relay',
    category: 'bridge',
    type: 'router',
  },

  // --- Aave (V3 periphery) ---
  '0x9e82583414771b593a1d730c94f828d23f922f81': {
    address: '0x9e82583414771b593a1d730c94f828d23f922f81',
    name: 'RiskOracle',
    protocol: 'Aave',
    category: 'lending',
    type: 'other',
  },
  '0x2825ce5921538d17cc15ae00a8b24ff759c6cdae': {
    address: '0x2825ce5921538d17cc15ae00a8b24ff759c6cdae',
    name: 'WrappedTokenGatewayV3',
    protocol: 'Aave',
    category: 'lending',
    type: 'other',
  },

  // --- Uniswap ---
  '0x655c406ebfa14ee2006250925e54ec43ad184f8b': {
    address: '0x655c406ebfa14ee2006250925e54ec43ad184f8b',
    name: 'NonfungiblePositionManager',
    protocol: 'Uniswap',
    category: 'dex',
    type: 'other',
  },

  // --- Yield Yak ---
  '0xc4729e56b831d74bbc18797e0e17a295fa77488c': {
    address: '0xc4729e56b831d74bbc18797e0e17a295fa77488c',
    name: 'YakRouter',
    protocol: 'Yield Yak',
    category: 'yield',
    type: 'router',
  },

  // --- Silo Finance (NEW protocol) ---
  '0xf8c100ab4b2d416609b0ef18105ebf601b2ec84a': {
    address: '0xf8c100ab4b2d416609b0ef18105ebf601b2ec84a',
    name: 'SiloVault',
    protocol: 'Silo Finance',
    category: 'lending',
    type: 'vault',
  },

  // --- OpenSea ---
  '0x0000000000000068f116a894984e2db1123eb395': {
    address: '0x0000000000000068f116a894984e2db1123eb395',
    name: 'Seaport',
    protocol: 'OpenSea',
    category: 'nft',
    type: 'other',
  },

  // --- Rango (NEW protocol) ---
  '0x69460570c93f9de5e2edbc3052bf10125f0ca22d': {
    address: '0x69460570c93f9de5e2edbc3052bf10125f0ca22d',
    name: 'RangoDiamond',
    protocol: 'Rango',
    category: 'bridge',
    type: 'router',
  },

  // --- LayerZero (V2) ---
  '0xbf3521d309642fa9b1c91a08609505ba09752c61': {
    address: '0xbf3521d309642fa9b1c91a08609505ba09752c61',
    name: 'ReceiveUln302',
    protocol: 'LayerZero',
    category: 'bridge',
    type: 'other',
  },

  // ============ AUTO-CLASSIFIED — MEDIUM CONFIDENCE (Round 7) ============
  // Tag: REVIEW: — verify protocol assignment before removing tag

  // --- Deployer-clustered: OKX DEX (same deployer as known OKX DEX contracts) ---
  // REVIEW: deployer-clustered — not verified on Routescan
  '0xe9f3c2da88b75ba4ac7cbe2da884b911ee200784': {
    address: '0xe9f3c2da88b75ba4ac7cbe2da884b911ee200784',
    name: 'Unknown (OKX DEX deployer)',
    protocol: 'OKX DEX',
    category: 'dex',
    type: 'other',
  },

  // --- Deployer-clustered: Pharaoh (same deployer as known Pharaoh contracts) ---
  // REVIEW: deployer-clustered — TransparentUpgradeableProxy, check implementation
  '0xe30d0c8532721551a51a9fec7fb233759964d9e3': {
    address: '0xe30d0c8532721551a51a9fec7fb233759964d9e3',
    name: 'TransparentUpgradeableProxy (Pharaoh deployer)',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'other',
  },
  // REVIEW: deployer-clustered — not verified on Routescan
  '0x64963852966aa7ff2258434f361ec933bf0eaf03': {
    address: '0x64963852966aa7ff2258434f361ec933bf0eaf03',
    name: 'Unknown (Pharaoh deployer)',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'other',
  },

  // --- Deployer-clustered: MoveQuest (same deployer as known MoveQuest contracts) ---
  // REVIEW: deployer-clustered — contract name "BOOSTS"
  '0x929f7fa7a248293f3e9914f117678e24b143813b': {
    address: '0x929f7fa7a248293f3e9914f117678e24b143813b',
    name: 'BOOSTS (MoveQuest deployer)',
    protocol: 'MoveQuest',
    category: 'gaming',
    type: 'other',
  },
  // REVIEW: deployer-clustered — contract name "Nest"
  '0x6e07eb8066d59440d9dc36a5d33ab8a70a9f969d': {
    address: '0x6e07eb8066d59440d9dc36a5d33ab8a70a9f969d',
    name: 'Nest (MoveQuest deployer)',
    protocol: 'MoveQuest',
    category: 'gaming',
    type: 'other',
  },

  // --- Deployer-clustered: ERC-4337 (same deployer as known ERC-4337 contracts) ---
  // REVIEW: deployer-clustered — not verified on Routescan
  '0xa05405b6340a7f43dc5835351bfc4f5b1f028359': {
    address: '0xa05405b6340a7f43dc5835351bfc4f5b1f028359',
    name: 'Unknown (ERC-4337 deployer)',
    protocol: 'ERC-4337',
    category: 'infrastructure',
    type: 'other',
  },
  // REVIEW: deployer-clustered — not verified on Routescan
  '0xcbcd511ccf92da77245c4ae936e574b630ff0001': {
    address: '0xcbcd511ccf92da77245c4ae936e574b630ff0001',
    name: 'Unknown (ERC-4337 deployer)',
    protocol: 'ERC-4337',
    category: 'infrastructure',
    type: 'other',
  },

  // --- Deployer-clustered: Chikn (same deployer as known Chikn contracts) ---
  // REVIEW: deployer-clustered — not verified on Routescan
  '0x159cfd38deac6bb7b95abff3aa42063651c3c6f9': {
    address: '0x159cfd38deac6bb7b95abff3aa42063651c3c6f9',
    name: 'Unknown (Chikn deployer)',
    protocol: 'Chikn',
    category: 'gaming',
    type: 'other',
  },

  // --- Deployer-clustered: MEV / Arbitrage (same deployer as known MEV bots) ---
  // REVIEW: deployer-clustered
  '0xddc03487658954ee4dbaf16015d423bc29c68f52': {
    address: '0xddc03487658954ee4dbaf16015d423bc29c68f52',
    name: 'MEV Bot (deployer 0xf69e0b)',
    protocol: 'MEV Bot (deployer 0xf69e0b)',
    category: 'mev',
    type: 'other',
  },
  '0x7773c694fddf850089b00f23d8ab466f00000000': {
    address: '0x7773c694fddf850089b00f23d8ab466f00000000',
    name: 'MEV Bot (deployer 0xa34ec9)',
    protocol: 'MEV Bot (deployer 0xa34ec9)',
    category: 'mev',
    type: 'other',
  },
  '0x40335a68bd5dcc8cee4b93916c1f4b7af6554cdc': {
    address: '0x40335a68bd5dcc8cee4b93916c1f4b7af6554cdc',
    name: 'MEV Bot (deployer 0x977a8a)',
    protocol: 'MEV Bot (deployer 0x977a8a) (0x40335a)',
    category: 'mev',
    type: 'other',
  },
  '0xdd8ea833cd3c5360cf3c3b8e26520893549d60d7': {
    address: '0xdd8ea833cd3c5360cf3c3b8e26520893549d60d7',
    name: 'MEV Bot (deployer 0x977a8a)',
    protocol: 'MEV Bot (deployer 0x977a8a) (0xdd8ea8)',
    category: 'mev',
    type: 'other',
  },
  '0x723a11d37743eeaa2029974ea7c0a030f150867d': {
    address: '0x723a11d37743eeaa2029974ea7c0a030f150867d',
    name: 'MEV Bot (deployer 0x25b395)',
    protocol: 'MEV Bot (deployer 0x25b395)',
    category: 'mev',
    type: 'other',
  },

  // --- Named contracts: name-based classification (REVIEW protocol) ---
  // REVIEW: name-based — "SwapHelper", unknown protocol, 0.10% gas
  '0xde9d7290959b6060860b983b32f2d65b2701ebc2': {
    address: '0xde9d7290959b6060860b983b32f2d65b2701ebc2',
    name: 'SwapHelper',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'other',
  },
  // REVIEW: name-based — "MassTokenTransferOptimized", likely airdrop/batch tool, 0.07% gas
  '0x6c70f11a949ca1241ed77048067d60bbb935e379': {
    address: '0x6c70f11a949ca1241ed77048067d60bbb935e379',
    name: 'MassTokenTransferOptimized',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'other',
  },
  // REVIEW: name-based — "SettlementRouter", likely DEX aggregator/solver, 0.05% gas
  '0xf38709cfd3f89734c231dd8e59ff1d44cacddee8': {
    address: '0xf38709cfd3f89734c231dd8e59ff1d44cacddee8',
    name: 'SettlementRouter',
    protocol: 'Infrastructure',
    category: 'dex',
    type: 'router',
  },
  // REVIEW: name-based — "DestinationBridge", likely Ondo/USDY bridge, 0.04% gas
  '0xa8baad3115a133b101ef935cb2e198fd04f1c659': {
    address: '0xa8baad3115a133b101ef935cb2e198fd04f1c659',
    name: 'DestinationBridge',
    protocol: 'Infrastructure',
    category: 'bridge',
    type: 'router',
  },
  // REVIEW: name-based — "AgoraDollarErc1967Proxy", Agora stablecoin (AUSD), 0.04% gas
  '0x00000000efe302beaa2b3e6e1b18d08d69a9012a': {
    address: '0x00000000efe302beaa2b3e6e1b18d08d69a9012a',
    name: 'AgoraDollarErc1967Proxy',
    protocol: 'Infrastructure',
    category: 'token',
    type: 'token',
  },
  // REVIEW: name-based — "ERC20BridgeToken", likely Avalanche Bridge wrapped token, 0.03% gas
  '0x5e0e90e268bc247cc850c789a0db0d5c7621fb59': {
    address: '0x5e0e90e268bc247cc850c789a0db0d5c7621fb59',
    name: 'ERC20BridgeToken',
    protocol: 'Avalanche Bridge',
    category: 'bridge',
    type: 'token',
  },
  // REVIEW: name-based — "MetaBridge", likely Synapse or similar bridge aggregator, 0.03% gas
  '0x29106d08382d3c73bf477a94333c61db1142e1b6': {
    address: '0x29106d08382d3c73bf477a94333c61db1142e1b6',
    name: 'MetaBridge',
    protocol: 'Infrastructure',
    category: 'bridge',
    type: 'router',
  },
  // REVIEW: name-based — "FlashLoanRouter", 0.03% gas
  '0x9da8b48441583a2b93e2ef8213aad0ec0b392c69': {
    address: '0x9da8b48441583a2b93e2ef8213aad0ec0b392c69',
    name: 'FlashLoanRouter',
    protocol: 'Infrastructure',
    category: 'lending',
    type: 'router',
  },
  // REVIEW: name-based — "TradingVault", 0.02% gas
  '0x34768891c11032d6fcc4afbec34b408e6a24442f': {
    address: '0x34768891c11032d6fcc4afbec34b408e6a24442f',
    name: 'TradingVault',
    protocol: 'Infrastructure',
    category: 'derivatives',
    type: 'vault',
  },
  // REVIEW: name-based — "SwapRouter", unknown DEX, 0.02% gas
  '0x5485a0751a249225d3ba2f6f296551507e22547f': {
    address: '0x5485a0751a249225d3ba2f6f296551507e22547f',
    name: 'SwapRouter',
    protocol: 'Infrastructure',
    category: 'dex',
    type: 'router',
  },
  // REVIEW: name-based — "Diamond" (EIP-2535 diamond proxy), 0.02% gas
  '0xb300000b72deaeb607a12d5f54773d1c19c7028d': {
    address: '0xb300000b72deaeb607a12d5f54773d1c19c7028d',
    name: 'Diamond',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: name-based — "UniversalRouter", likely Uniswap Universal Router, 0.02% gas
  '0x94b75331ae8d42c1b61065089b7d48fe14aa73b7': {
    address: '0x94b75331ae8d42c1b61065089b7d48fe14aa73b7',
    name: 'UniversalRouter',
    protocol: 'Uniswap',
    category: 'dex',
    type: 'router',
  },
  // REVIEW: name-based — "Router", unknown protocol, 0.01% gas
  '0x757121c9a8259c4d6b6956c283355b2902a6baa2': {
    address: '0x757121c9a8259c4d6b6956c283355b2902a6baa2',
    name: 'Router',
    protocol: 'Infrastructure',
    category: 'dex',
    type: 'router',
  },

  // --- Proxy contracts: protocol unknown, need implementation lookup ---
  // REVIEW: proxy — check implementation contract on Routescan, 0.06% gas
  '0x236088b6a190d8b0471d5ef53c5ca90461645dc3': {
    address: '0x236088b6a190d8b0471d5ef53c5ca90461645dc3',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.06% gas
  '0xf739bd12e31e9c61040c3d7a1f69065b6cdd4699': {
    address: '0xf739bd12e31e9c61040c3d7a1f69065b6cdd4699',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.05% gas
  '0x38a07152ee64c7067feeba904d72abc9a9da0c77': {
    address: '0x38a07152ee64c7067feeba904d72abc9a9da0c77',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.04% gas
  '0xc40da05d24e09a2906fbea2147e6a670aa659939': {
    address: '0xc40da05d24e09a2906fbea2147e6a670aa659939',
    name: 'ERC1967Proxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.04% gas
  '0x2196e106af476f57618373ec028924767c758464': {
    address: '0x2196e106af476f57618373ec028924767c758464',
    name: 'UUPSProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.04% gas
  '0x76e3bc265307c8dd654bcac3c001f66f3ddb6583': {
    address: '0x76e3bc265307c8dd654bcac3c001f66f3ddb6583',
    name: 'ERC1967Proxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.04% gas
  '0x27428dd2d3dd32a4d7f7c497eaaa23130d894911': {
    address: '0x27428dd2d3dd32a4d7f7c497eaaa23130d894911',
    name: 'SimpleProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.03% gas
  '0x10ac9b7eb034fab1f3bc446e81479d7dc089be83': {
    address: '0x10ac9b7eb034fab1f3bc446e81479d7dc089be83',
    name: 'OptimizedTransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.03% gas
  '0xc605c2cf66ee98ea925b1bb4fea584b71c00cc4c': {
    address: '0xc605c2cf66ee98ea925b1bb4fea584b71c00cc4c',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — ApprovalProxy, likely DEX aggregator, 0.03% gas
  '0xbbbfd134e9b44bfb5123898ba36b01de7ab93d98': {
    address: '0xbbbfd134e9b44bfb5123898ba36b01de7ab93d98',
    name: 'ApprovalProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.03% gas
  '0x8315f1eb449dd4b779495c3a0b05e5d194446c6e': {
    address: '0x8315f1eb449dd4b779495c3a0b05e5d194446c6e',
    name: 'UUPSProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.03% gas
  '0x3176f6e4be2448c53edd59c27651edfaa74bf483': {
    address: '0x3176f6e4be2448c53edd59c27651edfaa74bf483',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — RebalanceProxy, 0.02% gas
  '0xd57f0bb9ed6cbbad0b2bdd470fd496db852aeb76': {
    address: '0xd57f0bb9ed6cbbad0b2bdd470fd496db852aeb76',
    name: 'RebalanceProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0x93676a067566ec92a5b16aa741b9d4b45649711e': {
    address: '0x93676a067566ec92a5b16aa741b9d4b45649711e',
    name: 'ERC1967Proxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0x3a7ad40286540fc7e666adec44e679c59c34dd00': {
    address: '0x3a7ad40286540fc7e666adec44e679c59c34dd00',
    name: 'ERC1967Proxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0x81d40f21f12a8f0e3252bccb954d722d4c464b64': {
    address: '0x81d40f21f12a8f0e3252bccb954d722d4c464b64',
    name: 'AdminUpgradableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0x09c1e991870cbc01009a4b49397a4f2a127d3784': {
    address: '0x09c1e991870cbc01009a4b49397a4f2a127d3784',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0xde12e956aa65e0581e9c470ace2a8194987a8935': {
    address: '0xde12e956aa65e0581e9c470ace2a8194987a8935',
    name: 'ERC1967Proxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0xc104debc37806421cb3b3d7e075e61f566efb583': {
    address: '0xc104debc37806421cb3b3d7e075e61f566efb583',
    name: 'UUPSProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0xaaa45c8f5ef92a000a121d102f4e89278a711faa': {
    address: '0xaaa45c8f5ef92a000a121d102f4e89278a711faa',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0x66a8cb6c4230b044378ac3676d47ed4fe18e3cfb': {
    address: '0x66a8cb6c4230b044378ac3676d47ed4fe18e3cfb',
    name: 'ERC1967Proxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0x6a5b3ab3274b738eab25205af6e2d4dd77812924': {
    address: '0x6a5b3ab3274b738eab25205af6e2d4dd77812924',
    name: 'ERC1967Proxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0x90e595783e43eb89ff07f63d27b8430e6b44bd9c': {
    address: '0x90e595783e43eb89ff07f63d27b8430e6b44bd9c',
    name: 'OptimizedTransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0x8a92294ffcfe469a3df4a85c76a0b0d2b3292119': {
    address: '0x8a92294ffcfe469a3df4a85c76a0b0d2b3292119',
    name: 'AMTransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.02% gas
  '0xee7ae85f2fe2239e27d9c1e23fffe168d63b4055': {
    address: '0xee7ae85f2fe2239e27d9c1e23fffe168d63b4055',
    name: 'ERC1967Proxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.01% gas
  '0x297ac6b26ad11691474e370a65cb4b26f3bf0a20': {
    address: '0x297ac6b26ad11691474e370a65cb4b26f3bf0a20',
    name: 'BeaconProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.01% gas
  '0x2e581710e811e785b5e11f064aede3eec0bd5c70': {
    address: '0x2e581710e811e785b5e11f064aede3eec0bd5c70',
    name: 'ERC1967Proxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.01% gas
  '0x922b9ca8e2207bfb850b6ff647c054d4b58a2aa7': {
    address: '0x922b9ca8e2207bfb850b6ff647c054d4b58a2aa7',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.01% gas
  '0x936385b7aaaf73e089360c571f11e3d39561372f': {
    address: '0x936385b7aaaf73e089360c571f11e3d39561372f',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.01% gas
  '0x21e539a5b00b4d0ab4a603889f01fd4a431af103': {
    address: '0x21e539a5b00b4d0ab4a603889f01fd4a431af103',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.01% gas
  '0x154f97554eaa9ecca7b75fc3daca021613f9ac95': {
    address: '0x154f97554eaa9ecca7b75fc3daca021613f9ac95',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.01% gas
  '0x663dc15d3c1ac63ff12e45ab68fea3f0a883c251': {
    address: '0x663dc15d3c1ac63ff12e45ab68fea3f0a883c251',
    name: 'TransparentUpgradeableProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.01% gas
  '0xeffb809d99142ce3b51c1796c096f5b01b4aaec4': {
    address: '0xeffb809d99142ce3b51c1796c096f5b01b4aaec4',
    name: 'UUPSProxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },
  // REVIEW: proxy — 0.01% gas
  '0x829a0c4654cdbf899e35762e1fe9ab5aa80c5999': {
    address: '0x829a0c4654cdbf899e35762e1fe9ab5aa80c5999',
    name: 'ERC1967Proxy',
    protocol: 'Infrastructure',
    category: 'infrastructure',
    type: 'controller',
  },

  // ============ CLASSIFIED — Round 8 ============

  // --- Club HashCash: simulated mining game with MINER NFTs + hCASH tokens ---
  '0x105fecae0c48d683da63620de1f2d1582de9e98a': {
    address: '0x105fecae0c48d683da63620de1f2d1582de9e98a',
    name: 'Main',
    protocol: 'Club HashCash',
    category: 'gaming',
    type: 'other',
  },

  // --- GMX: ConfigSyncer — risk oracle config updates for GMX V2 markets ---
  '0xfe6bdb87e59484db1494a467cdba7c051fb2a604': {
    address: '0xfe6bdb87e59484db1494a467cdba7c051fb2a604',
    name: 'ConfigSyncer',
    protocol: 'GMX',
    category: 'derivatives',
    type: 'other',
  },

  // --- Arena: SocialFi bonding-curve token launchpad ---
  '0x03f1a18519abedbef210fa44e13b71fec01b8dfa': {
    address: '0x03f1a18519abedbef210fa44e13b71fec01b8dfa',
    name: 'AvaxHelper',
    protocol: 'Arena',
    category: 'token',
    type: 'other',
  },
  '0x12d0d71342071effb0e77a408f23ed985026ad94': {
    address: '0x12d0d71342071effb0e77a408f23ed985026ad94',
    name: 'ArenaMultiSend',
    protocol: 'Arena',
    category: 'token',
    type: 'other',
  },

  // --- BetSwirl: decentralized casino — Dice game using Chainlink VRF ---
  '0xaa4d2931a9fe14c3dec8ac3f12923cbb535c0e5f': {
    address: '0xaa4d2931a9fe14c3dec8ac3f12923cbb535c0e5f',
    name: 'Dice',
    protocol: 'BetSwirl',
    category: 'gaming',
    type: 'other',
  },

  // --- Socket: cross-chain infrastructure — intent solver ---
  '0xae68b7117be0026cbd4366303f74eecbb19e4042': {
    address: '0xae68b7117be0026cbd4366303f74eecbb19e4042',
    name: 'Solver',
    protocol: 'Socket',
    category: 'bridge',
    type: 'other',
  },

  // --- MoveQuest: card-based staking game with MQT tokens ---
  '0x7eb212519818c7deb8c8da4423bcec3370b7e83d': {
    address: '0x7eb212519818c7deb8c8da4423bcec3370b7e83d',
    name: 'WalletLockAction',
    protocol: 'MoveQuest',
    category: 'gaming',
    type: 'other',
  },
  '0x8719309bdb1df086948a5ca52982fbcb4184056e': {
    address: '0x8719309bdb1df086948a5ca52982fbcb4184056e',
    name: 'GoldenHatchery',
    protocol: 'MoveQuest',
    category: 'gaming',
    type: 'staking',
  },
  '0xa75d3edbc3ac10ebc6ad965e6e8a42a118f100d7': {
    address: '0xa75d3edbc3ac10ebc6ad965e6e8a42a118f100d7',
    name: 'Incubator',
    protocol: 'MoveQuest',
    category: 'gaming',
    type: 'staking',
  },

  // --- Orange Web3: ORNG governance token for Orange L1 ---
  '0x6c14c1898c843ff66ca51e87244690bbc28df215': {
    address: '0x6c14c1898c843ff66ca51e87244690bbc28df215',
    name: 'Orange',
    protocol: 'Orange Web3',
    category: 'token',
    type: 'token',
  },

  // --- Folks Finance: cross-chain lending hub-and-spoke ---
  '0xc03094c4690f3844ea17ef5272bf6376e0cf2ac6': {
    address: '0xc03094c4690f3844ea17ef5272bf6376e0cf2ac6',
    name: 'SpokeCommon',
    protocol: 'Folks Finance',
    category: 'lending',
    type: 'other',
  },

  // --- Yield Yak: Milk Vaults via Veda/BoringVault framework ---
  '0x665be7a6a226c6bb35e3ce243d2d1b3593d08abd': {
    address: '0x665be7a6a226c6bb35e3ce243d2d1b3593d08abd',
    name: 'BarebonesManagerWithMerkleVerification',
    protocol: 'Yield Yak',
    category: 'yield',
    type: 'vault',
  },

  // --- SushiSwap: RedSnwapper swap routing helper ---
  '0xac4c6e212a361c968f1725b4d055b47e63f80b75': {
    address: '0xac4c6e212a361c968f1725b4d055b47e63f80b75',
    name: 'RedSnwapper',
    protocol: 'SushiSwap',
    category: 'dex',
    type: 'other',
  },

  // --- Low confidence — kept but marked ---
  // DexFiKeeper: unverified keeper bot, single caller
  '0x6228947dab1ec28a3106600abaa223cfd01a6f9c': {
    address: '0x6228947dab1ec28a3106600abaa223cfd01a6f9c',
    name: 'DexFiKeeper',
    protocol: 'DexFi',
    category: 'infrastructure',
    type: 'other',
  },
  // MindFlow: multi-level referral investment scheme on USDt
  '0x05c4d94aee184498b24335e9913b9d01d08df89a': {
    address: '0x05c4d94aee184498b24335e9913b9d01d08df89a',
    name: 'MindFlow',
    protocol: 'MindFlow',
    category: 'other',
    type: 'other',
  },
  // MetaWallet: unverified multi-chain contract, holds ~$2.5M
  '0x233c5370ccfb3cd7409d9a3fb98ab94de94cb4cd': {
    address: '0x233c5370ccfb3cd7409d9a3fb98ab94de94cb4cd',
    name: 'MetaWallet',
    protocol: 'MetaWallet',
    category: 'infrastructure',
    type: 'other',
  },

  // ============ ROUND 9 — ClickHouse top-burner discovery (30d window) ============

  // --- Pharaoh: Universal Router (new address not in registry) ---
  '0x5acc35397d2ce81ac54a4b1c6d9e1fb29f8ec6c6': {
    address: '0x5acc35397d2ce81ac54a4b1c6d9e1fb29f8ec6c6',
    name: 'Universal Router',
    protocol: 'Pharaoh',
    category: 'dex',
    type: 'router',
  },

  // --- POPA (Proof of Physical Address) — on-chain attestation infra ---
  '0x7caf521af2969d8cab7b399b68dd7e7c037fc3ff': {
    address: '0x7caf521af2969d8cab7b399b68dd7e7c037fc3ff',
    name: 'Submissions',
    protocol: 'POPA',
    category: 'infrastructure',
    type: 'other',
  },
  '0x191adfd519058bf928c925851ab55df7d4d3eab6': {
    address: '0x191adfd519058bf928c925851ab55df7d4d3eab6',
    name: 'Mining',
    protocol: 'POPA',
    category: 'infrastructure',
    type: 'other',
  },

  // --- Chainlink: additional AuthorizedForwarder instances ---
  '0xe2dc74af81f6d8886607a99bcbb463a842519702': {
    address: '0xe2dc74af81f6d8886607a99bcbb463a842519702',
    name: 'AuthorizedForwarder #2',
    protocol: 'Chainlink',
    category: 'infrastructure',
    type: 'other',
  },
  '0x4d33b831a584cb260002f43baf16d130181fb14f': {
    address: '0x4d33b831a584cb260002f43baf16d130181fb14f',
    name: 'AuthorizedForwarder #3',
    protocol: 'Chainlink',
    category: 'infrastructure',
    type: 'other',
  },

  // --- Arena: PumpSpecialRouter + additional contract ---
  '0x4ec53317186098956956ae9a7092853e218390e2': {
    address: '0x4ec53317186098956956ae9a7092853e218390e2',
    name: 'PumpSpecialRouter',
    protocol: 'Arena',
    category: 'dex',
    type: 'router',
  },
  '0xa3a50041beb7ce541fe11c6f0a438b522302e500': {
    address: '0xa3a50041beb7ce541fe11c6f0a438b522302e500',
    name: 'Arena Contract',
    protocol: 'Arena',
    category: 'token',
    type: 'other',
  },

  // --- Uniswap V4 Hooks (pool-specific hook contracts) ---
  '0x7773721134c27a33a2c30e02e6b0130900000000': {
    address: '0x7773721134c27a33a2c30e02e6b0130900000000',
    name: 'Uniswap V4 Hook #A',
    protocol: 'Uniswap',
    category: 'dex',
    type: 'pool',
  },
  '0x777e0fc6d730cc42b853dc66e9fa1d8700000000': {
    address: '0x777e0fc6d730cc42b853dc66e9fa1d8700000000',
    name: 'Uniswap V4 Hook #B',
    protocol: 'Uniswap',
    category: 'dex',
    type: 'pool',
  },

  // --- Cross-chain bridge proxy ---
  '0x04ce218ead72401702dd5f3e56cedb7d2d477777': {
    address: '0x04ce218ead72401702dd5f3e56cedb7d2d477777',
    name: 'Bridge Proxy',
    protocol: 'Cross-Chain Bridge',
    category: 'bridge',
    type: 'other',
  },

  // --- MEV Bots (Round 9) ---
  '0x8031f70dace67b3c3be210e1b1e3bcf43bc69c5b': {
    address: '0x8031f70dace67b3c3be210e1b1e3bcf43bc69c5b',
    name: 'MEV Bot (high-volume arb)',
    protocol: 'MEV Bot (high-volume arb)',
    category: 'mev',
    type: 'other',
  },
  '0x6da68bcc6174a889aa7b75740b89536fa5d92dff': {
    address: '0x6da68bcc6174a889aa7b75740b89536fa5d92dff',
    name: 'MEV Bot (multi-DEX arb #2)',
    protocol: 'MEV Bot (multi-DEX arb #2)',
    category: 'mev',
    type: 'other',
  },
  '0xe494bca453ff53ade5c135127a40658e59e45b3f': {
    address: '0xe494bca453ff53ade5c135127a40658e59e45b3f',
    name: 'MEV Bot (sandwich)',
    protocol: 'MEV Bot (sandwich)',
    category: 'mev',
    type: 'other',
  },
  '0xe61f4b0c2f09ae0c6e65b49e0c1e695d96197283': {
    address: '0xe61f4b0c2f09ae0c6e65b49e0c1e695d96197283',
    name: 'MEV Bot (backrunner)',
    protocol: 'MEV Bot (backrunner)',
    category: 'mev',
    type: 'other',
  },
  '0x2743ea9beb0f4b8d721cd0faa44f8e46e1e9a81a': {
    address: '0x2743ea9beb0f4b8d721cd0faa44f8e46e1e9a81a',
    name: 'MEV Bot (JIT liquidity)',
    protocol: 'MEV Bot (JIT liquidity) (0x2743ea)',
    category: 'mev',
    type: 'other',
  },

  // ============ ROUND 10 — ClickHouse top-burner discovery (30d window, 2026-03-23) ============

  // --- MEV / Arbitrage Bots ---
  '0x80318c852ee7fbde52ce439dec3ae022ba39a536': {
    address: '0x80318c852ee7fbde52ce439dec3ae022ba39a536',
    name: 'MEV Bot (Pool Arbitrage)',
    protocol: 'MEV Bot (Pool Arbitrage)',
    category: 'mev',
    type: 'other',
  },
  '0x6da6cb5fdb93812e7df84148a409904c41e3e737': {
    address: '0x6da6cb5fdb93812e7df84148a409904c41e3e737',
    name: 'MEV Bot (DEX Arbitrage)',
    protocol: 'MEV Bot (DEX Arbitrage)',
    category: 'mev',
    type: 'other',
  },
  '0x70556849f4cfa8c8f0de36faa4b301223df40536': {
    address: '0x70556849f4cfa8c8f0de36faa4b301223df40536',
    name: 'Yield Strategy Bot (Multi-Protocol)',
    protocol: 'Yield Strategy Bot (Multi-Protocol)',
    category: 'mev',
    type: 'other',
  },
  '0xe6e428a32428748f08e7ed5a955ec62c805c2ed2': {
    address: '0xe6e428a32428748f08e7ed5a955ec62c805c2ed2',
    name: 'Market Making Bot (LFJ)',
    protocol: 'Market Making Bot (LFJ)',
    category: 'mev',
    type: 'other',
  },
  '0xaab5727377fd14b7aef03528d952891861594ff5': {
    address: '0xaab5727377fd14b7aef03528d952891861594ff5',
    name: 'MEV Bot (Sandwich/Arb)',
    protocol: 'MEV Bot (Sandwich/Arb)',
    category: 'mev',
    type: 'other',
  },
  '0xe61f5e2f1cb759c21cfbebafbcec0ad1bb961d07': {
    address: '0xe61f5e2f1cb759c21cfbebafbcec0ad1bb961d07',
    name: 'MEV Bot (High-Frequency)',
    protocol: 'MEV Bot (High-Frequency)',
    category: 'mev',
    type: 'other',
  },
  '0xe44eea4c6c2085d590a4a6bea01cf83e87a37be5': {
    address: '0xe44eea4c6c2085d590a4a6bea01cf83e87a37be5',
    name: 'Yield Strategy Bot (Balancer)',
    protocol: 'Yield Strategy Bot (Balancer)',
    category: 'mev',
    type: 'other',
  },
  '0xe4947a833cbc708c753082283ffc14fdd4679252': {
    address: '0xe4947a833cbc708c753082283ffc14fdd4679252',
    name: 'MEV Bot (Whitelisted Arb)',
    protocol: 'MEV Bot (Whitelisted Arb)',
    category: 'mev',
    type: 'other',
  },

  // --- Executor Bot (Batch Operations) ---
  '0xa6b9572156147e1ee9f3ccd3d1ad0b8b0c3d064b': {
    address: '0xa6b9572156147e1ee9f3ccd3d1ad0b8b0c3d064b',
    name: 'Executor Bot (Airdrop/Batch)',
    protocol: 'Executor Bot (Airdrop/Batch)',
    category: 'mev',
    type: 'other',
  },

  // --- Unknown DEX Aggregator (routes through Uniswap V4 pools, 200 users) ---
  '0xa04bd7ff587ec08723584a1afe80ffeb4815b627': {
    address: '0xa04bd7ff587ec08723584a1afe80ffeb4815b627',
    name: 'Swap Router (Uniswap V4 Pools)',
    protocol: 'Unknown DEX Aggregator',
    category: 'dex',
    type: 'router',
  },

  // --- Uniswap V4 Core (singleton Pool Manager) ---
  '0x06380c0e0912312b5150364b9dc4542ba0dbbc85': {
    address: '0x06380c0e0912312b5150364b9dc4542ba0dbbc85',
    name: 'Pool Manager V4',
    protocol: 'Uniswap',
    category: 'dex',
    type: 'controller',
  },
};

// Protocol slug mapping for linking to dApp pages (canonical slug per protocol)
export const PROTOCOL_SLUGS: Record<string, string> = {
  'Trader Joe': 'trader-joe',
  'Pangolin': 'pangolin',
  'GMX': 'gmx',
  'Benqi': 'benqi',
  'Folks Finance': 'folks-finance',
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
  'MEV: 0x9f8c': 'mev-0x9f8c',
  'MEV: 0x977a': 'mev-0x977a',
  'MEV: FEEEED': 'mev-feeeed',
  'MEV: 0x2222': 'mev-0x2222',
  'MEV: 0xf69e': 'mev-0xf69e',
  'MEV: Safe': 'mev-safe',
  'MEV: Coinbase': 'mev-coinbase',
  'MEV: 0xa34e': 'mev-0xa34e',
  'MEV: 0x1d67': 'mev-0x1d67',
  // Gaming / Other
  'Big Ads': 'big-ads',
  'Red Cast': 'red-cast',
  'Banza': 'banza',
  'Club HashCash': 'club-hashcash',
  'BetSwirl': 'betswirl',
  // SocialFi / Token
  'Arena': 'arena',
  'Orange Web3': 'orange-web3',
  'MindFlow': 'mindflow',
  // Cross-chain
  'Socket': 'socket',
  // Low-confidence
  'DexFi': 'dexfi',
  'MetaWallet': 'metawallet',
  // DEX Aggregators
  'Fly.trade': 'fly-trade',
  'DODO': 'dodo',
  '0x Protocol': '0x-protocol',
  'DexRouter': 'dexrouter',
  // Infrastructure
  'Chaos Labs': 'chaos-labs',
  'Chainlink': 'chainlink',
  // Gaming
  'AvaxPixel': 'avaxpixel',
  // RWA
  'Valinor OatFi': 'valinor-oatfi',
  // DEX (Round 5)
  'OKX DEX': 'okx-dex',
  'AquaSpace': 'aquaspace',
  // Bridge
  'Relay': 'relay',
  // Infrastructure
  'Rain': 'rain',
  'MetaMask Swaps': 'metamask-swaps',
  // Gaming
  'Sealfi': 'sealfi',
  // NFT
  'FestivalGreetings': 'festivalgreetings',
  // Round 6
  'Tresr': 'tresr',
  'Uniswap': 'uniswap',
  'CoW Protocol': 'cow-protocol',
  'Pyth': 'pyth',
  'Mayan Finance': 'mayan-finance',
  // Round 7
  'Silo Finance': 'silo-finance',
  'Rango': 'rango',
  // Round 9
  'POPA': 'popa',
  'Cross-Chain Bridge': 'cross-chain-bridge',
};

// Map alternative DefiLlama slugs to canonical protocol names
// This allows multiple DefiLlama entries to share the same on-chain data
export const SLUG_ALIASES: Record<string, string> = {
  // Benqi variations
  'benqi-lending': 'Benqi',
  'benqi-staked-avax': 'Benqi',
  'benqi': 'Benqi',
  'folks-finance': 'Folks Finance',
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
  'mev-0x9f8c': 'MEV: 0x9f8c',
  'mev-0x977a': 'MEV: 0x977a',
  'mev-feeeed': 'MEV: FEEEED',
  'mev-0x2222': 'MEV: 0x2222',
  'mev-0xf69e': 'MEV: 0xf69e',
  'mev-safe': 'MEV: Safe',
  'mev-coinbase': 'MEV: Coinbase',
  'mev-0xa34e': 'MEV: 0xa34e',
  'mev-0x1d67': 'MEV: 0x1d67',
  // Gaming / Other
  'big-ads': 'Big Ads',
  'red-cast': 'Red Cast',
  'banza': 'Banza',
  'club-hashcash': 'Club HashCash',
  'betswirl': 'BetSwirl',
  // SocialFi / Token
  'arena': 'Arena',
  'orange-web3': 'Orange Web3',
  'mindflow': 'MindFlow',
  // Cross-chain
  'socket': 'Socket',
  // Low-confidence
  'dexfi': 'DexFi',
  'metawallet': 'MetaWallet',
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
  // Gaming
  'avaxpixel': 'AvaxPixel',
  'apix': 'AvaxPixel',
  // RWA
  'valinor': 'Valinor OatFi',
  'oatfi': 'Valinor OatFi',
  'fence': 'Valinor OatFi',
  'valinor-oatfi': 'Valinor OatFi',
  // DEX (Round 5)
  'okx-dex': 'OKX DEX',
  'okx': 'OKX DEX',
  'aquaspace': 'AquaSpace',
  // Bridge
  'relay': 'Relay',
  'relay-bridge': 'Relay',
  // Infrastructure
  'rain': 'Rain',
  'rain-payments': 'Rain',
  'metamask-swaps': 'MetaMask Swaps',
  'metamask': 'MetaMask Swaps',
  // Gaming
  'sealfi': 'Sealfi',
  // NFT
  'festivalgreetings': 'FestivalGreetings',
  // Round 6
  'tresr': 'Tresr',
  'nftreasure': 'Tresr',
  'uniswap': 'Uniswap',
  'uniswap-v3': 'Uniswap',
  'cow-protocol': 'CoW Protocol',
  'cow-swap': 'CoW Protocol',
  'cowswap': 'CoW Protocol',
  'pyth': 'Pyth',
  'pyth-network': 'Pyth',
  'mayan-finance': 'Mayan Finance',
  'mayan': 'Mayan Finance',
  // Round 7
  'silo-finance': 'Silo Finance',
  'silo': 'Silo Finance',
  'silo-v2': 'Silo Finance',
  'rango': 'Rango',
  'rango-exchange': 'Rango',
  // Round 9
  'popa': 'POPA',
  'proof-of-physical-address': 'POPA',
  'cross-chain-bridge': 'Cross-Chain Bridge',
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
