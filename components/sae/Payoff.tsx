"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors } from "./types"

function VRFCard({ colors }: { colors: Colors }) {
  const [seed, setSeed] = useState("0x7a3f...")
  const [randomValue, setRandomValue] = useState("0x9c2e...")
  const [isGenerating, setIsGenerating] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "verifying" | "verified">("idle")
  
  useEffect(() => {
    const interval = setInterval(() => {
      // Start generation
      setIsGenerating(true)
      setVerifyStatus("idle")
      
      // Generate new random hex values
      const newSeed = "0x" + Math.random().toString(16).slice(2, 6) + "..."
      setSeed(newSeed)
      
      setTimeout(() => {
        const newRandom = "0x" + Math.random().toString(16).slice(2, 6) + "..."
        setRandomValue(newRandom)
        setIsGenerating(false)
        setVerifyStatus("verifying")
        
        setTimeout(() => {
          setVerifyStatus("verified")
        }, 400)
      }, 600)
    }, 2500)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className={`p-6 border ${colors.border} ${colors.blockBg} h-full flex flex-col`}>
      <div className="mb-5">
        <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
          Real-time VRF
        </h3>
        <p className={`text-base sm:text-sm ${colors.textMuted} leading-relaxed`}>
          Consensus artifacts become available during execution. Expose a verifiable random function for provably fair on-chain randomness.
        </p>
      </div>
      
      <div className="flex-1 flex flex-col justify-center gap-4">
        {/* Consensus seed input */}
        <div className="flex items-center gap-3">
          <div 
            className="flex-shrink-0 px-2 py-1 text-[9px] font-mono uppercase"
            style={{ backgroundColor: `${colors.stroke}15`, border: `1px solid ${colors.stroke}20` }}
          >
            <span className={colors.textMuted}>Consensus</span>
          </div>
          <motion.div
            className="flex-1 h-10 flex items-center px-3 font-mono text-sm"
            style={{ backgroundColor: `${colors.stroke}10`, border: `1px solid ${colors.stroke}20` }}
            animate={{ 
              borderColor: isGenerating ? `${colors.stroke}50` : `${colors.stroke}20`
            }}
          >
            <span className={colors.textMuted}>seed:</span>
            <motion.span 
              className={`ml-2 ${colors.text}`}
              key={seed}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {seed}
            </motion.span>
          </motion.div>
        </div>
        
        {/* Arrow */}
        <div className="flex justify-center">
          <motion.div
            animate={{ y: isGenerating ? [0, 3, 0] : 0 }}
            transition={{ duration: 0.3, repeat: isGenerating ? Infinity : 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="2" opacity={0.5}>
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </motion.div>
        </div>
        
        {/* VRF output */}
        <div className="flex items-center gap-3">
          <div 
            className="flex-shrink-0 px-2 py-1 text-[9px] font-mono uppercase"
            style={{ backgroundColor: '#8b5cf620', border: '1px solid #8b5cf640' }}
          >
            <span style={{ color: '#8b5cf6' }}>VRF</span>
          </div>
          <motion.div
            className="flex-1 h-10 flex items-center justify-between px-3 font-mono text-sm"
            style={{ backgroundColor: '#8b5cf610', border: '1px solid #8b5cf620' }}
            animate={{ 
              borderColor: verifyStatus === "verified" ? '#22c55e' : '#8b5cf620'
            }}
          >
            <div>
              <span className={colors.textMuted}>rand:</span>
              <motion.span 
                className={`ml-2 ${colors.text}`}
                key={randomValue}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                {randomValue}
              </motion.span>
            </div>
            <AnimatePresence mode="wait">
              {verifyStatus === "verified" && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  width="16" height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="3"
                >
                  <path d="M5 13l4 4L19 7" />
                </motion.svg>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
        
        {/* Status */}
        <div className="flex justify-center">
          <span className={`text-[10px] font-mono ${colors.textMuted}`}>
            {verifyStatus === "verified" ? "✓ provably fair" : verifyStatus === "verifying" ? "verifying..." : "generating..."}
          </span>
        </div>
      </div>
    </div>
  )
}

const TX_ACTIONS = ['send', 'swap', 'mint', 'vote', 'stake', 'claim', 'bridge', 'buy']

function getRandomAction() {
  return TX_ACTIONS[Math.floor(Math.random() * TX_ACTIONS.length)]
}

function EncryptedMempoolCard({ colors }: { colors: Colors }) {
  const [transactions, setTransactions] = useState<{ id: number; action: string }[]>([
    { id: 1, action: 'swap' },
    { id: 2, action: 'send' },
    { id: 3, action: 'mint' },
    { id: 4, action: 'vote' },
  ])
  const idRef = useRef(4)
  
  useEffect(() => {
    // Add new tx and remove oldest
    const interval = setInterval(() => {
      idRef.current++
      setTransactions(prev => [...prev.slice(1), { id: idRef.current, action: getRandomAction() }])
    }, 1500)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className={`p-6 border ${colors.border} ${colors.blockBg} h-full flex flex-col`}>
      <div className="mb-5">
        <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
          Encrypted mempool
        </h3>
        <p className={`text-base sm:text-sm ${colors.textMuted} leading-relaxed`}>
          Sequence transactions before revealing contents. Front-running and MEV extraction become significantly harder.
        </p>
      </div>
      
      <div className="flex-1 flex flex-col justify-center gap-4">
        {/* Mempool queue */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[9px] font-mono uppercase ${colors.textMuted}`}>Mempool Queue</span>
            <span className={`text-[9px] font-mono ${colors.textMuted}`}>sequence → reveal</span>
          </div>
          <div 
            className="h-16 flex items-center gap-2 px-3 overflow-hidden"
            style={{ backgroundColor: `${colors.stroke}08`, border: `1px solid ${colors.stroke}15` }}
          >
            <AnimatePresence mode="popLayout">
              {transactions.map((tx, idx) => {
                const isRevealed = idx === 0 // Leftmost is always revealed
                return (
                  <motion.div
                    key={tx.id}
                    layout
                    initial={{ scale: 0, x: 30 }}
                    animate={{ scale: 1, x: 0 }}
                    exit={{ scale: 0.8, x: -20, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-12 h-12 flex flex-col items-center justify-center flex-shrink-0 relative overflow-hidden"
                    style={{ 
                      backgroundColor: isRevealed ? '#ef444415' : `${colors.stroke}15`,
                      border: `1px solid ${isRevealed ? '#ef444440' : `${colors.stroke}40`}`,
                    }}
                  >
                    {!isRevealed && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeOpacity={0.6} strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    )}
                    {isRevealed && (
                      <motion.div
                        className="flex flex-col items-center justify-center"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className={`text-[7px] font-mono uppercase`} style={{ color: '#ef4444' }}>{tx.action}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 8v4M12 16h.01" />
                        </svg>
                      </motion.div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Protection indicators */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2" style={{ backgroundColor: colors.stroke, opacity: 0.6 }} />
            <span className={`text-[9px] font-mono ${colors.textMuted}`}>encrypted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2" style={{ backgroundColor: '#ef4444' }} />
            <span className={`text-[9px] font-mono ${colors.textMuted}`}>executed</span>
          </div>
        </div>
        
        {/* MEV protection badge */}
        <div className="flex justify-center">
          <div 
            className="px-3 py-1.5 text-[10px] font-mono"
            style={{ backgroundColor: '#22c55e15', border: '1px solid #22c55e40' }}
          >
            <span style={{ color: '#22c55e' }}>✓ front-running blocked</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Payoff({ colors }: { colors: Colors }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg md:text-xl font-bold ${colors.text} mb-2`}>
          What this enables
        </h3>
        <p className={`text-sm ${colors.textMuted}`}>
          When paired with{" "}
          <a 
            href="https://github.com/ava-labs/Simplex" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline hover:opacity-80"
            style={{ color: '#3b82f6' }}
          >
            Simplex
          </a>
          {" "}and DKG (Distributed Key Generation)
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="min-h-[300px]">
          <VRFCard colors={colors} />
        </div>
        <div className="min-h-[300px]">
          <EncryptedMempoolCard colors={colors} />
        </div>
      </div>
      
      <p className={`text-xs ${colors.textMuted} font-mono font-medium`}>
        *Streaming async execution is required to implement these features.
      </p>
    </div>
  )
}
