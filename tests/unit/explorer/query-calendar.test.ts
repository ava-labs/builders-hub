import { describe, expect, it } from 'vitest';
import { pchainPrompt, systemPrompt } from '@/lib/explorer-query/prompt';

// a worked example's date near today reads as this week's to a writer, which then copies it into its note
const calendarOf = (prompt: string) => prompt.split('\n').find((l) => l.startsWith('- Calendar words')) ?? '';
const datesOf = (line: string) => [...line.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => Date.parse(`${m[1]}T00:00:00Z`));
const YEAR = 365 * 86_400_000;

describe('the calendar rule', () => {
  it('writes its worked examples with dates years from today on mainnet', () => {
    const prompts = [
      systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null }),
      systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null, dex: true }),
      systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null, lending: true }),
      pchainPrompt({ chainId: 1, network: 'Mainnet', schema: '', coverage: null }),
    ];
    for (const prompt of prompts) {
      const line = calendarOf(prompt);
      expect(line).toContain('the week of Monday March 7, 2022 is');
      expect(datesOf(line).length).toBe(3);
      for (const d of datesOf(line)) expect(Math.abs(Date.now() - d)).toBeGreaterThan(2 * YEAR);
    }
  });

  it('leaves Fuji\'s as it was', () => {
    const line = calendarOf(systemPrompt({ chainId: 43113, chainName: 'Avalanche C-Chain (Fuji)', symbol: 'AVAX', schema: '', coverage: null }));
    expect(line).toMatch(/^- Calendar words are calendar windows: "today" starts at toStartOfDay\(now\(\)\)/);
    expect(datesOf(line)).toEqual([]);
  });
});
