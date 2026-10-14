---
name: builder-hub-design-system
description: The Builder Hub design system (the explorer's look) for Studio frontends, as the builder-hub.css classes, the rules behind them and ready-made page patterns. Use with the frontend skill whenever you build or restyle a page under frontend/.
---

# Builder Hub design system

Studio frontends look like the Builder Hub explorer: calm, dense, precise. Link the shared stylesheet and compose pages from its classes. Don't restyle the basics.

```html
<link rel="stylesheet" href="builder-hub.css">
<link rel="stylesheet" href="styles.css"> <!-- only what the page adds on top -->
```

`builder-hub.css` is served by the Preview tab and written next to `index.html` when the project is exported. Don't create or edit `frontend/builder-hub.css` yourself. Put page-specific rules in `styles.css`, using the `--bh-*` variables.

## Rules

1. **Square hairlines.** 1px borders in `--bh-border`, no rounded corners, no shadows, no gradients. Boards separate their rows with hairlines.
2. **Two faces.**
   - **Geist** for prose and titles.
   - **Geist Mono** for everything technical: labels, numbers, addresses, buttons.
   - **Labels** are mono, uppercase, 10 to 11px, with wide tracking (`.bh-label`, `.bh-section-header`).
3. **Zinc ink.**
   - Text runs from `--bh-ink` (headings, values) through `--bh-ink-2` (body) and `--bh-muted` (labels) to `--bh-faint` (units, empty states).
   - Colour carries meaning only:
     - blue `--bh-id` for addresses, hashes and links;
     - red `--bh-accent` for the active tab and link hover;
     - violet `--bh-fn` for function names;
     - green, amber and red for status.
4. **Numbers are figures.** Use `tabular-nums` (built into `.bh-ink`, `.bh-muted` and `.bh-fig`). Put the unit after the value in `.bh-unit`, and never show raw wei.
5. **Names first, addresses second.** Show people and things by their names: handles, products, token symbols. When an address appears, it's a `.bh-hash`, shortened in the middle (`0x1234…abcd`), linked to the explorer when there is a URL, with the full value in `title`.
6. **Quiet actions.** One primary `.bh-btn` per form. Everything else is `.bh-btn--secondary` or `.bh-btn--ghost`, and `.bh-btn--danger` only for destructive owner actions.
7. **Status, not alarms.**
   - `.bh-pill` tones for short states (pending, confirmed, owner).
   - `.bh-notice` for one-line messages under the thing they're about.
   - No modals for errors.
8. **Dense but breathable.** Sections 32px apart, rows 44px tall, 20px side padding. Stay readable at 360px, where rows wrap.
9. **Both themes.**
   - Everything uses the variables, so light and dark come for free.
   - The Preview sets `<html data-theme>` to match the console. Without it the OS preference applies.
   - Never hardcode `#fff` or `#000`.

## Classes

| Class | Use |
| --- | --- |
| `.bh-page` | Page container: centred, max 1120px, sections 32px apart |
| `.bh-topbar`, `.bh-title`, `.bh-spacer` | Header row: title on the left, network and wallet on the right |
| `.bh-section`, `.bh-section-header` | A section, and its bold mono label followed by a hairline (`<h2 class="bh-section-header">Balances</h2>`) |
| `.bh-board`, `.bh-board-header`, `.bh-row`, `.bh-empty` | Bordered list: header strip, 44px rows, empty state |
| `.bh-stats`, `.bh-stat` | Stat strip: `.bh-label` over `.bh-fig` with `.bh-unit` |
| `.bh-label`, `.bh-ink`, `.bh-muted`, `.bh-body`, `.bh-fig`, `.bh-unit` | Type roles |
| `.bh-hash`, `.bh-id`, `.bh-fn` | Addresses and hashes, blue text, function names |
| `.bh-btn` (`--secondary`, `--ghost`, `--danger`) | Buttons, 32px, mono uppercase |
| `.bh-form`, `.bh-field`, `.bh-input`, `.bh-select`, `.bh-textarea`, `.bh-hint` | Forms: responsive grid; label, control, hint |
| `.bh-tabs`, `.bh-tab[aria-selected=true]` | Tabs, with the active one underlined in red |
| `.bh-pill` (`--good`, `--warn`, `--bad`, `--info`) | Short status |
| `.bh-notice` (`--good`, `--warn`, `--bad`) | Messages |
| `.bh-live`, `.bh-spinner`, `.bh-skeleton` | Live dot, in-flight, loading placeholder |
| `.bh-built` | The "Built on Builder Hub Studio · Powered by Avalanche" footer. Studio adds it at the end of `<body>`, so don't write or restyle it. `<body>` is a full-height flex column so the footer rests at the bottom of a short page: don't change `body`'s `display`, `min-height` or `height`, and don't make the app's root element `height: 100vh` (let it grow with its content). |

## Patterns

The patterns are written as HTML. In a React app (the default), write them as JSX: `className` for `class`, `htmlFor` for `for`, self-closing tags, and `onClick`/`onChange` handlers instead of ids and listeners. The class names and structure are the same.

**Header with wallet**

```html
<header class="bh-topbar">
  <h1 class="bh-title">Guestbook</h1>
  <span class="bh-pill bh-pill--info" id="network">Fuji C-Chain</span>
  <span class="bh-spacer"></span>
  <span class="bh-hash" id="account" hidden></span>
  <button class="bh-btn" id="connect">Connect wallet</button>
</header>
```

**Stats**

```html
<div class="bh-stats">
  <div class="bh-stat"><span class="bh-label">Total supply</span><span class="bh-fig" id="supply"><span class="bh-skeleton"></span></span></div>
  <div class="bh-stat"><span class="bh-label">Your balance</span><span class="bh-fig"><span id="balance">—</span><span class="bh-unit">MOON</span></span></div>
</div>
```

**A profile the user came for** (a person or thing first, the address last)

```html
<section class="bh-section">
  <h2 class="bh-section-header">@alice</h2>
  <div class="bh-board">
    <div class="bh-board-header">Creator</div>
    <div class="bh-row"><span class="bh-label">Name</span><span class="bh-body" id="name">Alice Chen</span></div>
    <div class="bh-row"><span class="bh-label">Supporters</span><span class="bh-ink" id="tips">42 tips · 318.00 USDC</span></div>
    <div class="bh-row"><span class="bh-label">Wallet</span><a class="bh-hash" id="wallet" target="_blank" rel="noopener"></a></div>
  </div>
</section>
```

**The user's main action, with its steps and status underneath**

```html
<section class="bh-section">
  <h2 class="bh-section-header">Support @alice</h2>
  <form class="bh-form" id="tip">
    <label class="bh-field"><span class="bh-label">Amount</span><input class="bh-input" name="amount" inputmode="decimal" value="5" required>
      <span class="bh-hint">You have <span id="balance">—</span> USDC · <button type="button" class="bh-btn bh-btn--ghost" id="max">Max</button></span></label>
    <label class="bh-field"><span class="bh-label">Message (optional)</span><input class="bh-input" name="message" maxlength="280"></label>
    <button class="bh-btn" type="submit" id="submit">Tip 5 USDC</button>
  </form>
  <p class="bh-muted" id="steps" hidden>1 of 2 · Allow USDC → 2 of 2 · Send tip</p>
  <p class="bh-notice" id="tip-status" hidden></p>
</section>
```

Transaction status reads, in order:
1. `Confirm in your wallet…` in a neutral notice.
2. `Pending` with a `.bh-spinner` and the hash link.
3. `Confirmed in block N`, using `--good`.
4. Or the decoded revert, using `--bad`.

**Token list** (from `studio.explorer.tokenBalances`)

```html
<div class="bh-board" id="tokens">
  <div class="bh-board-header">Tokens</div>
  <!-- one per token -->
  <div class="bh-row"><span class="bh-ink">USDC</span><span class="bh-muted">USD Coin</span><span class="bh-spacer"></span><span class="bh-ink">12.50</span></div>
</div>
```

## Don't

- Rounded cards, drop shadows, gradients, emoji or icon fonts. Use text labels, or small inline SVGs in `currentColor` if you need an icon.
- Colour for decoration: every colour means something.
- More than one primary button in view, or buttons that don't say what they do ("Submit" should be "Send 10 MOON").
- Contract vocabulary on screen: function names, "approve", "nonpayable", wei, ABI types. Say what happens for the user instead.
- Spinners with no text, or blank values while loading: use `.bh-skeleton`.
- Your own font sizes for labels and numbers. Use the type classes so pages stay consistent with the explorer.
