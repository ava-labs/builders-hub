import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA } from './explorer-page';

// The Fund Flow table lists every owner of a multisig UTXO on its own line, each with a copy button
// (components/explorer-v2/pchain/utxo-ledger.tsx). The tx is a past mainnet tx whose three outputs are owned 5 of 9.
const TX = 'txV7PMua148QA8mP6p6kG5fi1PRkgV6DxX4ESyz9u8L4HNpH2';
// the nine owners as truncate(address, 10) writes them
const OWNERS = [
  'avax1pc8td…j0cn',
  'avax1f0duw…xt9s',
  'avax1f3kln…qy2t',
  'avax1fuzm2…dy77',
  'avax1wh07s…3m0d',
  'avax1s06hu…y2q4',
  'avax1jn79s…gfxg',
  'avax1kcaje…d2t9',
  'avax1u944m…zl42',
];

test('p-chain tx table shows every owner of a multisig utxo', async ({ app, screen, browser }) => {
  await app.open(`/explorer/mainnet/p-chain/tx/${TX}`);
  await screen.getByRole('button', 'Table').click(DATA);
  for (const owner of OWNERS) await expect(screen.getByRole('link', owner)).toHaveCount(3, DATA);
  // each owner of the first output sits on a line below the one before it, not clipped onto one line.
  // One read of the page, so a layout shift between reads cannot move the lines.
  const tops = await browser.evaluate(
    (owners) =>
      owners.map((owner) => {
        const link = [...document.querySelectorAll('a')].find((a) => a.textContent === owner);
        const box = link?.getBoundingClientRect();
        return box ? [box.top, box.bottom] : null;
      }),
    OWNERS,
  );
  for (const [i, line] of tops.entries()) {
    expect(line).not.toBeNull();
    const prev = tops[i - 1];
    if (prev && line) expect(line[0]).toBeGreaterThanOrEqual(prev[1]);
  }
});
