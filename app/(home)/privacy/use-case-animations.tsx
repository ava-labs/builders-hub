'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RED = '#E84142';

export function DVPAnim() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % 4), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full rounded-xl flex items-center justify-between px-4 gap-2"
      style={{ height: 88, background: `${RED}07`, border: `1px solid ${RED}18` }}>
      <div className="flex flex-col items-center gap-1">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm"
          style={{ background: `${RED}18`, border: `1.5px solid ${RED}50`, color: RED }}>A</div>
        <span className="text-[7px] font-mono" style={{ color: `${RED}80` }}>Bank A</span>
      </div>
      <div className="flex-1 flex flex-col items-center gap-1.5">
        <div className="relative w-full flex items-center">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <AnimatePresence>
            {step === 1 && (
              <motion.div key="sec" className="absolute left-0 text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap"
                initial={{ left: '5%', opacity: 0 }} animate={{ left: '60%', opacity: 1 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}
                style={{ background: `${RED}12`, color: `${RED}b0`, border: `1px solid ${RED}20` }}>
                securities [private]
              </motion.div>
            )}
          </AnimatePresence>
          <span className="text-[8px] text-white/15 ml-1">→</span>
        </div>
        <div className="relative w-full flex items-center">
          <span className="text-[8px] text-white/15 mr-1">←</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <AnimatePresence>
            {step === 2 && (
              <motion.div key="cash" className="absolute text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap"
                initial={{ right: '5%', opacity: 0 }} animate={{ right: '60%', opacity: 1 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}
                style={{ background: 'rgba(99,102,241,0.12)', color: 'rgba(99,102,241,0.8)', border: '1px solid rgba(99,102,241,0.2)' }}>
                cash [private]
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: step === 3 ? '#22c55e' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
          <span className="text-[7px] font-mono text-white/20">validator</span>
          <span className="text-[7px] font-mono transition-colors duration-300" style={{ color: step === 3 ? '#22c55e' : 'rgba(255,255,255,0.15)' }}>
            {step === 3 ? '✓ settled' : '…'}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm transition-all duration-300"
          style={{ background: step === 3 ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)', border: `1.5px solid ${step === 3 ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)'}`, color: '#818cf8' }}>
          {step === 3 ? '✓' : 'B'}
        </div>
        <span className="text-[7px] font-mono text-indigo-400/50">Bank B</span>
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
    { a: 'Bank A', b: 'Bank B', ca: RED,   cb: '#6366f1', label: 'EUR/USD bilateral' },
    { a: 'Bank A', b: 'Bank C', ca: RED,   cb: '#f59e0b', label: 'GBP/USD bilateral' },
  ];
  const ch = CHANNELS[channel];
  return (
    <div className="w-full rounded-xl flex flex-col justify-center gap-2 px-4"
      style={{ height: 88, background: `${RED}07`, border: `1px solid ${RED}18` }}>
      <AnimatePresence mode="wait">
        <motion.div key={channel} className="flex items-center gap-2"
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3 }}>
          <div className="w-8 h-7 rounded-md flex items-center justify-center text-[10px] font-bold"
            style={{ background: `${ch.ca}18`, border: `1px solid ${ch.ca}40`, color: ch.ca }}>{ch.a}</div>
          <div className="flex-1 flex flex-col items-center">
            <div className="text-[8px] font-mono px-2 py-0.5 rounded whitespace-nowrap"
              style={{ background: `${RED}10`, color: `${RED}90`, border: `1px solid ${RED}20` }}>
              {ch.label} · isolated ledger
            </div>
            <div className="text-[7px] font-mono text-white/20 mt-0.5">Other banks: no visibility</div>
          </div>
          <div className="w-8 h-7 rounded-md flex items-center justify-center text-[10px] font-bold"
            style={{ background: `${ch.cb}18`, border: `1px solid ${ch.cb}40`, color: ch.cb }}>{ch.b}</div>
        </motion.div>
      </AnimatePresence>
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
    <div className="w-full rounded-xl flex items-center justify-between px-5 gap-3"
      style={{ height: 88, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
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
    { label: 'LC Bank',   color: '#6366f1', sees: 'LC terms + cargo' },
    { label: 'Shipping',  color: '#f59e0b', sees: 'cargo only'        },
    { label: 'Buyer',     color: '#22c55e', sees: 'pricing only'      },
  ];
  return (
    <div className="w-full rounded-xl flex items-center justify-between px-3 gap-2"
      style={{ height: 88, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}>
      {PARTIES.map((p, i) => (
        <div key={p.label} className="flex flex-col items-center gap-1 flex-1">
          <motion.div className="w-9 h-9 rounded-lg flex items-center justify-center text-[9px] font-bold text-center leading-tight px-1"
            animate={{ scale: highlight === i ? 1.08 : 1 }}
            transition={{ duration: 0.3 }}
            style={{
              background: highlight === i ? `${p.color}20` : `${p.color}0a`,
              border: `1.5px solid ${highlight === i ? `${p.color}60` : `${p.color}20`}`,
              color: p.color,
              transition: 'background 0.3s, border-color 0.3s',
            }}>
            {p.label}
          </motion.div>
          <motion.span className="text-[6.5px] font-mono text-center leading-tight transition-colors duration-300"
            style={{ color: highlight === i ? `${p.color}90` : 'rgba(255,255,255,0.18)' }}>
            {highlight === i ? p.sees : '—'}
          </motion.span>
        </div>
      ))}
    </div>
  );
}

export function RepoAnim() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % 3), 1100);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full rounded-xl flex flex-col justify-center gap-2 px-4"
      style={{ height: 88, background: `${RED}07`, border: `1px solid ${RED}18` }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-7 rounded-md flex items-center justify-center text-[10px] font-bold"
          style={{ background: `${RED}18`, border: `1px solid ${RED}40`, color: RED }}>A</div>
        <div className="flex-1 flex flex-col items-center">
          <div className="text-[8px] font-mono px-2 py-0.5 rounded whitespace-nowrap"
            style={{ background: `${RED}10`, color: `${RED}90`, border: `1px solid ${RED}20` }}>
            repo: [private channel]
          </div>
        </div>
        <div className="w-8 h-7 rounded-md flex items-center justify-center text-[10px] font-bold"
          style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8' }}>B</div>
      </div>
      <div className="flex items-center gap-2 rounded-lg px-2 py-1"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
        <div className="w-6 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white/20">C</div>
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
    <div className="w-full rounded-xl flex items-center justify-between px-4 gap-1"
      style={{ height: 88, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
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
