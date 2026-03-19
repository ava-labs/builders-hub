const API_BASE = 'https://52.203.183.9.sslip.io/api/validators';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';

function color(text, c) { return `${c}${text}${RESET}`; }

function formatAvax(nAvax) {
  return (nAvax / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' AVAX';
}

function uptimeColor(val) {
  if (val >= 99) return GREEN;
  if (val >= 80) return YELLOW;
  return RED;
}

function missRateColor(val) {
  if (val === 0) return GREEN;
  if (val < 5) return YELLOW;
  return RED;
}

function daysLeftColor(val) {
  if (val < 7) return RED;
  if (val < 30) return YELLOW;
  return GREEN;
}

function printSection(title) {
  console.log(`\n${BOLD}${CYAN}--- ${title} ---${RESET}`);
}

function printRow(label, value) {
  console.log(`  ${DIM}${label.padEnd(24)}${RESET} ${value}`);
}

async function fetchValidator(nodeId) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(nodeId)}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('Validator not found');
    throw new Error(`API returned ${res.status}`);
  }
  return res.json();
}

async function main() {
  let nodeId = process.argv[2];

  if (!nodeId) {
    // Interactive mode
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    nodeId = await new Promise(resolve => {
      rl.question(`${BOLD}Enter Node ID: ${RESET}`, answer => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!nodeId.startsWith('NodeID-')) {
    nodeId = `NodeID-${nodeId}`;
  }

  console.log(`\n${DIM}Fetching data for ${BOLD}${nodeId}${RESET}${DIM}...${RESET}`);

  try {
    const d = await fetchValidator(nodeId);

    // Header
    console.log(`\n${BOLD}${WHITE}Validator: ${nodeId}${RESET}`);
    printRow('Version', d.version || 'N/A');
    printRow('Public IP', d.public_ip || 'N/A');

    // Key Metrics
    printSection('Key Metrics');
    printRow('Uptime (p50)', color(`${d.current_p50_uptime.toFixed(4)}%`, uptimeColor(d.current_p50_uptime)));
    printRow('Miss Rate (14d)', color(`${d.miss_rate_14d.toFixed(2)}%`, missRateColor(d.miss_rate_14d)));
    printRow('Blocks Proposed (14d)', String(d.proposed_14d));
    printRow('Blocks Missed (14d)', color(String(d.missed_14d), d.missed_14d > 0 ? RED : GREEN));
    printRow('Days Left', color(String(d.days_left), daysLeftColor(d.days_left)));
    printRow('Bench Observers', color(String(d.bench_observers), d.bench_observers > 0 ? YELLOW : GREEN));

    // Uptime Details
    if (d.uptime_details) {
      printSection('Uptime Details');
      printRow('Observers', String(d.uptime_details.count));
      printRow('Min', `${d.uptime_details.min.toFixed(4)}%`);
      printRow('Max', `${d.uptime_details.max.toFixed(4)}%`);
      printRow('Avg', `${d.uptime_details.avg.toFixed(4)}%`);
      printRow('P50 (Median)', `${d.uptime_details.p50.toFixed(4)}%`);
      printRow('P95', `${d.uptime_details.p95.toFixed(4)}%`);
    }

    // Staking
    printSection('Staking');
    printRow('Own Stake', formatAvax(d.weight));
    printRow('Delegated', formatAvax(d.delegator_weight));
    printRow('Delegators', String(d.delegator_count));
    printRow('Delegation Fee', `${d.delegation_fee}%`);
    printRow('Potential Reward', color(formatAvax(d.potential_reward), GREEN));

    // Proposal Timing (Slots)
    if (d.slots && d.slots.length > 0) {
      printSection('Proposal Timing (14d)');
      const total = d.slots.reduce((s, x) => s + x.cnt, 0);
      const slot0 = d.slots.find(s => s.slot === 0)?.cnt ?? 0;
      const slot1 = d.slots.find(s => s.slot === 1)?.cnt ?? 0;
      const slot2plus = d.slots.filter(s => s.slot >= 2).reduce((s, x) => s + x.cnt, 0);
      const pct = (v) => total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '0%';
      printRow('Slot 0 (On-time)', color(`${slot0} (${pct(slot0)})`, GREEN));
      printRow('Slot 1 (+5s late)', color(`${slot1} (${pct(slot1)})`, YELLOW));
      printRow('Slot 2+ (+10s+ late)', color(`${slot2plus} (${pct(slot2plus)})`, RED));
    }

    // Recent Uptime Trend (last 6 entries)
    if (d.uptime && d.uptime.length > 0) {
      printSection('Recent Uptime Trend');
      const recent = d.uptime.slice(-6);
      for (const u of recent) {
        const ts = new Date(u.bucket).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const bar = '█'.repeat(Math.round(u.p50_uptime / 5));
        printRow(ts, `${color(bar, uptimeColor(u.p50_uptime))} ${u.p50_uptime.toFixed(2)}%`);
      }
    }

    // Recent Block Production (last 6 entries)
    if (d.blocks && d.blocks.length > 0) {
      printSection('Recent Block Production');
      const recent = d.blocks.slice(-6);
      for (const b of recent) {
        const ts = new Date(b.hour).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const missText = b.missed > 0 ? color(` / ${b.missed} missed`, RED) : '';
        printRow(ts, `${b.proposed} proposed${missText}`);
      }
    }

    console.log(`\n${DIM}View full details at: /stats/validators/node/${encodeURIComponent(nodeId)}${RESET}\n`);

  } catch (err) {
    console.error(`\n${RED}Error: ${err.message}${RESET}\n`);
    process.exit(1);
  }
}

main();
