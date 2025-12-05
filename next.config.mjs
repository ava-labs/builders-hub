import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  serverExternalPackages: [
    'ts-morph',
    'typescript',
    'twoslash',
    'shiki',
  ],
  // Include tsconfig.json in serverless function bundles for twoslash
  outputFileTracingIncludes: {
    '/*': ['./tsconfig.json'],
  },
  env: {
    APIKEY: process.env.APIKEY,
  },
  transpilePackages: ["next-mdx-remote"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'abs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net',
      },
      {
        protocol: 'https',
        hostname: 'f005.backblazeb2.com',
      },
      {
        protocol: 'https',
        hostname: 'explorer-binaryholdings.cogitus.io',
      },
      {
        protocol: 'https',
        hostname: 'cdn.prod.website-files.com',
      },
      {
        protocol: 'https',
        hostname: 'developers.avacloud.io',
      },
      {
        protocol: 'https',
        hostname: 'dashboard-assets.dappradar.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/docs/dapps/smart-contract-dev/get-test-funds',
        destination: '/console/primary-network/faucet',
        permanent: true,
      },
      {
        source: '/integrations/trader-joe',
        destination: '/integrations/lfj',
        permanent: true,
      },
      {
        source: '/docs/dapps/end-to-end/launch-ethereum-dapp',
        destination: '/academy/blockchain/solidity-foundry',
        permanent: true,
      },
      {
        source: '/docs/dapps/toolchains/foundry',
        destination: '/academy/blockchain/solidity-foundry/03-smart-contracts/03-foundry-quickstart',
        permanent: true,
      },
      {
        source: '/docs/nodes/validate/how-to-stake',
        destination: '/docs/primary-network/validate/how-to-stake',
        permanent: true,
      },
      {
        source: '/docs/nodes/validate/validate-vs-delegate',
        destination: '/docs/primary-network/validate/validate-vs-delegate',
        permanent: true,
      },
      {
        source: '/docs/avalanche-l1s/evm-configuration/tokenomics',
        destination: '/docs/avalanche-l1s/precompiles/native-minter',
        permanent: true,
      },
      {
        source: '/docs/api-reference/guides/issuing-api-calls',
        destination: '/docs/rpcs/other/guides/issuing-api-calls',
        permanent: true,
      },
      {
        source: '/docs/api-reference/guides/txn-fees',
        destination: '/docs/rpcs/other/guides/txn-fees',
        permanent: true,
      },
      {
        source: '/docs/avalanche-l1s/evm-configuration/permissions',
        destination: '/docs/avalanche-l1s/precompiles/allowlist-interface',
        permanent: true,
      },
      {
        source: '/docs/avalanche-l1s/evm-configuration/allowlist',
        destination: '/docs/avalanche-l1s/precompiles/allowlist-interface',
        permanent: true,
      },
      {
        source: '/docs/avalanche-l1s/evm-configuration',
        destination: '/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1',
        permanent: true,
      },
      {
        source: '/docs/subnets/overview',
        destination: '/docs/avalanche-l1s',
        permanent: true,
      },
      {
        source: '/docs/subnets/subnet-evm',
        destination: '/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1',
        permanent: true,
      },
      {
        source: '/docs/subnets/create-a-subnet',
        destination: '/docs/tooling/avalanche-cli/create-avalanche-l1',
        permanent: true,
      },
      {
        source: '/docs/subnets/create/genesis',
        destination: '/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1',
        permanent: true,
      },
      {
        source: '/docs/subnets/security-considerations',
        destination: '/docs/avalanche-l1s',
        permanent: true,
      },
      {
        source: '/docs/api-reference/avalanche-sdk/interchain-sdk/getting-started',
        destination: '/docs/tooling/avalanche-sdk/interchain/getting-started',
        permanent: true,
      },
      {
        source: '/docs/avalanchego/tools/cli',
        destination: '/docs/tooling/avalanche-cli',
        permanent: true,
      },
      {
        source: '/docs/overview/tokenomics',
        destination: '/docs/primary-network/avax-token',
        permanent: true,
      },
      {
        source: '/docs/staking/overview',
        destination: '/docs/primary-network/validate/how-to-stake',
        permanent: true,
      },
      {
        source: '/docs/tooling/cross-chain/teleporter-local-network',
        destination: '/docs/tooling/avalanche-cli/cross-chain/teleporter-local-network',
        permanent: true,
      },
      {
        source: '/docs/tooling/cross-chain',
        destination: '/docs/tooling/avalanche-cli/cross-chain/teleporter-local-network',
        permanent: true,
      },
      {
        source: '/docs/tooling/create-avalanche-l1',
        destination: '/docs/tooling/avalanche-cli/create-avalanche-l1',
        permanent: true,
      },
      {
        source: '/docs/tooling/create-deploy-avalanche-l1s/deploy-with-custom-vm',
        destination: '/docs/tooling/avalanche-cli/create-deploy-avalanche-l1s/deploy-with-custom-vm',
        permanent: true,
      },
      {
        source: '/docs/tooling/create-deploy-avalanche-l1s/deploy-locally',
        destination: '/docs/tooling/avalanche-cli/create-deploy-avalanche-l1s/deploy-locally',
        permanent: true,
      },
      {
        source: '/docs/tooling/get-avalanche-cli',
        destination: '/docs/tooling/avalanche-cli/get-avalanche-cli',
        permanent: true,
      },
      {
        source: '/docs/tooling/avalanche-go-installer',
        destination: '/docs/nodes/run-a-node/using-install-script/installing-avalanche-go',
        permanent: true,
      },
      {
        source: '/docs/avalanche-l1s/upgrade/customize-avalanche-l1',
        destination: '/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1',
        permanent: true,
      },
      {
        source: '/docs/avalanche-l1s/upgrade/durango-upgrade',
        destination: '/docs/avalanche-l1s/upgrade/considerations',
        permanent: true,
      },
      {
        source: '/docs/nodes/validate/node-validator',
        destination: '/docs/primary-network/validate/node-validator',
        permanent: true,
      },
      {
        source: '/docs/nodes/on-third-party-services/microsoft-azure',
        destination: '/docs/nodes/run-a-node/on-third-party-services/microsoft-azure',
        permanent: true,
      },
      {
        source: '/docs/reference/avalanchego/p-chain/api',
        destination: '/docs/rpcs/p-chain',
        permanent: true,
      },
      {
        source: '/docs/reference/avalanchego/auth-api',
        destination: '/docs/rpcs/other',
        permanent: true,
      },
      {
        source: '/docs/apis/avalanchego/apis/issuing-api-calls',
        destination: '/docs/rpcs/other/guides/issuing-api-calls',
        permanent: true,
      },
      {
        source: '/docs/apis/avalanchego/apis/x-chain',
        destination: '/docs/rpcs/x-chain',
        permanent: true,
      },
      {
        source: '/docs/overview/getting-started/virtual-machines',
        destination: '/docs/primary-network/virtual-machines',
        permanent: true,
      },
      {
        source: '/docs/overview/getting-started/avax',
        destination: '/docs/primary-network/avax-token',
        permanent: true,
      },
      {
        source: '/docs/quickstart/cross-chain-transfers',
        destination: '/docs/cross-chain',
        permanent: true,
      },
      {
        source: '/docs/quickstart/validator/run-node/set-up-node',
        destination: '/docs/nodes/run-a-node/from-source',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/evm-customization/deploying-precompile',
        destination: '/docs/avalanche-l1s/precompiles/interacting-with-precompiles',
        permanent: true,
      },
      {
        source: '/academy/avalanche-l1/interchain-messaging/08-securing-cross-chain-communication/01-securing-cross-chain-communication',
        destination: '/academy/avalanche-l1/interchain-messaging',
        permanent: true,
      },
      {
        source: '/academy/avalanche-l1/multi-chain-architecture/04-independent-tokenomics/09-transaction-fees',
        destination: '/academy/avalanche-l1/l1-native-tokenomics/05-fee-config/02-transaction-fees',
        permanent: true,
      },
      {
        source: '/academy/avalanche-l1/multi-chain-architecture/03-avalanche-starter-kit/03-create-blockchain',
        destination: '/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1',
        permanent: true,
      },
      {
        source: '/academy/avalanche-l1/multi-chain-architecture/06-permissioning-users/05-activate-tx-allowlist',
        destination: '/academy/avalanche-l1/avalanche-fundamentals/08-permissioning-users/05-activate-tx-allowlist',
        permanent: true,
      },
      {
        source: '/academy/avalanche-l1/l1-native-tokenomics/01-tokens-fundamentals/10-wrapped-native-tokens',
        destination: '/academy/avalanche-l1/l1-native-tokenomics/01b-native-vs-erc20/09-wrapped-tokens',
        permanent: true,
      },
      {
        source: '/academy/avalanche-l1/avalanche-fundamentals/07-independent-tokenomics/09-transaction-fees',
        destination: '/academy/avalanche-l1/l1-native-tokenomics/05-fee-config/02-transaction-fees',
        permanent: true,
      },
      {
        source: '/docs/dapps/end-to-end/fuji-workflow',
        destination: '/academy/blockchain/solidity-foundry/04-hello-world-part-1/01-intro',
        permanent: true,
      },
      {
        source: '/console/primary-network',
        destination: '/console/primary-network/faucet',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines',
        destination: '/docs/primary-network/virtual-machines',
        permanent: true,
      },
      {
        source: '/docs/nodes/using-install-script/installing-avalanche-go',
        destination: '/docs/nodes/run-a-node/using-install-script/installing-avalanche-go',
        permanent: true,
      },
      {
        source: '/docs/tooling/maintain/troubleshooting',
        destination: '/docs/tooling/avalanche-cli/maintain/troubleshooting',
        permanent: true,
      },
      {
        source: '/docs/api-reference/avalanche-sdk/client-sdk/getting-started',
        destination: '/docs/tooling/avalanche-sdk/client/getting-started',
        permanent: true,
      },
      {
        source: '/docs/tooling/avalanche-postman/add-postman-collection',
        destination: '/docs/tooling/avalanche-postman',
        permanent: true,
      },
      {
        source: '/docs/avalanche-l1s/validator-manager/add-validator',
        destination: '/docs/tooling/avalanche-cli/maintain/add-validator-l1',
        permanent: true,
      },
      {
        source: '/docs/dapps/deploy-nft-collection/prep-nft-files',
        destination: '/academy/blockchain/nft-deployment/02-prepare-nft-files',
        permanent: true,
      },
      {
        source: '/docs/api-reference/p-chain/txn-format',
        destination: '/docs/rpcs/p-chain/txn-format',
        permanent: true,
      },
      {
        source: '/docs/api-reference/c-chain/txn-format',
        destination: '/docs/rpcs/c-chain/txn-format',
        permanent: true,
      },
      {
        source: '/docs/api-reference/x-chain/txn-format',
        destination: '/docs/rpcs/x-chain/txn-format',
        permanent: true,
      },
      {
        source: '/docs/api-reference/c-chain/api',
        destination: '/docs/rpcs/c-chain',
        permanent: true,
      },
      {
        source: '/docs/api-reference/p-chain/api',
        destination: '/docs/rpcs/p-chain',
        permanent: true,
      },
      {
        source: '/docs/api-reference/x-chain/api',
        destination: '/docs/rpcs/x-chain',
        permanent: true,
      },
      {
        source: '/docs/api-reference/info-api',
        destination: '/docs/rpcs/other/info-rpc',
        permanent: true,
      },
      {
        source: '/docs/api-reference/index-api',
        destination: '/docs/rpcs/other/index-rpc',
        permanent: true,
      },
      {
        source: '/docs/api-reference/health-api',
        destination: '/docs/rpcs/other/health-rpc',
        permanent: true,
      },
      {
        source: '/docs/api-reference/admin-api',
        destination: '/docs/rpcs/other',
        permanent: true,
      },
      {
        source: '/docs/api-reference/proposervm-api',
        destination: '/docs/rpcs/other/proposervm-rpc',
        permanent: true,
      },
      {
        source: '/docs/api-reference/subnet-evm-api',
        destination: '/docs/rpcs/subnet-evm',
        permanent: true,
      },
      {
        source: '/docs/rpcs',
        destination: '/docs/rpcs/c-chain',
        permanent: true,
      },
      {
        source: '/docs/tooling',
        destination: '/docs/tooling/avalanche-sdk',
        permanent: true,
      },
      {
        source: '/docs/api-reference',
        destination: '/docs/api-reference/data-api',
        permanent: true,
      },
      {
        source: '/introduction',
        destination: '/docs/api-reference/introduction',
        permanent: false,
      },
      {
        source: '/docs/tooling/rpc-providers',
        destination: '/integrations#rpc-providers',
        permanent: true,
      },
      {
        source: '/data-api/:path*',
        destination: '/docs/api-reference/data-api/:path*',
        permanent: false,
      },
      {
        source: '/webhooks-api/:path*',
        destination: '/docs/api-reference/webhooks-api/:path*',
        permanent: false,
      },
      {
        source: '/metrics-api/:path*',
        destination: '/docs/api-reference/metrics-api/:path*',
        permanent: false,
      },
      {
        source: '/rpc-api/:path*',
        destination: '/docs/api-reference/rpc-api/:path*',
        permanent: false,
      },
      {
        source: '/avalanche-sdk/:path*',
        destination: '/docs/api-reference/avalanche-sdk/:path*',
        permanent: false,
      },
      {
        source: '/changelog/:path*',
        destination: '/docs/api-reference/changelog/:path*',
        permanent: false,
      },
      {
        source: '/codebase-entrepreneur',
        destination: '/academy/entrepreneur',
        permanent: true,
      },
      {
        source: '/codebase-entrepreneur/:path*',
        destination: '/academy/entrepreneur/:path*',
        permanent: true,
      },
      {
        source: '/codebase-entrepreneur-academy',
        destination: '/academy',
        permanent: true,
      },
      {
        source: '/codebase-entrepreneur-academy/:path*',
        destination: '/academy/entrepreneur/:path*',
        permanent: true,
      },
      {
        source: '/hackathon',
        destination: '/hackathons/26bfce9b-4d44-4d40-8fbe-7903e76d48fa',
        permanent: true,
      },
      {
        source: '/tools/l1-launcher',
        destination: '/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1',
        permanent: true,
      },
      {
        source: '/tools/:path*',
        destination: '/console',
        permanent: true,
      },
      {
        source: '/guides',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/guides/:path*',
        destination: '/blog/:path*',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/index',
        destination: '/docs/avalanche-l1s/evm-configuration/evm-l1-customization#precompiles',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/deployerallowlist',
        destination: '/docs/avalanche-l1s/precompiles/deployer-allowlist',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/txallowlist',
        destination: '/docs/avalanche-l1s/precompiles/transaction-allowlist',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/contractnativeminter',
        destination: '/docs/avalanche-l1s/precompiles/native-minter',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/nativeminter',
        destination: '/docs/avalanche-l1s/precompiles/native-minter',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/feemanager',
        destination: '/docs/avalanche-l1s/precompiles/fee-manager',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/rewardmanager',
        destination: '/docs/avalanche-l1s/precompiles/reward-manager',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/warpmessenger',
        destination: '/docs/avalanche-l1s/evm-configuration/warpmessenger',
        permanent: true,
      },
      {
        source: '/docs/avalanche-l1s/default-precompiles/transaction-fees',
        destination: '/docs/avalanche-l1s/evm-configuration/transaction-fees',
        permanent: true,
      },
      {
        source: '/academy/interchain-messaging/10-running-a-relayer/01-running-a-relayer',
        destination: '/academy/avalanche-l1/interchain-messaging/10-running-a-relayer/01-relayer-introduction',
        permanent: true,
      },
      {
        source: '/academy/interchain-messaging/10-running-a-relayer/02-control-the-avalanche-cli-relayer',
        destination: '/academy/avalanche-l1/interchain-messaging/10-running-a-relayer/03-configure-and-run-the-relayer',
        permanent: true,
      }, {
        source: '/academy/interchain-messaging/10-running-a-relayer/03-install-relayer',
        destination: '/academy/avalanche-l1/interchain-messaging/10-running-a-relayer/03-configure-and-run-the-relayer',
        permanent: true,
      }, {
        source: '/academy/interchain-messaging/10-running-a-relayer/05-multichain-relayer-config',
        destination: '/academy/avalanche-l1/interchain-messaging/10-running-a-relayer/02-relayer-configuration#multichain-relayer-configuration',
        permanent: true,
      }, {
        source: '/academy/interchain-messaging/10-running-a-relayer/06-analyze-relayer-logs',
        destination: '/academy/avalanche-l1/interchain-messaging/10-running-a-relayer/03-configure-and-run-the-relayer',
        permanent: true,
      }, {
        source: '/academy/interchain-messaging/03-avalanche-starter-kit/03-create-blockchain',
        destination: '/academy/avalanche-l1/interchain-messaging/03-avalanche-starter-kit/04-networks',
        permanent: true,
      }, {
        source: '/academy/interchain-messaging/03-avalanche-starter-kit/06-pause-and-resume',
        destination: '/academy/avalanche-l1/interchain-messaging/03-avalanche-starter-kit/04-networks',
        permanent: true,
      }, {
        source: '/docs/subnets/customize-a-subnet',
        destination: '/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1',
        permanent: true,
      },       {
        source: '/docs/build/tutorials/platform/create-a-local-test-network',
        destination: '/academy/avalanche-l1/avalanche-fundamentals',
        permanent: true,
      }, {
        source: '/docs/tooling/guides/get-avalanche-cli',
        destination: '/docs/tooling/avalanche-cli/get-avalanche-cli',
        permanent: true,
      }, {
        source: '/evm-l1s/validator-manager/poa-vs-pos',
        destination: '/docs/avalanche-l1s/validator-manager/contract',
        permanent: true,
      }, {
        source: '/docs/avalanche-l1s/allowlist',
        destination: '/docs/avalanche-l1s/precompiles/allowlist-interface',
        permanent: true,
      }, {
        source: '/docs/virtual-machines/evm-customization/generating-your-precompile',
        destination: '/docs/avalanche-l1s/custom-precompiles/create-precompile',
        permanent: true,
      }, {
        source: '/docs/virtual-machines/evm-customization/defining-precompile#event-file',
        destination: '/docs/avalanche-l1s/custom-precompiles/defining-precompile#event-file',
        permanent: true,
      }, {
        source: '/docs/virtual-machines/evm-customization/testing-your-precompile',
        destination: '/docs/avalanche-l1s/custom-precompiles/executing-test-cases',
        permanent: true,
      }, {
        source: '/docs/nodes/run-a-node/manually#hardware-and-os-requirements',
        destination: '/docs/nodes/system-requirements#hardware-and-operating-systems',
        permanent: true,
      }, {
        source: "/build/cross-chain/awm/deep-dive",
        destination: "/docs/cross-chain/avalanche-warp-messaging/evm-integration#how-does-avalanche-warp-messaging-work",
        permanent: true,
      }, {
        source: "/docs/virtual-machines/custom-precompiles#minting-native-coins",
        destination: "/docs/avalanche-l1s/precompiles/native-minter",
        permanent: true,
      }, {
        source: "/docs/virtual-machines/evm-customization/introduction",
        destination: "/docs/avalanche-l1s/evm-configuration/evm-l1-customization",
        permanent: true,
      }, {
        source: "/docs/virtual-machines/evm-customization/background-requirements",
        destination: "/docs/avalanche-l1s/custom-precompiles/background-requirements",
        permanent: true,
      }, {
        source: "/docs/nodes/run-a-node/manually",
        destination: "/docs/nodes/run-a-node/from-source",
        permanent: true,
      }, {
        source: "/docs/tooling/avalanchego-postman-collection/setup",
        destination: "/docs/tooling/avalanche-postman",
        permanent: true,
      }, {
        source: "/docs/avalanche-l1s/deploy-a-avalanche-l1/fuji-testnet",
        destination: "/docs/tooling/create-deploy-avalanche-l1s/deploy-on-fuji-testnet",
        permanent: true,
      }, {
        source: "/academy/l1-validator-management",
        destination: "/academy/avalanche-l1/permissioned-l1s",
        permanent: true,
      },
      {
        source: "/academy/l1-validator-management/:path*",
        destination: "/academy/avalanche-l1/permissioned-l1s/:path*",
        permanent: true,
      },
      {
        source: "/academy/l1-tokenomics",
        destination: "/academy/avalanche-l1/l1-native-tokenomics",
        permanent: true,
      },
      {
        source: "/academy/l1-tokenomics/:path*",
        destination: "/academy/avalanche-l1/l1-native-tokenomics/:path*",
        permanent: true,
      },
      {
        source: "/console/permissioned-l1s/transactor-allowlist",
        destination: "/console/l1-access-restrictions/transactor-allowlist",
        permanent: true,
      },
      {
        source: "/console/permissioned-l1s/deployer-allowlist",
        destination: "/console/l1-access-restrictions/deployer-allowlist",
        permanent: true,
      },
      {
        source: "/docs/nodes/configure/chain-configs/p-chain",
        destination: "/docs/nodes/chain-configs/p-chain",
        permanent: true,
      },
      {
        source: "/docs/nodes/configure/chain-configs/x-chain",
        destination: "/docs/nodes/chain-configs/x-chain",
        permanent: true,
      },
      {
        source: "/docs/nodes/configure/chain-configs/c-chain",
        destination: "/docs/nodes/chain-configs/c-chain",
        permanent: true,
      },
      {
        source: "/docs/nodes/configure/chain-configs/subnet-evm",
        destination: "/docs/nodes/chain-configs/subnet-evm",
        permanent: true,
      },
      {
        source: "/academy/avalanche-fundamentals",
        destination: "/academy/avalanche-l1/avalanche-fundamentals",
        permanent: true,
      },
      {
        source: "/academy/avalanche-fundamentals/:path*",
        destination: "/academy/avalanche-l1/avalanche-fundamentals/:path*",
        permanent: true,
      },
      {
        source: "/academy/blockchain-fundamentals",
        destination: "/academy/blockchain/blockchain-fundamentals",
        permanent: true,
      },
      {
        source: "/academy/blockchain-fundamentals/:path*",
        destination: "/academy/blockchain/blockchain-fundamentals/:path*",
        permanent: true,
      },
      {
        source: "/academy/solidity-foundry",
        destination: "/academy/blockchain/solidity-foundry",
        permanent: true,
      },
      {
        source: "/academy/solidity-foundry/:path*",
        destination: "/academy/blockchain/solidity-foundry/:path*",
        permanent: true,
      },
      {
        source: "/academy/encrypted-erc",
        destination: "/academy/blockchain/encrypted-erc",
        permanent: true,
      },
      {
        source: "/academy/encrypted-erc/:path*",
        destination: "/academy/blockchain/encrypted-erc/:path*",
        permanent: true,
      },
      {
        source: "/academy/customizing-evm",
        destination: "/academy/avalanche-l1/customizing-evm",
        permanent: true,
      },
      {
        source: "/academy/customizing-evm/:path*",
        destination: "/academy/avalanche-l1/customizing-evm/:path*",
        permanent: true,
      },
      {
        source: "/academy/interchain-messaging",
        destination: "/academy/avalanche-l1/interchain-messaging",
        permanent: true,
      },
      {
        source: "/academy/interchain-messaging/:path*",
        destination: "/academy/avalanche-l1/interchain-messaging/:path*",
        permanent: true,
      },
      {
        source: "/academy/interchain-token-transfer",
        destination: "/academy/avalanche-l1/interchain-token-transfer",
        permanent: true,
      },
      {
        source: "/academy/interchain-token-transfer/:path*",
        destination: "/academy/avalanche-l1/interchain-token-transfer/:path*",
        permanent: true,
      },
      {
        source: "/academy/icm-chainlink",
        destination: "/academy/avalanche-l1/icm-chainlink",
        permanent: true,
      },
      {
        source: "/academy/icm-chainlink/:path*",
        destination: "/academy/avalanche-l1/icm-chainlink/:path*",
        permanent: true,
      },
      {
        source: "/academy/permissioned-l1s",
        destination: "/academy/avalanche-l1/permissioned-l1s",
        permanent: true,
      },
      {
        source: "/academy/permissioned-l1s/:path*",
        destination: "/academy/avalanche-l1/permissioned-l1s/:path*",
        permanent: true,
      },
      {
        source: "/academy/l1-native-tokenomics",
        destination: "/academy/avalanche-l1/l1-native-tokenomics",
        permanent: true,
      },
      {
        source: "/academy/l1-native-tokenomics/:path*",
        destination: "/academy/avalanche-l1/l1-native-tokenomics/:path*",
        permanent: true,
      },
      {
        source: "/academy/permissionless-l1s",
        destination: "/academy/avalanche-l1/permissionless-l1s",
        permanent: true,
      },
      {
        source: "/academy/permissionless-l1s/:path*",
        destination: "/academy/avalanche-l1/permissionless-l1s/:path*",
        permanent: true,
      },
      {
        source: "/academy/multi-chain-architecture",
        destination: "/academy/avalanche-l1/multi-chain-architecture",
        permanent: true,
      },
      {
        source: "/academy/multi-chain-architecture/:path*",
        destination: "/academy/avalanche-l1/multi-chain-architecture/:path*",
        permanent: true,
      },
      {
        source: "/academy/avacloudapis",
        destination: "/academy/avalanche-l1/avacloudapis",
        permanent: true,
      },
      {
        source: "/academy/avacloudapis/:path*",
        destination: "/academy/avalanche-l1/avacloudapis/:path*",
        permanent: true,
      },
      {
        source: "/docs/cross-chain/teleporter/teleporter-on-devnet",
        destination: "/docs/cross-chain/icm-contracts/icm-contracts-on-devnet",
        permanent: true,
      },
      {
        source: "/docs/cross-chain/teleporter/teleporter-on-local-network",
        destination: "/docs/cross-chain/icm-contracts/icm-contracts-on-local-network",
        permanent: true,
      },
      {
        source: "/docs/cross-chain/teleporter",
        destination: "/docs/cross-chain/icm-contracts",
        permanent: true,
      },
      {
        source: "/docs/cross-chain/teleporter/:path*",
        destination: "/docs/cross-chain/icm-contracts/:path*",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/interchain-token-transfer/03-tokens/:path*",
        destination: "/academy/avalanche-l1/l1-native-tokenomics/01-tokens-fundamentals/:path*",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/interchain-token-transfer/04-token-bridging/:path*",
        destination: "/academy/avalanche-l1/erc20-bridge/01-token-bridging/:path*",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/interchain-token-transfer/05-avalanche-interchain-token-transfer/:path*",
        destination: "/academy/avalanche-l1/erc20-bridge/02-avalanche-interchain-token-transfer/:path*",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/interchain-token-transfer/06-erc-20-to-erc-20-bridge/:path*",
        destination: "/academy/avalanche-l1/erc20-bridge/03-erc-20-to-erc-20-bridge/:path*",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/interchain-token-transfer/07-tokens-on-multiple-chains/:path*",
        destination: "/academy/avalanche-l1/erc20-bridge/04-tokens-on-multiple-chains/:path*",
        permanent: true,
      },
      {
        source: "/docs/dapps/smart-contract-dev/deploy-with-remix-ide",
        destination: "/docs/avalanche-l1s/add-utility/deploy-smart-contract",
        permanent: true,
      },
      {
        source: "/docs/dapps/:path*",
        destination: "/docs/primary-network",
        permanent: true,
      },
      {
        source: "/docs/dapps",
        destination: "/docs/primary-network",
        permanent: true,
      },
      {
        source: "/docs/quick-start/networks/fuji-testnet",
        destination: "/docs/primary-network#c-chain-contract-chain",
        permanent: true,
      },
      {
        source: "/docs/quick-start/validator-manager",
        destination: "/docs/avalanche-l1s/validator-manager/contract",
        permanent: true,
      },
      {
        source: "/docs/quick-start/avalanche-consensus",
        destination: "/docs/primary-network/avalanche-consensus",
        permanent: true,
      },
      {
        source: "/docs/quick-start/:path*",
        destination: "/docs/primary-network",
        permanent: true,
      },
      // AvalancheJS -> TypeScript SDK redirects
      {
        source: "/docs/apis/avalanchejs/:path*",
        destination: "/docs/tooling/avalanche-sdk",
        permanent: true,
      },
      {
        source: "/docs/avalanchejs/:path*",
        destination: "/docs/tooling/avalanche-sdk",
        permanent: true,
      },
      {
        source: "/docs/tooling/avalanchejs/:path*",
        destination: "/docs/tooling/avalanche-sdk",
        permanent: true,
      },
      // Community tutorials -> main docs
      {
        source: "/docs/community/:path*",
        destination: "/docs",
        permanent: true,
      },
      // Additional broken link redirects
      {
        source: "/docs/build/tutorials/nodes-and-staking/staking-avax-by-validating-or-delegating-with-the-avalanche-wallet",
        destination: "/docs/primary-network/validate/how-to-stake",
        permanent: true,
      },
      {
        source: "/docs/avalanche-l1s/validator-manager/poa-vs-pos",
        destination: "/docs/avalanche-l1s/validator-manager/contract",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/interchain-token-transfer/02-avalanche-starter-kit/:path*",
        destination: "/academy/avalanche-l1/interchain-messaging/03-avalanche-starter-kit/:path*",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/interchain-messaging/09-avalanche-warp-messaging/:path*",
        destination: "/academy/avalanche-l1/interchain-messaging/08-avalanche-warp-messaging/:path*",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/interchain-messaging/10-running-a-relayer/:path*",
        destination: "/academy/avalanche-l1/interchain-messaging/09-running-a-relayer/:path*",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/erc20-bridge/03-erc-20-to-erc-20-bridge/05-transfer-tokens",
        destination: "/academy/avalanche-l1/erc20-bridge/03-erc-20-to-erc-20-bridge/06-transfer-tokens",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/l1-native-tokenomics/01-tokens-fundamentals/03-transfer-native-tokens",
        destination: "/academy/avalanche-l1/l1-native-tokenomics/01-tokens-fundamentals/04-transfer-native-token",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/l1-native-tokenomics/06-distribution/:path*",
        destination: "/academy/avalanche-l1/l1-native-tokenomics/07-token-distribution/:path*",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/multi-chain-architecture/06-permissioning-users/:path*",
        destination: "/academy/avalanche-l1/avalanche-fundamentals/08-permissioning-users/:path*",
        permanent: true,
      },
      {
        source: "/docs/api-reference/standards/guides/:path*",
        destination: "/docs/rpcs/other/guides/:path*",
        permanent: true,
      },
      {
        source: "/docs/build/cross-chain/teleporter/:path*",
        destination: "/docs/cross-chain/icm-contracts/:path*",
        permanent: true,
      },
      {
        source: "/docs/build/subnet",
        destination: "/docs/avalanche-l1s",
        permanent: true,
      },
      {
        source: "/docs/cross-chain/interchain-messaging",
        destination: "/docs/cross-chain/icm-contracts",
        permanent: true,
      },
      {
        source: "/docs/nodes/build/set-up-an-avalanche-node-with-google-cloud-platform",
        destination: "/docs/nodes/run-a-node/on-third-party-services/google-cloud",
        permanent: true,
      },
      {
        source: "/docs/nodes/build/set-up-node-with-installer",
        destination: "/docs/nodes/run-a-node/using-install-script/installing-avalanche-go",
        permanent: true,
      },
      {
        source: "/docs/nodes/on-third-party-services/amazon-web-services",
        destination: "/docs/nodes/run-a-node/on-third-party-services/amazon-web-services",
        permanent: true,
      },
      {
        source: "/docs/overview/what-is-avalanche",
        destination: "/docs/primary-network",
        permanent: true,
      },
      {
        source: "/docs/reference/avalanchego/admin-api",
        destination: "/docs/rpcs/other",
        permanent: true,
      },
      {
        source: "/docs/rpcs/c-chain/rpc",
        destination: "/docs/rpcs/c-chain",
        permanent: true,
      },
      {
        source: "/docs/subnets/create-a-local-subnet",
        destination: "/docs/tooling/avalanche-cli/create-deploy-avalanche-l1s/deploy-locally",
        permanent: true,
      },
      {
        source: "/docs/subnets/deploy-a-gnosis-safe-on-your-evm",
        destination: "/docs/avalanche-l1s/add-utility/deploy-smart-contract",
        permanent: true,
      },
      {
        source: "/docs/subnets/deploy-a-smart-contract-on-your-evm",
        destination: "/docs/avalanche-l1s/add-utility/deploy-smart-contract",
        permanent: true,
      },
      {
        source: "/docs/subnets/upgrade/subnet-precompile-config",
        destination: "/docs/tooling/avalanche-cli/upgrade/avalanche-l1-precompile-config",
        permanent: true,
      },
      {
        source: "/docs/tooling/avalanche-cli/create-deploy-avalanche-l1s/deploy-public-network",
        destination: "/docs/tooling/avalanche-cli/create-deploy-avalanche-l1s/deploy-on-fuji-testnet",
        permanent: true,
      },
      {
        source: "/docs/tooling/avalanche-js",
        destination: "/docs/tooling/avalanche-sdk",
        permanent: true,
      },
      {
        source: "/docs/tooling/cross-chain/teleporter-token-bridge",
        destination: "/docs/tooling/avalanche-cli/cross-chain/teleporter-token-bridge",
        permanent: true,
      },
      {
        source: "/docs/tooling/maintain/delete-avalanche-l1",
        destination: "/docs/tooling/avalanche-cli/maintain/delete-avalanche-l1",
        permanent: true,
      },
      {
        source: "/docs/tooling/metrics-api",
        destination: "/docs/api-reference/metrics-api",
        permanent: true,
      },
      {
        source: "/docs/v1.0/:path*",
        destination: "/docs/rpcs",
        permanent: true,
      },
      {
        source: "/docs/virtual-machines/default-precompiles/allowlist",
        destination: "/docs/avalanche-l1s/precompiles/allowlist-interface",
        permanent: true,
      },
      {
        source: "/docs/virtual-machines/golang-vms/:path*",
        destination: "/docs/avalanche-l1s/golang-vms/:path*",
        permanent: true,
      },
      // Additional redirects from user feedback
      {
        source: "/academy/avalanche-l1/avalanche-fundamentals/04-creating-a-blockchain/:path*",
        destination: "/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/:path*",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/interchain-token-transfer/01-intro/:path*",
        destination: "/academy/avalanche-l1/interchain-messaging",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/l1-native-tokenomics/01-basics/:path*",
        destination: "/academy/avalanche-l1/l1-native-tokenomics/01-tokens-fundamentals",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/multi-chain-architecture/03-avalanche-starter-kit/04-add-blockchain-to-wallet",
        destination: "/academy/avalanche-l1/permissioned-l1s/03-create-an-L1/01-create-subnet",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/multi-chain-architecture/05-customizability/:path*",
        destination: "/academy/avalanche-l1/permissioned-l1s",
        permanent: true,
      },
      {
        source: "/academy/avalanche-l1/multi-chain-architecture/07-permissioning-validators/:path*",
        destination: "/academy/avalanche-l1/permissioned-l1s",
        permanent: true,
      },
      {
        source: "/docs/api-reference/keystore-api",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/build/tools/deprecating-ortelius",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/build/tools/ortelius",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/quickstart/fund-a-local-test-network",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/tooling/avalanche-ops",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/tooling/avalanche-sdk/client/accounts/methods/wallet-methods/wallet",
        destination: "/docs/tooling/avalanche-sdk/interchain/icm",
        permanent: true,
      },
      // Spanish docs redirect - remove /es prefix
      {
        source: "/docs/es/:path*",
        destination: "/docs/:path*",
        permanent: true,
      },
    ];
  },
};

export default withMDX(config);
