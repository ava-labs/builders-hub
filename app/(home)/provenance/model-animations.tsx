'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RED    = '#E84142';
const GREEN  = '#22c55e';
const INDIGO = '#6366f1';

export function WalledGardenAnim() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase(p => (p + 1) % 4), 1300);
    return () => clearInterval(id);
  }, []);
  const ACTORS = [
    { label: 'Manufacturer', color: INDIGO,  approved: true  },
    { label: 'Distributor',  color: INDIGO,  approved: true  },
    { label: 'Unknown',      color: RED,     approved: false },
    { label: 'Regulator',    color: GREEN,   approved: true  },
  ];
  const current = ACTORS[phase % ACTORS.length];
  return (
    <div className="w-full rounded-xl flex flex-col gap-4 p-5"
      style={{ background: `${RED}05`, border: `1px solid ${RED}15` }}>
      <p className="text-[9px] font-mono uppercase tracking-widest text-white/25">Supply chain access gate · live</p>
      <div className="flex items-center gap-4">
        <AnimatePresence mode="wait">
          <motion.div key={phase} className="flex flex-col items-center gap-1.5 w-28 flex-shrink-0"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.3 }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold"
              style={{ background: `${current.color}18`, border: `1.5px solid ${current.color}50`, color: current.color }}>
              {current.approved ? '✓' : '?'}
            </div>
            <span className="text-[8px] font-mono text-center leading-tight" style={{ color: current.color }}>
              {current.label}
            </span>
          </motion.div>
        </AnimatePresence>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <motion.div
            key={phase}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center w-20 h-12 rounded-xl flex-shrink-0"
            style={{
              background: current.approved ? `${GREEN}10` : `${RED}10`,
              border: `1.5px solid ${current.approved ? `${GREEN}40` : `${RED}40`}`,
              transition: 'background 0.3s, border-color 0.3s',
            }}>
            <span className="text-xl">{current.approved ? '🔓' : '🚫'}</span>
            <span className="text-[7px] font-mono" style={{ color: current.approved ? GREEN : RED }}>
              {current.approved ? 'approved' : 'blocked'}
            </span>
          </motion.div>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <div className="flex flex-col items-center gap-1.5 w-24 flex-shrink-0">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base"
            style={{ background: `${RED}12`, border: `1.5px solid ${RED}35` }}>⬡</div>
          <span className="text-[8px] font-mono text-center text-white/30">Private L1</span>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {ACTORS.map(a => (
          <span key={a.label} className="text-[7px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: `${a.color}0d`, color: `${a.color}90`, border: `1px solid ${a.color}20` }}>
            {a.label} {a.approved ? '✓' : '✗'}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ConsortiumTraceAnim() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % 3), 1400);
    return () => clearInterval(id);
  }, []);
  const BRANDS = [
    { label: 'Brand A', color: INDIGO, items: 142 },
    { label: 'Brand B', color: '#f59e0b', items: 87 },
    { label: 'Brand C', color: GREEN,   items: 215 },
  ];
  return (
    <div className="w-full rounded-xl flex flex-col gap-4 p-5"
      style={{ background: `${INDIGO}05`, border: `1px solid ${INDIGO}15` }}>
      <p className="text-[9px] font-mono uppercase tracking-widest text-white/25">Consortium verification · isolated channels</p>
      <div className="flex flex-col gap-2.5">
        {BRANDS.map((b, i) => {
          const isActive = active === i;
          return (
            <motion.div key={b.label}
              animate={{ opacity: isActive ? 1 : 0.4 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{
                background: isActive ? `${b.color}0e` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? `${b.color}35` : 'rgba(255,255,255,0.06)'}`,
                transition: 'background 0.4s, border-color 0.4s',
              }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: `${b.color}18`, border: `1.5px solid ${b.color}40`, color: b.color }}>
                {b.label.split(' ')[1]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-mono" style={{ color: isActive ? b.color : 'rgba(255,255,255,0.3)' }}>
                  {b.label}
                </div>
                <div className="text-[8px] font-mono text-white/25 mt-0.5">
                  {isActive ? `verified items: ${b.items}` : 'data: isolated'}
                </div>
              </div>
              <div className="flex-shrink-0">
                <span className="text-[7px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: isActive ? `${b.color}12` : 'rgba(255,255,255,0.04)',
                    color: isActive ? `${b.color}c0` : 'rgba(255,255,255,0.2)',
                    border: `1px solid ${isActive ? `${b.color}25` : 'rgba(255,255,255,0.07)'}`,
                  }}>
                  {isActive ? '● live' : '○ hidden'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="text-[7px] font-mono text-white/20 text-center">
        Shared infrastructure · isolated visibility per brand
      </div>
    </div>
  );
}

export function PublicAttestationAnim() {
  const [phase, setPhase] = useState<0|1|2>(0);
  useEffect(() => {
    let live = true;
    const cycle = async () => {
      while (live) {
        setPhase(0);
        await new Promise(r => setTimeout(r, 1200));
        if (!live) return;
        setPhase(1);
        await new Promise(r => setTimeout(r, 900));
        if (!live) return;
        setPhase(2);
        await new Promise(r => setTimeout(r, 1400));
      }
    };
    cycle();
    return () => { live = false; };
  }, []);
  return (
    <div className="w-full rounded-xl flex flex-col gap-4 p-5"
      style={{ background: `${GREEN}05`, border: `1px solid ${GREEN}12` }}>
      <p className="text-[9px] font-mono uppercase tracking-widest text-white/25">Consumer QR verification · public</p>
      <div className="flex items-center gap-5 justify-center">
        <div className="flex flex-col items-center gap-1.5">
          <motion.div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
            animate={{ scale: phase === 1 ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 0.5, repeat: phase === 1 ? Infinity : 0 }}
            style={{
              background: phase === 2 ? `${GREEN}15` : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${phase === 2 ? `${GREEN}50` : 'rgba(255,255,255,0.12)'}`,
              transition: 'background 0.4s, border-color 0.4s',
            }}>
            {phase === 2 ? '✅' : '⬛'}
          </motion.div>
          <span className="text-[8px] font-mono text-white/30">QR scan</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="h-px w-10" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <AnimatePresence mode="wait">
            {phase === 1 && (
              <motion.div key="scanning"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}
                className="text-[8px] font-mono px-2 py-0.5 rounded whitespace-nowrap"
                style={{ background: `${GREEN}10`, color: `${GREEN}80`, border: `1px solid ${GREEN}22` }}>
                verifying…
              </motion.div>
            )}
          </AnimatePresence>
          <div className="h-px w-10" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={phase}
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-1.5">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
              style={{
                background: phase === 2 ? `${GREEN}18` : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${phase === 2 ? `${GREEN}55` : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.4s',
              }}>
              {phase === 2 ? '✓' : '?'}
            </div>
            <span className="text-[8px] font-mono transition-colors duration-400"
              style={{ color: phase === 2 ? GREEN : 'rgba(255,255,255,0.2)' }}>
              {phase === 2 ? 'Authentic' : 'awaiting'}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex gap-1.5 justify-center">
        <span className="text-[7px] font-mono px-2 py-0.5 rounded"
          style={{ background: `${GREEN}0a`, color: `${GREEN}70`, border: `1px solid ${GREEN}18` }}>
          no account required · anyone can verify
        </span>
      </div>
    </div>
  );
}
