# Toolbox

The interactive Builder Console tooling — multi-step wizard flows for deploying and managing Avalanche L1s, validators, ICM/ICTT, and related on-chain operations. This is the largest feature area in the codebase.

## Structure

- `academy/` — Academy-specific console header and sidebar variants
- `components/` — All UI components used within toolbox flows (buttons, inputs, wallet connection, genesis wizard, etc.)
- `console/` — Console-page sub-flows organized by feature area (ICM, ICTT, layer-1, validators, permissioned/permissionless L1s, etc.)
- `contexts/` — React contexts (e.g. `ConnectedWalletContext`)
- `coreViem/` — Wallet provider wiring: Wagmi config, `Web3Provider`, `WalletProvider`, modal management, and Zustand stores
- `hooks/` — Feature hooks: `useWallet`, `useWalletConnect`, `useERC20Token`, `useLookupChain`, `useValidatorManagerDetails`, etc.
- `lib/` — Internal utilities: `utils.ts` (cn helper), `github-url.ts`, `contract-deployment.ts`, `containerVersions.ts`
- `providers/` — Root providers: `WalletProvider` (wraps Web3Provider + modals + wallet sync)
- `services/` — External service wrappers (`balanceService.ts`)
- `stores/` — Zustand stores: `walletStore`, `toolboxStore`, `createChainStore`, `l1ListStore`, `consoleBadgeNotificationStore`
- `types/` — Internal TypeScript types for toolbox
- `utils/` — Pure utilities: `json.ts`, `github-url.ts`

## Key Exports

- `WalletProvider` — Root provider; wrap console pages with this to enable wallet connectivity and modals
- `useWallet` — Primary hook for EVM wallet state, address, network switching, and Avalanche SDK client
- `useWalletStore` — Zustand store for raw wallet state (address, testnet flag, connection status)
- `useL1List` / `l1ListStore` — Store and hooks for the user's saved L1s
- `useValidatorManagerDetails` — Fetches validator manager contract details for a chain

## Adding New Flows

1. Create a subdirectory under `console/` matching the feature area (e.g. `console/my-feature/`)
2. Build step components in `components/` following the `Step` naming convention
3. Wire up the flow in `config/console-flows.ts` (root-level `config/` directory)
4. Add wallet requirements via `useWalletRequirements` / `useAccountRequirements` hooks
