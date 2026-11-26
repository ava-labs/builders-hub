import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validatePublicRpcUrl } from '@/app/api/console/l1-upgrade/rpc-utils';

/* The server fetches an RPC URL that a caller names only when the host is public. */

beforeEach(() => vi.stubEnv('NODE_ENV', 'production'));
afterEach(() => vi.unstubAllEnvs());

describe('validatePublicRpcUrl', () => {
  it('takes a public host', () => {
    for (const url of [
      'https://api.avax-test.network/ext/bc/C/rpc',
      'http://203.0.113.9:9650/ext/bc/C/rpc',
      'https://[2606:4700:4700::1111]/rpc',
      'https://fd-example.com/rpc',
    ]) {
      expect(validatePublicRpcUrl(url), url).toBeNull();
    }
  });

  it('refuses a local, private or link-local host, in IPv4 and in IPv6', () => {
    for (const url of [
      'http://localhost:9650/rpc',
      'http://127.0.0.1/rpc',
      'http://10.1.2.3/rpc',
      'http://192.168.1.1/rpc',
      'http://172.16.0.1/rpc',
      'http://169.254.169.254/latest/meta-data',
      'http://100.64.0.1/rpc',
      'http://metadata.google.internal/rpc',
      'http://[::1]/rpc',
      'http://[::]/rpc',
      'http://[::ffff:169.254.169.254]/rpc',
      'http://[::127.0.0.1]/rpc',
      'http://[fe80::1]/rpc',
      'http://[febf::1]/rpc',
      'http://[fc00::1]/rpc',
      'http://[fd12:3456::1]/rpc',
      'http://[64:ff9b::a9fe:a9fe]/rpc',
    ]) {
      expect(validatePublicRpcUrl(url), url).not.toBeNull();
    }
  });

  it('refuses a URL that is not http or https', () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.com/x', 'not a url', '']) {
      expect(validatePublicRpcUrl(url), url).not.toBeNull();
    }
  });
});
