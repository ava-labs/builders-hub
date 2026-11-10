# USDC Checkout

A storefront's payment contract. The owner lists products with USDC prices, buyers pay for orders, and each order is stored with its buyer, amount and the store's own reference, so a backend can fulfil it and the owner can refund it.

## What gets deployed

1. `USDCCheckout(paymentToken, owner)`, with USDC from `$net.main.tokens.USDC.address` and the platform deployer as the temporary owner.
2. `setProduct(1, name, price, true)` for the first product.
3. `transferOwnership(owner)` to the builder.
4. Optional smoke test from the builder's wallet: approve the price, buy one unit, and check that the checkout holds the payment.

## Money flow

- `purchase(productId, quantity, orderRef)` pulls `priceOf(productId, quantity)` from the buyer into the contract and emits `OrderPaid`.
- `purchaseWithPermit(...)` does the same in one transaction using an EIP-2612 signature. USDC supports permit on both Fuji and mainnet. A front-run permit does not break the purchase, because the allowance it granted still exists.
- `refund(orderId)` returns the order's amount to its buyer, once.
- `withdraw(to, amount)` moves collected funds to the store's treasury.
- `pause()` stops new purchases. Refunds and withdrawals keep working.

## Amounts

USDC has 6 decimals: 5 USDC is `5000000`. Read decimals from the registry and never assume 18. `MAX_QUANTITY` is 1,000 per order.

## Adapting it

- **Prices change often or come from a backend**: replace the on-chain catalog with EIP-712 quotes. The backend signs `(orderRef, amount, expiry)`, and `purchase` checks the signature with OpenZeppelin `ECDSA` and `EIP712`. The signer key lives on the backend, never in the frontend.
- **Pay out immediately**: transfer to a treasury inside `_purchase` instead of holding funds. Refunds then have to come from the treasury.
- **Multiple currencies**: keep one checkout per token. Mixing tokens in one contract complicates refunds and accounting.
- **Price in USD, pay in AVAX**: combine with `price-tracker` and add a slippage bound.

## Pitfalls

- Fulfil from `OrderPaid` events as the backend sees them, and handle chain reorgs by waiting a few blocks on mainnet.
- Withdrawing everything leaves nothing for refunds. Keep a reserve for the refund window.
