"use client"
import { Colors } from "./types"

export function Payoff({ colors }: { colors: Colors }) {
  return (
    <div className="space-y-8 md:space-y-12">
      {/* Performance */}
      <div>
        <h3 className={`text-lg md:text-xl font-bold ${colors.text} mb-4 md:mb-6`}>
          Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wider mb-2`}>
              Zero context switching
            </h4>
            <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
              Concurrent consensus and execution streams eliminate node context switching. VM time aligns with wall time — gas per second increases without hardware changes.
            </p>
          </div>
          <div>
            <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wider mb-2`}>
              Amortized overhead
            </h4>
            <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
              Irregular stop-the-world events spread across multiple blocks. Latency spikes smooth out. Bursty traffic is absorbed while the queue drains.
            </p>
          </div>
        </div>
      </div>

      {/* Who benefits */}
      <div>
        <h3 className={`text-lg md:text-xl font-bold ${colors.text} mb-4 md:mb-6`}>
          Who benefits
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wider mb-2`}>
              C-Chain dapps
            </h4>
            <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
              Transaction receipts stream as execution completes. Users see confirmations faster. Snappier UX across all C-Chain applications without any code changes.
            </p>
          </div>
          <div>
            <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wider mb-2`}>
              DeFi traders
            </h4>
            <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
              Run optimized execution clients that clear the queue ahead of the network. See results before settlement. HFT DeFi becomes viable.
            </p>
          </div>
          <div>
            <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wider mb-2`}>
              Custodial platforms
            </h4>
            <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
              Filter the queue for your EOAs. Credit user balances the moment execution completes — no waiting for on-chain settlement.
            </p>
          </div>
        </div>
      </div>

      {/* What this enables */}
      <div>
        <h3 className={`text-lg md:text-xl font-bold ${colors.text} mb-4 md:mb-6`}>
          What this enables
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wider mb-2`}>
              Real-time VRF
            </h4>
            <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
              Consensus artifacts become available during execution. Expose a verifiable random function for provably fair on-chain randomness.
            </p>
          </div>
          <div>
            <h4 className={`text-sm font-semibold ${colors.text} uppercase tracking-wider mb-2`}>
              Encrypted mempool
            </h4>
            <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
              Sequence transactions before revealing contents. Front-running and MEV extraction become significantly harder.
            </p>
          </div>
        </div>
        <p className={`text-xs ${colors.textFaint} mt-4 font-mono`}>
          ACP-194 does not introduce these features — but asynchronous execution is required to implement them.
        </p>
      </div>
    </div>
  )
}
