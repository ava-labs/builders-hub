"use client"
import { Colors } from "./types"

export function SynchronousExecutionDiagram({ colors }: { colors: Colors }) {
    const executionColor = "#ef4444" // red, matching Block Relationship

    return (
        <div className="mb-1 mt-2 md:mb-2 md:mt-4">
            {/* Section header */}
            <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-[0.15em] ${colors.text} font-semibold`}>
                    Synchronous Execution
                </span>
            </div>

            <div className={`border ${colors.border} p-4 sm:p-8 ${colors.blockBg} overflow-x-auto`}>
                {/* Legend */}
                <div className="flex items-center gap-4 mb-4 md:gap-6 md:mb-8 flex-wrap">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-4 h-4"
                            style={{ backgroundColor: `${colors.stroke}25`, border: `1px solid ${colors.stroke}40` }}
                        />
                        <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Consensus</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4" style={{ backgroundColor: executionColor, border: `1px solid ${executionColor}` }} />
                        <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Execution</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <line x1="0" y1="8" x2="16" y2="8" stroke={colors.stroke} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="6 4" />
                        </svg>
                        <span className={`text-sm sm:text-xs md:text-[11px] uppercase tracking-widest ${colors.text} font-semibold`}>Context Switching</span>
                    </div>
                </div>

                {/* Main diagram */}
                <div className="relative mx-auto" style={{ width: "700px", height: "190px" }}>
                    <svg className="absolute inset-0 w-full h-full overflow-visible">
                        <defs>
                            <marker id="time-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                                <path d="M0,0 L0,6 L9,3 z" fill={colors.stroke} fillOpacity="0.5" />
                            </marker>
                        </defs>
                        
                        {/* Blocks - 4 synchronous execution blocks */}
                        {[0, 1, 2, 3].map((i) => {
                            const x = i * 175
                            const soloExecWidth = 16
                            const blockWidth = 120
                            const blockHeight = 130
                            const execWidth = 18
                            const y = 15
                            const gap = 8

                            return (
                                <g key={i}>
                                    {/* Solo red execution bar on the left */}
                                    <rect
                                        x={x}
                                        y={y}
                                        width={soloExecWidth}
                                        height={blockHeight}
                                        fill={executionColor}
                                        rx="3"
                                    />

                                    {/* Consensus block - grey with border */}
                                    <rect
                                        x={x + soloExecWidth + gap}
                                        y={y}
                                        width={blockWidth}
                                        height={blockHeight}
                                        fill={`${colors.stroke}20`}
                                        stroke={`${colors.stroke}40`}
                                        strokeWidth="1.5"
                                        rx="4"
                                    />

                                    {/* Left white dashed vertical line inside consensus block */}
                                    <line
                                        x1={x + soloExecWidth + gap + blockWidth / 2 - 12}
                                        y1={y + 8}
                                        x2={x + soloExecWidth + gap + blockWidth / 2 - 12}
                                        y2={y + blockHeight - 8}
                                        stroke={colors.stroke}
                                        strokeOpacity="0.6"
                                        strokeWidth="2"
                                        strokeDasharray="6 4"
                                    />

                                    {/* Red execution bar in the middle of consensus block */}
                                    <rect
                                        x={x + soloExecWidth + gap + blockWidth / 2 - 9}
                                        y={y + 6}
                                        width={execWidth}
                                        height={blockHeight - 12}
                                        fill={executionColor}
                                        rx="2"
                                    />

                                    {/* Right white dashed vertical line inside consensus block */}
                                    <line
                                        x1={x + soloExecWidth + gap + blockWidth / 2 + 12}
                                        y1={y + 8}
                                        x2={x + soloExecWidth + gap + blockWidth / 2 + 12}
                                        y2={y + blockHeight - 8}
                                        stroke={colors.stroke}
                                        strokeOpacity="0.6"
                                        strokeWidth="2"
                                        strokeDasharray="6 4"
                                    />
                                </g>
                            )
                        })}
                        
                        {/* Time arrow at the bottom */}
                        <g>
                            <line
                                x1="0"
                                y1="165"
                                x2="680"
                                y2="165"
                                stroke={colors.stroke}
                                strokeOpacity="0.4"
                                strokeWidth="1.5"
                                markerEnd="url(#time-arrow)"
                            />
                            <text
                                x="340"
                                y="180"
                                fill={colors.stroke}
                                fillOpacity="0.5"
                                fontSize="10"
                                fontFamily="monospace"
                                textAnchor="middle"
                                letterSpacing="0.2em"
                            >
                                TIME
                            </text>
                        </g>
                    </svg>
                </div>

            </div>

            {/* Annotations at the bottom */}
            <div className="mt-2 md:mt-4">
                <p className={`text-sm sm:text-xs md:text-[11px] font-mono uppercase tracking-wider ${colors.text}`}>
                    <span style={{ color: '#ef4444' }}>Execution</span> fragments <span style={{ color: `${colors.stroke}60` }}>consensus</span> — validators constantly context switch
                </p>
                <div className={`text-base sm:text-sm ${colors.textMuted} leading-relaxed space-y-3 sm:space-y-2 mt-6 md:mt-10`}>
                    <p>
                        <strong className={colors.text}>Double execution per block.</strong> The proposer runs the VM before proposing (left red bar). Then every validator must re-execute to verify (middle red bar). Execution happens twice, yet only one result matters.
                    </p>
                    <p>
                        <strong className={colors.text}>Context switching overhead.</strong> The dashed lines represent context switches — validators stop consensus work to run the VM, then stop the VM to resume consensus. Each switch has latency cost. Multiply by thousands of validators and millions of blocks.
                    </p>
                    <p>
                        <strong className={colors.text}>Sequential dependency chain.</strong> Block N+1 cannot begin until Block N fully settles. The VM is the bottleneck: gas consumed per second determines maximum throughput. Faster consensus doesn&apos;t help if execution can&apos;t keep up.
                    </p>
                </div>
            </div>
        </div>
    )
}

