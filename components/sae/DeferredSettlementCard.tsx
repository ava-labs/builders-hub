"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors } from "./types"

export function DeferredSettlementCard({ colors }: { colors: Colors }) {
  const [executedBlocks, setExecutedBlocks] = useState<number[]>([1, 2, 3])
  const [settledCount, setSettledCount] = useState(0)
  const [isSettling, setIsSettling] = useState(false)
  const [cycleKey, setCycleKey] = useState(0)
  const blockIdRef = useRef(3)
  const addBlockTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSettlingRef = useRef(false)
  
  // Add new executed blocks at varying rates
  useEffect(() => {
    const addBlock = () => {
      // Don't add blocks while settling
      if (!isSettlingRef.current) {
        blockIdRef.current++
        setExecutedBlocks(prev => [...prev, blockIdRef.current].slice(-6))
      }
      // Random delay between 400ms and 1200ms
      const nextDelay = 400 + Math.random() * 800
      addBlockTimeoutRef.current = setTimeout(addBlock, nextDelay)
    }
    addBlockTimeoutRef.current = setTimeout(addBlock, 600)
    return () => {
      if (addBlockTimeoutRef.current) clearTimeout(addBlockTimeoutRef.current)
    }
  }, [])
  
  // Settle every 5 seconds - settles ALL blocks in buffer
  useEffect(() => {
    const interval = setInterval(() => {
      isSettlingRef.current = true
      setIsSettling(true)
      
      // Clear blocks and update count
      setExecutedBlocks(prev => {
        setSettledCount(c => c + prev.length)
        return [] // Clear all
      })
      
        setTimeout(() => {
          setIsSettling(false)
        isSettlingRef.current = false
        setCycleKey(k => k + 1) // Reset animation
      }, 400)
    }, 5000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className={`p-6 border ${colors.border} ${colors.blockBg} h-full flex flex-col`}>
      <div className="mb-4">
        <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
          Execute now, settle later.
        </h3>
        <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
          Transactions run immediately. The final proof is recorded a few seconds later.
        </p>
      </div>
      
      {/* Main visualization */}
      <div className="flex-1 flex flex-col justify-center gap-4">
        {/* Executed blocks buffer */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[9px] ${colors.textMuted} font-mono uppercase`}>Executed (waiting)</span>
            <span className={`text-[9px] font-mono`} style={{ color: '#ef4444' }}>
              τ = 5s
            </span>
          </div>
          <div 
            className="h-12 relative overflow-hidden flex items-center gap-1 px-2"
            style={{ backgroundColor: `${colors.stroke}08`, border: `1px solid ${colors.stroke}15` }}
          >
            <AnimatePresence mode="popLayout">
              {executedBlocks.map((id, i) => (
                <motion.div
                  key={id}
                  layout
                  initial={{ scale: 0, x: 30 }}
                  animate={{ 
                    scale: isSettling && i < 3 ? 0.8 : 1, 
                    x: 0,
                    opacity: isSettling && i < 3 ? 0.5 : 1,
                  }}
                  exit={{ scale: 0, y: 20, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="w-8 h-8 flex-shrink-0"
                  style={{ 
                    backgroundColor: '#ef444420',
                    border: '1px solid #ef444440'
                  }}
                />
                
              ))}
            </AnimatePresence>
            
            {/* Fill indicator - pure CSS animation */}
            <div
              key={cycleKey}
              className="absolute bottom-0 left-0 h-1"
              style={{ 
                backgroundColor: '#ef4444',
                animation: 'fillBar 5s linear forwards',
              }}
            />
            <style jsx>{`
              @keyframes fillBar {
                from { width: 0%; }
                to { width: 100%; }
              }
            `}</style>
          </div>
          </div>
          
        {/* Settlement arrow */}
        <div className="flex items-center justify-center">
          <motion.div
            animate={{ y: isSettling ? [0, 4, 0] : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </motion.div>
        </div>
        
        {/* Settled counter */}
        <div 
          className="h-12 flex items-center justify-between px-3"
          style={{ backgroundColor: '#22c55e15', border: '1px solid #22c55e30' }}
        >
          <span className={`text-[10px] ${colors.textMuted} font-mono uppercase`}>Settled</span>
          <div className="flex items-center gap-2">
            <motion.span
              key={settledCount}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="text-lg font-mono font-bold text-green-500"
            >
              {settledCount}
            </motion.span>
            <span className={`text-[10px] ${colors.textMuted} font-mono`}>blocks</span>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className={`text-[10px] ${colors.textMuted} font-mono text-center pt-3 mt-2`} style={{ borderTop: `1px solid ${colors.stroke}10` }}>
        Multiple blocks settle together after τ = 5s delay
      </div>
    </div>
  )
}

