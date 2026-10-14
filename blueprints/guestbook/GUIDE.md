# Guestbook

A permanent guestbook: anyone signs with a short message, and no one can edit or delete an entry. Use it as a builder's first deployment, or as the base for any append-only log such as shout-outs, event check-ins or attestations.

## What gets deployed

`Guestbook` on the `main` network. It has no constructor arguments and no owner, so there is nothing to hand over after deployment.

## Steps

1. Deploy `Guestbook`.
2. Optionally sign it once from the builder's wallet and check that `count()` is 1.

## Contract surface

- `sign(message)` appends an entry and emits `Signed(id, author, message)`. It reverts on an empty message or one longer than `MAX_MESSAGE_BYTES` (280 bytes).
- `latest(offset, limit)` returns the newest entries first, at most `MAX_PAGE_SIZE` (50) per call.
- `getEntry(id)` and `count()` read single values.

## Adapting it

- **Only some people may sign**: add OpenZeppelin `Ownable` plus an allowlist mapping checked in `sign`. Keep the length cap.
- **Paid entries**: take a USDC payment in `sign` with `SafeERC20.safeTransferFrom`, as `usdc-checkout` does. Validate the amount before writing the entry.
- **More data per entry**: emit the extra fields in the event and store only what reads need. Storage costs far more than event data.
- **Moderation**: entries are permanent by design. If the product needs hiding, add a `hidden` flag the owner can set and have the frontend respect it. Don't delete.

## Pitfalls

- The limit counts bytes. Measure with `new TextEncoder().encode(message).length`.
- Never loop over every entry in the frontend. Use `latest` pages.
