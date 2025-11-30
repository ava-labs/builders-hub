"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors } from "./types"

export function GuaranteedExecutionCard({ colors }: { colors: Colors }) {
  const [phase, setPhase] = useState<'incoming' | 'calculating' | 'checking' | 'accepted'>('incoming')
  const [gasLimit, setGasLimit] = useState(200)
  const [worstCasePrice, setWorstCasePrice] = useState(25)
  const [balance, setBalance] = useState(0)
  const [worstCaseCost, setWorstCaseCost] = useState(0)
  
  useEffect(() => {
    const runCycle = () => {
      // New transaction - realistic values that result in < 1 AVAX
      const newGasLimit = Math.floor(Math.random() * 80) + 21 // 21-100k gas
      const newPrice = Math.floor(Math.random() * 30) + 25 // 25-55 nAVAX
      // Cost in AVAX: gasLimit (k) * price (nAVAX) / 1e6 = milli-AVAX range
      const costValue = (newGasLimit * newPrice) / 1000000
      const cost = Math.round(costValue * 1000) / 1000 // Round to 3 decimals
      const bal = Math.round((cost + Math.random() * 0.5 + 0.1) * 1000) / 1000 // Always enough
      
      setGasLimit(newGasLimit)
      setWorstCasePrice(newPrice)
      setWorstCaseCost(cost)
      setBalance(bal)
      
      setPhase('incoming')
      setTimeout(() => setPhase('calculating'), 600)
      setTimeout(() => setPhase('checking'), 1200)
      setTimeout(() => setPhase('accepted'), 1800)
    }
    
    runCycle()
    const interval = setInterval(runCycle, 3500)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className={`p-6 border ${colors.border} ${colors.blockBg} h-full flex flex-col`}>
      <div className="mb-4">
        <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
          Pay for worst case, always execute.
        </h3>
        <p className={`text-base sm:text-sm ${colors.textMuted} leading-relaxed`}>
          If you can afford the maximum possible cost, your transaction is guaranteed to run.
        </p>
      </div>
      
      {/* Validation visualization */}
      <div className="flex-1 flex flex-col justify-center gap-4">
        {/* Transaction box */}
        <motion.div 
          className="mx-auto p-3 w-full max-w-[220px]"
          style={{ 
            backgroundColor: `${colors.stroke}08`,
            border: `1px solid ${colors.stroke}20`
          }}
          animate={{ 
            borderColor: phase === 'accepted' ? '#22c55e40' : `${colors.stroke}20`,
            backgroundColor: phase === 'accepted' ? '#22c55e08' : `${colors.stroke}08`
          }}
        >
          {/* Gas limit row */}
          <div className="flex justify-between items-center mb-2">
            <span className={`text-[10px] ${colors.textMuted} font-mono`}>Gas Limit</span>
            <motion.span 
              className={`text-xs font-mono ${colors.text}`}
              key={gasLimit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {gasLimit}k
            </motion.span>
          </div>
          
          {/* Worst case price row */}
          <motion.div 
            className="flex justify-between items-center mb-2"
            animate={{ opacity: phase === 'incoming' ? 0.3 : 1 }}
          >
            <span className={`text-[10px] ${colors.textMuted} font-mono`}>× Worst Price</span>
            <span className={`text-xs font-mono ${colors.text}`}>{worstCasePrice} nAVAX</span>
          </motion.div>
          
          {/* Divider */}
          <div className="h-px my-2" style={{ backgroundColor: `${colors.stroke}15` }} />
          
          {/* Worst case cost */}
          <motion.div 
            className="flex justify-between items-center"
            animate={{ opacity: phase === 'incoming' || phase === 'calculating' ? 0.3 : 1 }}
          >
            <span className={`text-[10px] font-mono`} style={{ color: '#ef4444' }}>Worst Case</span>
            <motion.span 
              className="text-xs font-mono font-bold"
              style={{ color: '#ef4444' }}
              animate={{ scale: phase === 'checking' ? [1, 1.1, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              {worstCaseCost} AVAX
            </motion.span>
          </motion.div>
        </motion.div>
        
        {/* Balance check */}
        <div className="flex items-center justify-center gap-3">
          <motion.div 
            className="text-center"
            animate={{ opacity: phase === 'checking' || phase === 'accepted' ? 1 : 0.3 }}
          >
            <div className={`text-[9px] ${colors.textMuted} font-mono mb-1`}>Your Balance</div>
            <div className={`text-sm font-mono ${colors.text}`}>{balance} AVAX</div>
          </motion.div>
          
          <motion.div
            animate={{ 
              opacity: phase === 'checking' || phase === 'accepted' ? 1 : 0.3,
              scale: phase === 'checking' ? [1, 1.2, 1] : 1
            }}
            transition={{ duration: 0.3 }}
          >
            <span className={`text-lg ${colors.textMuted}`}>≥</span>
          </motion.div>
          
          <motion.div 
            className="text-center"
            animate={{ opacity: phase === 'checking' || phase === 'accepted' ? 1 : 0.3 }}
          >
            <div className={`text-[9px] ${colors.textMuted} font-mono mb-1`}>Worst Case</div>
            <div className="text-sm font-mono" style={{ color: '#ef4444' }}>{worstCaseCost} AVAX</div>
          </motion.div>
          
          {/* Fixed width container to prevent layout shift */}
          <div className="w-8 h-8 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {phase === 'accepted' && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#22c55e' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Footer insight */}
      <div className={`text-[10px] ${colors.textMuted} font-mono text-center pt-3 mt-auto`} style={{ borderTop: `1px solid ${colors.stroke}10` }}>
        Can pay worst case → accepted → guaranteed to settle
      </div>
    </div>
  )
}

