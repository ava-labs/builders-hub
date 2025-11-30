"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Colors } from "./types"

export function GasClockCard({ colors }: { colors: Colors }) {
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

