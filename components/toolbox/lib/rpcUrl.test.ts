import { describe, expect, it } from 'vitest';
import {
  buildNodeRpcUrl,
  classifyRpcUrlForPage,
  isLoopbackHost,
  isValidIPv4,
  nipify,
  rpcUrlsEquivalent,
} from './rpcUrl';

const BLOCKCHAIN_ID = '2JJ8JguUJGNe9EKu9kapWftJ63TxKLsP4QexVjMfJmA7XSeXvk';

describe('nipify', () => {
  it('appends .nip.io to a bare IPv4', () => {
    expect(nipify('18.222.144.186')).toBe('18.222.144.186.nip.io');
  });

  it('passes a domain through unchanged', () => {
    expect(nipify('node.example.com')).toBe('node.example.com');
  });
});

describe('isValidIPv4', () => {
  it('accepts a dotted quad and rejects out-of-range octets', () => {
    expect(isValidIPv4('18.222.144.186')).toBe(true);
    expect(isValidIPv4('256.1.1.1')).toBe(false);
    expect(isValidIPv4('example.com')).toBe(false);
  });
});

describe('isLoopbackHost', () => {
  it('recognizes localhost, 127.x, and IPv6 loopback', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('127.1.2.3')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
    expect(isLoopbackHost('18.222.144.186')).toBe(false);
    expect(isLoopbackHost('node.example.com')).toBe(false);
  });
});

describe('buildNodeRpcUrl', () => {
  it('builds the localhost URL for a local node', () => {
    expect(buildNodeRpcUrl({ location: 'local', domain: '', blockchainId: BLOCKCHAIN_ID })).toBe(
      `http://localhost:9650/ext/bc/${BLOCKCHAIN_ID}/rpc`,
    );
  });

  it('builds the nipified https URL for a remote node with an IP', () => {
    expect(buildNodeRpcUrl({ location: 'remote', domain: '18.222.144.186', blockchainId: BLOCKCHAIN_ID })).toBe(
      `https://18.222.144.186.nip.io/ext/bc/${BLOCKCHAIN_ID}/rpc`,
    );
  });

  it('uses a domain as-is for a remote node', () => {
    expect(buildNodeRpcUrl({ location: 'remote', domain: 'node.example.com', blockchainId: BLOCKCHAIN_ID })).toBe(
      `https://node.example.com/ext/bc/${BLOCKCHAIN_ID}/rpc`,
    );
  });

  it('returns null for a remote node without a domain: there is no correct URL to invent', () => {
    expect(buildNodeRpcUrl({ location: 'remote', domain: '', blockchainId: BLOCKCHAIN_ID })).toBeNull();
    expect(buildNodeRpcUrl({ location: 'remote', domain: '   ', blockchainId: BLOCKCHAIN_ID })).toBeNull();
  });
});

describe('classifyRpcUrlForPage', () => {
  it('always allows https URLs', () => {
    expect(classifyRpcUrlForPage('https://18.222.144.186.nip.io/ext/bc/x/rpc', 'https:')).toBe('ok');
  });

  it('allows http loopback from an https page (trustworthy origin, not mixed content)', () => {
    expect(classifyRpcUrlForPage('http://localhost:9650/ext/bc/x/rpc', 'https:')).toBe('loopback-http');
    expect(classifyRpcUrlForPage('http://127.0.0.1:9650/ext/bc/x/rpc', 'https:')).toBe('loopback-http');
    expect(classifyRpcUrlForPage('http://[::1]:9650/ext/bc/x/rpc', 'https:')).toBe('loopback-http');
  });

  it('flags http on a remote host from an https page as mixed content', () => {
    expect(classifyRpcUrlForPage('http://18.222.144.186:9650/ext/bc/x/rpc', 'https:')).toBe('mixed-content');
    expect(classifyRpcUrlForPage('http://node.example.com:9650/ext/bc/x/rpc', 'https:')).toBe('mixed-content');
  });

  it('allows http remote hosts from an http page (local dev)', () => {
    expect(classifyRpcUrlForPage('http://18.222.144.186:9650/ext/bc/x/rpc', 'http:')).toBe('ok');
  });

  it('rejects garbage and non-http(s) schemes', () => {
    expect(classifyRpcUrlForPage('not a url', 'https:')).toBe('invalid');
    expect(classifyRpcUrlForPage('ftp://host/rpc', 'https:')).toBe('invalid');
  });
});

describe('rpcUrlsEquivalent', () => {
  it('normalizes trailing slash, case, and whitespace', () => {
    expect(rpcUrlsEquivalent('https://Host.example/ext/bc/X/rpc/', ' https://host.example/ext/bc/X/rpc ')).toBe(true);
  });

  it('distinguishes scheme, host, and path differences', () => {
    expect(rpcUrlsEquivalent('http://host.example/rpc', 'https://host.example/rpc')).toBe(false);
    expect(rpcUrlsEquivalent('https://a.example/rpc', 'https://b.example/rpc')).toBe(false);
    expect(rpcUrlsEquivalent('https://host.example/ext/bc/X/rpc', 'https://host.example/ext/bc/Y/rpc')).toBe(false);
  });

  it('preserves case sensitivity of the path (blockchain IDs are case-sensitive)', () => {
    expect(rpcUrlsEquivalent('https://host.example/ext/bc/abc/rpc', 'https://host.example/ext/bc/ABC/rpc')).toBe(false);
  });

  it('falls back to trimmed string equality for unparseable values', () => {
    expect(rpcUrlsEquivalent('not a url', 'not a url ')).toBe(true);
    expect(rpcUrlsEquivalent('not a url', 'other')).toBe(false);
  });
});
