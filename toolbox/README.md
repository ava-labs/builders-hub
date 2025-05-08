<<<<<<< HEAD
# Avalanche Builders Hub Toolbox
=======
# Avalanche Builder Hub Toolbox
>>>>>>> upstream/master

Please read this guide before contributing or at least feed this into your Cursor/v0/Windsurf/whatever. 

## UI Components
- Reusable components are in `./src/components`
- Put into shared components only the components that are already used in 2 or more tools.

## Stores
- Create new stores when state shouldn't be shared with toolbox
- State persists in localStorage except when it doesn't make sense to do so like in the Wallet store
- Use derived stores to simplify dependencies (see `useViemChainStore` example)

## Errors
- All async errors should be caught with try/catch blocks
- Use the `showBoundary` function from `useErrorBoundary` to display errors that should block the whole page
- For errors that shouldn't block the page, handle them locally with state management and UI feedback

## CoreViem
An experimental library that unifies Core wallet transactions and RPC calls. Will eventually be released as an SDK.

# Styles
Toolbox uses `avalanche-docs-shim.css` to be as close as possible to the builder hub look and feel. Feel free to edit it if some styles do not match.

Toolbox is an independent software from builder-hub and could not have any dependencies on builder-hub.
