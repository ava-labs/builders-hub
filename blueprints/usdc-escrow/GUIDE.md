# USDC Escrow

Two-party escrow with a per-deal arbiter. It suits freelance work, peer-to-peer trades, and marketplace orders where delivery happens off-chain.

## What gets deployed

`USDCEscrow(token)`, with USDC from `$net.main.tokens.USDC.address`. There is no owner: every power sits with the parties of each deal.

## Deal lifecycle

| From | Action | Who | To |
| --- | --- | --- | --- |
| none | `createDeal(seller, arbiter, amount, deadline, terms)` | buyer | Funded |
| Funded | `release(id)` | buyer | Released: seller paid |
| Funded | `refund(id)` | seller | Refunded: buyer paid |
| Funded, up to the deadline | `dispute(id)` | buyer or seller | Disputed |
| Disputed | `settle(id, toSeller)` | arbiter | Settled: split paid |
| Funded, after the deadline | `reclaim(id)` | anyone | Refunded: buyer paid |

A disputed deal has no deadline: only the arbiter can close it. Buyer, seller and arbiter must be three different addresses.

## Choosing a deadline

The deadline is the seller's delivery window plus the buyer's inspection time. The seller must dispute before it passes if the buyer goes silent after delivery, because after the deadline anyone can return the funds to the buyer. State this in the UI.

## Adapting it

- **Milestones**: split a job into several deals created together, one per milestone.
- **Arbiter fee**: have `settle` pay the arbiter a fixed fee agreed in `createDeal`, taken from the deal amount, and show it to both parties up front.
- **Platform-appointed arbiter**: replace the per-deal arbiter with an immutable arbiter address or a multisig. Document who that is.
- **Native AVAX deals**: keep a separate contract that takes `msg.value`. Don't mix native and token accounting.

## Pitfalls

- `terms` is stored on-chain and public. Store a hash of private terms instead, and keep the document off-chain.
- Timestamps come from the block, not the user's clock. Leave margins of minutes, not seconds.
