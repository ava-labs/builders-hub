import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA } from './explorer-page';

// The Fund Flow table shows a multisig UTXO's first owner and a "+8" chip. Hovering or tapping the chip opens a card
// with every owner, each with a copy button (components/explorer-v2/pchain/utxo-ledger.tsx). The tx is a past mainnet
// tx whose three outputs are owned 5 of 9.
const TX = 'txV7PMua148QA8mP6p6kG5fi1PRkgV6DxX4ESyz9u8L4HNpH2';
const OWNERS = [
  'avax1pc8td7945eve3p56a2k3lw520hq0tmpmgrj0cn',
  'avax1f0duw2sc3f3a7au57pdvg92vzd6j07dx5lxt9s',
  'avax1f3kln6zel3yw78ydqppc34g2l5x6v6r8cmqy2t',
  'avax1fuzm277erekxjrakauny5kcyerm9knfg6wdy77',
  'avax1wh07sssej6knsfdj2rrkm4apygcgy2nz7e3m0d',
  'avax1s06hu38aksmjqjsz4reuvnz7zvfh0yce7jy2q4',
  'avax1jn79svz8xf7dhehlzdv5ccg3tsj7fhf0wagfxg',
  'avax1kcaje6jht84qkmdg9z6nset4s5fax524dkd2t9',
  'avax1u944mtcdzl56qzz4uv6m8wwsq3su9zy0aezl42',
];

test('p-chain tx table opens every owner of a multisig utxo from its chip', async ({ app, screen }) => {
  await app.open(`/explorer/mainnet/p-chain/tx/${TX}`);
  await screen.getByRole('button', 'Table').click(DATA);
  // the row itself shows the first owner, as truncate(address, 10) writes it, and the chip
  await expect(screen.getByRole('link', 'avax1pc8td…j0cn')).toHaveCount(3, DATA);
  await expect(screen.getByRole('link', 'avax1u944m…zl42')).toHaveCount(0);
  const chips = screen.getByRole('button', `All ${OWNERS.length} owners`);
  await expect(chips).toHaveCount(3);
  await expect(chips.first()).toHaveText('+8');
  await chips.first().click();
  const card = screen.getByRole('dialog', 'Owners');
  await expect(card).toBeVisible();
  await expect(card.getByText('5 of 9 to sign')).toBeVisible();
  for (const owner of OWNERS) await expect(card.getByRole('link', owner)).toBeVisible();
  await expect(card.getByRole('button', 'Copy')).toHaveCount(OWNERS.length);
});
