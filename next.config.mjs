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
    ],
  },
  async redirects() {
    return [
      {
        source: '/hackathon',
        destination: '/hackathons/26bfce9b-4d44-4d40-8fbe-7903e76d48fa',
        permanent: true,
      },
      // Redirects from old VM paths
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
      }
    ];
  },
};

export default withMDX(config);
