"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Colors } from "./types"

function GasClockCard({ colors }: { colors: Colors }) {
  const [blocks, setBlocks] = useState<{ id: number; gas: number; time: number }[]>([])
  const [currentGas, setCurrentGas] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const blockIdRef = useRef(0)
  
  // Simulate blocks being executed
  useEffect(() => {
    const interval = setInterval(() => {
      blockIdRef.current++
      const gas = Math.floor(Math.random() * 8) + 4 // 4-12M gas
      const time = Math.round((gas / 30) * 1000) // time = gas / R, R = 30M/s
      
      setBlocks(prev => [...prev.slice(-2), { id: blockIdRef.current, gas, time }])
      setCurrentGas(gas)
      setCurrentTime(time)
    }, 2000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className={`p-6 border ${colors.border} ${colors.blockBg} h-full flex flex-col`}>
      <div className="mb-5">
        <h3 className={`text-lg font-bold ${colors.text} mb-2`}>
          Gas is the clock.
        </h3>
        <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
          <Link 
            href="/docs/acps/176-dynamic-evm-gas-limit-and-price-discovery-updates" 
            className="underline hover:opacity-80"
          >
            ACP-176
          </Link>
          {" "}introduced the gas rate R = 30M gas/sec. SAE uses R to convert gas consumed into elapsed time.
        </p>
      </div>
      
      {/* Simple equation + live values */}
      <div className="flex-1 flex flex-col justify-center gap-6">
        {/* The formula */}
        <div className="flex items-center justify-center gap-3">
          <div className="text-center">
            <motion.div 
              className={`text-2xl font-mono font-bold ${colors.text}`}
              key={currentGas}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {currentGas}M
            </motion.div>
            <div className={`text-[10px] ${colors.textMuted} font-mono mt-1`}>gas</div>
          </div>
          
          <div className={`text-xl ${colors.textMuted}`}>÷</div>
          
          <div className="text-center">
            <div className={`text-2xl font-mono font-bold ${colors.text}`}>30M</div>
            <div className={`text-[10px] ${colors.textMuted} font-mono mt-1`}>gas/sec</div>
          </div>
          
          <div className={`text-xl ${colors.textMuted}`}>=</div>
          
          <div className="text-center">
            <motion.div 
              className="text-2xl font-mono font-bold text-red-400"
              key={currentTime}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              {currentTime}ms
            </motion.div>
            <div className={`text-[10px] ${colors.textMuted} font-mono mt-1`}>time</div>
          </div>
        </div>
        
        {/* Block history */}
        <div className="flex justify-center gap-2">
          <AnimatePresence mode="popLayout">
            {blocks.map((block, i) => (
            <motion.div
                key={block.id}
                layout
                initial={{ scale: 0, opacity: 0, x: 20 }}
                animate={{ scale: 1, opacity: i === blocks.length - 1 ? 1 : 0.4, x: 0 }}
                exit={{ scale: 0.8, opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex flex-col items-center"
              >
                <div 
                  className="w-14 h-10 flex flex-col items-center justify-center"
                  style={{ 
                    backgroundColor: i === blocks.length - 1 ? `${colors.stroke}15` : `${colors.stroke}08`,
                    border: `1px solid ${colors.stroke}${i === blocks.length - 1 ? '30' : '15'}`
                  }}
                >
                  <span className={`text-[10px] font-mono ${colors.text}`}>{block.gas}M</span>
                  <span className="text-[9px] font-mono text-red-400">{block.time}ms</span>
          </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Simple footer */}
      <div className={`text-center text-[10px] ${colors.textMuted} font-mono pt-3 mt-auto`} style={{ borderTop: `1px solid ${colors.stroke}10` }}>
        R = 30M gas/sec → gas consumed = time elapsed
      </div>
    </div>
  )
}

function DeferredSettlementCard({ colors }: { colors: Colors }) {
  const [executedBlocks, setExecutedBlocks] = useState<number[]>([1, 2, 3])
  const [settledCount, setSettledCount] = useState(0)
  const [isSettling, setIsSettling] = useState(false)
  const [cycleKey, setCycleKey] = useState(0)
  const blockIdRef = useRef(3)
  
  // Add new executed blocks at varying rates
  useEffect(() => {
    const addBlock = () => {
      blockIdRef.current++
      setExecutedBlocks(prev => [...prev, blockIdRef.current].slice(-6))
      // Random delay between 400ms and 1200ms
      const nextDelay = 400 + Math.random() * 800
      setTimeout(addBlock, nextDelay)
    }
    const timeout = setTimeout(addBlock, 600)
    return () => clearTimeout(timeout)
  }, [])
  
  // Settle every 5 seconds - settles ALL blocks in buffer
  useEffect(() => {
    const interval = setInterval(() => {
        setIsSettling(true)
        setTimeout(() => {
        setExecutedBlocks(prev => {
          setSettledCount(c => c + prev.length)
          return [] // Clear all
        })
          setIsSettling(false)
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

function ImmediateConfirmationCard({ colors }: { colors: Colors }) {
  const [receipts, setReceipts] = useState<{ id: number; done: boolean }[]>([])
  const idRef = useRef(0)
  
  useEffect(() => {
    const interval = setInterval(() => {
      idRef.current++
      const newId = idRef.current
      
      setReceipts(prev => [...prev.slice(-4), { id: newId, done: false }])
      
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
                    <span className={`text-[9px] font-mono ${receipt.done ? 'text-green-500' : colors.textMuted}`}>
                  Tx
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

function GuaranteedExecutionCard({ colors }: { colors: Colors }) {
  const [phase, setPhase] = useState<'incoming' | 'calculating' | 'checking' | 'accepted'>('incoming')
  const [gasLimit, setGasLimit] = useState(200)
  const [worstCasePrice, setWorstCasePrice] = useState(25)
  const [balance, setBalance] = useState(0)
  const [worstCaseCost, setWorstCaseCost] = useState(0)
  
  useEffect(() => {
    const runCycle = () => {
      // New transaction
      const newGasLimit = Math.floor(Math.random() * 150) + 100 // 100-250k
      const newPrice = Math.floor(Math.random() * 20) + 20 // 20-40 gwei
      const cost = Math.round(newGasLimit * newPrice / 1000) // in some unit
      const bal = cost + Math.floor(Math.random() * 20) + 5 // Always enough
      
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
        <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
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
            <span className={`text-xs font-mono ${colors.text}`}>{worstCasePrice} gwei</span>
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

function ParallelStreamsCard({ colors }: { colors: Colors }) {
  const [consensusBlocks, setConsensusBlocks] = useState<number[]>([1, 2, 3, 4])
  const [executionBlocks, setExecutionBlocks] = useState<number[]>([1, 2])
  const [settledBlocks, setSettledBlocks] = useState<number[]>([1])
  const [activeConsensus, setActiveConsensus] = useState(4)
  const [activeExecution, setActiveExecution] = useState(2)
  const blockIdRef = useRef(4)
  const executionQueueRef = useRef<number[]>([3, 4])
  const settleQueueRef = useRef<number[]>([2])
  
  useEffect(() => {
    // Consensus runs ahead - faster rate
    const consensusInterval = setInterval(() => {
      blockIdRef.current++
      const newId = blockIdRef.current
      setConsensusBlocks(prev => [...prev.slice(-5), newId])
      setActiveConsensus(newId)
      executionQueueRef.current.push(newId)
    }, 800)
    
    // Execution follows - stays 1-3 blocks behind
    const scheduleExecution = () => {
      const queueLen = executionQueueRef.current.length
      if (queueLen > 0) {
        const toExecute = executionQueueRef.current.shift()!
        setExecutionBlocks(prev => [...prev.slice(-4), toExecute])
        setActiveExecution(toExecute)
        settleQueueRef.current.push(toExecute)
      }
      // Only speed up when falling too far behind (3+), otherwise stay behind
      const delay = queueLen > 3 ? 700 : queueLen > 2 ? 900 : 1100
      setTimeout(scheduleExecution, delay)
    }
    const execTimeout = setTimeout(scheduleExecution, 1000)
    
    // Settlement happens after τ = 5s delay
    const settleInterval = setInterval(() => {
      if (settleQueueRef.current.length > 0) {
        const toSettle = settleQueueRef.current.shift()!
        setSettledBlocks(prev => [...prev.slice(-3), toSettle])
      }
    }, 1200)
    
    return () => {
      clearInterval(consensusInterval)
      clearTimeout(execTimeout)
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
      <div className="flex-1 flex flex-col justify-center gap-3">
        {/* Consensus lane */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-2 h-2"
              style={{ backgroundColor: `${colors.stroke}60` }}
            />
            <span className={`text-[10px] ${colors.text} font-mono uppercase`}>Consensus</span>
            <span className={`text-[9px] ${colors.textMuted} font-mono ml-auto`}>accepting</span>
            </div>
          <div 
            className="h-10 flex items-center gap-1 px-2 overflow-hidden"
            style={{ backgroundColor: `${colors.stroke}08`, border: `1px solid ${colors.stroke}15` }}
          >
            <AnimatePresence mode="popLayout">
              {consensusBlocks.map((id) => (
              <motion.div
                  key={`c-${id}`}
                  layout
                  initial={{ scale: 0, x: 20 }}
                  animate={{ scale: 1, x: 0, opacity: id === activeConsensus ? 1 : 0.5 }}
                  exit={{ scale: 0.8, x: -20, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-8 h-8 flex-shrink-0"
                  style={{ 
                    backgroundColor: `${colors.stroke}20`,
                    border: id === activeConsensus ? `2px solid ${colors.stroke}50` : `1px solid ${colors.stroke}20`,
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Execution lane */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-2 h-2"
              style={{ backgroundColor: '#ef4444' }}
            />
            <span className={`text-[10px] ${colors.text} font-mono uppercase`}>Execution</span>
            <span className={`text-[9px] ${colors.textMuted} font-mono ml-auto`}>processing</span>
            </div>
          <div 
            className="h-10 flex items-center gap-1 px-2 overflow-hidden"
            style={{ backgroundColor: `${colors.stroke}08`, border: `1px solid ${colors.stroke}15` }}
          >
            <AnimatePresence mode="popLayout">
              {executionBlocks.map((id) => (
                <motion.div
                  key={`e-${id}`}
                  layout
                  initial={{ scale: 0, x: 20 }}
                  animate={{ scale: 1, x: 0, opacity: id === activeExecution ? 1 : 0.5 }}
                  exit={{ scale: 0.8, x: -20, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-8 h-8 flex-shrink-0 relative overflow-hidden"
                  style={{ 
                    backgroundColor: '#ef444420',
                    border: id === activeExecution ? '2px solid #ef4444' : `1px solid ${colors.stroke}20`,
                  }}
                >
                  {id === activeExecution && (
              <motion.div
                      className="absolute bottom-0 left-0 right-0"
                      style={{ backgroundColor: '#ef4444' }}
                      initial={{ height: 0 }}
                      animate={{ height: '100%' }}
                      transition={{ duration: 1, ease: "linear" }}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Settlement lane */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-2 h-2"
              style={{ backgroundColor: '#22c55e' }}
            />
            <span className={`text-[10px] ${colors.text} font-mono uppercase`}>Settlement</span>
            <span className={`text-[9px] ${colors.textMuted} font-mono ml-auto`}>τ = 5s later</span>
          </div>
          <div 
            className="h-10 flex items-center gap-1 px-2 overflow-hidden"
            style={{ backgroundColor: `${colors.stroke}08`, border: `1px solid ${colors.stroke}15` }}
          >
            <AnimatePresence mode="popLayout">
              {settledBlocks.map((id) => (
                <motion.div
                  key={`s-${id}`}
                  layout
                  initial={{ scale: 0, y: -10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.8, x: -20, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="w-8 h-8 flex-shrink-0"
                  style={{ 
                    backgroundColor: '#22c55e20',
                    border: '1px solid #22c55e40',
                  }}
                />
              ))}
            </AnimatePresence>
            {settledBlocks.length === 0 && (
              <span className={`text-[9px] ${colors.textMuted} font-mono italic`}>waiting...</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: `1px solid ${colors.stroke}10` }}>
        <div className="flex gap-3">
          <span className={`text-[10px] ${colors.textMuted} font-mono flex items-center gap-1`}>
            <span style={{ color: `${colors.stroke}60` }}>↑</span> Throughput
          </span>
          <span className={`text-[10px] ${colors.textMuted} font-mono flex items-center gap-1`}>
            <span style={{ color: '#ef4444' }}>↓</span> Latency
          </span>
        </div>
        <span className={`text-[10px] ${colors.textMuted} font-mono`}>execution starts immediately</span>
      </div>
    </div>
  )
}

export function KeyFeatures({ colors }: { colors: Colors }) {
  return (
    <div className="space-y-6">
      {/* Feature grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="min-h-[260px]">
          <GasClockCard colors={colors} />
        </div>
        <div className="min-h-[260px]">
          <DeferredSettlementCard colors={colors} />
        </div>
        <div className="min-h-[260px]">
          <ImmediateConfirmationCard colors={colors} />
        </div>
        <div className="min-h-[260px]">
          <GuaranteedExecutionCard colors={colors} />
        </div>
        <ParallelStreamsCard colors={colors} />
      </div>
      
    </div>
  )
}
