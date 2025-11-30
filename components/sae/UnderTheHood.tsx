"use client"
import { motion } from "framer-motion"
import { Colors } from "./types"

function GasClock({ colors }: { colors: Colors }) {
  return (
    <div className="mt-4 md:mt-10">
      <div className="flex items-center gap-2 mb-3 md:mb-6 px-1">
        <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
          The Gas Clock
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 min-h-[320px]">
        {/* Left side - Dark gradient with tagline */}
        <div 
          className="p-8 md:p-12 flex flex-col justify-center relative overflow-hidden"
          style={{ 
            background: 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 50%, #1a1a1a 100%)',
          }}
        >
          {/* Subtle gradient overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.02) 50%, transparent 100%)',
            }}
          />
          <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4 relative z-10">
            If time is money,<br />
            gas is both.
          </h3>
          <p className="text-white/60 text-sm font-medium uppercase tracking-wider relative z-10">
            The Gas Clock
          </p>
        </div>

        {/* Right side - Equations */}
        <div 
          className="p-8 md:p-12 flex flex-col items-center justify-center gap-6"
          style={{ backgroundColor: '#0a0a0a' }}
        >
          {/* First equation: R = gas/t */}
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-serif text-white flex items-center justify-center gap-3">
              <span className="italic text-red-400">R</span>
              <span className="text-white/60">=</span>
              <div className="flex flex-col items-center">
                <span className="text-white/90 text-lg md:text-xl">gas</span>
                <div className="w-12 h-px bg-white/60 my-1" />
                <span className="italic text-white/90 text-lg md:text-xl">t</span>
              </div>
            </div>
          </div>

          {/* Double arrow */}
          <div className="flex flex-col items-center text-red-500">
            <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
              <path d="M12 0L6 8H18L12 0Z" fill="currentColor" />
              <path d="M12 32L6 24H18L12 32Z" fill="currentColor" />
            </svg>
          </div>

          {/* Second equation: t = gas/R */}
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-serif text-white flex items-center justify-center gap-3">
              <span className="italic text-white/90">t</span>
              <span className="text-white/60">=</span>
              <div className="flex flex-col items-center">
                <span className="text-white/90 text-lg md:text-xl">gas</span>
                <div className="w-12 h-px bg-white/60 my-1" />
                <span className="italic text-red-400 text-lg md:text-xl">R</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation text */}
      <div className="mt-4 md:mt-6">
        <p className={`text-base sm:text-sm ${colors.textMuted} leading-relaxed`}>
          <a href="/docs/acps/176-dynamic-evm-gas-limit-and-price-discovery-updates" className="font-semibold text-red-400 hover:underline">ACP-176</a> gave us <span className="italic font-mono text-red-400">R</span> — how much gas the network can process per second. If you know the gas consumed, you know how much time passed. SAE builds on this: <span className="italic font-mono text-red-400">R</span> shows up in the equations for block size limits, queue bounds, and when blocks settle.
        </p>
      </div>
    </div>
  )
}

function Checkpoints({ colors }: { colors: Colors }) {
  return (
    <div className="mt-4 md:mt-10">
      <div className="flex items-center gap-2 mb-3 md:mb-6 px-1">
        <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
          Checkpoints
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 min-h-[360px]">
        {/* Left side - Blue with tagline */}
        <div 
          className="p-8 md:p-12 flex flex-col justify-center"
          style={{ backgroundColor: '#1e40af' }}
        >
          <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4">
            Execution flows.<br />
            Consensus logs.
          </h3>
          <p className="text-white/70 text-sm font-medium uppercase tracking-wider">
            Checkpoints
          </p>
        </div>

        {/* Right side - Light/cream with prose */}
        <div 
          className="p-8 md:p-12 flex flex-col justify-center"
          style={{ backgroundColor: '#faf8f5' }}
        >
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                Deferred settlement
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                A later consensus block references execution results — recording <span className="font-mono text-gray-900">stateRoot</span> and <span className="font-mono text-gray-900">receiptsRoot</span> for all transactions since last settlement. The delay <span className="font-mono text-amber-600">τ</span> = 5s absorbs sporadic slowdowns. Performance tuned for the average case, not the worst.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                Immediate confirmation
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                Receipts stream as transactions execute — no waiting for settlement. Execution-only clients can clear the queue ahead of the network. A trader&apos;s optimized client sees results early. A custodial platform credits balances the moment their transactions run.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BlockRelationship({ colors }: { colors: Colors }) {
  return (
    <div className="mb-1 mt-2 md:mb-2 md:mt-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
          Streaming Asynchronous Execution (SAE)
        </span>
      </div>

      <div className={`border ${colors.border} p-3 sm:p-8 ${colors.blockBg} overflow-x-auto`}>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-4 md:gap-6 md:mb-8">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: `${colors.stroke}20`, border: `1.5px solid ${colors.stroke}40` }}
            />
            <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Consensus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: "#ef4444" }} />
            <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Execution</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="12" height="20" viewBox="0 0 12 20">
              <line x1="6" y1="0" x2="6" y2="14" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" />
              <path d="M2,11 L6,18 L10,11" fill="none" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" />
            </svg>
            <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Block</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="12" height="20" viewBox="0 0 12 20">
              <line x1="6" y1="6" x2="6" y2="20" stroke="#ef4444" strokeWidth="1.5" />
              <path d="M2,9 L6,2 L10,9" fill="none" stroke="#ef4444" strokeWidth="1.5" />
            </svg>
            <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Settlement</span>
          </div>
        </div>

        <div className="relative mx-auto" style={{ width: "600px", height: "270px" }}>
          {/* SVG Layer */}
          <svg className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <marker id="arrow-white" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill={colors.stroke} fillOpacity="0.6" />
              </marker>
              <marker id="arrow-red" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
              </marker>
              <marker id="arrow-time" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill={colors.stroke} fillOpacity="0.4" />
              </marker>
            </defs>
            
            {/* Time Arrow */}
            <line x1="20" y1="250" x2="560" y2="250" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.4" markerEnd="url(#arrow-time)" />
            <text x="290" y="265" textAnchor="middle" fill={colors.stroke} fillOpacity="0.5" fontSize="10" fontFamily="monospace" letterSpacing="0.2em">TIME</text>

            {/* Connections */}
            {/* C0 (64) -> E1 start (88) */}
            <line x1="64" y1="84" x2="88" y2="130" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />
            {/* E1 end (152) -> C2 (176) */}
            <line x1="152" y1="130" x2="176" y2="84" stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />
            
            {/* C1 (152) -> E2 start (176) */}
            <line x1="152" y1="84" x2="176" y2="130" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />
            {/* C2 (240) -> E2 mid (296) */}
            <line x1="240" y1="84" x2="296" y2="130" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />
            {/* C3 (328) -> E2 mid (392) */}
            <line x1="328" y1="84" x2="392" y2="130" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />
            {/* E2 1st divider (296) -> C4 (352) */}
            <line x1="296" y1="130" x2="352" y2="84" stroke="#ef4444" strokeWidth="1.5" markerEnd="url(#arrow-red)" />

            {/* C5 (416) -> E3 start (464) */}
            <line x1="416" y1="84" x2="464" y2="130" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />
            {/* C6 (504) -> E3 divider (536) */}
            <line x1="504" y1="84" x2="536" y2="130" stroke={colors.stroke} strokeWidth="1.5" strokeOpacity="0.6" markerEnd="url(#arrow-white)" />

            {/* Curly Bracket under E2 (From first divider to end: 296-416) */}
            <path 
              d="M 296 200 q 0 12 12 12 h 36 q 12 0 12 13 q 0 -13 12 -13 h 36 q 12 0 12 -12"
              fill="none" 
              stroke="#ef4444" 
              strokeWidth="1.5" 
            />
            {/* Line from bracket to C5 bottom-left with rounded corner */}
            <path 
              d="M 356 225 L 418 225 Q 428 225 428 215 L 428 100 L 440 84" 
              fill="none" 
              stroke="#ef4444" 
              strokeWidth="1.5" 
              markerEnd="url(#arrow-red)"
            />
          </svg>

          {/* Blocks Layer */}
          {/* Top Row: Consensus (6 blocks) */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="absolute w-16 h-16 rounded"
              style={{
                left: `${i * 88}px`,
                top: "20px",
                backgroundColor: `${colors.stroke}20`,
                border: `1.5px solid ${colors.stroke}40`,
              }}
            />
          ))}

          {/* Bottom Row: Execution (3 blocks) */}
          {/* E1: Matches C1 (88) */}
          <div
            className="absolute h-16 bg-red-500 rounded"
            style={{ left: "88px", top: "130px", width: "64px" }}
          >
             <div className="absolute right-0 top-0 bottom-0 w-px bg-white opacity-20" />
          </div>
          
          {/* E2: Matches C2+C3+C4 (176) */}
          <div
            className="absolute h-16 bg-red-500 rounded"
            style={{ left: "176px", top: "130px", width: "240px" }}
          >
             {/* Dividers at 120px and 216px */}
             <div className="absolute left-[120px] top-0 bottom-0 w-px bg-white opacity-40" />
             <div className="absolute left-[216px] top-0 bottom-0 w-px bg-white opacity-40" />
             <div className="absolute right-0 top-0 bottom-0 w-px bg-white opacity-20" />
          </div>
          
          {/* E3: Starts at 464, Wider (112px) */}
          <div
            className="absolute h-16 bg-red-500 rounded"
            style={{ left: "464px", top: "130px", width: "112px" }}
          >
             {/* Divider towards end */}
             <div className="absolute left-[72px] top-0 bottom-0 w-px bg-white opacity-40" />
             <div className="absolute right-0 top-0 bottom-0 w-px bg-white opacity-20" />
          </div>
        </div>

      </div>
      <div className="mt-2 md:mt-4">
        <p className={`text-sm sm:text-xs md:text-[11px] font-mono uppercase tracking-wider ${colors.text} mt-1`}>
          <span style={{ color: `${colors.stroke}60` }}>consensus</span> guarantees <span style={{ color: '#ef4444' }}>execution</span>, <span className="italic normal-case">eventually</span>
        </p>
        <div className={`text-base sm:text-sm ${colors.textMuted} leading-relaxed space-y-4 sm:space-y-3 mt-6 md:mt-10`}>
          <p>
            <strong className={colors.text}>Decoupled streams.</strong> Consensus orders and accepts transactions into a FIFO queue without waiting for execution. The execution stream processes blocks independently, running transactions and computing state changes. Both streams operate simultaneously — no context switching, no blocking.
          </p>
          <p>
            <strong className={colors.text}>Guaranteed execution.</strong> Every accepted transaction is guaranteed to eventually execute. Consensus validates worst-case gas bounds at acceptance time, ensuring senders can always pay. Order is fixed at acceptance, execution is deterministic.
          </p>
          <p>
            <strong className={colors.text}>Gas is time.</strong> Execution duration is measured in gas, not wall time. The gas rate R = 30M gas/sec provides deterministic, sub-second granular timestamps that advance predictably as transactions consume gas.
          </p>
          <p>
            <strong className={colors.text}>Deferred settlement.</strong> Results stream immediately to clients as execution completes. Settlement is recorded τ = 5s later when a following accepted block includes the state root — multiple blocks can settle together, amortizing overhead.
          </p>
        </div>
      </div>
    </div>
  )
}

function PessimisticFeeValidation({ colors }: { colors: Colors }) {
  return (
    <div className="mt-4 md:mt-10">
      <div className="flex items-center gap-2 mb-3 md:mb-6 px-1">
        <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
          Pessimistic Fee Validation
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 min-h-[320px]">
        {/* Left - The Rule */}
        <div 
          className="p-8 md:p-12 flex flex-col justify-center"
          style={{ backgroundColor: '#ef4444' }}
        >
          <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4">
            Assume the worst.<br />
            Mallory can&apos;t afford that.
          </h3>
          <p className="text-white/80 text-sm font-medium uppercase tracking-wider">
            Pessimistic fee validation
          </p>
        </div>

        {/* Right - Prose explanation */}
        <div 
          className="p-8 md:p-12 flex flex-col justify-center"
          style={{ backgroundColor: '#faf8f5' }}
        >
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
            Affordability ≠ Success
          </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                Worst-case gas price is calculated using <span className="font-mono text-gray-900">g<sub>L</sub></span> (gas limit) instead of <span className="font-mono text-gray-900">g<sub>C</sub></span> (gas charged). Consensus only checks that you can pay this upper bound. If you can afford the worst case, you&apos;re guaranteed to execute — but reverts and out-of-gas are still possible.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                Lightweight Consensus Validation
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                Blocks are accepted fast — no heavy computation blocking the queue. Third-party accounting of simple transfers (EOA→EOA) can happen before execution even runs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TechnicalSpecification({ colors }: { colors: Colors }) {
  return (
    <div className="mt-4 md:mt-10">
      <div className="flex items-center gap-2 mb-3 md:mb-6 px-1">
        <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
          Technical Specification
        </span>
      </div>
      
      {/* Configuration Parameters Table */}
      <div className="mb-8">
        <h4 className={`text-sm sm:text-xs font-medium ${colors.text} uppercase tracking-wider mb-4`}>Configuration Parameters</h4>
        <div className={`border ${colors.border} overflow-hidden`} style={{ backgroundColor: `${colors.stroke}03` }}>
          <table className="w-full text-sm sm:text-xs md:text-[11px]">
            <thead>
              <tr style={{ backgroundColor: `${colors.stroke}08` }}>
                <th className={`text-left p-3 font-mono ${colors.text} border-b ${colors.border}`}>Parameter</th>
                <th className={`text-left p-3 font-mono ${colors.text} border-b ${colors.border}`}>Description</th>
                <th className={`text-left p-3 font-mono ${colors.text} border-b ${colors.border}`}>C-Chain</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                <td className={`p-3 font-mono ${colors.text} border-b ${colors.border}`}>
                  <span className="italic text-amber-500">τ</span>
                </td>
                <td className={`p-3 ${colors.textMuted} border-b ${colors.border}`}>Duration between execution and settlement</td>
                <td className={`p-3 font-mono font-medium ${colors.text} border-b ${colors.border}`}>5s</td>
              </tr>
              <tr className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                <td className={`p-3 font-mono ${colors.text} border-b ${colors.border}`}>
                  <span className="italic text-blue-500">λ</span>
                </td>
                <td className={`p-3 ${colors.textMuted} border-b ${colors.border}`}>Minimum conversion from gas limit to gas charged</td>
                <td className={`p-3 font-mono font-medium ${colors.text} border-b ${colors.border}`}>2</td>
              </tr>
              <tr className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                <td className={`p-3 font-mono ${colors.text} border-b ${colors.border}`}>
                  <span className="italic text-green-500">T</span>
                </td>
                <td className={`p-3 ${colors.textMuted} border-b ${colors.border}`}>Target gas consumed per second</td>
                <td className={`p-3 font-mono font-medium ${colors.textMuted} border-b ${colors.border}`}>Dynamic</td>
              </tr>
              <tr className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                <td className={`p-3 font-mono ${colors.text} border-b ${colors.border}`}>
                  <span className="italic text-purple-500">M</span>
                </td>
                <td className={`p-3 ${colors.textMuted} border-b ${colors.border}`}>Minimum gas price</td>
                <td className={`p-3 font-mono font-medium ${colors.textMuted} border-b ${colors.border}`}>—</td>
              </tr>
              <tr className="hover:bg-opacity-50" style={{ transition: 'background 0.2s' }}>
                <td className={`p-3 font-mono ${colors.text}`}>
                  <span className="italic text-red-500">R</span> = 2·<span className="italic text-green-500">T</span>
                </td>
                <td className={`p-3 ${colors.textMuted}`}>Gas capacity added per second</td>
                <td className={`p-3 font-mono font-medium ${colors.textMuted}`}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Formulas */}
      <h4 className={`text-sm sm:text-xs font-medium ${colors.text} uppercase tracking-wider mb-4`}>Key Formulas</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Gas Charged */}
        <motion.div 
          className={`border ${colors.border} p-4 relative overflow-hidden`}
          style={{ backgroundColor: `${colors.stroke}03` }}
          whileHover={{ borderColor: '#22c55e50' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2" style={{ backgroundColor: '#22c55e' }} />
            <span className={`text-sm sm:text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Gas Charged</span>
          </div>
          <div className={`font-mono text-sm ${colors.text} p-3 text-center border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
            <span className="italic">g</span><sub>C</sub> := max(<span className="italic">g</span><sub>U</sub>, <span className="italic">g</span><sub>L</sub> / <span className="italic text-blue-500">λ</span>)
          </div>
          <p className={`text-sm sm:text-[10px] ${colors.textMuted} mt-3 leading-relaxed`}>
            <span className="italic font-mono">g<sub>L</sub></span> = gas limit, <span className="italic font-mono">g<sub>U</sub></span> = gas used
          </p>
        </motion.div>

        {/* Block Size */}
        <motion.div 
          className={`border ${colors.border} p-4 relative overflow-hidden`}
          style={{ backgroundColor: `${colors.stroke}03` }}
          whileHover={{ borderColor: '#3b82f650' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2" style={{ backgroundColor: '#3b82f6' }} />
            <span className={`text-sm sm:text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Max Block Size</span>
          </div>
          <div className={`font-mono text-sm ${colors.text} p-3 text-center border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
            <span className="italic">ω</span><sub>B</sub> := <span className="italic text-red-500">R</span> · <span className="italic text-amber-500">τ</span> · <span className="italic text-blue-500">λ</span>
          </div>
          <p className={`text-sm sm:text-[10px] ${colors.textMuted} mt-3 leading-relaxed`}>
            Blocks exceeding this are invalid
          </p>
        </motion.div>

        {/* Queue Size */}
        <motion.div 
          className={`border ${colors.border} p-4 relative overflow-hidden`}
          style={{ backgroundColor: `${colors.stroke}03` }}
          whileHover={{ borderColor: '#f59e0b50' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2" style={{ backgroundColor: '#f59e0b' }} />
            <span className={`text-sm sm:text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Max Queue Size</span>
          </div>
          <div className={`font-mono text-sm ${colors.text} p-3 text-center border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
            <span className="italic">ω</span><sub>Q</sub> := 2 · <span className="italic">ω</span><sub>B</sub>
          </div>
          <p className={`text-sm sm:text-[10px] ${colors.textMuted} mt-3 leading-relaxed`}>
            Queue limit before enqueueing
          </p>
        </motion.div>

        {/* Gas Price */}
        <motion.div 
          className={`border ${colors.border} p-4 relative overflow-hidden`}
          style={{ backgroundColor: `${colors.stroke}03` }}
          whileHover={{ borderColor: '#a855f750' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2" style={{ backgroundColor: '#a855f7' }} />
            <span className={`text-sm sm:text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Gas Price</span>
          </div>
          <div className={`font-mono text-sm ${colors.text} p-3 text-center border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
            <span className="italic text-purple-500">M</span> · exp(<span className="italic">x</span> / <span className="italic">K</span>)
          </div>
          <p className={`text-sm sm:text-[10px] ${colors.textMuted} mt-3 leading-relaxed`}>
            <span className="italic font-mono">x ≥ 0</span> excess, <span className="italic font-mono">K = 87·T</span>
          </p>
        </motion.div>
      </div>

      {/* Block Executor Updates */}
      <h4 className={`text-sm sm:text-xs font-medium ${colors.text} uppercase tracking-wider mb-4`}>Block Executor Updates</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <motion.div 
          className={`border ${colors.border} p-4`}
          style={{ backgroundColor: `${colors.stroke}03` }}
          whileHover={{ borderColor: '#3b82f650' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <motion.div 
              className="w-3 h-3 flex items-center justify-center"
              animate={{ rotate: [0, 180, 360] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              <div className="w-2 h-2" style={{ backgroundColor: '#3b82f6' }} />
            </motion.div>
            <span className={`text-sm sm:text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>Before Execution</span>
          </div>
          <div className={`font-mono text-sm sm:text-[11px] ${colors.textMuted} space-y-1 p-3 border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
            <div>Δ<span className="italic">t</span> := max(0, <span className="italic">t</span><sub>b</sub> − <span className="italic">t</span><sub>e</sub>)</div>
            <div><span className="italic">t</span><sub>e</sub> := <span className="italic">t</span><sub>e</sub> + Δ<span className="italic">t</span></div>
            <div><span className="italic">x</span> := max(<span className="italic">x</span> − <span className="italic text-green-500">T</span>·Δ<span className="italic">t</span>, 0)</div>
          </div>
        </motion.div>

        <motion.div 
          className={`border ${colors.border} p-4`}
          style={{ backgroundColor: `${colors.stroke}03` }}
          whileHover={{ borderColor: '#22c55e50' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <motion.div 
              className="w-3 h-3 flex items-center justify-center"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <div className="w-2 h-2" style={{ backgroundColor: '#22c55e' }} />
            </motion.div>
            <span className={`text-sm sm:text-[10px] font-medium ${colors.text} uppercase tracking-wider`}>After Execution</span>
          </div>
          <div className={`font-mono text-sm sm:text-[11px] ${colors.textMuted} space-y-1 p-3 border ${colors.border}`} style={{ backgroundColor: `${colors.stroke}05` }}>
            <div>Δ<span className="italic">t</span> := <span className="italic">g</span><sub>C</sub> / <span className="italic text-red-500">R</span></div>
            <div><span className="italic">t</span><sub>e</sub> := <span className="italic">t</span><sub>e</sub> + Δ<span className="italic">t</span></div>
            <div><span className="italic">x</span> := <span className="italic">x</span> + Δ<span className="italic">t</span>·(<span className="italic text-red-500">R</span> − <span className="italic text-green-500">T</span>)</div>
          </div>
        </motion.div>
      </div>

      {/* Block Settlement */}
      <h4 className={`text-sm sm:text-xs font-medium ${colors.text} uppercase tracking-wider mb-4`}>Settlement Condition</h4>
      <motion.div 
        className={`border ${colors.border} p-5 relative overflow-hidden`}
        style={{ backgroundColor: `${colors.stroke}03` }}
        whileHover={{ scale: 1.005 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(135deg, #22c55e08 0%, transparent 50%)` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <div className={`font-mono text-lg ${colors.text} p-4 text-center border ${colors.border} mb-4 relative`} style={{ backgroundColor: `${colors.stroke}05` }}>
          <span className="italic">t</span><sub>e</sub> ≤ <span className="italic">t</span><sub>b</sub> − <span className="italic text-amber-500">τ</span>
        </div>
        <p className={`text-sm sm:text-[11px] ${colors.textMuted} leading-relaxed text-center relative`}>
          Ancestors whose execution timestamp satisfies this condition are settled. The proposed block includes the stateRoot from the most recently settled block.
        </p>
      </motion.div>
    </div>
  )
}

export function UnderTheHood({ colors }: { colors: Colors }) {
  return (
    <>
      <GasClock colors={colors} />
      <Checkpoints colors={colors} />
      <PessimisticFeeValidation colors={colors} />
      {/* <TechnicalSpecification colors={colors} /> */}
    </>
  )
}

