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
                <div className="flex items-center gap-4 mb-4 md:gap-6 md:mb-8">
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
            <div className="mt-2 md:mt-4 space-y-2">
                <p className="text-sm sm:text-xs md:text-[11px] font-mono uppercase tracking-wider" style={{ color: executionColor }}>
                    Execution blocks the pipeline <br />
                    <span className={colors.textMuted}>consensus cannot proceed until execution completes</span>
                </p>
                <p className={`text-sm ${colors.textMuted} leading-relaxed`}>
                    Each red bar represents execution. The block proposer executes before proposing, then <em>every other validator must also execute</em> during consensus to verify. This creates a symmetrical bottleneck: consensus waits on execution, execution waits on consensus. Validators constantly context switch between the two — wasted cycles that could be spent on useful work.
                </p>
            </div>
        </div>
    )
}

