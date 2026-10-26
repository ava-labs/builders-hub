import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GAS_TRACER, TRACE_TIMEOUT, gasProfile, gasTracer, type GasTracerResult } from '@/lib/debug-trace';
import { RedisFake } from './redis-fake';

/* The Gas tab's opcode table and the gas split come from a JS tracer that
   the debug node runs at every opcode step (GAS_TRACER). It must keep a
   fixed set of numbers, whatever the step count, and give the numbers the
   struct log gave. Here the tracer source runs in node:vm on made-up step
   logs, with the step values libevm logs; the node URL and the hashes are
   made up, and fetch is stubbed, so no test reaches a node. */

type Step = [op: string, code: number, gas: number, cost: number, depth: number];

/** what the node's ctx holds of the tx (the fields the tracer reads), and
 *  the code at the target, which the tracer reads from the state */
type Ctx = { gas: number; gasUsed: number; type?: 'CALL' | 'CREATE'; error?: string; to?: Uint8Array; output?: Uint8Array; code?: Uint8Array };

/** an address as the node's ctx holds it, from its last byte */
const address = (last: number) => Uint8Array.from({ length: 20 }, (_, i) => (i === 19 ? last : 0));
/** the precompiles at 0x01 to 0x09, as libevm's isPrecompiled reads them */
const isPrecompiled = (a: Uint8Array) => a.slice(0, 19).every((b) => b === 0) && a[19] >= 1 && a[19] <= 9;

/** the tracer as the node builds it: the source as one expression, with
 *  the node's isPrecompiled in scope */
function newTracer() {
  return runInNewContext(`(${GAS_TRACER})`, { isPrecompiled }) as {
    step(log: unknown): void;
    fault(log: unknown): void;
    result(ctx: Ctx, db: { getCode(a: Uint8Array): Uint8Array }): unknown;
    [field: string]: unknown;
  };
}

/** a step log with the methods the tracer calls; names counts op.toString() calls */
function logOf([op, code, gas, cost, depth]: Step, names: { calls: number }) {
  return {
    op: {
      toNumber: () => code,
      toString: () => {
        names.calls++;
        return op;
      },
    },
    getGas: () => gas,
    getCost: () => cost,
    getDepth: () => depth,
  };
}

/** the tracer's answer for these steps, as JSON, the way the node sends
 *  it. By default the tx calls an account with no code, with no error */
function run(steps: Step[], { code = new Uint8Array(), ...ctx }: Ctx): GasTracerResult {
  const t = newTracer();
  const names = { calls: 0 };
  for (const s of steps) t.step(logOf(s, names));
  const full = { type: 'CALL', to: address(0xaa), output: new Uint8Array(), ...ctx };
  return JSON.parse(JSON.stringify(t.result(full, { getCode: () => code })));
}

/** what the trace route computed from the struct log before #4802
 *  (aab88fa6f), to hold the tracer to the same numbers */
function fromStructLog(limit: number, gasUsed: number, logs: { op: string; gas: number; gasCost: number; depth: number }[]) {
  const agg = new Map<string, { gas: number; count: number }>();
  for (const s of logs) {
    const a = agg.get(s.op) ?? { gas: 0, count: 0 };
    a.gas += s.gasCost;
    a.count++;
    agg.set(s.op, a);
  }
  const opcodes = [...agg.entries()].map(([op, v]) => ({ op, ...v })).sort((a, b) => b.gas - a.gas);
  const top = logs.filter((l) => l.depth === 1);
  let gas = null;
  if (top.length && limit) {
    const first = top[0];
    const last = top[top.length - 1];
    const intrinsic = limit - first.gas;
    const execution = first.gas - (last.gas - last.gasCost);
    const before = intrinsic + execution;
    const used = gasUsed > 0 && gasUsed <= before ? gasUsed : before;
    gas = { limit, intrinsic, execution, refund: before - used, used };
  }
  return { opcodes, steps: logs.length, gas };
}

// A call: two pushes and a store at depth 1, a CALL into a contract that
// runs three steps at depth 2, then two more steps at depth 1. The limit is
// 100,000 and intrinsic gas 21,640, so the first top-level step has 78,360.
const LIMIT = 100_000;
const STEPS: Step[] = [
  ['PUSH1', 0x60, 78_360, 3, 1],
  ['PUSH1', 0x60, 78_357, 3, 1],
  ['SSTORE', 0x55, 78_354, 22_100, 1],
  ['CALL', 0xf1, 56_254, 30_000, 1],
  ['PUSH1', 0x60, 29_000, 3, 2],
  ['ADD', 0x01, 28_997, 3, 2],
  ['STOP', 0x00, 28_994, 0, 2],
  ['PUSH1', 0x60, 55_000, 3, 1],
  ['STOP', 0x00, 54_997, 0, 1],
];
// intrinsic 21,640 plus execution 78,360 - 54,997
const USED = 21_640 + 23_363;
const structLog = (steps: Step[]) => steps.map(([op, , gas, gasCost, depth]) => ({ op, gas, gasCost, depth }));

describe('the gas tracer', () => {
  it('sums count and gas per opcode at every depth, in the order each first ran', () => {
    const r = run(STEPS, { gas: LIMIT, gasUsed: USED });
    expect(r.limit).toBe(LIMIT);
    expect(r.used).toBe(USED);
    expect(r.steps).toBe(9);
    expect(r.ops).toEqual([
      { op: 'PUSH1', count: 4, gas: 12 },
      { op: 'SSTORE', count: 1, gas: 22_100 },
      { op: 'CALL', count: 1, gas: 30_000 },
      { op: 'ADD', count: 1, gas: 3 },
      { op: 'STOP', count: 2, gas: 0 },
    ]);
  });

  it('keeps the first top-level step gas, and the last top-level step gas and cost, past the depth-2 steps', () => {
    expect(run(STEPS, { gas: LIMIT, gasUsed: USED }).top).toEqual({ first: 78_360, last: 54_997, cost: 0 });
    // a call whose last step is deeper than 1: the last depth-1 step still counts
    const deeper: Step[] = [...STEPS.slice(0, 7)];
    expect(run(deeper, { gas: LIMIT, gasUsed: USED }).top).toEqual({ first: 78_360, last: 56_254, cost: 30_000 });
  });

  it('keeps the same fields and at most one entry per opcode, however many steps run', () => {
    const t = newTracer();
    const fields = Object.keys(t).sort();
    const names = { calls: 0 };
    const loop: Step[] = [
      ['JUMPDEST', 0x5b, 0, 1, 1],
      ['PUSH1', 0x60, 0, 3, 2],
      ['MLOAD', 0x51, 0, 3, 3],
      ['JUMP', 0x56, 0, 8, 1],
    ];
    for (let i = 0; i < 200_000; i++) {
      const [op, code, , cost, depth] = loop[i % loop.length];
      t.step(logOf([op, code, 1_000_000 - i, cost, depth], names));
    }
    expect(Object.keys(t).sort()).toEqual(fields);
    for (const f of ['count', 'cost', 'name']) expect((t[f] as unknown[]).length).toBeLessThanOrEqual(256);
    expect(t.seen).toHaveLength(4);
    // an opcode's name is read once, not at every step
    expect(names.calls).toBe(4);
    expect(t.steps).toBe(200_000);
    const r = JSON.parse(JSON.stringify(t.result({ gas: 2_000_000, gasUsed: 1_100_000 }))) as GasTracerResult;
    expect(r.ops).toEqual([
      { op: 'JUMPDEST', count: 50_000, gas: 50_000 },
      { op: 'PUSH1', count: 50_000, gas: 150_000 },
      { op: 'MLOAD', count: 50_000, gas: 150_000 },
      { op: 'JUMP', count: 50_000, gas: 400_000 },
    ]);
  });

  it('answers no top-level step for a tx that runs no code, and whether it was a plain call', () => {
    expect(run([], { gas: 21_000, gasUsed: 21_000 })).toEqual({
      limit: 21_000,
      used: 21_000,
      steps: 0,
      ops: [],
      top: null,
      create: false,
      error: null,
      out: 0,
      plain: true,
    });
    // a precompile, a stateful one (warp: libevm does not list it, but its code is 0x01), a creation and a failed
    // call ran no opcode either, but spent gas that no step shows
    expect(run([], { gas: 50_000, gasUsed: 25_000, to: address(0x02) }).plain).toBe(false);
    expect(run([], { gas: 100_000, gasUsed: 64_000, to: address(0x05), code: Uint8Array.from([1]) }).plain).toBe(false);
    expect(run([], { gas: 60_000, gasUsed: 53_000, type: 'CREATE' }).plain).toBe(false);
    expect(run([], { gas: 50_000, gasUsed: 50_000, error: 'out of gas' }).plain).toBe(false);
  });

  it('reads the top call\'s kind, error and output from ctx', () => {
    const r = run(STEPS, { gas: LIMIT, gasUsed: LIMIT, type: 'CREATE', error: 'invalid opcode: INVALID', output: new Uint8Array(7) });
    expect([r.create, r.error, r.out, r.plain]).toEqual([true, 'invalid opcode: INVALID', 7, false]);
  });

  it('is sent with the node-side timeout', () => {
    expect(gasTracer()).toEqual({ tracer: GAS_TRACER, timeout: TRACE_TIMEOUT });
  });
});

describe('the gas profile', () => {
  it('gives the numbers the struct log gave for the same steps', () => {
    // PUSH1 and MLOAD tie on gas: the struct log kept them in the order they first ran, not by opcode number
    const ties: Step[] = Array.from({ length: 12 }, (_, i): Step => {
      const [op, code, cost] = ([['JUMPDEST', 0x5b, 1], ['PUSH1', 0x60, 3], ['MLOAD', 0x51, 3]] as const)[i % 3];
      return [op, code, 90_000 - i * 3, cost, 1];
    });
    for (const steps of [STEPS, STEPS.slice(0, 7), ties]) {
      // the gas the steps add up to, with a refund under it, and no figure at all
      const sum = fromStructLog(LIMIT, 0, structLog(steps)).gas!.used;
      for (const gasUsed of [sum, sum - 4_800, 0]) {
        expect(gasProfile(run(steps, { gas: LIMIT, gasUsed })), `${steps.length} steps, gas used ${gasUsed}`).toEqual(
          fromStructLog(LIMIT, gasUsed, structLog(steps)),
        );
      }
    }
  });

  it('sorts the opcodes by gas, the most first, ties in the order they first ran', () => {
    const p = gasProfile(run(STEPS, { gas: LIMIT, gasUsed: USED }));
    expect(p.opcodes!.map((o) => o.op)).toEqual(['CALL', 'SSTORE', 'PUSH1', 'ADD', 'STOP']);
    expect(p.steps).toBe(9);
    expect(p.gas).toEqual({ limit: LIMIT, intrinsic: 21_640, execution: 23_363, refund: 0, used: USED });
  });

  it('splits a plain call that ran no code: all its gas is intrinsic, the EVM\'s figure', () => {
    expect(gasProfile(run([], { gas: 21_000, gasUsed: 21_000 }))).toEqual({
      opcodes: [],
      steps: 0,
      gas: { limit: 21_000, intrinsic: 21_000, execution: 0, refund: 0, used: 21_000 },
    });
    // an access list is intrinsic gas too, and shows in the EVM's figure
    expect(gasProfile(run([], { gas: 30_000, gasUsed: 23_400 })).gas).toMatchObject({ intrinsic: 23_400, used: 23_400 });
  });

  it('gives no split where the steps cannot tell it exactly', () => {
    // charged half a 50,000 limit (ACP-194): the figure is the charge, and the access list is unknown
    expect(gasProfile(run([], { gas: 50_000, gasUsed: 25_000 })).gas).toBeNull();
    // a precompile's own gas, warp's included, cannot be told apart from intrinsic gas
    expect(gasProfile(run([], { gas: 50_000, gasUsed: 25_000, to: address(0x01) })).gas).toBeNull();
    expect(gasProfile(run([], { gas: 100_000, gasUsed: 64_000, to: address(0x05), code: Uint8Array.from([1]) })).gas).toBeNull();
  });

  it('counts the code a creation stores: 200 gas a byte, after its last step', () => {
    // intrinsic 150,000; the init code runs 200,000 and returns 5,000 bytes of code
    const limit = 2_000_000;
    const init: Step[] = [
      ['PUSH1', 0x60, 1_850_000, 3, 1],
      ['RETURN', 0xf3, 1_650_000, 0, 1],
    ];
    const output = new Uint8Array(5_000);
    const gas = { limit, intrinsic: 150_000, execution: 1_200_000, refund: 0, used: 1_350_000 };
    expect(gasProfile(run(init, { gas: limit, gasUsed: 1_350_000, type: 'CREATE', output })).gas).toEqual(gas);
    // charged half a 4,000,000 limit, it used the same
    const steps = init.map(([op, code, g, cost, depth]): Step => [op, code, g + 2_000_000, cost, depth]);
    expect(gasProfile(run(steps, { gas: 4_000_000, gasUsed: 2_000_000, type: 'CREATE', output })).gas).toEqual({ ...gas, limit: 4_000_000 });
    // a creation that reverts stores no code, whatever it returned
    const reverted = gasProfile(run(init, { gas: limit, gasUsed: 350_000, type: 'CREATE', error: 'execution reverted', output })).gas;
    expect(reverted).toEqual({ limit, intrinsic: 150_000, execution: 200_000, refund: 0, used: 350_000 });
  });

  it('counts the gas a halt burns: an error other than a revert takes all the gas left', () => {
    // libevm logs INVALID at cost 0, then burns the 78,354 left
    const invalid: Step[] = [...STEPS.slice(0, 2), ['INVALID', 0xfe, 78_354, 0, 1]];
    const halted = { limit: LIMIT, intrinsic: 21_640, execution: 78_360, refund: 0, used: LIMIT };
    expect(gasProfile(run(invalid, { gas: LIMIT, gasUsed: LIMIT, error: 'invalid opcode: INVALID' })).gas).toEqual(halted);
    // out of gas: the last step costs more than the gas left, and no refund appears
    const short: Step[] = [...STEPS.slice(0, 2), ['SLOAD', 0x54, 1_000, 2_100, 1]];
    expect(gasProfile(run(short, { gas: LIMIT, gasUsed: LIMIT, error: 'out of gas' })).gas).toEqual(halted);
  });

  it('gives back the gas a revert leaves', () => {
    const steps: Step[] = [...STEPS.slice(0, 2), ['REVERT', 0xfd, 70_000, 6, 1]];
    const { gas } = gasProfile(run(steps, { gas: LIMIT, gasUsed: 30_006, error: 'execution reverted' }));
    expect(gas).toEqual({ limit: LIMIT, intrinsic: 21_640, execution: 8_366, refund: 0, used: 30_006 });
  });

  it('takes the EVM\'s figure where it is more than the steps show and not the floor', () => {
    const { gas } = gasProfile(run(STEPS, { gas: LIMIT, gasUsed: USED + 1_000 }));
    expect(gas).toEqual({ limit: LIMIT, intrinsic: 21_640, execution: 24_363, refund: 0, used: USED + 1_000 });
  });

  it('gives the gas execution used for a tx charged half its limit', () => {
    // ACP-194: the receipt charges 500,000 of a 1,000,000 limit; execution used 45,003.
    // The EVM may report either figure; the split reads the same
    const limit = 1_000_000;
    const steps = STEPS.map(([op, code, gas, cost, depth]): Step => [op, code, gas + (limit - LIMIT), cost, depth]);
    for (const gasUsed of [500_000, USED]) {
      const { gas } = gasProfile(run(steps, { gas: limit, gasUsed }));
      expect(gas).toEqual({ limit, intrinsic: 21_640, execution: 23_363, refund: 0, used: USED });
    }
  });

  it('reads a refund the EVM credited, as before Apricot Phase 1', () => {
    const { gas } = gasProfile(run(STEPS, { gas: LIMIT, gasUsed: USED - 4_800 }));
    expect(gas).toEqual({ limit: LIMIT, intrinsic: 21_640, execution: 23_363, refund: 4_800, used: USED - 4_800 });
  });
});

/* getGasProfile reads a tx once, as getTrace does: the answer is kept in
   this instance and in Redis, one instance at a time asks the node, and
   that one passes the node budget. Each import() after vi.resetModules()
   is a new Vercel instance; they share one RedisFake. */

const NODE = 'https://debug-node.invalid/ext/bc/C/rpc';
const HASH = `0x${'ab'.repeat(32)}`;
const RAW = run(STEPS, { gas: LIMIT, gasUsed: USED });
const ROOT = { type: 'CALL', from: '0x1', to: '0x2', input: '0x', gas: '0x186a0', gasUsed: '0xafcb', calls: [] };

const fake = { client: null as RedisFake | null };
vi.mock('@/lib/redis', () => ({ redis: async () => fake.client }));

type Body = { method: string; params: [string, { tracer?: string; timeout?: string }] };
let bodies: Body[] = [];
function stubNode(answer: (b: Body) => Response | Promise<Response>) {
  bodies = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body)) as Body;
      bodies.push(b);
      return answer(b);
    }),
  );
}
const result = (r: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: r }));
const node = (b: Body) => result(b.params[1].tracer === 'muxTracer' ? { callTracer: ROOT, prestateTracer: { pre: {}, post: {} } } : RAW);

/** a new Vercel instance: fresh module state, the same Redis */
async function instance() {
  vi.resetModules();
  return import('@/lib/trace-node');
}
const from = { lane: 'gesture' as const, ip: '203.0.113.1' };

describe('getGasProfile', () => {
  beforeEach(() => {
    fake.client = new RedisFake();
    vi.stubEnv('CCHAIN_DEBUG_RPC_URL', NODE);
    vi.stubEnv('REDIS_URL', 'redis://redis.invalid:6379');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('asks the node once, with the gas tracer and the timeout, never the struct logger', async () => {
    stubNode(node);
    const { getGasProfile } = await instance();
    const outs = await Promise.all(Array.from({ length: 5 }, () => getGasProfile('43114', HASH, from)));
    expect(outs[0]).toEqual({ profile: gasProfile(RAW) });
    expect(new Set(outs.map((o) => JSON.stringify(o))).size).toBe(1);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].method).toBe('debug_traceTransaction');
    expect(bodies[0].params).toEqual([HASH, { tracer: GAS_TRACER, timeout: TRACE_TIMEOUT }]);
  });

  it('serves another instance from Redis without asking the node', async () => {
    stubNode(node);
    const first = await (await instance()).getGasProfile('43114', HASH, from);
    expect(await (await instance()).getGasProfile('43114', HASH, from)).toEqual(first);
    expect(bodies).toHaveLength(1);
  });

  it('lets one instance read a tx while another waits for its answer', async () => {
    let answer!: () => void;
    const answered = new Promise<void>((r) => (answer = r));
    stubNode(async (b) => {
      await answered;
      return node(b);
    });
    const a = await instance();
    const b = await instance();
    const first = a.getGasProfile('43114', HASH, from);
    await new Promise((r) => setTimeout(r, 50));
    const second = b.getGasProfile('43114', HASH, from);
    await new Promise((r) => setTimeout(r, 50));
    answer();
    const [x, y] = await Promise.all([first, second]);
    expect(y).toEqual(x);
    expect(bodies).toHaveLength(1);
  });

  it('keeps the trace and the gas profile of a tx apart', async () => {
    stubNode(node);
    const { getGasProfile, getTrace } = await instance();
    expect(await getGasProfile('43114', HASH, from)).toMatchObject({ profile: { steps: 9 } });
    expect(await getTrace('43114', HASH, from)).toMatchObject({ trace: { call: ROOT, opcodes: null } });
    expect(bodies.map((b) => b.params[1].tracer)).toEqual([GAS_TRACER, 'muxTracer']);
    // each is kept: neither asks again
    await getGasProfile('43114', HASH, from);
    await getTrace('43114', HASH, from);
    expect(bodies).toHaveLength(2);
  });

  it('asks the node nothing when Redis is down, and nothing for a chain with no node', async () => {
    stubNode(node);
    fake.client!.down = true;
    expect(await (await instance()).getGasProfile('43114', HASH, from)).toEqual({ miss: 'unavailable' });
    expect(await (await instance()).getGasProfile('1', HASH, from)).toEqual({ miss: 'no_node' });
    expect(bodies).toHaveLength(0);
  });

  it('keeps a timeout, so the node is not asked again for a tx too long to profile', async () => {
    stubNode(() => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: "execution timeout    in server-side tracer function 'step'" } })));
    expect(await (await instance()).getGasProfile('43114', HASH, from)).toEqual({ miss: 'timeout' });
    expect(await (await instance()).getGasProfile('43114', HASH, from)).toEqual({ miss: 'timeout' });
    expect(bodies).toHaveLength(1);
  });
});
