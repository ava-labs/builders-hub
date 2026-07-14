'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RED = '#E84142';

export function DVPAnim() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % 5), 950);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full rounded-xl flex flex-col gap-2 p-3"
      style={{ background: `${RED}07`, border: `1px solid ${RED}18` }}>

      {/* Bank row */}
      <div className="flex items-center gap-2">
        {/* Bank A — flex-shrink-0 so it never gets squeezed */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
            style={{ background: `${RED}18`, border: `1.5px solid ${RED}50`, color: RED }}>A</div>
          <span className="text-[7px] font-mono" style={{ color: `${RED}70` }}>Bank A</span>
        </div>

        {/* Tracks — overflow:hidden clips pills so they can't bleed into bank boxes */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col gap-1.5">
          {/* A→B securities track */}
          <div className="relative h-6 flex items-center">
            <div className="absolute inset-x-0 h-px top-1/2 -translate-y-px"
              style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="absolute right-0 text-[7px] text-white/15 leading-none">→</span>
            <AnimatePresence>
              {step === 1 && (
                <motion.div key="sec"
                  className="absolute left-0 text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap"
                  initial={{ x: -8, opacity: 0 }}
                  animate={{ x: 20, opacity: 1 }}
                  exit={{ x: 72, opacity: 0 }}
                  transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: `${RED}14`, color: `${RED}c0`, border: `1px solid ${RED}25` }}>
                  securities [private]
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* B→A cash track */}
          <div className="relative h-6 flex items-center">
            <div className="absolute inset-x-0 h-px top-1/2 -translate-y-px"
              style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="absolute left-0 text-[7px] text-white/15 leading-none">←</span>
            <AnimatePresence>
              {step === 2 && (
                <motion.div key="cash"
                  className="absolute right-0 text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap"
                  initial={{ x: 8, opacity: 0 }}
                  animate={{ x: -20, opacity: 1 }}
                  exit={{ x: -72, opacity: 0 }}
                  transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: 'rgba(99,102,241,0.14)', color: 'rgba(99,102,241,0.85)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  cash [private]
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bank B — flex-shrink-0 */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-all duration-300"
            style={{
              background: step >= 3 ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
              border: `1.5px solid ${step >= 3 ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.25)'}`,
              color: '#818cf8',
            }}>
            {step >= 3 ? '✓' : 'B'}
          </div>
          <span className="text-[7px] font-mono text-indigo-400/40">Bank B</span>
        </div>
      </div>

      {/* Validator status */}
      <div className="flex items-center justify-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full"
          style={{ background: step >= 3 ? '#22c55e' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
        <span className="text-[7px] font-mono text-white/20">validator</span>
        <span className="text-[7px] font-mono transition-colors duration-300"
          style={{ color: step >= 3 ? '#22c55e' : 'rgba(255,255,255,0.15)' }}>
          {step >= 3 ? '✓ settled' : '…'}
        </span>
      </div>
    </div>
  );
}

export function FXAnim() {
  const [channel, setChannel] = useState<0|1>(0);
  useEffect(() => {
    const id = setInterval(() => setChannel(c => c === 0 ? 1 : 0), 1600);
    return () => clearInterval(id);
  }, []);
  const CHANNELS = [
    { aLetter: 'A', bLetter: 'B', aLabel: 'Bank A', bLabel: 'Bank B', ca: RED, cb: '#6366f1', label: 'EUR/USD bilateral' },
    { aLetter: 'A', bLetter: 'C', aLabel: 'Bank A', bLabel: 'Bank C', ca: RED, cb: '#f59e0b', label: 'GBP/USD bilateral' },
  ];
  const ch = CHANNELS[channel];
  return (
    <div className="w-full rounded-xl flex flex-col gap-2 p-3"
      style={{ background: `${RED}07`, border: `1px solid ${RED}18` }}>
      <AnimatePresence mode="wait">
        <motion.div key={channel} className="flex items-center gap-2"
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}>
          {/* Bank A */}
          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
              style={{ background: `${ch.ca}18`, border: `1px solid ${ch.ca}40`, color: ch.ca }}>
              {ch.aLetter}
            </div>
            <span className="text-[7px] font-mono whitespace-nowrap" style={{ color: `${ch.ca}70` }}>{ch.aLabel}</span>
          </div>

          {/* Center label */}
          <div className="flex-1 min-w-0 flex flex-col items-center gap-0.5">
            <div className="text-[8px] font-mono px-2 py-0.5 rounded whitespace-nowrap"
              style={{ background: `${RED}10`, color: `${RED}90`, border: `1px solid ${RED}20` }}>
              {ch.label} · isolated ledger
            </div>
            <div className="text-[7px] font-mono text-white/20">Other banks: no visibility</div>
          </div>

          {/* Bank B/C */}
          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
              style={{ background: `${ch.cb}18`, border: `1px solid ${ch.cb}40`, color: ch.cb }}>
              {ch.bLetter}
            </div>
            <span className="text-[7px] font-mono whitespace-nowrap" style={{ color: `${ch.cb}70` }}>{ch.bLabel}</span>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Pagination dots */}
      <div className="flex justify-center gap-1.5">
        {CHANNELS.map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{ background: i === channel ? RED : 'rgba(255,255,255,0.12)' }} />
        ))}
      </div>
    </div>
  );
}

export function RWAAnim() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    const cycle = async () => {
      while (live) {
        await new Promise(r => setTimeout(r, 1800));
        if (!live) return;
        setOpen(true);
        await new Promise(r => setTimeout(r, 1200));
        if (!live) return;
        setOpen(false);
      }
    };
    cycle();
    return () => { live = false; };
  }, []);
  return (
    <div className="w-full rounded-xl flex items-center justify-between px-5 py-3 gap-3"
      style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
      <div className="flex flex-col items-center gap-1">
        <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.3)' }}>
          <span className="text-[8px] font-mono text-white/25">balance</span>
          <motion.span className="text-[10px] font-mono font-bold transition-colors duration-500"
            style={{ color: open ? '#22c55e' : 'rgba(255,255,255,0.25)' }}>
            {open ? '$840M' : '[ENC]'}
          </motion.span>
        </div>
        <span className="text-[7px] font-mono text-white/20">on-chain token</span>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 items-center">
        <div className="flex items-center gap-1.5 text-[8px] font-mono px-2 py-1 rounded-lg w-full justify-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span>👁</span><span className="text-white/25">public: </span><span className="text-white/30">✓ valid</span>
        </div>
        <motion.div className="flex items-center gap-1.5 text-[8px] font-mono px-2 py-1 rounded-lg w-full justify-center transition-all duration-500"
          style={{
            background: open ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${open ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.07)'}`,
          }}>
          <motion.span animate={{ rotate: open ? 0 : 20 }} transition={{ duration: 0.3 }}>
            {open ? '🔓' : '🔑'}
          </motion.span>
          <span style={{ color: open ? '#22c55e' : 'rgba(255,255,255,0.25)' }}>
            auditor: {open ? '$840M' : 'key req.'}
          </span>
        </motion.div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <motion.div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-500"
          style={{ background: open ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${open ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
          {open ? '📋' : '🏛'}
        </motion.div>
        <span className="text-[7px] font-mono text-white/20">regulator</span>
      </div>
    </div>
  );
}

export function TradeFinanceAnim() {
  const [highlight, setHighlight] = useState<0|1|2>(0);
  useEffect(() => {
    const id = setInterval(() => setHighlight(h => ((h + 1) % 3) as 0|1|2), 1200);
    return () => clearInterval(id);
  }, []);
  const PARTIES = [
    { letter: '🏦', label: 'LC Bank',  color: '#6366f1', sees: 'LC terms + cargo' },
    { letter: '🚢', label: 'Shipping', color: '#f59e0b', sees: 'cargo only'        },
    { letter: '🏢', label: 'Buyer',    color: '#22c55e', sees: 'pricing only'      },
  ];
  return (
    <div className="w-full rounded-xl flex items-center justify-between px-3 py-3 gap-2"
      style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}>
      {PARTIES.map((p, i) => (
        <div key={p.label} className="flex flex-col items-center gap-1 flex-1">
          <motion.div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            animate={{ scale: highlight === i ? 1.08 : 1 }}
            transition={{ duration: 0.3 }}
            style={{
              background: highlight === i ? `${p.color}20` : `${p.color}0a`,
              border: `1.5px solid ${highlight === i ? `${p.color}60` : `${p.color}20`}`,
              transition: 'background 0.3s, border-color 0.3s',
            }}>
            {p.letter}
          </motion.div>
          <span className="text-[7px] font-mono text-center whitespace-nowrap transition-colors duration-300"
            style={{ color: highlight === i ? `${p.color}90` : 'rgba(255,255,255,0.25)' }}>
            {p.label}
          </span>
          <motion.span className="text-[6.5px] font-mono text-center leading-tight"
            style={{ color: highlight === i ? `${p.color}70` : 'transparent', minHeight: '0.75rem' }}>
            {highlight === i ? p.sees : ''}
          </motion.span>
        </div>
      ))}
    </div>
  );
}

export function RepoAnim() {
  return (
    <div className="w-full rounded-xl flex flex-col gap-2 p-3"
      style={{ background: `${RED}07`, border: `1px solid ${RED}18` }}>
      {/* A ↔ B bilateral */}
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
            style={{ background: `${RED}18`, border: `1px solid ${RED}40`, color: RED }}>A</div>
          <span className="text-[7px] font-mono" style={{ color: `${RED}70` }}>Bank A</span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <div className="text-[8px] font-mono px-2 py-0.5 rounded whitespace-nowrap"
            style={{ background: `${RED}10`, color: `${RED}90`, border: `1px solid ${RED}20` }}>
            repo: [private channel]
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8' }}>B</div>
          <span className="text-[7px] font-mono text-indigo-400/40">Bank B</span>
        </div>
      </div>

      {/* Bank C excluded */}
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
        <div className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white/20"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>C</div>
        <span className="text-[7px] font-mono text-white/15 flex-1">Bank C — no visibility into A↔B relationship</span>
        <span className="text-sm">🚫</span>
      </div>
    </div>
  );
}

export function BondsAnim() {
  const [phase, setPhase] = useState<0|1|2>(0);
  useEffect(() => {
    const id = setInterval(() => setPhase(p => ((p + 1) % 3) as 0|1|2), 1000);
    return () => clearInterval(id);
  }, []);
  const STAGES = [
    { label: 'Investor',    note: 'identity private',  color: '#6366f1', icon: '👤' },
    { label: 'ZK verify',  note: '✓ eligible',        color: '#f59e0b', icon: 'π'  },
    { label: 'Allocation', note: '[ENCRYPTED]',        color: '#22c55e', icon: '🔒' },
  ];
  return (
    <div className="w-full rounded-xl flex items-center justify-between px-4 py-3 gap-1"
      style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
      {STAGES.map((s, i) => (
        <div key={s.label} className="flex flex-col items-center gap-1 flex-1">
          <motion.div className="w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all duration-400"
            style={{
              background: i <= phase ? `${s.color}18` : 'rgba(255,255,255,0.03)',
              border: `1.5px solid ${i <= phase ? `${s.color}50` : 'rgba(255,255,255,0.08)'}`,
            }}>
            {s.icon}
          </motion.div>
          <span className="text-[7px] font-mono text-center transition-colors duration-300"
            style={{ color: i <= phase ? `${s.color}90` : 'rgba(255,255,255,0.15)' }}>
            {s.label}
          </span>
          <span className="text-[6px] font-mono text-center"
            style={{ color: i === phase ? `${s.color}70` : 'transparent' }}>
            {s.note}
          </span>
        </div>
      ))}
    </div>
  );
}

const USE_CASE_ANIM_MAP: Record<string, React.FC> = {
  dvp:   DVPAnim,
  fx:    FXAnim,
  rwa:   RWAAnim,
  trade: TradeFinanceAnim,
  repo:  RepoAnim,
  bonds: BondsAnim,
};

export function UseCaseAnim({ id }: { id: string }) {
  const Comp = USE_CASE_ANIM_MAP[id];
  return Comp ? <Comp /> : null;
}
