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

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "Is Firewood production-ready?",
    answer: "Firewood is currently experimental. LevelDB remains the default and recommended database for AvalancheGo nodes. Firewood is available for testing but not yet recommended for production validators.",
  },
  {
    question: "Why not just use a faster KV store?",
    answer: "Even the fastest generic KV stores introduce double indexing. The Merkle trie gets serialized into key-value pairs, then the KV store builds its own index (LSM-tree) on top. Firewood eliminates this by storing the trie structure directly \u2014 the trie IS the index.",
  },
  {
    question: "How does Firewood handle state growth?",
    answer: "Firewood uses a malloc-like free space manager with 23 predefined area sizes (16 bytes to 16MB). When revisions expire, their unique nodes are returned to per-size free lists. This inline reclamation keeps disk usage bounded without compaction. Early engineering measurements put an archival C-Chain node at roughly 3 TB on Firewood versus ~16 TB on LevelDB — around 5× smaller.",
  },
  {
    question: "What about crash recovery?",
    answer: "Firewood guarantees recoverability by not referencing new nodes in a new revision before they are flushed to disk, and by carefully managing the free list during creation and expiration of revisions. On crash, Firewood recovers from the last fully persisted revision — no WAL replay or log reconstruction needed.",
  },
  {
    question: "Can I switch an existing node from LevelDB to Firewood?",
    answer: "Switching requires a full resync of the node with Firewood configured as the database backend.",
  },
  {
    question: "How does parallel Merkle hashing work?",
    answer: "We create 16 independent subtrees (one per nibble 0-F). Each subtree is processed by a separate worker thread via Rayon. Insertions, deletions, and hash computation within each subtree are fully independent.",
  },
  {
    question: "Does Firewood support Merkle proofs natively?",
    answer: "Yes. Since the trie structure exists directly on disk, proof generation doesn't require rebuilding the trie from flattened KV pairs. Key proofs - both exclusion and inclusioon, as well as range and change proofs between stored revisions are natively supported, making these operations faster and more efficient.",
  },
  {
    question: "Will Firewood benefit L1s or just the C-Chain?",
    answer: "Firewood is a general-purpose Merkleized state database. Any Avalanche chain \u2014 C-Chain or custom L1 \u2014 that uses Merkle Patricia Tries for state management can benefit from Firewood's performance characteristics.",
  },
]

export function FAQ({ colors }: { colors: Colors }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

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
          borderColor: "rgba(156, 163, 175, 0.5)",
          backgroundColor: "rgba(156, 163, 175, 0.01)",
        }}
      >
        {/* Inner container */}
        <div className={`p-4 sm:p-6 border ${colors.border} ${colors.blockBg}`}>
          {FAQ_ITEMS.map((item, index) => (
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
