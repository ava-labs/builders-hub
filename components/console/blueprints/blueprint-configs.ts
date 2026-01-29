// Blueprint configurations based on avalanchego and subnet-evm
// Reference: https://github.com/ava-labs/avalanchego
// Default values from snowball/parameters.go and proposervm/vm.go

export const gamingConfig = {
  genesis: {
    data: {
      config: {
        chainId: 99999,
        feeConfig: {
          gasLimit: 20000000,
          targetBlockRate: 1,
          minBaseFee: 1000000000,
          targetGas: 10000000,
          baseFeeChangeDenominator: 48,
          minBlockGasCost: 0,
          maxBlockGasCost: 1000000,
          blockGasCostStep: 200000
        },
        warpConfig: {
          blockTimestamp: 0,
          quorumNumerator: 67
        }
      },
      alloc: {
        "0xYourAddress": { balance: "0x52B7D2DCC80CD2E4000000" }
      },
      gasLimit: "0x1312D00",
      timestamp: "0x0"
    },
    display: `{
  "config": {
    "chainId": 99999,
    "feeConfig": {
      "gasLimit": 20000000,                    ①
      "targetBlockRate": 1,                    ②
      "minBaseFee": 1000000000,                ③
      "targetGas": 10000000,
      "baseFeeChangeDenominator": 48,          ④
      "minBlockGasCost": 0,
      "maxBlockGasCost": 1000000,
      "blockGasCostStep": 200000
    },
    "warpConfig": {
      "blockTimestamp": 0,
      "quorumNumerator": 67
    }
  },
  "alloc": {
    "0xYourAddress": { "balance": "0x..." }
  },
  "gasLimit": "0x1312D00",
  "timestamp": "0x0"
}`,
    annotations: [
      { marker: 1, key: "gasLimit", highlight: "20M gas per block", description: "High capacity for many concurrent game actions per block." },
      { marker: 2, key: "targetBlockRate", highlight: "1 second blocks", description: "Fast block production for responsive gameplay. Default is 2s." },
      { marker: 3, key: "minBaseFee", highlight: "1 gwei (~$0.00001)", description: "Ultra-low fees let players spam thousands of actions affordably." },
      { marker: 4, key: "baseFeeChangeDenominator", highlight: "48 (stable fees)", description: "Higher than default (36) prevents fee spikes during intense gameplay." },
    ]
  },
  chainConfig: {
    data: {
      "snowman-api-enabled": false,
      "local-txs-enabled": true,
      "pruning-enabled": true,
      "state-sync-enabled": true,
      "tx-pool-account-slots": 64,
      "tx-pool-global-slots": 8192,
      "tx-pool-account-queue": 128,
      "tx-pool-global-queue": 4096
    },
    display: `{
  "snowman-api-enabled": false,
  "local-txs-enabled": true,
  "pruning-enabled": true,                   ①
  "state-sync-enabled": true,                ②
  "tx-pool-account-slots": 64,               ③
  "tx-pool-global-slots": 8192,
  "tx-pool-account-queue": 128,
  "tx-pool-global-queue": 4096
}`,
    annotations: [
      { marker: 1, key: "pruning-enabled", highlight: "State pruning on", description: "Gaming generates massive state. Pruning keeps storage manageable." },
      { marker: 2, key: "state-sync-enabled", highlight: "Fast sync", description: "New validators can quickly sync without processing all historical blocks." },
      { marker: 3, key: "tx-pool-*", highlight: "Large mempool", description: "High pool limits handle traffic spikes during peak gameplay." },
    ]
  },
  integrations: [
    { category: "Randomness", emoji: "🎲", categoryColor: "bg-purple-500/20", title: "Chainlink VRF", description: "Provably fair random numbers for loot drops, card draws, and battle outcomes.", href: "/integrations/chainlink-vrf" },
    { category: "Randomness", emoji: "🎰", categoryColor: "bg-purple-500/20", title: "Supra dVRF", description: "Fast, decentralized VRF with native L1 support for high-frequency events.", href: "/integrations/supra-vrf" },
    { category: "Indexing", emoji: "📊", categoryColor: "bg-green-500/20", title: "Envio", description: "Real-time indexing for leaderboards, player stats, and match history.", href: "/integrations/envio" },
    { category: "Indexing", emoji: "🔍", categoryColor: "bg-green-500/20", title: "The Graph", description: "Decentralized indexing with GraphQL for complex game state queries.", href: "/integrations/the-graph" },
    { category: "Account Abstraction", emoji: "👛", categoryColor: "bg-blue-500/20", title: "Particle Network", description: "Social logins, session keys, and gasless transactions for frictionless onboarding.", href: "/integrations/particle-network" },
    { category: "Infrastructure", emoji: "⚡", categoryColor: "bg-orange-500/20", title: "Gelato", description: "Full L1 infrastructure with automation, relayers, and cross-chain messaging.", href: "/integrations/gelato" },
  ]
};

export const rwaConfig = {
  genesis: {
    data: {
      config: {
        chainId: 99998,
        feeConfig: {
          gasLimit: 15000000,
          targetBlockRate: 2,
          minBaseFee: 25000000000,
          targetGas: 15000000,
          baseFeeChangeDenominator: 36,
          minBlockGasCost: 0,
          maxBlockGasCost: 1000000,
          blockGasCostStep: 200000
        },
        txAllowListConfig: {
          adminAddresses: ["0xAdminAddress"],
          enabledAddresses: [],
          blockTimestamp: 0
        },
        contractDeployerAllowListConfig: {
          adminAddresses: ["0xAdminAddress"],
          enabledAddresses: [],
          blockTimestamp: 0
        },
        warpConfig: {
          blockTimestamp: 0,
          quorumNumerator: 67
        }
      },
      alloc: {
        "0xAdminAddress": { balance: "0x52B7D2DCC80CD2E4000000" }
      },
      gasLimit: "0xE4E1C0",
      timestamp: "0x0"
    },
    display: `{
  "config": {
    "chainId": 99998,
    "feeConfig": {
      "gasLimit": 15000000,
      "targetBlockRate": 2,
      "minBaseFee": 25000000000,
      "targetGas": 15000000,
      "baseFeeChangeDenominator": 36,
      "minBlockGasCost": 0,
      "maxBlockGasCost": 1000000,
      "blockGasCostStep": 200000
    },
    "txAllowListConfig": {                     ①
      "adminAddresses": ["0xAdmin..."],
      "enabledAddresses": [],
      "blockTimestamp": 0
    },
    "contractDeployerAllowListConfig": {       ②
      "adminAddresses": ["0xAdmin..."],
      "enabledAddresses": [],
      "blockTimestamp": 0
    },
    "warpConfig": {
      "blockTimestamp": 0,
      "quorumNumerator": 67                    ③
    }
  },
  "alloc": { ... },
  "timestamp": "0x0"
}`,
    annotations: [
      { marker: 1, key: "txAllowListConfig", highlight: "Transaction allowlist", description: "Only KYC-verified addresses can send transactions. Add users via admin." },
      { marker: 2, key: "contractDeployerAllowListConfig", highlight: "Deployer allowlist", description: "Only approved entities can deploy contracts. Prevents unauthorized tokens." },
      { marker: 3, key: "quorumNumerator", highlight: "67% quorum", description: "Institutional validators must reach 67% agreement for finality." },
    ]
  },
  chainConfig: {
    data: {
      "snowman-api-enabled": false,
      "local-txs-enabled": false,
      "pruning-enabled": false,
      "state-sync-enabled": true,
      "allow-unfinalized-queries": false,
      "log-level": "info"
    },
    display: `{
  "snowman-api-enabled": false,
  "local-txs-enabled": false,                ①
  "pruning-enabled": false,                  ②
  "state-sync-enabled": true,
  "allow-unfinalized-queries": false,        ③
  "log-level": "info"
}`,
    annotations: [
      { marker: 1, key: "local-txs-enabled", highlight: "No local bypass", description: "All transactions must go through the allowlist—no validator shortcuts." },
      { marker: 2, key: "pruning-enabled", highlight: "Full archive", description: "Disabled for audit compliance. Retain complete transaction history." },
      { marker: 3, key: "allow-unfinalized-queries", highlight: "Finalized only", description: "APIs only return finalized data—no speculative state for compliance." },
    ]
  },
  integrations: [
    { category: "KYC/Identity", emoji: "🪪", categoryColor: "bg-blue-500/20", title: "Jumio", description: "Enterprise KYC/AML verification for onboarding institutional users.", href: "/integrations/jumio" },
    { category: "KYC/Identity", emoji: "✅", categoryColor: "bg-blue-500/20", title: "Sumsub", description: "Comprehensive identity verification with global regulatory compliance.", href: "/integrations/sumsub" },
    { category: "Custody", emoji: "🔐", categoryColor: "bg-yellow-500/20", title: "Fireblocks", description: "Institutional-grade custody with MPC wallets and policy engine.", href: "/integrations/fireblocks" },
    { category: "Custody", emoji: "🏦", categoryColor: "bg-yellow-500/20", title: "BitGo", description: "Multi-signature custody and wallet infrastructure for institutions.", href: "/integrations/bitgo" },
    { category: "Compliance", emoji: "📋", categoryColor: "bg-green-500/20", title: "Chainalysis", description: "Transaction monitoring and compliance screening for AML requirements.", href: "/integrations/chainalysis" },
    { category: "Oracles", emoji: "📈", categoryColor: "bg-purple-500/20", title: "Chainlink Data Feeds", description: "Reliable price feeds for asset valuations and NAV calculations.", href: "/integrations/chainlink-data-feeds" },
  ]
};

export const defiConfig = {
  genesis: {
    data: {
      config: {
        chainId: 99997,
        feeConfig: {
          gasLimit: 30000000,
          targetBlockRate: 1,
          minBaseFee: 10000000000,
          targetGas: 15000000,
          baseFeeChangeDenominator: 36,
          minBlockGasCost: 0,
          maxBlockGasCost: 10000000,
          blockGasCostStep: 500000
        },
        warpConfig: {
          blockTimestamp: 0,
          quorumNumerator: 67
        }
      },
      alloc: {
        "0xYourAddress": { balance: "0x52B7D2DCC80CD2E4000000" }
      },
      gasLimit: "0x1C9C380",
      timestamp: "0x0"
    },
    display: `{
  "config": {
    "chainId": 99997,
    "feeConfig": {
      "gasLimit": 30000000,                    ①
      "targetBlockRate": 1,                    ②
      "minBaseFee": 10000000000,               ③
      "targetGas": 15000000,
      "baseFeeChangeDenominator": 36,
      "minBlockGasCost": 0,
      "maxBlockGasCost": 10000000,             ④
      "blockGasCostStep": 500000
    },
    "warpConfig": {
      "blockTimestamp": 0,
      "quorumNumerator": 67
    }
  },
  "alloc": { ... },
  "timestamp": "0x0"
}`,
    annotations: [
      { marker: 1, key: "gasLimit", highlight: "30M gas per block", description: "High limit for complex DeFi operations: multi-hop swaps, flash loans, liquidations." },
      { marker: 2, key: "targetBlockRate", highlight: "1 second blocks", description: "Fast blocks reduce MEV opportunities and improve trading UX." },
      { marker: 3, key: "minBaseFee", highlight: "10 gwei floor", description: "Moderate fee floor prevents spam while keeping swaps affordable." },
      { marker: 4, key: "maxBlockGasCost", highlight: "10M max block cost", description: "Higher ceiling allows fee surge during high-demand periods (liquidations)." },
    ]
  },
  chainConfig: {
    data: {
      "snowman-api-enabled": false,
      "local-txs-enabled": true,
      "pruning-enabled": true,
      "state-sync-enabled": true,
      "tx-pool-price-bump": 10,
      "tx-pool-account-slots": 32,
      "tx-pool-global-slots": 8192,
      "tx-pool-account-queue": 64,
      "tx-pool-global-queue": 2048
    },
    display: `{
  "snowman-api-enabled": false,
  "local-txs-enabled": true,
  "pruning-enabled": true,
  "state-sync-enabled": true,
  "tx-pool-price-bump": 10,                  ①
  "tx-pool-account-slots": 32,
  "tx-pool-global-slots": 8192,              ②
  "tx-pool-account-queue": 64,
  "tx-pool-global-queue": 2048
}`,
    annotations: [
      { marker: 1, key: "tx-pool-price-bump", highlight: "10% replacement", description: "Lower than default (25%) allows easier transaction replacement for traders." },
      { marker: 2, key: "tx-pool-global-slots", highlight: "Large mempool", description: "High capacity handles DeFi traffic spikes during market volatility." },
    ]
  },
  integrations: [
    { category: "Oracles", emoji: "📈", categoryColor: "bg-purple-500/20", title: "Chainlink Data Feeds", description: "Industry-standard price feeds for DeFi protocols and liquidations.", href: "/integrations/chainlink-data-feeds" },
    { category: "Oracles", emoji: "🔮", categoryColor: "bg-purple-500/20", title: "Pyth Network", description: "High-frequency price updates for trading applications.", href: "/integrations/pyth" },
    { category: "Indexing", emoji: "📊", categoryColor: "bg-green-500/20", title: "The Graph", description: "Index swap events, liquidity changes, and user positions.", href: "/integrations/the-graph" },
    { category: "Indexing", emoji: "⚡", categoryColor: "bg-green-500/20", title: "Envio", description: "Real-time indexing with native L1 support for DeFi dashboards.", href: "/integrations/envio" },
    { category: "Bridges", emoji: "🌉", categoryColor: "bg-blue-500/20", title: "LayerZero", description: "Cross-chain messaging for multi-chain DeFi composability.", href: "/integrations/layerzero" },
    { category: "Security", emoji: "🛡️", categoryColor: "bg-red-500/20", title: "OpenZeppelin", description: "Audited smart contract libraries and security tools.", href: "/integrations/openzeppelin" },
  ]
};
