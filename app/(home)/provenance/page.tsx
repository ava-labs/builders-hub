'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { WalledGardenAnim, ConsortiumTraceAnim, PublicAttestationAnim } from './model-animations';
import { UseCaseAnim } from './use-case-animations';

// ─── Design tokens ────────────────────────────────────────────────────────────
const RED     = '#E84142';
const SURFACE = 'rgba(255,255,255,0.03)';
const BORDER  = 'rgba(255,255,255,0.07)';

// ─── Data ─────────────────────────────────────────────────────────────────────

const CLIENTS = [
  { name: 'Blockticity',           detail: 'Blockchain-powered product authentication',  href: 'https://blockticity.com' },
  { name: 'Leading manufacturer',  detail: 'Anti-counterfeit verification at scale',     href: null },
];

const USE_CASES = [
  {
    icon: '💊', title: 'Pharma Authentication',
    problem: 'Counterfeit drugs enter the supply chain at distribution points. A pharmacist cannot tell a genuine lot from a falsified one.',
    solution: 'Each lot is registered on a permissioned L1. QR scan at dispensation verifies the chain of custody from manufacturer to patient in under 2 seconds.',
    model: 'Walled-Garden L1', modelColor: RED, animId: 'pharma',
  },
  {
    icon: '👜', title: 'Luxury Goods',
    problem: 'High-value items are replicated and sold through parallel channels. Authentication relies on certificates that can themselves be forged.',
    solution: 'NFC/QR linked to an immutable on-chain record. Chain of custody from factory floor to boutique, verifiable by the end buyer without trusting a third party.',
    model: 'Walled-Garden L1', modelColor: RED, animId: 'luxury',
  },
  {
    icon: '🌾', title: 'Food Safety & Origin',
    problem: 'A contamination event requires tracing implicated product across multiple tiers of suppliers, a process that currently takes days.',
    solution: 'Every batch is attested at farm, processor, and retail. An outbreak can be traced to origin in minutes. Consumers verify provenance via QR at point of sale.',
    model: 'Consortium Trace Network', modelColor: '#6366f1', animId: 'food',
  },
  {
    icon: '✈️', title: 'Aerospace & Auto Parts',
    problem: 'Safety-critical components sourced from unauthorized suppliers have caused failures. Standard paper certificates are easily forged.',
    solution: 'Each part carries an on-chain certification record. Installation crews verify authenticity before fitting. Unauthorized parts are flagged at the scan point.',
    model: 'Walled-Garden L1', modelColor: RED, animId: 'aerospace',
  },
  {
    icon: '🔌', title: 'Electronics & Chips',
    problem: 'Counterfeit components enter global supply chains at border and distribution points, creating both safety and tariff compliance risks.',
    solution: 'Origin-of-manufacture attested at fab. Each checkpoint, assembly, border, retail, adds a verified event. Flagged components are blocked automatically.',
    model: 'Public Attestation Layer', modelColor: '#22c55e', animId: 'electronics',
  },
  {
    icon: '🎨', title: 'Art & Collectibles',
    problem: 'Provenance for physical and digital art relies on paper trails that can be lost, altered, or fabricated after the fact.',
    solution: 'ZK-attested certificate of authenticity anchored on-chain at creation. Each ownership transfer adds a cryptographically signed event. Publicly verifiable, commercially private.',
    model: 'Public Attestation Layer', modelColor: '#22c55e', animId: 'art',
  },
];

const MODELS = [
  {
    id: 'walled-garden', label: 'Tier 01', name: 'Walled-Garden L1', tagline: 'Only authorized actors touch the chain', color: RED,
    analogy: 'A private factory floor with a biometric turnstile, outsiders cannot enter, insiders are logged.',
    description: 'A fully permissioned Avalanche L1 where every participant, manufacturer, distributor, retailer, regulator, must be approved. No public RPC, no block explorer. Data is only readable by role-appropriate actors.',
    bestFor: 'Pharma, luxury goods, defense, high-value regulated supply chains',
    how: [
      'Role-gated validator set, only approved institutions operate nodes',
      'API-gated RPC, no public endpoint, no public explorer',
      'Deployer allowlists, only authorized contracts can be deployed',
      'QR/NFC at each handoff point triggers an on-chain event',
    ],
    compliance: 'Regulators added as permissioned read-only participants, they see what they need, nothing more.',
  },
  {
    id: 'consortium-trace', label: 'Tier 02', name: 'Consortium Trace Network', tagline: 'Shared verification, isolated brand data', color: '#6366f1',
    analogy: 'Like a shared port authority — multiple shipping companies use the same infrastructure, but only see their own cargo.',
    description: "Multiple brands or manufacturers share a verification infrastructure, each with isolated data visibility. A consortium member can verify any product in the network, but cannot read another brand's supply chain data.",
    bestFor: 'Food safety consortia, automotive multi-tier supply chains, cross-border trade networks',
    how: [
      'Each brand gets isolated ledger channels with its own validator subset',
      'Cross-brand verification via shared attestation protocol',
      'Regulators access specific channels without full network visibility',
      'Interchain Messaging (ICM) for multi-region coordination',
    ],
    compliance: "Audit access structured per brand channel, regulators see one brand's data without cross-contamination.",
  },
  {
    id: 'public-attestation', label: 'Tier 03', name: 'Public Attestation Layer', tagline: 'Cryptographic proof, no trusted intermediary', color: '#22c55e',
    analogy: 'Like a publicly verifiable stamp of authenticity, anyone can check it, but only the issuer could have created it.',
    description: 'Cryptographic attestations anchored on-chain. The verification is public, any consumer with a QR scanner can confirm authenticity. The underlying commercial data (pricing, supply volumes, supplier identities) stays off-chain.',
    bestFor: 'Consumer goods, art and collectibles, sustainability claims, carbon credits',
    how: [
      'On-chain ZK proof of authenticity, verifiable by anyone',
      'Commercial data kept off-chain, only the proof is public',
      'Rotatable issuer keys, certificate can be revoked without modifying chain',
      'Gasless consumer verification via meta-transaction relayer',
    ],
    compliance: 'No KYC required for consumers. Issuer identity cryptographically anchored, regulators verify issuer, not end-user.',
  },
];

const WHY_ITEMS = [
  { num: '01', icon: '⊛', title: 'Proven in production', body: "Blockticity runs product authentication on Avalanche infrastructure today. A leading pharmaceutical supply chain project is in advanced validation, the infrastructure works at regulated-industry scale." },
  { num: '02', icon: '⚡', title: 'QR verification in under 2 seconds', body: 'Avalanche L1 finality is sub-second. A scan at a pharmacy counter, a retail point of sale, or a border checkpoint returns a verified result before the transaction completes, without congestion from unrelated traffic.' },
  { num: '03', icon: '🔒', title: 'No public explorer by default', body: 'A walled-garden L1 has no public RPC endpoint and no block explorer. Competitors cannot monitor your supply volumes, distributor relationships, or pricing patterns from on-chain data.' },
  { num: '04', icon: '⬡', title: 'Role-gated from the protocol layer', body: 'Manufacturer, distributor, retailer, regulator, each role is enforced at the validator and deployer allowlist level, not by application logic alone. Permissions cannot be bypassed by a smart contract exploit.' },
  { num: '05', icon: '◎', title: 'Your existing team can build it', body: 'Full EVM compatibility. Every Solidity developer, every Web3 toolchain, every existing audit process transfers unchanged. No new language, no new runtime.' },
  { num: '06', icon: '⇌', title: 'Multi-region supply chains, one network', body: 'Avalanche Warp Messaging connects regional L1s without routing through a public bridge. A product tracked across manufacturing in Asia, distribution in Europe, and retail in the Americas stays on a single verifiable record.' },
];

// ─── Configurator ─────────────────────────────────────────────────────────────
type Step1 = 'pharma' | 'luxury' | 'food' | 'industrial' | 'electronics' | 'art' | null;
type Step2 = Set<'consumer' | 'regulator' | 'b2b' | 'internal'>;
type Step3 = 'private' | 'selective' | 'public' | null;

function getRecommendation(s1: Step1, s2: Step2, s3: Step3) {
  const isPublic    = s3 === 'public' || s1 === 'art' || s1 === 'electronics';
  const isConsortium = s2.has('b2b') || s1 === 'food';

  const model = isPublic
    ? 'Public Attestation Layer'
    : isConsortium
    ? 'Consortium Trace Network'
    : 'Walled-Garden L1';

  const timeline = isPublic ? '4-6 weeks' : isConsortium ? '6-8 weeks' : '8-12 weeks';

  const compliance =
    s3 === 'public'
      ? 'Public attestation — anyone can verify, issuer identity cryptographically anchored'
      : s3 === 'selective'
      ? 'Regulator and partner access via permissioned read-only participant keys'
      : 'Fully private — only approved actors can read or submit transactions';

  const whyMap: Record<NonNullable<Step1>, string> = {
    pharma:      'Pharmaceutical supply chains require role-gated access and sub-2-second dispensation verification — a walled-garden L1 delivers both.',
    luxury:      'Luxury goods need immutable chain-of-custody from factory to consumer, hidden from competitor monitoring.',
    food:        'Food safety traceability across multiple brands benefits from shared consortium infrastructure with isolated data channels per brand.',
    industrial:  'Industrial and aerospace parts require strict certification pipelines — a permissioned network enforces this at the protocol level.',
    electronics: 'Electronics origin attestation is best served by a public layer consumers and border authorities can verify without accounts.',
    art:         'Art provenance is publicly verifiable by design — ZK proofs anchor authenticity without exposing commercial transaction details.',
  };

  return { model, timeline, compliance, why: whyMap[s1 ?? 'pharma'] ?? '' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref  = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={seen ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}>
      {children}
    </motion.div>
  );
}

function Tag({ children, color = RED }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
      {children}
    </span>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-center bg-[#020202] overflow-hidden px-6 pt-24 pb-16">
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(232,65,66,0.08) 0%, transparent 60%)' }} />

      <div className="relative max-w-5xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center gap-2 mb-8">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: RED }} />
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/35">{'Avalanche · Supply-Chain Provenance'}</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }}
          className="text-5xl md:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-6">
          {'Anti-counterfeit'}<br />{'provenance'}<br /><span style={{ color: RED }}>{'infrastructure.'}</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }}
          className="text-xl text-white/45 max-w-2xl leading-relaxed mb-10">
          {'Every product leaves a trace. Make yours tamper-proof, with a permissioned Avalanche L1 that role-gates every actor, hides data from unauthorized eyes, and lets any QR scan return a verified result in under 2 seconds.'}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.28 }}
          className="flex flex-wrap gap-3 mb-16">
          <a href="#models" className="px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: RED }}>{'See how it works →'}</a>
          <a href="#configurator" className="px-6 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>{'Find my architecture'}</a>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/20 mb-4">{'Validated in production'}</p>
          <div className="flex flex-wrap gap-3">
            {CLIENTS.map((c, i) => {
              const inner = (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white/70">{c.name}</span>
                    {c.href && (
                      <span className="text-[9px] font-mono text-white/25">↗</span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-white/25">{c.detail}</span>
                </>
              );
              return c.href ? (
                <motion.a key={c.name} href={c.href}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + i * 0.07 }}
                  className="flex flex-col gap-0.5 px-4 py-2.5 rounded-xl transition-all duration-200 hover:border-white/20"
                  style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                  {inner}
                </motion.a>
              ) : (
                <motion.div key={c.name}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + i * 0.07 }}
                  className="flex flex-col gap-0.5 px-4 py-2.5 rounded-xl"
                  style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                  {inner}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function UseCasesSection() {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <section className="relative py-28 bg-[#020202]">
      <div className="max-w-5xl mx-auto px-6">
        <FadeIn>
          <div className="mb-12">
            <span className="text-[10px] font-mono text-white/25 uppercase tracking-widest">§ 01</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 mt-4 leading-tight">{'Your use case, solved.'}</h2>
            <p className="text-white/40 text-lg max-w-xl leading-relaxed">{'Select a scenario to see how provenance verification works end-to-end for that industry.'}</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {USE_CASES.map((uc, i) => (
            <FadeIn key={uc.title} delay={i * 0.05}>
              <button onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full text-left rounded-2xl p-5 transition-all duration-200 hover:border-white/15 group"
                style={{ background: expanded === i ? `${uc.modelColor}08` : SURFACE, border: `1px solid ${expanded === i ? `${uc.modelColor}30` : BORDER}` }}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{uc.icon}</span>
                  <Tag color={uc.modelColor}>{uc.model}</Tag>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{uc.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{uc.problem}</p>
                <AnimatePresence>
                  {expanded === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${uc.modelColor}18` }}>
                        <UseCaseAnim id={uc.animId} />
                        <p className="text-[10px] font-mono uppercase tracking-widest mt-3 mb-2" style={{ color: `${uc.modelColor}60` }}>{'Avalanche solution'}</p>
                        <p className="text-sm leading-relaxed" style={{ color: `${uc.modelColor}cc` }}>{uc.solution}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="mt-3 text-[10px] font-mono text-white/20 group-hover:text-white/35 transition-colors">
                  {expanded === i ? '↑ less' : '↓ see how'}
                </div>
              </button>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModelsSection() {
  const [active, setActive] = useState(0);
  const model = MODELS[active];

  const ANIMS = [<WalledGardenAnim key="wg" />, <ConsortiumTraceAnim key="ct" />, <PublicAttestationAnim key="pa" />];

  return (
    <section id="models" className="relative py-28 bg-[#020202] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(232,65,66,0.05) 0%, transparent 55%)' }} />
      <div className="relative max-w-5xl mx-auto px-6">
        <FadeIn>
          <div className="mb-12">
            <span className="text-[10px] font-mono text-white/25 uppercase tracking-widest">§ 02</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 mt-4 leading-tight">
              {'Three tiers.'}<br />{'One platform.'}
            </h2>
            <p className="text-white/40 text-lg max-w-xl leading-relaxed">{'Provenance on Avalanche is not one product — it is three composable architectures. Pick the one that fits your supply chain, or combine them.'}</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex lg:flex-col gap-2 lg:w-56 flex-shrink-0">
              {MODELS.map((m, i) => (
                <button key={m.id} onClick={() => setActive(i)}
                  className="flex-1 lg:flex-none flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200"
                  style={{ background: active === i ? `${m.color}0d` : 'rgba(255,255,255,0.02)', border: `1px solid ${active === i ? `${m.color}35` : BORDER}` }}>
                  <div className="w-1 h-8 rounded-full flex-shrink-0 transition-colors duration-200"
                    style={{ background: active === i ? m.color : 'rgba(255,255,255,0.07)' }} />
                  <div className="min-w-0">
                    <div className="text-[9px] font-mono uppercase tracking-widest mb-0.5 transition-colors"
                      style={{ color: active === i ? m.color : 'rgba(255,255,255,0.2)' }}>{m.label}</div>
                    <div className="text-sm font-semibold leading-tight transition-colors"
                      style={{ color: active === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }}>{m.name}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}
                  className="grid md:grid-cols-2 gap-6">
                  {(() => {
                    const ml = model;
                    return (
                      <div className="flex flex-col gap-5">
                        <div>
                          <p className="text-xs font-mono mb-1.5" style={{ color: model.color }}>{ml.tagline}</p>
                          <h3 className="text-2xl font-bold text-white mb-3">{ml.name}</h3>
                          <div className="text-xs font-mono px-3 py-2 rounded-lg mb-3 italic"
                            style={{ background: `${model.color}0a`, color: `${model.color}80`, border: `1px solid ${model.color}15` }}>
                            &ldquo;{ml.analogy}&rdquo;
                          </div>
                          <p className="text-sm text-white/50 leading-relaxed">{ml.description}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-white/22 font-mono mb-2">{'How it works'}</p>
                          <div className="space-y-2">
                            {ml.how.map((hw: string) => (
                              <div key={hw} className="flex items-start gap-2 text-sm text-white/55">
                                <span style={{ color: model.color }} className="flex-shrink-0 mt-0.5">→</span>{hw}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-xl px-4 py-3.5" style={{ background: `${model.color}0a`, border: `1px solid ${model.color}15` }}>
                          <p className="text-[10px] uppercase tracking-widest font-mono mb-1.5" style={{ color: `${model.color}70` }}>{'Compliance path'}</p>
                          <p className="text-sm" style={{ color: `${model.color}b0` }}>{ml.compliance}</p>
                        </div>
                        <div className="rounded-xl px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}` }}>
                          <p className="text-[10px] uppercase tracking-widest font-mono text-white/20 mb-1">{'Best for'}</p>
                          <p className="text-xs text-white/40 leading-relaxed">{ml.bestFor}</p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex flex-col justify-center">
                    {ANIMS[active]}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function WhySection() {
  return (
    <section className="relative py-28 bg-[#030303]">
      <div className="max-w-5xl mx-auto px-6">
        <FadeIn>
          <div className="mb-12">
            <span className="text-[10px] font-mono text-white/25 uppercase tracking-widest">§ 03</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 mt-4 leading-tight">{'Why Avalanche?'}</h2>
            <p className="text-white/40 text-lg max-w-xl leading-relaxed">{'Provenance infrastructure exists on many platforms. Avalanche is the only one where all three tiers coexist, compose, and deploy at regulated-industry scale — today.'}</p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {WHY_ITEMS.map((item, i) => (
            <FadeIn key={item.num} delay={i * 0.06}>
              <div className="rounded-2xl p-5 h-full" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="font-mono text-xs text-white/15">{item.num}</span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2 leading-snug">{item.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{item.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function ConfiguratorSection() {
  const [step, setStep] = useState(0);
  const [s1, setS1] = useState<Step1>(null);
  const [s2, setS2] = useState<Step2>(new Set());
  const [s3, setS3] = useState<Step3>(null);
  const [result, setResult] = useState<ReturnType<typeof getRecommendation> | null>(null);

  const toggleS2 = (v: 'consumer' | 'regulator' | 'b2b' | 'internal') => {
    setS2(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  };

  const S1_ICONS = ['💊', '👜', '🌾', '✈️', '🔌', '🎨'] as const;
  const S1_IDS: Step1[] = ['pharma', 'luxury', 'food', 'industrial', 'electronics', 'art'];
  const S1_LABELS = ['Pharma / Medicamentos', 'Luxury Goods', 'Food Safety', 'Industrial / Aerospace', 'Electronics', 'Art & Collectibles'];
  const S1_OPTS = S1_IDS.map((id, i) => ({ id, icon: S1_ICONS[i], label: S1_LABELS[i] }));

  const S2_IDS = ['consumer', 'regulator', 'b2b', 'internal'] as const;
  const S2_OPTS_DATA = [
    { label: 'Consumer / end buyer',           detail: 'Any person scanning a QR at point of sale' },
    { label: 'Regulatory authority',            detail: 'Customs, health authority, or auditor' },
    { label: 'B2B partners / distributors',     detail: 'Other businesses in the supply chain' },
    { label: 'Internal teams only',             detail: 'Only your own employees verify' },
  ];
  const S2_OPTS = S2_IDS.map((id, i) => ({ id, ...S2_OPTS_DATA[i] }));

  const S3_IDS: Step3[] = ['private', 'selective', 'public'];
  const S3_OPTS_DATA = [
    { label: 'Fully private',   detail: 'No public verification — authorized parties only' },
    { label: 'Selective',       detail: 'Regulators and partners only' },
    { label: 'Public',          detail: 'Any consumer can verify via QR' },
  ];
  const S3_OPTS = S3_IDS.map((id, i) => ({ id, ...S3_OPTS_DATA[i] }));

  const MODEL_COLORS: Record<string, string> = {
    'Walled-Garden L1':        RED,
    'Consortium Trace Network': '#6366f1',
    'Public Attestation Layer': '#22c55e',
  };

  return (
    <section id="configurator" className="relative py-28 bg-[#020202]">
      <div className="max-w-3xl mx-auto px-6">
        <FadeIn>
          <div className="mb-12 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-[10px] font-mono text-white/25 uppercase tracking-widest">§ 04</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">{'Find your architecture'}</h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto leading-relaxed">{'Three questions. One tailored recommendation for your supply chain.'}</p>
          </div>
        </FadeIn>

        {!result && (
          <div className="flex items-center gap-2 mb-8">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                  style={{
                    background: step === i ? RED : step > i ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${step === i ? RED : step > i ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: step === i ? '#fff' : step > i ? '#22c55e' : 'rgba(255,255,255,0.3)',
                  }}>
                  {step > i ? '✓' : i + 1}
                </div>
                {i < 2 && <div className="flex-1 h-px" style={{ background: step > i ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)' }} />}
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {!result && step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="rounded-2xl p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <h3 className="text-xl font-bold text-white mb-1">{'What industry are you in?'}</h3>
                <p className="text-sm text-white/35 mb-6">{'Select the type of supply chain.'}</p>
                <div className="flex flex-col gap-2">
                  {S1_OPTS.map(opt => (
                    <button key={opt.id} onClick={() => setS1(opt.id)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200"
                      style={{
                        background: s1 === opt.id ? `${RED}12` : 'rgba(255,255,255,0.025)',
                        border: `1px solid ${s1 === opt.id ? `${RED}40` : 'rgba(255,255,255,0.07)'}`,
                      }}>
                      <span className="text-lg w-7 text-center flex-shrink-0">{opt.icon}</span>
                      <span className="text-sm" style={{ color: s1 === opt.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={() => setStep(1)} disabled={!s1}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: s1 ? RED : 'rgba(255,255,255,0.05)',
                    color: s1 ? '#fff' : 'rgba(255,255,255,0.2)',
                    cursor: s1 ? 'pointer' : 'not-allowed',
                  }}>
                  {'Next →'}
                </button>
              </div>
            </motion.div>
          )}

          {!result && step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="rounded-2xl p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <h3 className="text-xl font-bold text-white mb-1">{'Who needs to verify authenticity?'}</h3>
                <p className="text-sm text-white/35 mb-6">{'Select all that apply.'}</p>
                <div className="flex flex-col gap-2">
                  {S2_OPTS.map(opt => {
                    const on = s2.has(opt.id);
                    return (
                      <button key={opt.id} onClick={() => toggleS2(opt.id)}
                        className="flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200"
                        style={{
                          background: on ? `${RED}12` : 'rgba(255,255,255,0.025)',
                          border: `1px solid ${on ? `${RED}40` : 'rgba(255,255,255,0.07)'}`,
                        }}>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                          style={{ background: on ? RED : 'rgba(255,255,255,0.06)', border: `1px solid ${on ? RED : 'rgba(255,255,255,0.12)'}` }}>
                          {on && <span className="text-white text-[10px]">✓</span>}
                        </div>
                        <div>
                          <div className="text-sm text-white/75 font-medium">{opt.label}</div>
                          <div className="text-[11px] text-white/30 mt-0.5">{opt.detail}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <button onClick={() => setStep(0)} className="text-sm text-white/30 hover:text-white/60 transition-colors">{'← Back'}</button>
                <button onClick={() => setStep(2)} disabled={s2.size === 0}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: s2.size > 0 ? RED : 'rgba(255,255,255,0.05)',
                    color: s2.size > 0 ? '#fff' : 'rgba(255,255,255,0.2)',
                    cursor: s2.size > 0 ? 'pointer' : 'not-allowed',
                  }}>
                  {'Next →'}
                </button>
              </div>
            </motion.div>
          )}

          {!result && step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="rounded-2xl p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <h3 className="text-xl font-bold text-white mb-1">{'How visible should verification be?'}</h3>
                <p className="text-sm text-white/35 mb-6">{'Define the visibility model.'}</p>
                <div className="flex flex-col gap-2">
                  {S3_OPTS.map(opt => (
                    <button key={opt.id} onClick={() => setS3(opt.id)}
                      className="flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200"
                      style={{
                        background: s3 === opt.id ? `${RED}12` : 'rgba(255,255,255,0.025)',
                        border: `1px solid ${s3 === opt.id ? `${RED}40` : 'rgba(255,255,255,0.07)'}`,
                      }}>
                      <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all"
                        style={{ borderColor: s3 === opt.id ? RED : 'rgba(255,255,255,0.2)', background: s3 === opt.id ? `${RED}20` : 'transparent' }}>
                        {s3 === opt.id && <div className="w-1.5 h-1.5 rounded-full" style={{ background: RED }} />}
                      </div>
                      <div>
                        <div className="text-sm text-white/75 font-medium">{opt.label}</div>
                        <div className="text-[11px] text-white/30 mt-0.5">{opt.detail}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <button onClick={() => setStep(1)} className="text-sm text-white/30 hover:text-white/60 transition-colors">{'← Back'}</button>
                <button
                  onClick={() => { if (s1 && s3) setResult(getRecommendation(s1, s2, s3)); }}
                  disabled={!s3}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: s3 ? RED : 'rgba(255,255,255,0.05)',
                    color: s3 ? '#fff' : 'rgba(255,255,255,0.2)',
                    cursor: s3 ? 'pointer' : 'not-allowed',
                  }}>
                  {'See recommendation →'}
                </button>
              </div>
            </motion.div>
          )}

          {result && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}>
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${MODEL_COLORS[result.model] ?? RED}30` }}>
                <div className="px-6 py-4"
                  style={{ background: `${MODEL_COLORS[result.model] ?? RED}0d`, borderBottom: `1px solid ${MODEL_COLORS[result.model] ?? RED}15` }}>
                  <p className="text-[10px] font-mono uppercase tracking-widest mb-1"
                    style={{ color: `${MODEL_COLORS[result.model] ?? RED}70` }}>
                    {'Recommended architecture'}
                  </p>
                  <h3 className="text-2xl font-bold text-white">{result.model}</h3>
                </div>

                <div className="px-6 py-6 flex flex-col gap-5" style={{ background: SURFACE }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/20 font-mono mb-2">{'Why this fits your case'}</p>
                    <p className="text-sm text-white/60 leading-relaxed">{result.why}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}` }}>
                      <p className="text-[9px] font-mono uppercase tracking-widest text-white/20 mb-1.5">{'Deployment timeline'}</p>
                      <p className="text-sm font-semibold text-white/70">{result.timeline}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{'production-ready pilot'}</p>
                    </div>
                    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}` }}>
                      <p className="text-[9px] font-mono uppercase tracking-widest text-white/20 mb-1.5">{'Infrastructure'}</p>
                      <p className="text-sm font-semibold text-white/70">{'Avalanche L1'}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{'sovereign, permissioned chain'}</p>
                    </div>
                  </div>

                  <div className="rounded-xl px-4 py-3"
                    style={{ background: `${MODEL_COLORS[result.model] ?? RED}08`, border: `1px solid ${MODEL_COLORS[result.model] ?? RED}18` }}>
                    <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5"
                      style={{ color: `${MODEL_COLORS[result.model] ?? RED}60` }}>{'Compliance approach'}</p>
                    <p className="text-sm" style={{ color: `${MODEL_COLORS[result.model] ?? RED}b0` }}>
                      {result.compliance}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/20 font-mono mb-3">{'Ready to move forward?'}</p>
                    <div className="flex flex-col gap-2">
                      <a href="https://www.avax.network/contact" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                        style={{ background: MODEL_COLORS[result.model] ?? RED }}>
                        {'Talk to our team →'}
                      </a>
                      <button onClick={() => { setResult(null); setStep(0); setS1(null); setS2(new Set()); setS3(null); }}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/40 transition-all hover:text-white/60"
                        style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}` }}>
                        {'← Try a different scenario'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="relative py-28 bg-[#030303] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 70% 50% at 50% 100%, ${RED}08, transparent 65%)` }} />
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <FadeIn>
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/25 mb-5">
            {'Build on Avalanche'}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            {'Your supply chain.'}
            <br />
            {'Your rules.'}
            <br />
            <span style={{ color: RED }}>{'Tamper-proof.'}</span>
          </h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto leading-relaxed mb-10">
            {"Launch your own provenance L1 on Avalanche — or reach out to our team and your BD contact to define the right architecture for your industry."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="https://www.avax.network/contact"
              className="px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-200"
              style={{ background: RED }}>
              {'Talk to our team →'}
            </a>
            <a href="/integrations"
              className="px-7 py-3.5 rounded-xl text-sm font-semibold text-white/60 transition-all duration-200 hover:text-white"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
              {'Explore integrations'}
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function ProvenancePage() {
  return (
    <div className="bg-[#020202] text-white overflow-x-hidden">
      <HeroSection />
      <UseCasesSection />
      <ModelsSection />
      <WhySection />
      <ConfiguratorSection />
      <CTASection />
    </div>
  );
}
