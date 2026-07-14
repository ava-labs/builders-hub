'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const RED    = '#E84142';
const GREEN  = '#22c55e';
const INDIGO = '#6366f1';
const AMBER  = '#f59e0b';

export function PharmaAnim() {
  const [step, setStep] = useState<0|1|2>(0);
  const [authentic, setAuthentic] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setStep(s => {
        const next = ((s + 1) % 3) as 0|1|2;
        if (next === 2) setAuthentic(a => !a);
        return next;
      });
    }, 1100);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full rounded-xl flex items-center justify-between px-4 gap-2"
      style={{ height: 88, background: `${RED}07`, border: `1px solid ${RED}18` }}>
      <div className="flex flex-col items-center gap-1 w-16 flex-shrink-0">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
          style={{ background: `${RED}15`, border: `1.5px solid ${step === 0 ? `${RED}60` : `${RED}20`}`, transition: 'border-color 0.3s' }}>
          💊
        </div>
        <span className="text-[7px] font-mono text-center" style={{ color: `${RED}80` }}>Lot #[SCAN]</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div className="h-px w-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="verify" className="text-[8px] font-mono px-2 py-0.5 rounded whitespace-nowrap"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}
              style={{ background: `${AMBER}12`, color: `${AMBER}b0`, border: `1px solid ${AMBER}25` }}>
              [VERIFYING…]
              <span className="inline-block ml-1 w-1.5 h-1.5 rounded-full align-middle"
                style={{ background: AMBER, animation: 'pulse 0.8s infinite' }} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="h-px w-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
      </div>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>⬡</div>
      <div className="flex flex-col items-center gap-0.5">
        <div className="h-px w-8" style={{ background: 'rgba(255,255,255,0.1)' }} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step === 2 ? (authentic ? 'ok' : 'block') : 'idle'}
          initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.25 }}
          className="flex flex-col items-center gap-1 w-20 flex-shrink-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{
              background: step !== 2 ? 'rgba(255,255,255,0.04)' : authentic ? `${GREEN}15` : `${RED}15`,
              border: `1.5px solid ${step !== 2 ? 'rgba(255,255,255,0.1)' : authentic ? `${GREEN}50` : `${RED}50`}`,
              color: step !== 2 ? 'rgba(255,255,255,0.2)' : authentic ? GREEN : RED,
              transition: 'all 0.3s',
            }}>
            {step !== 2 ? '?' : authentic ? '✓' : '✗'}
          </div>
          <span className="text-[7px] font-mono text-center transition-colors duration-300"
            style={{ color: step !== 2 ? 'rgba(255,255,255,0.2)' : authentic ? GREEN : RED }}>
            {step !== 2 ? 'pending' : authentic ? 'Authentic' : 'BLOCKED'}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function LuxuryAnim() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % 3), 1300);
    return () => clearInterval(id);
  }, []);
  const NODES = [
    { label: 'Factory', day: 'Day 0',  icon: '🏭' },
    { label: 'Customs', day: 'Day 14', icon: '🛃' },
    { label: 'Boutique', day: 'Day 31', icon: '🛍' },
  ];
  const COLOR = AMBER;
  return (
    <div className="w-full rounded-xl flex flex-col justify-center gap-2 px-4"
      style={{ height: 88, background: `${COLOR}07`, border: `1px solid ${COLOR}18` }}>
      <div className="flex items-center justify-between gap-1">
        {NODES.map((n, i) => (
          <div key={n.label} className="flex flex-col items-center gap-0.5 flex-1">
            <motion.div className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
              animate={{ scale: active === i ? 1.1 : 1 }}
              transition={{ duration: 0.3 }}
              style={{
                background: active === i ? `${COLOR}20` : `${COLOR}08`,
                border: `1.5px solid ${active === i ? `${COLOR}60` : `${COLOR}18`}`,
                transition: 'background 0.3s, border-color 0.3s',
              }}>
              {n.icon}
            </motion.div>
            <span className="text-[7px] font-mono transition-colors duration-300"
              style={{ color: active === i ? `${COLOR}cc` : 'rgba(255,255,255,0.25)' }}>
              {n.label}
            </span>
            <span className="text-[6px] font-mono" style={{ color: active === i ? `${COLOR}80` : 'transparent' }}>
              {n.day}
            </span>
            {i < NODES.length - 1 && (
              <div />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center">
        <span className="text-[7px] font-mono px-2 py-0.5 rounded"
          style={{ background: `${COLOR}10`, color: `${COLOR}80`, border: `1px solid ${COLOR}20` }}>
          NFC/QR · chain of custody
        </span>
      </div>
    </div>
  );
}

export function FoodAnim() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % 3), 1200);
    return () => clearInterval(id);
  }, []);
  const NODES = [
    { label: 'Farm',      icon: '🌾' },
    { label: 'Processor', icon: '🏭' },
    { label: 'Retail',    icon: '🛒' },
  ];
  return (
    <div className="w-full rounded-xl flex items-center justify-between px-4 gap-2"
      style={{ height: 88, background: `${GREEN}06`, border: `1px solid ${GREEN}15` }}>
      {NODES.map((n, i) => (
        <div key={n.label} className="flex flex-col items-center gap-1 flex-1 relative">
          <div className="relative">
            <motion.div className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
              animate={{ scale: active === i ? 1.1 : 1 }}
              transition={{ duration: 0.3 }}
              style={{
                background: active === i ? `${GREEN}18` : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${active === i ? `${GREEN}55` : 'rgba(255,255,255,0.1)'}`,
                transition: 'background 0.3s, border-color 0.3s',
              }}>
              {n.icon}
            </motion.div>
            <AnimatePresence>
              {active === i && (
                <motion.div key="badge"
                  initial={{ opacity: 0, scale: 0.7, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: -2 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.2 }}
                  className="absolute -top-2 -right-2 text-[7px] font-bold px-1 rounded"
                  style={{ background: GREEN, color: '#000' }}>
                  ✓
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <span className="text-[7px] font-mono transition-colors duration-300"
            style={{ color: active === i ? `${GREEN}cc` : 'rgba(255,255,255,0.25)' }}>
            {n.label}
          </span>
          {i < NODES.length - 1 && (
            <div className="absolute right-0 top-4 w-px h-1" style={{ background: 'transparent' }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function AerospaceAnim() {
  const [phase, setPhase] = useState<0|1>(0);
  useEffect(() => {
    const id = setInterval(() => setPhase(p => p === 0 ? 1 : 0), 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full rounded-xl flex flex-col justify-center gap-2 px-4"
      style={{ height: 88, background: `${INDIGO}06`, border: `1px solid ${INDIGO}15` }}>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-10 h-8 rounded-lg flex items-center justify-center text-[9px] font-mono"
            style={{ background: `${INDIGO}15`, border: `1.5px solid ${INDIGO}40`, color: `${INDIGO}cc` }}>
            PART-<br />4471X
          </div>
          <span className="text-[6.5px] font-mono text-white/25">component</span>
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <AnimatePresence mode="wait">
            <motion.div key={phase}
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.3 }}>
              {phase === 0 ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                  style={{ background: `${AMBER}10`, border: `1px solid ${AMBER}25` }}>
                  <span className="text-[9px]">🔍</span>
                  <span className="text-[8px] font-mono" style={{ color: `${AMBER}b0` }}>certifier reviewing…</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                  style={{ background: `${GREEN}10`, border: `1px solid ${GREEN}25` }}>
                  <span className="text-[9px]">✅</span>
                  <span className="text-[8px] font-mono" style={{ color: `${GREEN}b0` }}>installed · verified</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full"
              style={{ background: phase === 1 ? GREEN : AMBER, transition: 'background 0.4s' }} />
            <span className="text-[7px] font-mono text-white/25">
              {phase === 0 ? 'scan in progress' : 'on-chain confirmed'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ElectronicsAnim() {
  const [step, setStep] = useState(0);
  const [flagged, setFlagged] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setStep(s => {
        const next = (s + 1) % 3;
        if (next === 2) setFlagged(f => !f);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const STAGES = [
    { label: 'Chip Fab', icon: '🔌' },
    { label: 'Assembly', icon: '🖥' },
    { label: 'Border',   icon: '🏛' },
  ];
  return (
    <div className="w-full rounded-xl flex items-center justify-between px-4 gap-2"
      style={{ height: 88, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {STAGES.map((s, i) => (
        <div key={s.label} className="flex flex-col items-center gap-1 flex-1">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all duration-300"
            style={{
              background: i === 2
                ? (step === 2 ? (flagged ? `${RED}15` : `${GREEN}15`) : 'rgba(255,255,255,0.04)')
                : (i <= step ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'),
              border: i === 2
                ? (step === 2 ? `1.5px solid ${flagged ? `${RED}50` : `${GREEN}50`}` : '1.5px solid rgba(255,255,255,0.1)')
                : `1.5px solid ${i <= step ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
            }}>
            {s.icon}
          </div>
          <span className="text-[7px] font-mono transition-colors duration-300"
            style={{ color: i <= step ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)' }}>
            {s.label}
          </span>
          {i === 2 && step === 2 && (
            <span className="text-[7px] font-mono font-bold transition-colors duration-300"
              style={{ color: flagged ? RED : GREEN }}>
              {flagged ? '✗ flagged' : '✓ verified'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function ArtAnim() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % 3), 1400);
    return () => clearInterval(id);
  }, []);
  const OWNERS = [
    { label: 'Creator',   icon: '🎨' },
    { label: 'Gallery',   icon: '🖼'  },
    { label: 'Collector', icon: '👤' },
  ];
  return (
    <div className="w-full rounded-xl flex flex-col justify-center gap-2 px-4"
      style={{ height: 88, background: `${AMBER}06`, border: `1px solid ${AMBER}15` }}>
      <div className="flex items-center justify-between gap-1">
        {OWNERS.map((o, i) => (
          <div key={o.label} className="flex flex-col items-center gap-0.5 flex-1">
            <motion.div className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
              animate={{ scale: active === i ? 1.1 : 1 }}
              transition={{ duration: 0.3 }}
              style={{
                background: active === i ? `${AMBER}20` : `${AMBER}08`,
                border: `1.5px solid ${active === i ? `${AMBER}60` : `${AMBER}18`}`,
                transition: 'background 0.3s, border-color 0.3s',
              }}>
              {o.icon}
            </motion.div>
            <span className="text-[7px] font-mono transition-colors duration-300"
              style={{ color: active === i ? `${AMBER}cc` : 'rgba(255,255,255,0.25)' }}>
              {o.label}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-center">
        <AnimatePresence mode="wait">
          <motion.span key={active}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}
            className="text-[7px] font-mono px-2 py-0.5 rounded"
            style={{ background: `${AMBER}10`, color: `${AMBER}80`, border: `1px solid ${AMBER}20` }}>
            ZK proof · ownership transfer →{OWNERS[active].label}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

const USE_CASE_ANIM_MAP: Record<string, React.FC> = {
  pharma:      PharmaAnim,
  luxury:      LuxuryAnim,
  food:        FoodAnim,
  aerospace:   AerospaceAnim,
  electronics: ElectronicsAnim,
  art:         ArtAnim,
};

export function UseCaseAnim({ id }: { id: string }) {
  const Comp = USE_CASE_ANIM_MAP[id];
  return Comp ? <Comp /> : null;
}
