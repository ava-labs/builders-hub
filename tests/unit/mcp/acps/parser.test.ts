import { describe, expect, it } from 'vitest';

import { parseAcpDocument, normalizeStatus, normalizeTracks } from '@/lib/mcp/acps/parser';

const acp103 = `---
title: "ACP-103: Dynamic Fees"
description: "Details for Avalanche Community Proposal 103: Dynamic Fees"
edit_url: https://github.com/avalanche-foundation/ACPs/edit/main/ACPs/103-dynamic-fees/README.md
---

| ACP | 103 |
| :--- | :--- |
| **Title** | Add Dynamic Fees to the P-Chain |
| **Author(s)** | Dhruba Basu ([@dhrubabasu](https://github.com/dhrubabasu)), Alberto Benegiamo ([@abi87](https://github.com/abi87)) |
| **Status** | Activated ([Discussion](https://github.com/avalanche-foundation/ACPs/discussions/104)) |
| **Track** | Standards |

## Abstract

Introduce a dynamic fee mechanism to the P-Chain.
`;

const acp13 = `---
title: "ACP-13: Subnet Only Validators"
---

| ACP | 13 |
| :--- | :--- |
| **Title** | Subnet-Only Validators (SOVs) |
| **Author(s)** | Patrick O'Grady |
| **Status** | Stale |
| **Track** | Standards |
| **Superseded-By** | [ACP-77](https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/77-reinventing-subnets/README.md) |
`;

const acp131 = `---
title: "ACP-131: Cancun Eips"
---

| ACP | 131 |
| :--- | :--- |
| **Title** | Activate Cancun EIPs on C-Chain and Subnet-EVM chains |
| **Author(s)** | Darioush Jalali |
| **Status** | Activated ([Discussion](https://github.com/avalanche-foundation/ACPs/discussions/139)) |
| **Track** | Standards, Subnet |
`;

const acp77 = `---
title: "ACP-77: Reinventing Subnets"
---

| ACP           | 77                                                                                        |
| :------------ | :---------------------------------------------------------------------------------------- |
| **Title**     | Reinventing Subnets                                                                       |
| **Author(s)** | Dhruba Basu ([@dhrubabasu](https://github.com/dhrubabasu))                                |
| **Status**    | Activated                                                                                 |
| **Track**     | Standards                                                                                 |
| **Replaces**  | [ACP-13](https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/13-subnet-only-validators/README.md)                                          |
`;

function expectParsed(content: string, url: string) {
  const parsed = parseAcpDocument(content, url);
  expect(parsed).not.toBeNull();
  return parsed!;
}

describe('parseAcpDocument', () => {
  it('extracts number, title, status, track, and authors from ACP-103', () => {
    const parsed = expectParsed(acp103, '/docs/acps/103-dynamic-fees');

    expect(parsed.number).toBe(103);
    expect(parsed.title).toBe('Add Dynamic Fees to the P-Chain');
    expect(parsed.status).toBe('Activated');
    expect(parsed.tracks).toEqual(['Standards']);
    expect(parsed.authors).toContain('Dhruba Basu');
    expect(parsed.authors).toContain('Alberto Benegiamo');
    expect(parsed.url).toBe('/docs/acps/103-dynamic-fees');
  });

  it('extracts the Superseded-By reference for ACP-13', () => {
    const parsed = expectParsed(acp13, '/docs/acps/13-subnet-only-validators');

    expect(parsed.number).toBe(13);
    expect(parsed.status).toBe('Stale');
    expect(parsed.supersededBy).toEqual([77]);
  });

  it('extracts the Replaces reference for ACP-77', () => {
    const parsed = expectParsed(acp77, '/docs/acps/77-reinventing-subnets');

    expect(parsed.number).toBe(77);
    expect(parsed.replaces).toEqual([13]);
    expect(parsed.tracks).toEqual(['Standards']);
  });

  it('splits comma-separated tracks for ACP-131', () => {
    const parsed = expectParsed(acp131, '/docs/acps/131-cancun-eips');

    expect(parsed.tracks).toEqual(['Standards', 'Subnet']);
  });

  it('falls back to URL when number cannot be parsed from the table', () => {
    const incomplete = `---\ntitle: "ACP-256: Hardware"\n---\n\nNo table here.`;
    const parsed = expectParsed(incomplete, '/docs/acps/256-hardware-recommendations');

    expect(parsed.number).toBe(256);
    expect(parsed.title).toBe('Hardware');
    expect(parsed.status).toBe('Unknown');
  });

  it('returns null when no ACP number can be derived from anywhere', () => {
    const noNumber = `---\ntitle: "Just a doc"\n---\n\nNo table, no number.`;
    expect(parseAcpDocument(noNumber, '/docs/acps/index')).toBeNull();
  });
});

describe('normalizeStatus', () => {
  it('maps known status keywords case-insensitively', () => {
    expect(normalizeStatus('Activated ([Discussion](url))')).toBe('Activated');
    expect(normalizeStatus('proposed')).toBe('Proposed');
    expect(normalizeStatus('IMPLEMENTABLE')).toBe('Implementable');
    expect(normalizeStatus('  stale  ')).toBe('Stale');
    expect(normalizeStatus('withdrawn')).toBe('Withdrawn');
  });

  it('returns Unknown for unrecognized values', () => {
    expect(normalizeStatus('')).toBe('Unknown');
    expect(normalizeStatus('something else')).toBe('Unknown');
  });
});

describe('normalizeTracks', () => {
  it('splits and trims comma-separated tracks', () => {
    expect(normalizeTracks('Standards, Subnet')).toEqual(['Standards', 'Subnet']);
    expect(normalizeTracks('Best Practices Track')).toEqual(['Best Practices']);
    expect(normalizeTracks('Meta')).toEqual(['Meta']);
  });

  it('returns an empty array for empty input', () => {
    expect(normalizeTracks('')).toEqual([]);
  });
});
