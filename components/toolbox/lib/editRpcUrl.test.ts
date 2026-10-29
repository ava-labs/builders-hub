import { describe, expect, it } from 'vitest';
import { decideRpcEdit, validateRpcUrlInput } from './editRpcUrl';

describe('validateRpcUrlInput', () => {
  it('rejects empty input', () => {
    expect(validateRpcUrlInput('   ')).toMatch(/enter/i);
  });

  it('rejects non-URL garbage', () => {
    expect(validateRpcUrlInput('not a url')).toMatch(/valid URL/i);
  });

  it('rejects non-http schemes', () => {
    expect(validateRpcUrlInput('ws://localhost:9650/ext/bc/C/ws')).toMatch(/http/i);
  });

  it('accepts http and https URLs', () => {
    expect(validateRpcUrlInput('http://localhost:9650/ext/bc/abc/rpc')).toBeNull();
    expect(validateRpcUrlInput('https://node.example.com/ext/bc/abc/rpc')).toBeNull();
  });
});

describe('decideRpcEdit', () => {
  it('saves without friction when preflight passes', () => {
    expect(decideRpcEdit({ ok: true, chainId: 10637 }, 10637)).toEqual({
      save: true,
      allowForce: false,
      message: null,
    });
  });

  it('never allows forcing a chain-identity mismatch', () => {
    const decision = decideRpcEdit({ ok: false, reason: 'chain-mismatch', actualChainId: 43113 }, 10637);
    expect(decision.save).toBe(false);
    expect(decision.allowForce).toBe(false);
    expect(decision.message).toContain('43113');
    expect(decision.message).toContain('10637');
  });

  it('allows forcing an unreachable endpoint and surfaces the detail', () => {
    const decision = decideRpcEdit({ ok: false, reason: 'unreachable', detail: 'fetch failed' }, 10637);
    expect(decision.save).toBe(false);
    expect(decision.allowForce).toBe(true);
    expect(decision.message).toContain('fetch failed');
  });

  it('allows forcing past a mixed-content block and points at the proxy fix', () => {
    const decision = decideRpcEdit({ ok: false, reason: 'mixed-content-blocked' }, 10637);
    expect(decision.allowForce).toBe(true);
    expect(decision.message).toMatch(/reverse proxy/i);
  });

  it('allows forcing a non-RPC response', () => {
    const decision = decideRpcEdit({ ok: false, reason: 'bad-response', detail: 'HTTP 404' }, 10637);
    expect(decision.allowForce).toBe(true);
    expect(decision.message).toContain('HTTP 404');
  });
});
