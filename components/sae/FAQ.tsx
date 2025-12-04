"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors } from "./types"

interface FAQItem {
  question: string
  answer: string
}

function FAQAccordion({ item, colors, isOpen, onToggle }: { 
  item: FAQItem
  colors: Colors
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div 
      className="border-b"
      style={{ borderColor: `${colors.stroke}15` }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 px-1 text-left"
      >
        <span className={`text-sm sm:text-base ${colors.text} font-medium pr-4`}>
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke={colors.stroke} 
            strokeWidth="2"
            strokeOpacity={0.5}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`pb-4 px-1 text-sm ${colors.textMuted} leading-relaxed`}>
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FAQ({ colors }: { colors: Colors }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqItems: FAQItem[] = [
    {
      question: "Is finality slower with SAE?",
      answer: "No — it's technically instant. As soon as consensus accepts a transaction, finality is locked. The key insight: ordering determines the truth, execution reveals it. We have finality the moment a block is accepted — we just won't know the outcome until execution completes. Consensus determines what will happen; execution shows us what happened."
    },
    {
      question: "What problem does SAE solve?",
      answer: "Traditional blockchains bottleneck because consensus waits for execution. SAE will run them in parallel — consensus will accept transactions into a queue while execution drains it independently. More throughput, lower latency."
    },
    {
      question: "What will consensus verify in SAE?",
      answer: "Consensus will verify you can pay for the worst-case cost — gas limit × maximum possible gas price — without running the VM. In synchronous execution, validators execute every transaction to verify it. In SAE, they will only check signatures, nonces, and that senders can afford the maximum fee. Lightweight validation, same security."
    },
    {
      question: "How will transaction ordering work?",
      answer: "Order will be locked at consensus, before execution. Once a block is accepted, transaction sequence will be final. Execution will process them in that order. If Alice's swap is ordered before Bob's, Alice executes first — regardless of when execution actually runs."
    },
    {
      question: "How will a swap or DeFi transaction work in SAE?",
      answer: "Same as before, just faster. Your swap will be ordered by consensus, queued, then executed. You'll get the receipt immediately after execution — not after settlement. The 5-second settlement delay won't affect your experience; your tokens will move as soon as execution completes."
    },
    {
      question: "How will SAE prevent malicious actors?",
      answer: "Worst-case fee validation. Attackers won't be able to spam the queue with high gas-limit transactions that use minimal gas — you'll be charged at least half your gas limit. The maximum queue DoS impact will be ~12% fee inflation. If you can't afford the worst-case cost, your transaction will be rejected before it enters the queue."
    },
    {
      question: "What will the gas limits be?",
      answer: "Maximum block size will be R × τ × λ (gas rate × settlement delay × charge ratio). With R = 30M gas/sec, τ = 5s, and λ = 2, that's 300M gas per block. Queue will be capped at 2× block size. These bounds will prevent DoS while allowing bursty throughput."
    },
    {
      question: "Can transactions still fail?",
      answer: "Yes. SAE will guarantee execution and payment — not success. Reverts, out-of-gas, and contract errors will still happen. The difference: you'll know the outcome faster."
    },
    {
      question: "How fast will users see transaction results?",
      answer: "Results will stream immediately after execution. Users won't wait for settlement — receipts will arrive as soon as transactions run. Settlement will be recorded 5 seconds later for finality."
    },
    {
      question: "Will I need to change how I build?",
      answer: "For most applications, no. Your contracts will work the same. The improvement is infrastructure-level — faster block acceptance, saturated execution, instant receipts. Same APIs, better performance."
    },
    {
      question: "What future capabilities does this unlock?",
      answer: "Executing after consensus sequencing will enable features like real-time VRF and encrypted mempools for MEV protection. SAE is foundational infrastructure for the next generation of onchain applications."
    },
    {
      question: "Will SAE be available for just the C-Chain or also L1s?",
      answer: "SAE will be available for all Avalanche L1s. Every chain in the ecosystem will benefit from parallel consensus and execution."
    },
  ]

  return (
    <div className="mb-12 md:mb-24">
      <div className="flex items-center gap-4 mb-6 md:mb-8">
        <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
        <span className={`text-sm uppercase tracking-[0.2em] ${colors.text} font-medium`}>FAQ</span>
        <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
      </div>

      {/* Outer container */}
      <div 
        className="border p-2 sm:p-3"
        style={{
          borderColor: 'rgba(156, 163, 175, 0.5)',
          backgroundColor: 'rgba(156, 163, 175, 0.01)',
        }}
      >
        {/* Middle layer */}
        <div 
          className={`p-4 sm:p-6 border ${colors.border} ${colors.blockBg}`}
        >
          {faqItems.map((item, index) => (
            <FAQAccordion
              key={index}
              item={item}
              colors={colors}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
