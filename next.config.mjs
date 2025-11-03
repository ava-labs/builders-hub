import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  serverExternalPackages: [
    'ts-morph',
    'typescript',
    'twoslash',
  ],
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
        hostname: 'cdn.prod.website-files.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
      {
        source: '/academy/:path*.mdx',
        destination: '/llms.mdx/academy/:path*',
      },
      {
        source: '/guides/:path*.mdx',
        destination: '/llms.mdx/guides/:path*',
      },
      {
        source: '/integrations/:path*.mdx',
        destination: '/llms.mdx/integrations/:path*',
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/codebase-entrepreneur',
        destination: '/codebase-entrepreneur-academy',
        permanent: true,
      },
      {
        source: '/codebase-entrepreneur/:path*',
        destination: '/codebase-entrepreneur-academy/:path*',
        permanent: true,
      },
      {
        source: '/hackathon',
        destination: '/hackathons/26bfce9b-4d44-4d40-8fbe-7903e76d48fa',
        permanent: true,
      },
      {
        source: '/tools/l1-launcher',
        destination: '/academy/avalanche-fundamentals/04-creating-an-l1/01-creating-an-l1',
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
        destination: '/docs/avalanche-l1s/evm-configuration/permissions#contract-deployer-allowlist',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/txallowlist',
        destination: '/docs/avalanche-l1s/evm-configuration/permissions#transaction-allowlist',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/contractnativeminter',
        destination: '/docs/avalanche-l1s/evm-configuration/tokenomics#native-minter',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/nativeminter',
        destination: '/docs/avalanche-l1s/evm-configuration/tokenomics#native-minter',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/feemanager',
        destination: '/docs/avalanche-l1s/evm-configuration/transaction-fees#fee-manager',
        permanent: true,
      },
      {
        source: '/docs/virtual-machines/default-precompiles/rewardmanager',
        destination: '/docs/avalanche-l1s/evm-configuration/transaction-fees#reward-manager',
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
        destination: '/academy/interchain-messaging/10-running-a-relayer/01-relayer-introduction',
        permanent: true,
      },
      {
        source: '/academy/interchain-messaging/10-running-a-relayer/02-control-the-avalanche-cli-relayer',
        destination: '/academy/interchain-messaging/10-running-a-relayer/03-configure-and-run-the-relayer',
        permanent: true,
      }, {
        source: '/academy/interchain-messaging/10-running-a-relayer/03-install-relayer',
        destination: '/academy/interchain-messaging/10-running-a-relayer/03-configure-and-run-the-relayer',
        permanent: true,
      }, {
        source: '/academy/interchain-messaging/10-running-a-relayer/05-multichain-relayer-config',
        destination: '/academy/interchain-messaging/10-running-a-relayer/02-relayer-configuration#multichain-relayer-configuration',
        permanent: true,
      }, {
        source: '/academy/interchain-messaging/10-running-a-relayer/06-analyze-relayer-logs',
        destination: '/academy/interchain-messaging/10-running-a-relayer/03-configure-and-run-the-relayer',
        permanent: true,
      }, {
        source: '/academy/interchain-messaging/03-avalanche-starter-kit/03-create-blockchain',
        destination: '/academy/interchain-messaging/03-avalanche-starter-kit/04-networks',
        permanent: true,
      }, {
        source: '/academy/interchain-messaging/03-avalanche-starter-kit/06-pause-and-resume',
        destination: '/academy/interchain-messaging/03-avalanche-starter-kit/04-networks',
        permanent: true,
      }, {
        source: '/docs/subnets/customize-a-subnet',
        destination: '/docs/avalanche-l1s/upgrade/customize-avalanche-l1',
        permanent: true,
      }, {
        source: '/docs/build/tutorials/platform/create-a-local-test-network',
        destination: '/academy/avalanche-fundamentals',
        permanent: true,
      }, {
        source: '/docs/api-reference/standards/guides/issuing-api-calls',
        destination: '/docs/api-reference/guides/issuing-api-calls',
        permanent: true,
      }, {
        source: '/docs/api-reference/standards/guides/txn-fees',
        destination: '/docs/api-reference/guides/txn-fees',
        permanent: true,
      }, {
        source: '/docs/api-reference/standards/guides/txn-fees#c-chain-fees',
        destination: '/docs/api-reference/guides/txn-fees#c-chain-fees',
        permanent: true,
      }, {
        source: '/docs/tooling/guides/get-avalanche-cli',
        destination: '/docs/tooling/get-avalanche-cli',
        permanent: true,
      }, {
        source: '/evm-l1s/validator-manager/poa-vs-pos',
        destination: 'docs/avalanche-l1s/validator-manager/poa-vs-pos',
        permanent: true,
      }, {
        source: '/docs/avalanche-l1s/allowlist',
        destination: '/docs/avalanche-l1s/evm-configuration/allowlist',
        permanent: true,
      }, {
        source: '/docs/virtual-machines/evm-customization/generating-your-precompile',
        destination: '/docs/virtual-machines/custom-precompiles/create-precompile',
        permanent: true,
      }, {
        source: '/docs/virtual-machines/evm-customization/defining-precompile#event-file',
        destination: '/docs/virtual-machines/custom-precompiles/defining-precompile#event-file',
        permanent: true,
      }, {
        source: '/docs/virtual-machines/evm-customization/testing-your-precompile',
        destination: '/docs/virtual-machines/custom-precompiles/test-precompile',
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
        destination: "/docs/avalanche-l1s/evm-configuration/tokenomics#native-minter",
        permanent: true,
      }, {
        source: "/docs/virtual-machines/evm-customization/introduction",
        destination: "/docs/virtual-machines/evm-l1-customization",
        permanent: true,
      }, {
        source: "/docs/virtual-machines/evm-customization/background-requirements",
        destination: "/docs/virtual-machines/custom-precompiles/background-requirements",
        permanent: true,
      }, {
        source: "/docs/nodes/run-a-node/manually",
        destination: "/docs/nodes/run-a-node/from-source",
        permanent: true,
      }, {
        source: "/docs/tooling/avalanchego-postman-collection/setup",
        destination: "/docs/tooling/avalanche-postman/add-postman-collection",
        permanent: true,
      }, {
        source: "/docs/avalanche-l1s/deploy-a-avalanche-l1/fuji-testnet",
        destination: "/docs/tooling/create-deploy-avalanche-l1s/deploy-on-fuji-testnet",
        permanent: true,
      }, {
        source: "/docs/tooling/avalanche-cli#avalanche-l1-deploy",
        destination: "/docs/tooling/cli-commands#deploy",
        permanent: true,
      }, {
        source: "/docs/tooling/avalanche-cli#network-start",
        destination: "/docs/tooling/cli-commands#start",
        permanent: true,
      }, {
        source: "/docs/tooling/avalanche-cli",
        destination: "/docs/tooling/cli-commands",
        permanent: true,
      },       {
        source: "/academy/l1-validator-management",
        destination: "/academy/permissioned-l1s",
        permanent: true,
      },
      {
        source: "/academy/l1-validator-management/:path*",
        destination: "/academy/permissioned-l1s/:path*",
        permanent: true,
      },
      {
        source: "/academy/l1-tokenomics",
        destination: "/academy/l1-native-tokenomics",
        permanent: true,
      },
      {
        source: "/academy/l1-tokenomics/:path*",
        destination: "/academy/l1-native-tokenomics/:path*",
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
    ];
  },
};

export default withMDX(config);
