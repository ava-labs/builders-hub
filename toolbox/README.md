# Avalanche Builders Hub Toolbox

Please read this guide before contributing or at least feed this into your Cursor/v0/Windsurf/whatever. 

## UI Components
- Reusable components are in `./src/components`
- Only create shared components when used in multiple places
- Keep components minimal to reduce dependency complexity

## Stores
- Create new stores when state shouldn't be shared with toolbox
- State persists in localStorage except when it doesn't make sense to do so like in the Wallet store
- Use derived stores to simplify dependencies (see `useViemChainStore` example)

## CoreViem
An experimental library that unifies Core wallet transactions and RPC calls. Will eventually be released as an SDK.

Toolbox is an independent software from builder-hub and could not have any dependencies on builder-hub.
