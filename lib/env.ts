import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // ── Database ────────────────────────────────────────────────
    DATABASE_URL: z.string().min(1),

    // ── Auth (NextAuth) ─────────────────────────────────────────
    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url().optional(),

    // ── OAuth providers ─────────────────────────────────────────
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_ID: z.string().optional(),
    GITHUB_SECRET: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    TWITTER_CLIENT_ID: z.string().optional(),
    TWITTER_CLIENT_SECRET: z.string().optional(),

    // ── Custom OAuth (MCP / Glacier) ────────────────────────────
    OAUTH_CLIENT_ID: z.string().optional(),
    OAUTH_CLIENT_SECRET: z.string().optional(),
    OAUTH_JWT_PRIVATE_KEY: z.string().optional(),
    OAUTH_REDIRECT_URI: z.string().optional(),

    // ── AI / LLM ────────────────────────────────────────────────
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),

    // ── ClickHouse ──────────────────────────────────────────────
    CLICKHOUSE_URL: z.string().optional(),
    CLICKHOUSE_USER: z.string().optional(),
    CLICKHOUSE_PASSWORD: z.string().optional(),
    CLICKHOUSE_DATABASE: z.string().optional(),

    // ── Redis ───────────────────────────────────────────────────
    REDIS_URL: z.string().optional(),

    // ── Glacier ─────────────────────────────────────────────────
    GLACIER_API_KEY: z.string().optional(),
    GLACIER_JWT_PRIVATE_KEY: z.string().optional(),

    // ── Faucet ──────────────────────────────────────────────────
    SERVER_PRIVATE_KEY: z.string().optional(),
    FAUCET_C_CHAIN_PRIVATE_KEY: z.string().optional(),
    FAUCET_C_CHAIN_ADDRESS: z.string().optional(),
    FAUCET_P_CHAIN_ADDRESS: z.string().optional(),

    // ── HubSpot ─────────────────────────────────────────────────
    HUBSPOT_API_KEY: z.string().optional(),
    HUBSPOT_PORTAL_ID: z.string().optional(),
    HUBSPOT_HACKATHON_FORM_GUID: z.string().optional(),
    HUBSPOT_INFRABUIDL_FORM_GUID: z.string().optional(),
    HUBSPOT_NEWSLETTER_FORM_GUID: z.string().optional(),
    HUBSPOT_USER_DATA_LIST_ID: z.string().optional(),

    // ── HubSpot certificate webhooks ────────────────────────────
    HUBSPOT_WEBHOOK_ACCESS_RESTRICTION_ADVANCED: z.string().optional(),
    HUBSPOT_WEBHOOK_ACCESS_RESTRICTION_FUNDAMENTALS: z.string().optional(),
    HUBSPOT_WEBHOOK_AVALANCHE_FUNDAMENTALS: z.string().optional(),
    HUBSPOT_WEBHOOK_BLOCKCHAIN_FUNDAMENTALS: z.string().optional(),
    HUBSPOT_WEBHOOK_CUSTOMIZING_EVM: z.string().optional(),
    HUBSPOT_WEBHOOK_ENCRYPTED_ERC: z.string().optional(),
    HUBSPOT_WEBHOOK_ERC20_BRIDGE: z.string().optional(),
    HUBSPOT_WEBHOOK_INTERCHAIN_MESSAGING: z.string().optional(),
    HUBSPOT_WEBHOOK_L1_NATIVE_TOKENOMICS: z.string().optional(),
    HUBSPOT_WEBHOOK_NATIVE_TOKEN_BRIDGE: z.string().optional(),
    HUBSPOT_WEBHOOK_NFT_DEPLOYMENT: z.string().optional(),
    HUBSPOT_WEBHOOK_PERMISSIONED_L1S: z.string().optional(),
    HUBSPOT_WEBHOOK_PERMISSIONLESS_L1S: z.string().optional(),
    HUBSPOT_WEBHOOK_SOLIDITY_FOUNDRY: z.string().optional(),
    HUBSPOT_WEBHOOK_X402_PAYMENT_INFRASTRUCTURE: z.string().optional(),
    CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK: z.string().optional(),
    ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK: z.string().optional(),

    // ── HubSpot form GUIDs ──────────────────────────────────────
    BUILD_GAMES_FORM_GUID: z.string().optional(),
    BUILD_GAMES_HACKATHON_ID: z.string().optional(),
    RETRO9000_FORM_GUID: z.string().optional(),
    VALIDATOR_FORM_GUID: z.string().optional(),

    // ── Email / SendGrid ────────────────────────────────────────
    SENDGRID_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // ── Blob storage ────────────────────────────────────────────
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    BLOB_BASE_URL: z.string().optional(),

    // ── External APIs ───────────────────────────────────────────
    DUNE_API_KEY: z.string().optional(),
    YOUTUBE_API_KEY: z.string().optional(),
    AVALANCHE_WORKERS_API_KEY: z.string().optional(),

    // ── Metrics ─────────────────────────────────────────────────
    METRICS_API_URL: z.string().optional(),
    METRICS_BYPASS_TOKEN: z.string().optional(),

    // ── Validator alerts ────────────────────────────────────────
    VALIDATOR_ALERTS_API_KEY: z.string().optional(),
    CRON_SECRET: z.string().optional(),

    // ── Managed testnet nodes ───────────────────────────────────
    MANAGED_NODES_OVERRIDE: z.string().optional(),
    MANAGED_TESTNET_NODE_SERVICE_PASSWORD: z.string().optional(),

    // ── MCP ─────────────────────────────────────────────────────
    MCP_ALLOWED_ORIGINS: z.string().optional(),

    // ── L1 validator fees ───────────────────────────────────────
    L1_VALIDATOR_FEE_MONTHLY_N_AVAX: z.string().optional(),

    // ── X402 ────────────────────────────────────────────────────
    X402_PAYER_PRIVATE_KEY: z.string().optional(),

    // ── Algolia ─────────────────────────────────────────────────
    ALGOLIA_WRITE_KEY: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_SITE_URL: z.string().optional(),
    NEXT_PUBLIC_BASE_URL: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
    NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY: z.string().optional(),
    NEXT_PUBLIC_AVALANCHE_WORKERS_URL: z.string().optional(),
  },

  runtimeEnv: {
    // Database
    DATABASE_URL: process.env.DATABASE_URL,

    // Auth
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,

    // OAuth providers
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_ID: process.env.GITHUB_ID,
    GITHUB_SECRET: process.env.GITHUB_SECRET,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
    TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,

    // Custom OAuth
    OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET,
    OAUTH_JWT_PRIVATE_KEY: process.env.OAUTH_JWT_PRIVATE_KEY,
    OAUTH_REDIRECT_URI: process.env.OAUTH_REDIRECT_URI,

    // AI / LLM
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,

    // ClickHouse
    CLICKHOUSE_URL: process.env.CLICKHOUSE_URL,
    CLICKHOUSE_USER: process.env.CLICKHOUSE_USER,
    CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD,
    CLICKHOUSE_DATABASE: process.env.CLICKHOUSE_DATABASE,

    // Redis
    REDIS_URL: process.env.REDIS_URL,

    // Glacier
    GLACIER_API_KEY: process.env.GLACIER_API_KEY,
    GLACIER_JWT_PRIVATE_KEY: process.env.GLACIER_JWT_PRIVATE_KEY,

    // Faucet
    SERVER_PRIVATE_KEY: process.env.SERVER_PRIVATE_KEY,
    FAUCET_C_CHAIN_PRIVATE_KEY: process.env.FAUCET_C_CHAIN_PRIVATE_KEY,
    FAUCET_C_CHAIN_ADDRESS: process.env.FAUCET_C_CHAIN_ADDRESS,
    FAUCET_P_CHAIN_ADDRESS: process.env.FAUCET_P_CHAIN_ADDRESS,

    // HubSpot
    HUBSPOT_API_KEY: process.env.HUBSPOT_API_KEY,
    HUBSPOT_PORTAL_ID: process.env.HUBSPOT_PORTAL_ID,
    HUBSPOT_HACKATHON_FORM_GUID: process.env.HUBSPOT_HACKATHON_FORM_GUID,
    HUBSPOT_INFRABUIDL_FORM_GUID: process.env.HUBSPOT_INFRABUIDL_FORM_GUID,
    HUBSPOT_NEWSLETTER_FORM_GUID: process.env.HUBSPOT_NEWSLETTER_FORM_GUID,
    HUBSPOT_USER_DATA_LIST_ID: process.env.HUBSPOT_USER_DATA_LIST_ID,

    // HubSpot certificate webhooks
    HUBSPOT_WEBHOOK_ACCESS_RESTRICTION_ADVANCED: process.env.HUBSPOT_WEBHOOK_ACCESS_RESTRICTION_ADVANCED,
    HUBSPOT_WEBHOOK_ACCESS_RESTRICTION_FUNDAMENTALS: process.env.HUBSPOT_WEBHOOK_ACCESS_RESTRICTION_FUNDAMENTALS,
    HUBSPOT_WEBHOOK_AVALANCHE_FUNDAMENTALS: process.env.HUBSPOT_WEBHOOK_AVALANCHE_FUNDAMENTALS,
    HUBSPOT_WEBHOOK_BLOCKCHAIN_FUNDAMENTALS: process.env.HUBSPOT_WEBHOOK_BLOCKCHAIN_FUNDAMENTALS,
    HUBSPOT_WEBHOOK_CUSTOMIZING_EVM: process.env.HUBSPOT_WEBHOOK_CUSTOMIZING_EVM,
    HUBSPOT_WEBHOOK_ENCRYPTED_ERC: process.env.HUBSPOT_WEBHOOK_ENCRYPTED_ERC,
    HUBSPOT_WEBHOOK_ERC20_BRIDGE: process.env.HUBSPOT_WEBHOOK_ERC20_BRIDGE,
    HUBSPOT_WEBHOOK_INTERCHAIN_MESSAGING: process.env.HUBSPOT_WEBHOOK_INTERCHAIN_MESSAGING,
    HUBSPOT_WEBHOOK_L1_NATIVE_TOKENOMICS: process.env.HUBSPOT_WEBHOOK_L1_NATIVE_TOKENOMICS,
    HUBSPOT_WEBHOOK_NATIVE_TOKEN_BRIDGE: process.env.HUBSPOT_WEBHOOK_NATIVE_TOKEN_BRIDGE,
    HUBSPOT_WEBHOOK_NFT_DEPLOYMENT: process.env.HUBSPOT_WEBHOOK_NFT_DEPLOYMENT,
    HUBSPOT_WEBHOOK_PERMISSIONED_L1S: process.env.HUBSPOT_WEBHOOK_PERMISSIONED_L1S,
    HUBSPOT_WEBHOOK_PERMISSIONLESS_L1S: process.env.HUBSPOT_WEBHOOK_PERMISSIONLESS_L1S,
    HUBSPOT_WEBHOOK_SOLIDITY_FOUNDRY: process.env.HUBSPOT_WEBHOOK_SOLIDITY_FOUNDRY,
    HUBSPOT_WEBHOOK_X402_PAYMENT_INFRASTRUCTURE: process.env.HUBSPOT_WEBHOOK_X402_PAYMENT_INFRASTRUCTURE,
    CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK: process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK,
    ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK: process.env.ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK,

    // HubSpot form GUIDs
    BUILD_GAMES_FORM_GUID: process.env.BUILD_GAMES_FORM_GUID,
    BUILD_GAMES_HACKATHON_ID: process.env.BUILD_GAMES_HACKATHON_ID,
    RETRO9000_FORM_GUID: process.env.RETRO9000_FORM_GUID,
    VALIDATOR_FORM_GUID: process.env.VALIDATOR_FORM_GUID,

    // Email / SendGrid
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,

    // Blob storage
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    BLOB_BASE_URL: process.env.BLOB_BASE_URL,

    // External APIs
    DUNE_API_KEY: process.env.DUNE_API_KEY,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    AVALANCHE_WORKERS_API_KEY: process.env.AVALANCHE_WORKERS_API_KEY,

    // Metrics
    METRICS_API_URL: process.env.METRICS_API_URL,
    METRICS_BYPASS_TOKEN: process.env.METRICS_BYPASS_TOKEN,

    // Validator alerts
    VALIDATOR_ALERTS_API_KEY: process.env.VALIDATOR_ALERTS_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,

    // Managed testnet nodes
    MANAGED_NODES_OVERRIDE: process.env.MANAGED_NODES_OVERRIDE,
    MANAGED_TESTNET_NODE_SERVICE_PASSWORD: process.env.MANAGED_TESTNET_NODE_SERVICE_PASSWORD,

    // MCP
    MCP_ALLOWED_ORIGINS: process.env.MCP_ALLOWED_ORIGINS,

    // L1 validator fees
    L1_VALIDATOR_FEE_MONTHLY_N_AVAX: process.env.L1_VALIDATOR_FEE_MONTHLY_N_AVAX,

    // X402
    X402_PAYER_PRIVATE_KEY: process.env.X402_PAYER_PRIVATE_KEY,

    // Algolia
    ALGOLIA_WRITE_KEY: process.env.ALGOLIA_WRITE_KEY,

    // Client vars
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY,
    NEXT_PUBLIC_AVALANCHE_WORKERS_URL: process.env.NEXT_PUBLIC_AVALANCHE_WORKERS_URL,
  },

  // Skip validation during build if flag is set
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
