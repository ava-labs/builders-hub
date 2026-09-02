import { describe, expect, it, vi } from 'vitest';
import { aggregateWithRetry, classifyAggregationError } from './aggregationRetry';

function statusError(statusCode: number, message: string): Error {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

describe('classifyAggregationError', () => {
  it('classifies the aggregator threshold message as below-quorum and retryable', () => {
    const result = classifyAggregationError(new Error('failed to connect to a threshold of stake'));
    expect(result.kind).toBe('below-quorum');
    expect(result.retryable).toBe(true);
    expect(result.achievedPercent).toBeUndefined();
  });

  it('extracts the achieved percentage from the signature-weight message', () => {
    const result = classifyAggregationError(new Error('signature weight is insufficient: 67*200 > 100*100'));
    expect(result.kind).toBe('below-quorum');
    expect(result.retryable).toBe(true);
    expect(result.achievedPercent).toBe(50);
  });

  it('classifies network failures as transient', () => {
    const result = classifyAggregationError(new TypeError('Failed to fetch'));
    expect(result.kind).toBe('transient');
    expect(result.retryable).toBe(true);
  });

  it('classifies our attempt timeout as transient but NOT retryable (the request may still be in flight)', () => {
    const result = classifyAggregationError(new Error('signature aggregation attempt timed out after 60s'));
    expect(result.kind).toBe('transient');
    expect(result.retryable).toBe(false);
  });

  it('classifies 5xx responses as transient', () => {
    const result = classifyAggregationError(statusError(500, 'Internal Server Error'));
    expect(result.kind).toBe('transient');
    expect(result.retryable).toBe(true);
  });

  it('classifies 4xx responses as invalid-request and not retryable', () => {
    const result = classifyAggregationError(statusError(400, 'invalid hex string'));
    expect(result.kind).toBe('invalid-request');
    expect(result.retryable).toBe(false);
  });

  it('leaves unrecognized errors as unknown and not retryable', () => {
    const result = classifyAggregationError(new Error('User rejected the request'));
    expect(result.kind).toBe('unknown');
    expect(result.retryable).toBe(false);
  });
});

describe('aggregateWithRetry', () => {
  it('retries retryable failures with the configured delays and succeeds', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onAttempt = vi.fn();
    let calls = 0;
    const run = vi.fn().mockImplementation(() => {
      calls += 1;
      if (calls < 3) return Promise.reject(new Error('failed to connect to a threshold of stake'));
      return Promise.resolve('signed');
    });

    const result = await aggregateWithRetry(run, { onAttempt, sleep });

    expect(result).toBe('signed');
    expect(run).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([5000, 10000]);
    expect(onAttempt.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [2, 4],
      [3, 4],
    ]);
  });

  it('throws immediately on a non-retryable error without sleeping', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const run = vi.fn().mockRejectedValue(statusError(400, 'invalid hex string'));

    await expect(aggregateWithRetry(run, { sleep })).rejects.toThrow('invalid hex string');
    expect(run).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('rethrows the last error after exhausting all attempts', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    let calls = 0;
    const run = vi.fn().mockImplementation(() => {
      calls += 1;
      return Promise.reject(new Error(`transient failure, fetch failed (${calls})`));
    });

    await expect(aggregateWithRetry(run, { sleep })).rejects.toThrow('transient failure, fetch failed (4)');
    expect(run).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([5000, 10000, 20000]);
  });

  it('honors a custom attempt budget', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const run = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(aggregateWithRetry(run, { attempts: 2, sleep })).rejects.toThrow('Failed to fetch');
    expect(run).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([5000]);
  });
});
