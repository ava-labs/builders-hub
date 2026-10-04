import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

/**
 * Runs next build with its own type check off, and tsc beside it. Both must pass.
 *
 * next build type checks only after the compile, on one core. This script starts
 * the same tsc command (lib/typescript/runTypeCheckCli.js in next) while the
 * compile runs. tsc starts only after next build has written .source/index.ts
 * ("[MDX] generated files") and the route types ("Creating an optimized production
 * build" comes after .next/types/validator.ts). An earlier start checks a
 * half-written .source and skips the route export checks.
 *
 * The Vercel build command runs this script. next.config.mjs skips the type check
 * of next build when SKIP_NEXT_TYPECHECK is 1.
 */
const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const tscBin = require.resolve('typescript/bin/tsc');
const validatorFile = path.join('.next', 'types', 'validator.ts');
const gateLines = ['[MDX] generated files', 'Creating an optimized production build'];
const tscArgs = [
  '--project',
  'tsconfig.json',
  '--noEmit',
  '--declarationMap',
  'false',
  '--emitDeclarationOnly',
  'false',
  '--tsBuildInfoFile',
  path.join('.next', 'cache', '.tsbuildinfo'),
];

const start = Date.now();
const seconds = (from) => `${((Date.now() - from) / 1000).toFixed(1)}s`;
const log = (message) => console.log(`[typecheck] ${message}`);

// The cgroup peak covers every process of the build. The sampled value is the fallback.
let sampledPeak = 0;
const sampler = setInterval(() => {
  sampledPeak = Math.max(sampledPeak, os.totalmem() - os.freemem());
}, 2000).unref();
function memoryReport() {
  const gb = (bytes) => (bytes / 2 ** 30).toFixed(1);
  sampledPeak = Math.max(sampledPeak, os.totalmem() - os.freemem());
  for (const file of ['/sys/fs/cgroup/memory.peak', '/sys/fs/cgroup/memory/memory.max_usage_in_bytes']) {
    try {
      return `cgroup peak ${gb(Number(fs.readFileSync(file, 'utf8')))} GB of ${gb(os.totalmem())} GB`;
    } catch {}
  }
  return `sampled peak ${gb(sampledPeak)} GB of ${gb(os.totalmem())} GB`;
}

// Each child leads its own process group, so a kill also stops its workers. When a
// child exits, any worker it left behind in its group is killed.
function launch(who, args, env, stdout) {
  const child = spawn(process.execPath, args, { env, stdio: ['ignore', stdout, 'inherit'], detached: true });
  const exit = new Promise((resolve) => {
    child.on('error', (error) => resolve({ who, ok: false, reason: error.message }));
    child.on('exit', (code, signal) => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
      resolve({ who, ok: code === 0, reason: signal ?? `exit ${code}` });
    });
  });
  return { child, exit };
}

// SIGTERM lets next stop its workers. SIGKILL then clears what is left of the group.
async function stop(proc) {
  if (!proc) return;
  const kill = (signal) => {
    try {
      process.kill(-proc.child.pid, signal);
    } catch {}
  };
  kill('SIGTERM');
  await Promise.race([proc.exit, new Promise((resolve) => setTimeout(resolve, 10_000))]);
  kill('SIGKILL');
}

function finish(ok, message) {
  log(`${message}, ${memoryReport()}`);
  clearInterval(sampler);
  process.exit(ok ? 0 : 1);
}

let tsc;
let tscStart;
let onTscStart;
let warned = false;
const tscStarted = new Promise((resolve) => (onTscStart = resolve));
function startTsc() {
  if (tsc) return true;
  if (!fs.existsSync(validatorFile)) {
    if (!warned) log(`${validatorFile} is missing, so tsc would skip the route checks`);
    warned = true;
    return false;
  }
  tscStart = Date.now();
  log(`tsc started at ${seconds(start)}`);
  tsc = launch('tsc', [tscBin, ...tscArgs], process.env, 'inherit');
  onTscStart(tsc);
  return true;
}

const next = launch('next build', [nextBin, 'build'], { ...process.env, SKIP_NEXT_TYPECHECK: '1' }, 'pipe');
const seen = new Set();
let rest = '';
next.child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  const lines = (rest + chunk).split('\n');
  rest = lines.pop();
  for (const line of lines) for (const gate of gateLines) if (line.includes(gate)) seen.add(gate);
  if (!tsc && seen.size === gateLines.length) startTsc();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await Promise.all([stop(next), stop(tsc)]);
    process.exit(1);
  });
}

// Whichever ends first decides: a failure stops the other one at once.
const first = await Promise.race([next.exit, tscStarted.then((proc) => proc.exit)]);
if (!first.ok) {
  await stop(first.who === 'tsc' ? next : tsc);
  finish(false, `${first.who} failed (${first.reason}) at ${seconds(start)}`);
}

if (first.who === 'next build') {
  log(`next build done at ${seconds(start)}`);
  // If the gate lines never came, the check runs now, after the build.
  if (!startTsc()) finish(false, 'no type check ran');
  const result = await tsc.exit;
  finish(result.ok, `tsc ${result.ok ? 'passed' : `failed (${result.reason})`} in ${seconds(tscStart)}`);
}

log(`tsc passed in ${seconds(tscStart)}, next build still running`);
const result = await next.exit;
finish(result.ok, `next build ${result.ok ? 'done' : `failed (${result.reason})`} at ${seconds(start)}`);
