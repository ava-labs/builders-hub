'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RED = '#E84142';

export function PrivateNetworkAnim() {
  const [phase, setPhase] = useState<0|1|2>(0);
  useEffect(() => {
    const id = setInterval(() => setPhase(p => ((p + 1) % 3) as 0|1|2), 1400);
    return () => clearInterval(id);
  }, []);
  const ACTORS = [
    { label: 'Your Bank',  color: '#6366f1', approved: true  },
    { label: 'Partner A',  color: '#6366f1', approved: true  },
    { label: 'Unknown',    color: '#ef4444', approved: false },
    { label: 'Auditor',    color: '#22c55e', approved: true  },
  ];
  const current = ACTORS[phase % ACTORS.length];
  return (
    <div className="w-full rounded-xl flex flex-col gap-3 p-4"
      style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
      <p className="text-[9px] font-mono uppercase tracking-widest text-white/25">Network entry · live</p>
      <div className="flex items-center gap-3">
        <AnimatePresence mode="wait">
          <motion.div key={phase} className="flex flex-col items-center gap-1 w-24 flex-shrink-0"
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.3 }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: `${current.color}18`, border: `1.5px solid ${current.color}50`, color: current.color }}>
              {current.approved ? '✓' : '?'}
            </div>
            <span className="text-[8px] font-mono text-center leading-tight" style={{ color: current.color }}>
              {current.label}
            </span>
          </motion.div>
        </AnimatePresence>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="flex flex-col items-center justify-center w-16 h-10 rounded-lg flex-shrink-0"
            style={{
              background: current.approved ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1.5px solid ${current.approved ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
              transition: 'all 0.3s',
            }}>
            <span className="text-base">{current.approved ? '🔓' : '🚫'}</span>
            <span className="text-[7px] font-mono" style={{ color: current.approved ? '#22c55e' : '#ef4444' }}>
              {current.approved ? 'approved' : 'blocked'}
            </span>
          </div>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>

        <div className="flex flex-col items-center gap-1 w-24 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1.5px solid rgba(99,102,241,0.4)' }}>⬡</div>
          <span className="text-[8px] font-mono text-center text-white/30">Private L1</span>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {ACTORS.map(a => (
          <span key={a.label} className="text-[7px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: `${a.color}0d`, color: `${a.color}99`, border: `1px solid ${a.color}20` }}>
            {a.label} {a.approved ? '✓' : '✗'}
          </span>
        ))}
      </div>
    </div>
  );
}

export function NeedToKnowAnim() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % 4), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full rounded-xl flex flex-col gap-3 p-4"
      style={{ background: 'rgba(232,65,66,0.05)', border: '1px solid rgba(232,65,66,0.15)' }}>
      <p className="text-[9px] font-mono uppercase tracking-widest text-white/25">DVP Settlement · Bank A ↔ Bank B</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ background: 'rgba(232,65,66,0.15)', border: '1.5px solid rgba(232,65,66,0.5)', color: RED }}>A</div>
          <span className="text-[8px] font-mono" style={{ color: 'rgba(232,65,66,0.7)' }}>Bank A</span>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1">
          <AnimatePresence mode="wait">
            {step >= 1 && step <= 3 && (
              <motion.div key="tx" className="flex flex-col items-center gap-0.5"
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.3 }}>
                <div className="px-3 py-1.5 rounded-lg text-[9px] font-mono text-center"
                  style={{ background: 'rgba(232,65,66,0.1)', border: '1px solid rgba(232,65,66,0.25)', color: 'rgba(232,65,66,0.8)' }}>
                  Amount: [PRIVATE]<br />Asset: [PRIVATE]
                </div>
                <div className="flex gap-1 mt-0.5">
                  <div className="w-3 h-3 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <span className="text-[6px] text-white/30">✓</span>
                  </div>
                  <span className="text-[7px] font-mono text-white/25">validator confirmed</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ background: 'rgba(99,102,241,0.15)', border: `1.5px solid ${step >= 3 ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.3)'}`, color: '#818cf8', transition: 'border-color 0.4s' }}>
            {step >= 3 ? '✓' : 'B'}
          </div>
          <span className="text-[8px] font-mono text-indigo-400/60">Bank B</span>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white/20"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>C</div>
        <div className="flex flex-col">
          <span className="text-[8px] font-mono text-white/20">Bank C (non-party)</span>
          <span className="text-[7px] font-mono text-white/12">Cannot see this transaction exists</span>
        </div>
        <span className="ml-auto text-sm">🚫</span>
      </div>
    </div>
  );
}

export function EncryptedSettlementAnim() {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    let live = true;
    const cycle = async () => {
      while (live) {
        await new Promise(r => setTimeout(r, 1800));
        if (!live) return;
        setUnlocked(true);
        await new Promise(r => setTimeout(r, 1200));
        if (!live) return;
        setUnlocked(false);
      }
    };
    cycle();
    return () => { live = false; };
  }, []);
  return (
    <div className="w-full rounded-xl flex flex-col gap-3 p-4"
      style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
      <p className="text-[9px] font-mono uppercase tracking-widest text-white/25">Shared chain · encrypted balances</p>

      <div className="flex gap-1.5">
        {[
          { label: 'Bank A→B', val: unlocked ? '$840M' : '[ENC]' },
          { label: 'Bank C→D', val: '[ENC]' },
          { label: 'Bank A→E', val: '[ENC]' },
        ].map((tx, i) => (
          <div key={i} className="flex-1 rounded-lg p-1.5 text-center"
            style={{
              background: i === 0 && unlocked ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${i === 0 && unlocked ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.07)'}`,
              transition: 'all 0.4s',
            }}>
            <div className="text-[7px] font-mono text-white/25 mb-0.5">{tx.label}</div>
            <div className="text-[9px] font-mono transition-colors duration-400"
              style={{ color: i === 0 && unlocked ? '#22c55e' : 'rgba(255,255,255,0.25)' }}>
              {tx.val}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        <div className="flex-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-xs">👁</span>
          <div>
            <div className="text-[7px] font-mono text-white/20">Public</div>
            <div className="text-[7px] font-mono text-white/12">sees: ✓ valid</div>
          </div>
        </div>
        <motion.div className="flex-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer"
          style={{
            background: unlocked ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${unlocked ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
            transition: 'all 0.4s',
          }}>
          <motion.span className="text-xs" animate={{ rotate: unlocked ? 0 : 30 }} transition={{ duration: 0.3 }}>
            {unlocked ? '🔓' : '🔑'}
          </motion.span>
          <div>
            <div className="text-[7px] font-mono" style={{ color: unlocked ? '#22c55e' : 'rgba(255,255,255,0.2)' }}>Auditor</div>
            <div className="text-[7px] font-mono" style={{ color: unlocked ? 'rgba(34,197,94,0.7)' : 'rgba(255,255,255,0.12)' }}>
              {unlocked ? 'sees: $840M ✓' : 'key required'}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
