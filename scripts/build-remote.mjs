import { spawn } from 'child_process';

/**
 * Runs the build:remote steps, with independent steps at the same time.
 *
 * remote-content writes content/docs/rpcs/{p,c,x}-chain/index.mdx, and
 * generate-api-reference backs those files up, regenerates the folders and
 * restores them. So those two run in order. enrich-chains writes
 * constants/l1-chains.json and index-repos writes public/embeddings, so each
 * runs beside the pair. The run fails when any step fails, after all steps end.
 */
const lanes = [
  [
    ['remote-content', ['./utils/remote-content.mts']],
    ['api-reference', ['./scripts/generate-api-reference.mts']],
  ],
  [['enrich-chains', ['./scripts/enrich-chains.ts', '--prune']]],
  [['index-repos', ['./scripts/index-repos.mts']]],
];

function prefixLines(stream, out, label) {
  let rest = '';
  stream.on('data', (chunk) => {
    const lines = (rest + chunk).split('\n');
    rest = lines.pop();
    for (const line of lines) out.write(`[${label}] ${line}\n`);
  });
  stream.on('end', () => {
    if (rest) out.write(`[${label}] ${rest}\n`);
  });
}

function runStep(label, args) {
  const start = Date.now();
  return new Promise((resolve) => {
    // tsx comes from node_modules/.bin, which yarn puts on PATH for package scripts.
    const child = spawn('tsx', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    prefixLines(child.stdout, process.stdout, label);
    prefixLines(child.stderr, process.stderr, label);
    child.on('error', (error) => {
      console.error(`[${label}] could not start: ${error.message}`);
      resolve(false);
    });
    child.on('close', (code, signal) => {
      const seconds = ((Date.now() - start) / 1000).toFixed(1);
      const ok = code === 0;
      console.log(`[${label}] ${ok ? 'done' : `failed (${signal ?? `exit ${code}`})`} in ${seconds}s`);
      resolve(ok);
    });
  });
}

async function runLane(steps) {
  for (const [label, args] of steps) {
    if (!(await runStep(label, args))) return false;
  }
  return true;
}

const results = await Promise.all(lanes.map(runLane));
if (results.includes(false)) process.exit(1);
