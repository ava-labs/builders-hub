'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { PrivateNetworkAnim, NeedToKnowAnim, EncryptedSettlementAnim } from './model-animations';
import { UseCaseAnim } from './use-case-animations';

// ─── Design tokens ────────────────────────────────────────────────────────────
const RED     = '#E84142';
const SURFACE = 'rgba(255,255,255,0.03)';
const BORDER  = 'rgba(255,255,255,0.07)';

// ─── Data ─────────────────────────────────────────────────────────────────────

const CLIENTS = [
  { name: 'Citi',          detail: 'Private markets tokenization — Evergreen Spruce',   href: 'https://www.avax.network/about/blog/citi-tests-benefits-of-private-markets-tokenization-with-avalanche-evergreen-subnet-spruce' },
  { name: 'T. Rowe Price', detail: 'On-chain finance pilot — Evergreen Spruce',         href: 'https://www.avax.network/about/blog/financial-institutions-join-avalanche-evergreen-subnet-spruce-to-drive-on-chain-finance-innovation' },
  { name: 'BlackRock',     detail: 'Tokenized institutional fund infrastructure',       href: '/integrations/blackrock' },
  { name: 'WisdomTree',   detail: 'Digital fund infrastructure proof-of-concept',       href: '/integrations/wisdomtree' },
];

const USE_CASES = [
  {
    icon: '⇌', title: 'DVP Settlement', problem: 'Two banks exchange securities and cash. Neither wants the other to see their full position or book.', solution: 'Each leg visible only to its counterparties. Validators confirm settlement without reading amounts.', model: 'Need-to-Know Ledger', modelColor: RED, animId: 'dvp',
  },
  {
    icon: '↗', title: 'FX Netting', problem: 'Multiple institutions net bilateral exposures. Showing your full book to competitors is commercially unacceptable.', solution: 'Each bilateral relationship runs on a separate ledger. Net positions calculated without exposing gross flows to others.', model: 'Need-to-Know Ledger', modelColor: RED, animId: 'fx',
  },
  {
    icon: '◎', title: 'RWA Tokenization', problem: 'Token balances on a shared chain expose institutional holdings to anyone with a block explorer.', solution: 'Balances encrypted on-chain. Regulators receive a dedicated auditor key. Settlement verifiable without revealing amounts.', model: 'Encrypted Settlement', modelColor: '#22c55e', animId: 'rwa',
  },
  {
    icon: '⬡', title: 'Trade Finance', problem: 'LC issuance, cargo data, and pricing terms are commercially sensitive — yet multiple banks must participate.', solution: 'Permissioned network with role-based visibility. Cargo visible to logistics parties. Pricing stays between originator and buyer.', model: 'Private Network', modelColor: '#6366f1', animId: 'trade',
  },
  {
    icon: '⟳', title: 'Repo / Securities Lending', problem: 'Intraday repo positions signal trading strategy. Broadcasting these to a shared ledger is competitively damaging.', solution: 'Bilateral repo ledgers per counterparty pair. Each relationship has an isolated, private view.', model: 'Need-to-Know Ledger', modelColor: RED, animId: 'repo',
  },
  {
    icon: '⊛', title: 'Digital Bond Issuance', problem: 'KYC-verified investors need to transact, but investor identity and allocation sizes must remain confidential.', solution: 'Investor eligibility verified without exposing identity. Allocations encrypted on-chain. Auditor key for regulatory reporting.', model: 'Encrypted Settlement', modelColor: '#22c55e', animId: 'bonds',
  },
];

const MODELS = [
  {
    id: 'private-network', label: 'Model 01', name: 'Private Network', tagline: 'Only approved institutions participate', color: '#6366f1',
    analogy: 'Your own private SWIFT network — with full programmability.',
    description: 'You control who joins. Only institutions you approve can submit transactions or operate infrastructure. Block contents are hidden from the public by default.',
    bestFor: 'Closed consortia, regulated market infrastructure, single-institution tokenization platforms',
    how: ['Your institution (or consortium) controls who validates', 'Block contents hidden from public — only permissioned nodes see transactions', 'Full EVM: your existing contracts and team skills transfer unchanged'],
    compliance: 'Add regulators as permissioned read-only participants — they see what they need, nothing more.',
  },
  {
    id: 'need-to-know', label: 'Model 02', name: 'Need-to-Know Ledger', tagline: 'Each party sees only their transactions', color: RED,
    analogy: 'Like correspondent banking — each relationship is a separate account, not a shared ledger.',
    description: 'Each bilateral or multi-party relationship runs on its own isolated ledger. Non-parties cannot see that a transaction occurred at all — not amounts, not identities, not timing.',
    bestFor: 'Bilateral settlement, inter-bank clearing, multi-party consortia, FX netting',
    how: ['Each counterparty pair gets an isolated chain with its own validator set', 'Private messaging between chains via Interchain Messaging (ICM)', 'Non-parties have zero visibility — no transaction metadata leaks'],
    compliance: 'Auditor added as a separate participant on specific channels — sees only what they need, per relationship.',
  },
  {
    id: 'encrypted-settlement', label: 'Model 03', name: 'Encrypted Settlement', tagline: 'Amounts encrypted on a shared chain', color: '#22c55e',
    analogy: 'Like a sealed envelope delivered by a trusted courier who confirms delivery without reading the contents.',
    description: 'Transactions happen on shared infrastructure — so all participants benefit from liquidity and interoperability. But amounts, identities, and logic are encrypted. Validators confirm validity without seeing values.',
    bestFor: 'Tokenized assets, cross-institution liquidity pools, digital bonds, public applications with private amounts',
    how: ['Token balances encrypted — no block explorer can read holdings', 'Mathematical proofs confirm validity without revealing amounts', 'Rotatable auditor key — regulators decrypt what they need, when they need it'],
    compliance: 'Purpose-built compliance path: auditor keys, selective disclosure, cryptographic proofs for regulatory attestation.',
  },
];

const WHY_ITEMS = [
  { num: '01', icon: '⊛', title: 'Proven with your peers', body: 'Citi, T. Rowe Price, BlackRock, WisdomTree, and more have all run live pilots on Avalanche institutional infrastructure. This is not a prototype — it is a validated path.' },
  { num: '02', icon: '⚡', title: 'Live in weeks, not quarters', body: 'Spin up your own Avalanche L1 with full validator control — private validators, hidden block contents, custom compliance rules. Ecosystem tooling is available to accelerate deployment. Talk to our team to map out the right path for your institution.' },
  { num: '03', icon: '⬡', title: 'Your existing team can build it', body: 'Full EVM compatibility. Every Solidity contract, every developer skill, every existing toolchain works unchanged. No new programming language, no new runtime to learn.' },
  { num: '04', icon: '⇌', title: 'All three models on one platform', body: 'Start with a private network. Add need-to-know channels for key relationships. Layer encrypted settlement as requirements grow. No platform switching, no vendor lock-in between models.' },
  { num: '05', icon: '◎', title: 'Compliance is built in, not bolted on', body: 'Auditor keys, permissioned validators, selective disclosure — native protocol capabilities. Compliance is not a workaround for a system not designed for it; it is the architecture.' },
  { num: '06', icon: '🔒', title: 'Private cross-chain by default', body: 'Institutional chains communicate via Avalanche Warp Messaging — without routing through a public bridge. Your cross-chain activity stays confidential between participants.' },
];

// Configurator
type Step1 = 'settle' | 'tokenize' | 'bonds' | 'payments' | 'data' | null;
type Step2 = Set<'counterparties' | 'validators' | 'public'>;
type Step3 = 'audit' | 'full' | 'gdpr' | 'none' | null;

function getRecommendation(s1: Step1, s2: Step2, s3: Step3) {
  const needsEncrypted = s1 === 'tokenize' || s1 === 'bonds' || s2.has('public');
  const needsLedger    = s1 === 'settle' || s1 === 'payments';
  const needsPrivate   = s2.has('validators') && !needsEncrypted;

  const model = needsEncrypted
    ? 'Encrypted Settlement'
    : needsLedger
    ? 'Need-to-Know Ledger'
    : 'Private Network';

  const timeline = needsEncrypted ? '8–12 weeks' : needsLedger ? '6–8 weeks' : '4–6 weeks';

  const compliance =
    s3 === 'full'
      ? 'Full regulatory reporting with auditor key + selective disclosure'
      : s3 === 'audit'
      ? 'On-demand audit access via dedicated auditor participant key'
      : s3 === 'gdpr'
      ? 'Data minimization by design — only necessary data on-chain'
      : 'No regulatory constraints — full privacy defaults';

  const why: Record<NonNullable<Step1>, string> = {
    settle:   'Your use case requires counterparties to see only their own trades — not each other\'s full book.',
    tokenize: 'Tokenized assets on shared infrastructure require encrypted balances so holdings aren\'t exposed publicly.',
    bonds:    'Digital bond issuance requires private investor allocations with on-demand regulatory audit capability.',
    payments: 'Institutional payments need bilateral privacy between banks, without shared ledger exposure.',
    data:     'Data marketplace use cases benefit from a private permissioned network where access is controlled.',
  };

  return { model, timeline, compliance, why: why[s1 ?? 'settle'] ?? '' };
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
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/35">{'Avalanche · Institutional Privacy'}</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }}
          className="text-5xl md:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-6">
          {'Institutional-grade'}<br />{'privacy for'}<br /><span style={{ color: RED }}>{'enterprise finance.'}</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }}
          className="text-xl text-white/45 max-w-2xl leading-relaxed mb-10">{'The privacy infrastructure for settlement, tokenization, and clearing — with full regulatory audit capability built into the protocol. Proven with Citi, T. Rowe Price, BlackRock, WisdomTree, and more.'}</motion.p>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.28 }}
          className="flex flex-wrap gap-3 mb-16">
          <a href="#models" className="px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: RED }}>{'See how it works →'}</a>
          <a href="#configurator" className="px-6 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>{'Find my architecture'}</a>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/20 mb-4">{'Validated by institutional leaders'}</p>
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
            <p className="text-white/40 text-lg max-w-xl leading-relaxed">{'Select a scenario to see how privacy works end-to-end for that workflow.'}</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {USE_CASES.map((uc, i) => {
            const title    = uc.title;
            const problem  = uc.problem;
            const solution = uc.solution;
            const model    = uc.model;
            return (
              <FadeIn key={uc.title} delay={i * 0.05}>
                <button onClick={() => setExpanded(expanded === i ? null : i)}
                  className="w-full text-left rounded-2xl p-5 transition-all duration-200 hover:border-white/15 group"
                  style={{ background: expanded === i ? `${uc.modelColor}08` : SURFACE, border: `1px solid ${expanded === i ? `${uc.modelColor}30` : BORDER}` }}>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{uc.icon}</span>
                    <Tag color={uc.modelColor}>{model}</Tag>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{problem}</p>
                  <AnimatePresence>
                    {expanded === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${uc.modelColor}18` }}>
                          <UseCaseAnim id={uc.animId} />
                          <p className="text-[10px] font-mono uppercase tracking-widest mt-3 mb-2" style={{ color: `${uc.modelColor}60` }}>{'Avalanche solution'}</p>
                          <p className="text-sm leading-relaxed" style={{ color: `${uc.modelColor}cc` }}>{solution}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="mt-3 text-[10px] font-mono text-white/20 group-hover:text-white/35 transition-colors">
                    {expanded === i ? '↑ less' : '↓ see how'}
                  </div>
                </button>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ModelsSection() {
  const [active, setActive] = useState(0);
  const model = MODELS[active];

  const ANIMS = [<PrivateNetworkAnim key="pn" />, <NeedToKnowAnim key="ntk" />, <EncryptedSettlementAnim key="es" />];

  return (
    <section id="models" className="relative py-28 bg-[#020202] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(232,65,66,0.05) 0%, transparent 55%)' }} />
      <div className="relative max-w-5xl mx-auto px-6">
        <FadeIn>
          <div className="mb-12">
            <span className="text-[10px] font-mono text-white/25 uppercase tracking-widest">§ 02</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 mt-4 leading-tight">
              {'Three approaches.'}<br />{'One platform.'}
            </h2>
            <p className="text-white/40 text-lg max-w-xl leading-relaxed">{'Privacy on Avalanche is not one product — it is three composable architectures. Pick the one that fits your workflow, or combine them.'}</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex lg:flex-col gap-2 lg:w-56 flex-shrink-0">
              {MODELS.map((m, i) => {
                const ml = m;
                return (
                  <button key={m.id} onClick={() => setActive(i)}
                    className="flex-1 lg:flex-none flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200"
                    style={{ background: active === i ? `${m.color}0d` : 'rgba(255,255,255,0.02)', border: `1px solid ${active === i ? `${m.color}35` : BORDER}` }}>
                    <div className="w-1 h-8 rounded-full flex-shrink-0 transition-colors duration-200"
                      style={{ background: active === i ? m.color : 'rgba(255,255,255,0.07)' }} />
                    <div className="min-w-0">
                      <div className="text-[9px] font-mono uppercase tracking-widest mb-0.5 transition-colors"
                        style={{ color: active === i ? m.color : 'rgba(255,255,255,0.2)' }}>{ml.label}</div>
                      <div className="text-sm font-semibold leading-tight transition-colors"
                        style={{ color: active === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }}>{ml.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}
                  className="grid md:grid-cols-2 gap-6">
                  {/* Left: text */}
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

                  {/* Right: animation */}
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
            <p className="text-white/40 text-lg max-w-xl leading-relaxed">{'Privacy frameworks exist on every platform. Avalanche is the only one where all three models coexist, compose, and deploy at institutional scale — today.'}</p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {WHY_ITEMS.map((item, i) => {
            const il = item;
            return (
            <FadeIn key={item.num} delay={i * 0.06}>
              <div className="rounded-2xl p-5 h-full" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="font-mono text-xs text-white/15">{item.num}</span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2 leading-snug">{il.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{il.body}</p>
              </div>
            </FadeIn>
            );
          })}
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

  const toggleS2 = (v: 'counterparties' | 'validators' | 'public') => {
    setS2(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  };

  const S1_ICONS = ['⇌','◎','⊛','↗','⟨⟩'] as const;
  const S1_IDS: Step1[] = ['settle','tokenize','bonds','payments','data'];
  const S1_LABELS = ['Settle trades between counterparties', 'Tokenize real-world assets', 'Issue digital bonds or securities', 'Institutional payments / FX', 'Share data between institutions'];
  const S1_OPTS = S1_IDS.map((id, i) => ({ id, icon: S1_ICONS[i], label: S1_LABELS[i] }));

  const S2_IDS = ['counterparties','validators','public'] as const;
  const S2_OPTS_DATA = [{ label: 'Counterparties', detail: "Don't show other banks my positions" }, { label: 'Infrastructure operators', detail: "Don't show validators my data" }, { label: 'The public / competitors', detail: "Don't show amounts on a block explorer" }];
  const S2_OPTS = S2_IDS.map((id, i) => ({ id, ...S2_OPTS_DATA[i] }));

  const S3_IDS: Step3[] = ['audit','full','gdpr','none'];
  const S3_OPTS_DATA = [{ label: 'On-demand audit access', detail: 'Regulator can see when required' }, { label: 'Full regulatory reporting', detail: 'Securities, banking, or similar' }, { label: 'Data privacy laws', detail: 'GDPR, CCPA, or similar' }, { label: 'No regulatory requirements', detail: 'Internal or permissionless use case' }];
  const S3_OPTS = S3_IDS.map((id, i) => ({ id, ...S3_OPTS_DATA[i] }));

  const MODEL_COLORS: Record<string, string> = {
    'Private Network':       '#6366f1',
    'Need-to-Know Ledger':   RED,
    'Encrypted Settlement':  '#22c55e',
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
            <p className="text-white/40 text-lg max-w-xl mx-auto leading-relaxed">{'Three questions. One tailored recommendation for your institution.'}</p>
          </div>
        </FadeIn>

        {/* Progress */}
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
          {/* Step 0 */}
          {!result && step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="rounded-2xl p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <h3 className="text-xl font-bold text-white mb-1">{'What are you building?'}</h3>
                <p className="text-sm text-white/35 mb-6">{'Select the type of application or workflow.'}</p>
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

          {/* Step 1 */}
          {!result && step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="rounded-2xl p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <h3 className="text-xl font-bold text-white mb-1">{"Who needs to be kept private from whom?"}</h3>
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

          {/* Step 2 */}
          {!result && step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
              <div className="rounded-2xl p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                <h3 className="text-xl font-bold text-white mb-1">{'What compliance level do you need?'}</h3>
                <p className="text-sm text-white/35 mb-6">{'Define the regulatory requirements.'}</p>
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

          {/* Result */}
          {result && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}>
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${MODEL_COLORS[result.model] ?? RED}30` }}>
                {/* Header */}
                <div className="px-6 py-4"
                  style={{ background: `${MODEL_COLORS[result.model] ?? RED}0d`, borderBottom: `1px solid ${MODEL_COLORS[result.model] ?? RED}15` }}>
                  <p className="text-[10px] font-mono uppercase tracking-widest mb-1"
                    style={{ color: `${MODEL_COLORS[result.model] ?? RED}70` }}>
                    {'Recommended architecture'}
                  </p>
                  <h3 className="text-2xl font-bold text-white">{result.model}</h3>
                </div>

                <div className="px-6 py-6 flex flex-col gap-5" style={{ background: SURFACE }}>
                  {/* Why */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/20 font-mono mb-2">{'Why this fits your case'}</p>
                    <p className="text-sm text-white/60 leading-relaxed">{result.why}</p>
                  </div>

                  {/* Details */}
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

                  {/* Compliance */}
                  <div className="rounded-xl px-4 py-3"
                    style={{ background: `${MODEL_COLORS[result.model] ?? RED}08`, border: `1px solid ${MODEL_COLORS[result.model] ?? RED}18` }}>
                    <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5"
                      style={{ color: `${MODEL_COLORS[result.model] ?? RED}60` }}>{'Compliance approach'}</p>
                    <p className="text-sm" style={{ color: `${MODEL_COLORS[result.model] ?? RED}b0` }}>
                      {result.compliance}
                    </p>
                  </div>

                  {/* Next steps */}
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
            {'Your private chain.'}
            <br />
            {'Your rules.'}
            <br />
            <span style={{ color: RED }}>{'Your timeline.'}</span>
          </h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto leading-relaxed mb-10">
            {"Launch your own L1 on Avalanche with full validator control and institutional privacy built in. Reach out to our team — or connect with your BD contact — and we'll map out the next steps together."}
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
              {'Explore the ecosystem'}
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function PrivacyBDPage() {
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
