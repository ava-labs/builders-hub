"use client";

import { motion, useReducedMotion } from "framer-motion";

/* ------------------------------------------------------------------ */
/* Motion helpers shared by the /solutions surfaces                    */
/* ------------------------------------------------------------------ */

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Scroll-triggered rise, the shared entrance for page blocks. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  id,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  id?: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      id={id}
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Text that slides up out of a mask the first time it scrolls into view.
 *  The mask itself watches the viewport: the text starts outside its own
 *  clip box, so it could never intersect on its own. */
export function MaskText({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.span
      className={`block overflow-hidden ${className}`}
      initial={reducedMotion ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, margin: "-40px" }}
    >
      <motion.span
        className="block"
        variants={{ hidden: { y: "105%" }, shown: { y: 0 } }}
        transition={{ duration: 0.8, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

/** Two-digit index: 1 becomes "01". */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Sentence case for the pillar data's all-caps labels and values, keeping
 * the protocol's proper nouns and acronyms intact ("P-CHAIN REGISTRY"
 * becomes "P-Chain registry", "DEDICATED L1 FINALITY" keeps "L1").
 */
export function sentenceCase(label: string): string {
  const lower = label.toLowerCase();
  return (lower.charAt(0).toUpperCase() + lower.slice(1))
    .replace(/\b([cpx])-chain\b/gi, (_, c: string) => `${c.toUpperCase()}-Chain`)
    .replace(/\bl1(s?)\b/gi, "L1$1")
    .replace(/\b(icm|ictt|evm|dvp|fx|bls|tls|rwa)\b/gi, (m) => m.toUpperCase());
}
