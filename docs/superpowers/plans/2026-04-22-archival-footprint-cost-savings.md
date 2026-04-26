# Archival Footprint Cost Savings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Firewood interactive docs page's `ArchivalFootprintCard` to show not just the storage delta (16 TB → 3 TB) but also the per-node NVMe cost saved by switching to Firewood, using mid-tier NVMe Gen 4 pricing.

**Architecture:** Extract a small pure cost helper into its own file so the math is isolated, easily sourced, and testable. Keep all UI changes inside the existing `ArchivalFootprintCard.tsx`. Add:

1. A cost annotation (`$1,200` / `$225`) under each size label next to the existing bars.
2. A second line in the delta badge showing per-node USD savings alongside the existing `~5.3× smaller` ratio.
3. A pricing-assumption footnote inside the card so the figure is sourced inline.
4. An updated `InfoTooltip` that explains the hardware cost model.

**Tech Stack:** React 18, TypeScript, Next.js App Router, framer-motion (already used by the card). No new dependencies.

**Pricing assumption (single source of truth):**

- Mid-tier NVMe Gen 4 SSDs at retail in **April 2026** sit at **~$120 per TB USD** (Samsung 990 Pro, WD Black SN850X, Crucial T700, Kingston KC3000 at 2–4 TB capacity tiers). This reflects current market pricing confirmed with the user.
- Figure stored in one place as `PRICE_PER_TB_USD = 120` so it can be tuned later without touching component code.
- All dollar figures rendered in the UI are derived from this constant and the `LEVELDB_TB` / `FIREWOOD_TB` values already defined on the card — no hard-coded dollars in JSX.

**Derived numbers at $120/TB:**

| Backend | Storage | NVMe cost / node |
|---------|---------|------------------|
| LevelDB | ~16 TB  | ~$1,920          |
| Firewood| ~3 TB   | ~$360            |
| **Saved** | **~13 TB** | **~$1,560 (~81%)** |

---

## File Structure

**Create:**
- `components/firewood/archival-cost.ts` — pure cost helper module. Constants + a `computeArchivalCosts()` function returning `{ leveldb, firewood, savings, savingsPct }`. No React imports. Exported for reuse if a future card needs it.

**Modify:**
- `components/firewood/ArchivalFootprintCard.tsx` — consume the helper, render dollar annotations, update badge + tooltip + footnote.

**Unchanged (referenced only):**
- `components/firewood/types.ts` — provides `Colors`, `FIREWOOD_COLORS`.
- `components/firewood/shared.tsx` — provides `InfoTooltip`.
- `components/firewood/Payoff.tsx` — already wires the card into the page, no change needed.

No new tests file: the codebase has no existing UI unit tests (no `vitest.config.*`, no `*.test.tsx` under `components/`). A unit test module would add infrastructure the project doesn't currently use. Verification is `tsc --noEmit` + browser.

---

## Task 1: Extract cost helper into a pure module

**Files:**
- Create: `components/firewood/archival-cost.ts`

- [ ] **Step 1: Create the helper file**

Write `components/firewood/archival-cost.ts`:

```ts
// Hardware cost model for archival node storage.
// Mid-tier NVMe Gen 4 SSDs at retail (April 2026) sit around $120/TB — examples:
// Samsung 990 Pro, WD Black SN850X, Crucial T700, Kingston KC3000 at bulk
// capacity (2–4 TB tiers). This single constant drives every dollar figure
// rendered in the archival footprint card.
export const PRICE_PER_TB_USD = 120

export interface ArchivalCostResult {
  leveldb: number
  firewood: number
  savings: number
  savingsPct: number
}

export function computeArchivalCosts(
  leveldbTb: number,
  firewoodTb: number,
  pricePerTbUsd: number = PRICE_PER_TB_USD,
): ArchivalCostResult {
  const leveldb = leveldbTb * pricePerTbUsd
  const firewood = firewoodTb * pricePerTbUsd
  const savings = leveldb - firewood
  const savingsPct = leveldb === 0 ? 0 : Math.round((savings / leveldb) * 100)
  return { leveldb, firewood, savings, savingsPct }
}

// Format a USD amount as "$1,200" — no decimals, localised thousand separators.
export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`
}
```

- [ ] **Step 2: Type-check the new file compiles in isolation**

Run: `npx tsc --noEmit`
Expected: Exit code `0` with no new errors. (If it fails, fix before moving on.)

- [ ] **Step 3: Commit**

```bash
git add components/firewood/archival-cost.ts
git commit -m "feat(docs): add archival cost helper for firewood card"
```

---

## Task 2: Wire helper into the card and render cost annotations

**Files:**
- Modify: `components/firewood/ArchivalFootprintCard.tsx`

- [ ] **Step 1: Import the helper and compute the cost figures once**

At the top of `components/firewood/ArchivalFootprintCard.tsx`, under the existing imports, add:

```tsx
import {
  PRICE_PER_TB_USD,
  computeArchivalCosts,
  formatUsd,
} from "./archival-cost"
```

Inside `ArchivalFootprintCard`, directly after the `useInView` line, compute the cost values:

```tsx
const costs = computeArchivalCosts(LEVELDB_TB, FIREWOOD_TB)
```

- [ ] **Step 2: Add a cost annotation under the LevelDB size label**

Find the existing LevelDB row JSX (search for `~16 TB`). The row currently looks like:

```tsx
<div className="flex items-baseline justify-between">
  <span
    className={`text-[10px] font-mono uppercase tracking-[0.15em] ${colors.textMuted}`}
  >
    LevelDB
  </span>
  <span
    className="text-base sm:text-lg font-mono font-bold"
    style={{ color: FIREWOOD_COLORS.leveldb }}
  >
    ~16 TB
  </span>
</div>
```

Replace it with a two-line right column:

```tsx
<div className="flex items-baseline justify-between">
  <span
    className={`text-[10px] font-mono uppercase tracking-[0.15em] ${colors.textMuted}`}
  >
    LevelDB
  </span>
  <div className="flex flex-col items-end gap-0.5">
    <span
      className="text-base sm:text-lg font-mono font-bold"
      style={{ color: FIREWOOD_COLORS.leveldb }}
    >
      ~16 TB
    </span>
    <span
      className={`text-[10px] font-mono ${colors.textMuted}`}
    >
      ~{formatUsd(costs.leveldb)} / node
    </span>
  </div>
</div>
```

- [ ] **Step 3: Add a cost annotation under the Firewood size label**

Find the matching Firewood row (search for `~3 TB`). Replace the inner `<span>~3 TB</span>` block with the same two-line pattern, using firewood color:

```tsx
<div className="flex items-baseline justify-between">
  <span
    className="text-[10px] font-mono uppercase tracking-[0.15em]"
    style={{ color: FIREWOOD_COLORS.firewood }}
  >
    Firewood
  </span>
  <div className="flex flex-col items-end gap-0.5">
    <span
      className="text-base sm:text-lg font-mono font-bold"
      style={{ color: FIREWOOD_COLORS.firewood }}
    >
      ~3 TB
    </span>
    <span
      className="text-[10px] font-mono"
      style={{ color: `${FIREWOOD_COLORS.firewood}B0` }}
    >
      ~{formatUsd(costs.firewood)} / node
    </span>
  </div>
</div>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: Exit code `0`.

- [ ] **Step 5: Commit**

```bash
git add components/firewood/ArchivalFootprintCard.tsx
git commit -m "feat(docs): annotate archival bars with per-node USD cost"
```

---

## Task 3: Enhance the delta badge with per-node savings

**Files:**
- Modify: `components/firewood/ArchivalFootprintCard.tsx`

- [ ] **Step 1: Replace the delta badge block**

Find the existing `motion.span` that renders `~{RATIO}× smaller`. Replace the entire badge-and-source footer block with a version that adds the dollar savings alongside the ratio:

```tsx
<div
  className="flex items-center justify-between gap-3 pt-4 mt-auto"
  style={{ borderTop: `1px solid ${colors.stroke}10` }}
>
  <motion.div
    className="flex flex-col gap-1"
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 4 }}
    transition={{ delay: 1.3, duration: 0.3 }}
  >
    <span
      className="text-xs font-mono font-bold px-2.5 py-1 self-start"
      style={{
        backgroundColor: `${FIREWOOD_COLORS.disk}20`,
        color: FIREWOOD_COLORS.disk,
        border: `1px solid ${FIREWOOD_COLORS.disk}40`,
      }}
    >
      ~{RATIO}× smaller
    </span>
    <span
      className="text-[10px] font-mono"
      style={{ color: FIREWOOD_COLORS.disk }}
    >
      ~{formatUsd(costs.savings)} saved / node ({costs.savingsPct}%)
    </span>
  </motion.div>
  <span className={`text-[9px] sm:text-[10px] font-mono ${colors.textFaint} text-right`}>
    Storage: Firewood engineering team · Cost: mid-tier NVMe Gen 4 at ~${PRICE_PER_TB_USD}/TB
  </span>
</div>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: Exit code `0`.

- [ ] **Step 3: Commit**

```bash
git add components/firewood/ArchivalFootprintCard.tsx
git commit -m "feat(docs): surface per-node cost savings in delta badge"
```

---

## Task 4: Update the InfoTooltip to explain the pricing model

**Files:**
- Modify: `components/firewood/ArchivalFootprintCard.tsx`

- [ ] **Step 1: Replace the tooltip text**

Find the existing `<InfoTooltip colors={colors} text="...">`. Replace the `text` prop value with a version that mentions the hardware cost assumption:

```tsx
<InfoTooltip
  colors={colors}
  text={`Archival nodes retain the full state history of the chain. Because Firewood stores the Merkle trie directly and reclaims space inline through the Future-Delete Log, the archival footprint is dramatically smaller — roughly 3 TB on Firewood versus ~16 TB on LevelDB for C-Chain. Cost figures assume mid-tier NVMe Gen 4 SSDs at ~$${PRICE_PER_TB_USD}/TB (April 2026 retail for drives like Samsung 990 Pro or WD Black SN850X at 2–4 TB capacity). Storage numbers sourced from the Firewood engineering team.`}
/>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: Exit code `0`.

- [ ] **Step 3: Commit**

```bash
git add components/firewood/ArchivalFootprintCard.tsx
git commit -m "docs(firewood): explain NVMe cost model in tooltip"
```

---

## Task 5: Verify in the browser

**Files:** none (read-only verification)

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: Exit code `0`, no errors.

- [ ] **Step 2: Confirm the dev server is up**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/docs/primary-network/firewood`
Expected: `200`.

If the server is not running, start it: `pnpm dev` (in another terminal) and wait for ready.

- [ ] **Step 3: Manual visual check**

Open `http://localhost:3000/docs/primary-network/firewood` in a browser. Scroll to **Section 04 — The Payoff**. In the **Archival footprint** card, verify all of the following:

- [ ] LevelDB bar shows `~16 TB` on line 1 and `~$1,920 / node` on line 2 below it, right-aligned, muted-grey small font.
- [ ] Firewood bar shows `~3 TB` on line 1 and `~$360 / node` on line 2 below it, rust-coloured to match the brand.
- [ ] Delta badge reads `~5.3× smaller` on the first line and `~$1,560 saved / node (81%)` on the second line, both in the disk-green accent.
- [ ] Footnote bottom-right reads: `Storage: Firewood engineering team · Cost: mid-tier NVMe Gen 4 at ~$120/TB`.
- [ ] InfoTooltip (hover the "i" icon) now mentions the NVMe Gen 4 mid-tier assumption and the $120/TB figure.
- [ ] Toggle dark/light theme — both colour schemes remain legible.
- [ ] At mobile width (≤640 px, use DevTools responsive at 375 px), the two-line labels still fit without overflow; bars still animate on scroll-into-view.

- [ ] **Step 4: Console sanity**

In DevTools → Console, confirm no new errors or React warnings originating from `ArchivalFootprintCard` after scrolling to the card and toggling the theme once.

- [ ] **Step 5: Done**

No commit — verification only.

---

## Self-Review Notes

**Spec coverage:**
- User asked for "cost saving in the archival footprint" — covered by Tasks 2, 3 (bar annotation + badge).
- "Not just display the dimension but also the cost saved" — covered by the badge showing both dimension (`~5.3× smaller`) and cost (`~$975 saved`).
- "Assume nvme disks gen 4 with mid tier for calculating the costs per TB saved" — Task 1 locks the assumption into `PRICE_PER_TB_USD = 75` with inline rationale; Task 4 re-states it in the tooltip; Task 3 prints it in the footnote.

**Placeholder scan:** No TBDs, no "TODO", no handwaved error handling. Every step ships code.

**Type consistency:**
- `computeArchivalCosts` returns `{ leveldb, firewood, savings, savingsPct }` — fields are used under those exact names in Tasks 2 and 3.
- `formatUsd` called with `costs.leveldb`, `costs.firewood`, `costs.savings` — all three are `number` per the interface.
- `PRICE_PER_TB_USD` referenced in Tasks 3 and 4 as a plain number in a template literal — consistent.

**Non-goals checked:**
- No attempt to multiply by a node-count (we don't have a reliable archival-node population figure; per-node framing is the honest one).
- No cloud pricing branch — user specified NVMe hardware, and mixing cloud/bare-metal would muddy the comparison.
