"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Colors } from "./types"

export function ParallelStreamsCard({ colors }: { colors: Colors }) {
  const [consensusBlocks, setConsensusBlocks] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  const [executionBlocks, setExecutionBlocks] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [activeConsensus, setActiveConsensus] = useState(10)
  const [activeExecution, setActiveExecution] = useState(6)
  const [consensusBurst, setConsensusBurst] = useState(false)
  const [executionBurst, setExecutionBurst] = useState(false)
  const [executionDuration, setExecutionDuration] = useState(0.3)
  const blockIdRef = useRef(10)
  const executionQueueRef = useRef<number[]>([7, 8, 9, 10])
  const consensusTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const execTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  
  useEffect(() => {
    isMountedRef.current = true
    
    // Consensus - races ahead fast
    const scheduleConsensus = () => {
      if (!isMountedRef.current) return
      
      blockIdRef.current++
      if (blockIdRef.current > 99) blockIdRef.current = 1
      const newId = blockIdRef.current
      setConsensusBlocks(prev => [...prev.slice(-11), newId])
      setActiveConsensus(newId)
      executionQueueRef.current.push(newId)
      
      // Consensus is fast - variable speed with bursts
      const rand = Math.random()
      let delay: number
      if (rand < 0.5) {
        // Fast burst
        delay = 250 + Math.random() * 100
        setConsensusBurst(true)
        setTimeout(() => isMountedRef.current && setConsensusBurst(false), 100)
      } else if (rand < 0.8) {
        // Normal fast
        delay = 350 + Math.random() * 150
      } else {
        // Slightly slower
        delay = 500 + Math.random() * 200
      }
      
      consensusTimeoutRef.current = setTimeout(scheduleConsensus, delay)
    }
    consensusTimeoutRef.current = setTimeout(scheduleConsensus, 300)
    
    // Execution - catches up, slightly behind consensus
    const scheduleExecution = () => {
      if (!isMountedRef.current) return
      const queueLen = executionQueueRef.current.length
      
      if (queueLen === 0) {
        execTimeoutRef.current = setTimeout(scheduleExecution, 50)
        return
      }
      
      // Execution is slightly slower than consensus on average
      let executionTime: number
      
      if (queueLen > 3) {
        // Backlog building - speed up to catch up
        executionTime = 150 + Math.random() * 80
        setExecutionBurst(true)
        setTimeout(() => isMountedRef.current && setExecutionBurst(false), 80)
      } else if (queueLen > 1) {
        // Small backlog - steady pace
        executionTime = 250 + Math.random() * 100
      } else {
        // Caught up - normal pace
        executionTime = 350 + Math.random() * 150
      }
      
      const toExecute = executionQueueRef.current.shift()!
      setExecutionBlocks(prev => [...prev.slice(-9), toExecute])
      setActiveExecution(toExecute)
      setExecutionDuration(executionTime / 1000)
      
      setTimeout(() => {
        if (isMountedRef.current) {
          setActiveExecution(-1)
          scheduleExecution()
        }
      }, executionTime)
    }
    execTimeoutRef.current = setTimeout(scheduleExecution, 500)
    
    return () => {
      isMountedRef.current = false
      if (consensusTimeoutRef.current) clearTimeout(consensusTimeoutRef.current)
      if (execTimeoutRef.current) clearTimeout(execTimeoutRef.current)
    }
  }, [])
  
  return (
    <div 
      className={`p-6 h-full flex flex-col col-span-1 md:col-span-2 ${colors.blockBg}`}
    >
      <div className="mb-5">
        <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
          Two engines, full speed.
        </h3>
        <p className={`text-base sm:text-sm ${colors.textMuted} leading-relaxed`}>
          Consensus and execution run in parallel. No more waiting for one to finish before starting the other.
        </p>
      </div>
      
      {/* Two parallel lanes racing */}
      <div className="flex-1 flex flex-col justify-center gap-3">
        {/* Consensus lane - races ahead */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <motion.div 
              className="w-2 h-2" 
              animate={{ 
                backgroundColor: consensusBurst ? `${colors.stroke}` : `${colors.stroke}60`,
                scale: consensusBurst ? [1, 1.4, 1] : 1,
              }}
              transition={{ duration: 0.12 }}
            />
            <span className={`text-[10px] ${colors.text} font-mono uppercase tracking-wide`}>Consensus</span>
            <span className={`text-[9px] ${colors.textMuted} font-mono`}>races ahead</span>
          </div>
          <motion.div 
            className="h-9 flex items-center gap-0.5 px-2 overflow-hidden"
            animate={{
              backgroundColor: consensusBurst ? `${colors.stroke}12` : `${colors.stroke}05`,
              borderColor: consensusBurst ? `${colors.stroke}40` : `${colors.stroke}15`,
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
                  animate={{ scale: 1, x: 0, opacity: id === activeConsensus ? 1 : 0.5 }}
                  exit={{ scale: 0.7, x: -15, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 25 }}
                  className="w-6 h-6 flex-shrink-0 flex items-center justify-center"
                  style={{ 
                    backgroundColor: id === activeConsensus ? `${colors.stroke}30` : `${colors.stroke}12`,
                    border: id === activeConsensus ? `1.5px solid ${colors.stroke}60` : `1px solid ${colors.stroke}20`,
                  }}
                >
                  {id === activeConsensus ? (
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: colors.stroke }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  ) : (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeOpacity={0.35} strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div className="flex-1" />
            <span className={`text-[9px] font-mono flex-shrink-0 opacity-40`} style={{ color: colors.stroke }}>→</span>
          </motion.div>
        </div>
        
        {/* Execution lane - catches up */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <motion.div 
              className="w-2 h-2" 
              style={{ backgroundColor: '#ef4444' }}
              animate={{ scale: executionBurst ? [1, 1.4, 1] : 1 }}
              transition={{ duration: 0.12 }}
            />
            <span className={`text-[10px] ${colors.text} font-mono uppercase tracking-wide`}>Execution</span>
            <span className={`text-[9px] ${colors.textMuted} font-mono`}>catches up</span>
          </div>
          <motion.div 
            className="h-9 flex items-center gap-0.5 px-2 overflow-hidden"
            animate={{
              backgroundColor: executionBurst ? '#ef444415' : `${colors.stroke}05`,
              borderColor: executionBurst ? '#ef444460' : `${colors.stroke}15`,
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
                    animate={{ scale: 1, x: 0, opacity: isActive ? 1 : 0.6 }}
                    exit={{ scale: 0.7, x: -15, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 25 }}
                    className="w-6 h-6 flex-shrink-0 relative overflow-hidden"
                    style={{ 
                      backgroundColor: isActive ? '#ef444420' : '#ef444435',
                      border: isActive ? '1.5px solid #ef4444' : '1px solid #ef444445',
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
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeOpacity={0.6} strokeWidth="3">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div className="flex-1" />
            <span className={`text-[9px] font-mono flex-shrink-0 opacity-40`} style={{ color: '#ef4444' }}>→</span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

