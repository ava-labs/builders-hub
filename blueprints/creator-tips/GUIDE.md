# Creator Tips

Handle-based creator profiles with USDC tips. It fills the role of Arc's "ENS Profile" template without needing a name service: handles live in the contract itself.

## What gets deployed

1. `CreatorTips(tipToken)`, with USDC from `$net.main.tokens.USDC.address`. There is no owner and nothing to hand over.
2. Optionally, the builder registers their own profile so the UI has something to show.

## Contract surface

- `register(handle, displayName, bio, avatarURI)`: one profile per address. A handle is 3 to 32 characters of `a-z`, `0-9` and `_`, and first come, first served.
- `updateProfile(displayName, bio, avatarURI)`: the handle cannot change.
- `tip(handle, amount, message)` moves `amount` from the fan straight to the creator with `safeTransferFrom`, updates `tipsReceived` and `tipCount`, and emits `Tipped`. Self-tips revert.
- `creatorOf(handle)` and `profileOf(creator)` for reads. Text fields are capped at 280 bytes.

## Testing tips

A creator cannot tip themselves, so a tip test needs a second wallet. Register from one wallet and tip from another, or skip the tip test and rely on the panel.

## Adapting it

- **Tip in AVAX too**: add a payable `tipNative(handle, message)` that forwards `msg.value` with a checked low-level call, and put `nonReentrant` on it.
- **Platform fee**: take a basis-point cut to a fee recipient inside `tip`, emit it, and cap the rate with an immutable maximum.
- **Transferable handles**: make handles ERC-721 tokens so they can be sold. This changes the storage model substantially, so plan it before launch.
- **Avalanche names**: resolve `.avax` names off-chain in the frontend and keep the on-chain handle as the source of truth for tips.

## Pitfalls

- `avatarURI` is user-controlled. Load it through an image proxy or restrict it to `ipfs://` and `https://`.
- Handles are case-sensitive at the byte level. The contract only accepts lowercase, so lowercase input in the UI before calling.
