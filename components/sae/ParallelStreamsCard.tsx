"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors } from "./types"

export function ParallelStreamsCard({ colors }: { colors: Colors }) {
  const [consensusBlocks, setConsensusBlocks] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8])
  const [executionBlocks, setExecutionBlocks] = useState<number[]>([1, 2, 3, 4, 5])
  const [executedWaiting, setExecutedWaiting] = useState<number[]>([]) // Blocks waiting for settlement (τ = 5s)
  const [settledBlocks, setSettledBlocks] = useState<number[]>([])
  const [settledCount, setSettledCount] = useState(0)
  const [activeConsensus, setActiveConsensus] = useState(8)
  const [activeExecution, setActiveExecution] = useState(5)
  const [consensusFlash, setConsensusFlash] = useState(false)
  const [consensusBurst, setConsensusBurst] = useState(false) // Visual indicator of fast consensus
  const [executionBurst, setExecutionBurst] = useState(false) // Visual indicator of execution catching up
  const [executionDuration, setExecutionDuration] = useState(0.4) // Duration for fill animation in seconds
  const [cycleKey, setCycleKey] = useState(0)
  const blockIdRef = useRef(8)
  const executionQueueRef = useRef<number[]>([6, 7, 8])
  const consensusTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const execTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  
  useEffect(() => {
    isMountedRef.current = true
    
    // Consensus - variable speed, execution follows immediately
    const scheduleConsensus = () => {
      if (!isMountedRef.current) return
      
      blockIdRef.current++
      // Keep block IDs reasonable (wrap around)
      if (blockIdRef.current > 99) blockIdRef.current = 1
      const newId = blockIdRef.current
      setConsensusBlocks(prev => [...prev.slice(-9), newId])
      setActiveConsensus(newId)
      executionQueueRef.current.push(newId)
      
      // Variable consensus speed - mostly fast with occasional slowdowns
      const rand = Math.random()
      let delay: number
      if (rand < 0.4) {
        // Very fast burst - 40% chance
        delay = 300 + Math.random() * 150
        setConsensusBurst(true)
        setTimeout(() => isMountedRef.current && setConsensusBurst(false), 150)
      } else if (rand < 0.7) {
        // Fast - 30% chance
        delay = 450 + Math.random() * 200
        setConsensusBurst(true)
        setTimeout(() => isMountedRef.current && setConsensusBurst(false), 150)
      } else if (rand < 0.9) {
        // Normal - 20% chance
        delay = 650 + Math.random() * 250
      } else {
        // Occasional slow - 10% chance
        delay = 1000 + Math.random() * 500
      }
      
      consensusTimeoutRef.current = setTimeout(scheduleConsensus, delay)
    }
    consensusTimeoutRef.current = setTimeout(scheduleConsensus, 400)
    
    // Execution - stays right behind consensus
    const scheduleExecution = () => {
      if (!isMountedRef.current) return
      const queueLen = executionQueueRef.current.length
      
      if (queueLen === 0) {
        // No blocks to execute - check again very soon
        execTimeoutRef.current = setTimeout(scheduleExecution, 50)
        return
      }
      
      // Execute immediately - stay on consensus's tail
      let executionTime: number
      
      if (queueLen > 1) {
        // Any backlog - clear it fast
        executionTime = 80 + Math.random() * 60
        setExecutionBurst(true)
        setTimeout(() => isMountedRef.current && setExecutionBurst(false), 60)
      } else {
        // Just 1 block - execute quickly but visibly
        executionTime = 150 + Math.random() * 100
      }
      
      // Start executing this block
      const toExecute = executionQueueRef.current.shift()!
      setExecutionBlocks(prev => [...prev.slice(-8), toExecute])
      setActiveExecution(toExecute)
      
      // Fill animation duration matches execution time exactly
      setExecutionDuration(executionTime / 1000)
      
      // When execution completes: add to Executed (keep in execution lane for visual), start next block
      setTimeout(() => {
        if (isMountedRef.current) {
          // Add completed block to Executed waiting
          setExecutedWaiting(prev => [...prev, toExecute])
          // Clear active execution (block stays in lane, just not filling anymore)
          setActiveExecution(-1)
          
          // Immediately start next execution
          scheduleExecution()
        }
      }, executionTime)
    }
    execTimeoutRef.current = setTimeout(scheduleExecution, 400)
    
    // Settlement happens every 5 seconds - clears ALL executed blocks at once
    const settleInterval = setInterval(() => {
      if (!isMountedRef.current) return
      setExecutedWaiting(prev => {
        if (prev.length === 0) return prev
        const batchSize = prev.length
        setSettledBlocks(prev)
        setSettledCount(c => c + batchSize)
        setConsensusFlash(true)
        setCycleKey(k => k + 1)
        setTimeout(() => {
          if (isMountedRef.current) setConsensusFlash(false)
        }, 400)
        return []
      })
    }, 5000)
    
    return () => {
      isMountedRef.current = false
      if (consensusTimeoutRef.current) clearTimeout(consensusTimeoutRef.current)
      if (execTimeoutRef.current) clearTimeout(execTimeoutRef.current)
      clearInterval(settleInterval)
    }
  }, [])
  
  return (
    <div className={`p-6 border ${colors.border} ${colors.blockBg} h-full flex flex-col col-span-1 md:col-span-2`}>
      <div className="mb-5">
        <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
          Two engines, full speed.
        </h3>
        <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
          Consensus and execution run in parallel. No more waiting for one to finish before starting the other.
        </p>
      </div>
      
      {/* Parallel streams - full width lanes */}
      <div className="flex-1 flex flex-col justify-center gap-2">
        {/* Consensus lane - runs ahead */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <motion.div 
              className="w-2 h-2" 
              animate={{ 
                backgroundColor: consensusFlash ? '#22c55e' : consensusBurst ? `${colors.stroke}` : `${colors.stroke}60`,
                scale: consensusBurst ? [1, 1.3, 1] : 1,
              }}
              transition={{ duration: 0.15 }}
            />
            <span className={`text-[10px] ${colors.text} font-mono uppercase`}>Consensus</span>
            <span className={`text-[9px] ${colors.textMuted} font-mono`}>runs ahead</span>
            </div>
          <motion.div 
            className="h-8 flex items-center gap-0.5 px-1.5 overflow-hidden"
            animate={{
              backgroundColor: consensusFlash ? '#22c55e10' : consensusBurst ? `${colors.stroke}12` : `${colors.stroke}05`,
              borderColor: consensusFlash ? '#22c55e50' : consensusBurst ? `${colors.stroke}40` : `${colors.stroke}15`,
            }}
            transition={{ duration: 0.1 }}
            style={{ border: '1px solid' }}
          >
            <AnimatePresence mode="popLayout">
              {consensusBlocks.map((id) => (
              <motion.div
                  key={`c-${id}`}
                  layout
                  initial={{ scale: 0, x: 20, opacity: 0 }}
                  animate={{ scale: 1, x: 0, opacity: id === activeConsensus ? 1 : 0.6 }}
                  exit={{ scale: 0.8, x: -20, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 25 }}
                  className="w-6 h-6 flex-shrink-0 flex items-center justify-center"
                  style={{ 
                    backgroundColor: id === activeConsensus ? `${colors.stroke}25` : `${colors.stroke}15`,
                    border: id === activeConsensus ? `1.5px solid ${colors.stroke}50` : `1px solid ${colors.stroke}20`,
                  }}
                >
                  {id === activeConsensus ? (
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: colors.stroke }}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeOpacity={0.4} strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="flex-1" />
            <span className={`text-[8px] font-mono flex-shrink-0 opacity-50`} style={{ color: colors.stroke }}>→</span>
          </motion.div>
        </div>
        
        {/* Execution lane - follows consensus */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <motion.div 
              className="w-2 h-2" 
              style={{ backgroundColor: '#ef4444' }}
              animate={{ scale: executionBurst ? [1, 1.3, 1] : 1 }}
              transition={{ duration: 0.15 }}
            />
            <span className={`text-[10px] ${colors.text} font-mono uppercase`}>Execution</span>
            <span className={`text-[9px] ${colors.textMuted} font-mono`}>catches up</span>
            </div>
          <motion.div 
            className="h-8 flex items-center gap-0.5 px-1.5 overflow-hidden"
            animate={{
              backgroundColor: executionBurst ? '#ef444412' : `${colors.stroke}05`,
              borderColor: executionBurst ? '#ef444450' : `${colors.stroke}15`,
            }}
            transition={{ duration: 0.1 }}
            style={{ border: '1px solid' }}
          >
            <AnimatePresence mode="popLayout">
              {executionBlocks.map((id) => {
                const isActive = id === activeExecution
                return (
                  <motion.div
                    key={`e-${id}`}
                    layout
                    initial={{ scale: 0, x: 20, opacity: 0 }}
                    animate={{ scale: 1, x: 0, opacity: isActive ? 1 : 0.7 }}
                    exit={{ scale: 0.8, x: -20, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 25 }}
                    className="w-6 h-6 flex-shrink-0 relative overflow-hidden"
                    style={{ 
                      backgroundColor: isActive ? '#ef444415' : '#ef444440',
                      border: isActive ? '1.5px solid #ef4444' : '1px solid #ef444450',
                    }}
                  >
                    {isActive ? (
                      <motion.div
                        key={`fill-${id}-${executionDuration}`}
                        className="absolute bottom-0 left-0 right-0"
                        style={{ backgroundColor: '#ef4444' }}
                        initial={{ height: 0 }}
                        animate={{ height: '100%' }}
                        transition={{ duration: executionDuration, ease: "linear" }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
          </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div className="flex-1" />
            <span className={`text-[8px] font-mono flex-shrink-0 opacity-50`} style={{ color: '#ef4444' }}>→</span>
          </motion.div>
        </div>
        
        {/* Executed (waiting τ) lane - blocks waiting 5s before settlement */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2" style={{ backgroundColor: '#f59e0b' }} />
            <span className={`text-[10px] ${colors.text} font-mono uppercase`}>Executed</span>
            <span className={`text-[9px] ${colors.textMuted} font-mono`}>waiting τ = 5s</span>
            </div>
          <div 
            className="h-8 flex items-center gap-0.5 px-1.5 overflow-hidden relative"
            style={{ backgroundColor: `${colors.stroke}05`, border: `1px solid ${colors.stroke}15` }}
          >
            <AnimatePresence mode="popLayout">
              {executedWaiting.map((id) => (
                <motion.div
                  key={`w-${id}`}
                  layout
                  initial={{ scale: 0, x: 15 }}
                  animate={{ scale: 1, x: 0 }}
                  exit={{ scale: 0.8, y: 10, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-6 h-6 flex-shrink-0 flex items-center justify-center"
                  style={{ 
                    backgroundColor: '#f59e0b15',
                    border: '1px solid #f59e0b40',
                  }}
                >
              <motion.div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#f59e0b' }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {/* Progress bar for 5s countdown */}
            <div
              key={cycleKey}
              className="absolute bottom-0 left-0 h-0.5"
              style={{ 
                backgroundColor: '#f59e0b',
                animation: 'fillBar5s 5s linear forwards',
              }}
            />
            <style jsx>{`
              @keyframes fillBar5s {
                from { width: 0%; }
                to { width: 100%; }
              }
            `}</style>
            <div className="flex-1" />
            <span className={`text-[8px] font-mono ${colors.textMuted} flex-shrink-0`}>⏳</span>
          </div>
        </div>
        
        {/* Settlement lane - batch settles after τ = 5s */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <motion.div 
              className="w-2 h-2" 
              animate={{ backgroundColor: consensusFlash ? '#22c55e' : '#22c55e60' }}
              transition={{ duration: 0.15 }}
            />
            <span className={`text-[10px] ${colors.text} font-mono uppercase`}>Settlement</span>
            <span className={`text-[9px] ${colors.textMuted} font-mono`}>batch finalized</span>
          </div>
          <motion.div
            className="h-8 flex items-center gap-0.5 px-1.5 overflow-hidden"
            animate={{
              backgroundColor: consensusFlash ? '#22c55e15' : `${colors.stroke}05`,
              borderColor: consensusFlash ? '#22c55e50' : `${colors.stroke}15`,
            }}
            transition={{ duration: 0.15 }}
            style={{ border: '1px solid' }}
          >
            <AnimatePresence mode="popLayout">
              {settledBlocks.map((id, idx) => (
                <motion.div
                  key={`s-${id}`}
                  layout
                  initial={{ scale: 0, y: -10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.8, x: -15, opacity: 0 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 500, 
                    damping: 30,
                    delay: idx * 0.05 // Stagger the batch appearance
                  }}
                  className="w-6 h-6 flex-shrink-0 flex items-center justify-center"
                  style={{ 
                    backgroundColor: '#22c55e20',
                    border: '1px solid #22c55e50',
                  }}
                >
                  <motion.svg
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: idx * 0.05 }}
                    width="10" height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </motion.svg>
          </motion.div>
              ))}
            </AnimatePresence>
            <div className="flex-1" />
            <span className={`text-[8px] font-mono ${colors.textMuted} flex-shrink-0`}>✓</span>
          </motion.div>
        </div>
      </div>
      
    </div>
  )
}

