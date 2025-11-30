"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors } from "./types"

const TX_ACTIONS = ['send', 'swap', 'mint', 'vote', 'stake', 'claim', 'bridge', 'buy']

function getRandomAction() {
  return TX_ACTIONS[Math.floor(Math.random() * TX_ACTIONS.length)]
}

export function ImmediateConfirmationCard({ colors }: { colors: Colors }) {
  const [receipts, setReceipts] = useState<{ id: number; done: boolean; action: string }[]>([])
  const idRef = useRef(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      idRef.current++
      const newId = idRef.current
      const action = getRandomAction()
      
      setReceipts(prev => [...prev.slice(-4), { id: newId, done: false, action }])
      
      setTimeout(() => {
        setReceipts(prev => prev.map(r => r.id === newId ? { ...r, done: true } : r))
      }, 200)
    }, 600)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className={`p-6 border ${colors.border} ${colors.blockBg} h-full flex flex-col`}>
      <div className="mb-6">
        <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
          See results instantly.
        </h3>
        <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
          Get transaction results the moment they execute — no waiting for settlement.
        </p>
      </div>
      
      {/* Streaming receipts */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex gap-2">
          <AnimatePresence mode="popLayout">
            {receipts.map(receipt => (
              <motion.div
                key={receipt.id}
                layout
                initial={{ scale: 0, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, x: -15, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
              >
                <motion.div
                  className="w-10 h-12 relative"
                  animate={{ 
                    backgroundColor: receipt.done ? '#22c55e20' : `${colors.stroke}10`,
                    borderColor: receipt.done ? '#22c55e' : `${colors.stroke}20`
                  }}
                  style={{ border: '1px solid' }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Fixed position content - no jitter */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-[7px] font-mono uppercase ${receipt.done ? 'text-green-500' : colors.textMuted}`}>
                      {receipt.action}
                </span>
                    <div className="h-4 flex items-center justify-center">
                      {receipt.done ? (
                  <motion.svg
                          width="14" height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                          stroke="#22c55e"
                    strokeWidth="3"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  >
                    <path d="M5 13l4 4L19 7" />
                  </motion.svg>
                      ) : (
                        <motion.div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: `${colors.stroke}30` }}
                          animate={{ opacity: [0.3, 0.7, 0.3] }}
                          transition={{ duration: 0.6, repeat: Infinity }}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        </div>
        
      {/* Use cases */}
      <div className="flex gap-2 justify-center mt-4">
        <span className={`text-[10px] px-2 py-1 ${colors.blockBgStrong} ${colors.textMuted} font-mono`}>
          Fast DeFi
        </span>
        <span className={`text-[10px] px-2 py-1 ${colors.blockBgStrong} ${colors.textMuted} font-mono`}>
          Instant payments
        </span>
      </div>
    </div>
  )
}

