"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors, FIREWOOD_PALETTE } from "./types"

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
      style={{ borderColor: colors.wood + '20' }}
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
            stroke={isOpen ? FIREWOOD_PALETTE.ember : colors.stroke}
            strokeWidth="2"
            strokeOpacity={isOpen ? 1 : 0.5}
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
      question: "Why not just use LevelDB/RocksDB?",
      answer: "LevelDB and RocksDB are excellent general-purpose databases, but they're unaware of the Merkle trie structure blockchains store. They flatten the tree into key-value pairs and use content-addressing (hash → value), adding lookup overhead. They also require continuous compaction, which steals CPU and causes latency spikes. Firewood was purpose-built for blockchain state — the trie structure is the index, nodes are addressed by disk offset, and there's no compaction."
    },
    {
      question: "What is compaction and why is it bad for blockchain nodes?",
      answer: "LSM-tree databases write data sequentially to 'levels' for fast writes. Over time, data fragments across levels and must be merged (compacted) to maintain read performance. This background process consumes CPU, amplifies writes (rewriting data 10-30x), and causes unpredictable latency spikes. For blockchain validators processing blocks continuously, these pauses can affect consensus participation."
    },
    {
      question: "How does address-based storage work?",
      answer: "Instead of storing nodes by their hash (requiring a hash table lookup), Firewood stores each node at a specific disk offset. Branch nodes contain the addresses (offsets) of their children directly. To traverse the trie, you just follow these pointers — seek to address, read node, follow child address. No hash computation or lookup needed. This is similar to how B+-trees work in traditional databases."
    },
    {
      question: "How does Firewood handle deleted data?",
      answer: "When nodes become obsolete (replaced by a newer revision), they're added to a 'free list' organized by size — similar to heap memory management. New writes can reuse this free space immediately. There's also a 'future delete log' that tracks nodes to be freed when older revisions expire. This avoids the need for compaction-based garbage collection."
    },
    {
      question: "Can I access historical state?",
      answer: "Yes. Firewood supports configurable revision retention (e.g., 128-200 recent states). Each revision is a copy-on-write snapshot — unchanged nodes are shared, only modified nodes create new versions. This is optimized for validators who need recent history, not archival nodes keeping all states forever."
    },
    {
      question: "Is Firewood compatible with Ethereum?",
      answer: "Yes. While Firewood defaults to SHA256 (for Avalanche/merkledb compatibility), it supports Keccak256 via the 'ethhash' feature flag for Ethereum-compatible chains. It also understands Ethereum account structures with RLP encoding. Firewood powers Coreth, Avalanche's EVM implementation."
    },
    {
      question: "How do Merkle proofs work in Firewood?",
      answer: "Firewood provides native proof generation: single-key proofs (prove a key exists or doesn't exist), range proofs (prove all key-value pairs in a range), and change proofs (prove differences between revisions). These are essential for state sync, light clients, and cross-chain verification."
    },
    {
      question: "What's the performance like?",
      answer: "The key advantage is predictability — no compaction pauses means consistent latency. Direct trie storage means no emulation overhead. Address-based lookup means O(1) node access. Write amplification is 1x (you write data once, not 10-30x like LSM trees). Firewood also supports parallel proposal creation and io-uring for async I/O on Linux."
    },
    {
      question: "Is this production-ready?",
      answer: "Firewood is currently beta-level software (v0.0.x). The API may evolve, but it's actively used and developed. It includes comprehensive Prometheus metrics for monitoring, a Go FFI layer for non-Rust integrations, and a CLI tool (fwdctl) for database inspection and benchmarking."
    },
    {
      question: "How is this different from other blockchain databases?",
      answer: "Most blockchain state solutions either: (1) use general-purpose KV stores like LevelDB that are unaware of trie structure, or (2) keep everything in memory. Firewood is purpose-built — the on-disk format matches the logical data structure. It's designed for 'validation storage' (recent state for validators), not archival storage (all historical state)."
    },
  ]

  return (
    <div className="mb-12 md:mb-24">
      <div className="flex items-center gap-4 mb-6 md:mb-8">
        <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
        <span className={`text-sm uppercase tracking-widest ${colors.text} font-medium`}>FAQ</span>
        <div className="flex-1 h-px" style={{ backgroundColor: colors.wood + '30' }} />
      </div>

      {/* Outer container */}
      <div
        className="p-2 sm:p-3 rounded-sm"
        style={{
          backgroundColor: colors.wood + '08',
          border: `1px solid ${colors.wood}20`,
        }}
      >
        {/* Inner container */}
        <div
          className={`p-4 sm:p-6 border ${colors.border} ${colors.blockBg} rounded-sm`}
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
