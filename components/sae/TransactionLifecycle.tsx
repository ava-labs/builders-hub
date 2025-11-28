"use client"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { AvalancheLogo } from "@/components/navigation/avalanche-logo"
import { AssemblyLineCard } from "./AssemblyLineAnimation"
import { Colors } from "./types"
import { SynchronousExecution } from "./SynchronousExecution"
import { StreamingAsyncExecution } from "./StreamingAsyncExecution"
import { UnderTheHood, BlockRelationship } from "./UnderTheHood"
import { Payoff } from "./Payoff"
import { SynchronousExecutionDiagram } from "./SynchronousExecutionDiagram"

export function TransactionLifecycle() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [domTheme, setDomTheme] = useState<'dark' | 'light'>('dark')
  
  // Wait for theme to be resolved on client
  useEffect(() => {
    setMounted(true)
    // Get initial theme from DOM
    const isDarkClass = document.documentElement.classList.contains('dark')
    setDomTheme(isDarkClass ? 'dark' : 'light')
  }, [])
  
  // Watch for DOM-based theme changes (mobile toggle uses direct DOM manipulation)
  useEffect(() => {
    if (!mounted) return
    
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          const isDarkClass = document.documentElement.classList.contains('dark')
          setDomTheme(isDarkClass ? 'dark' : 'light')
        }
      }
    })
    
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [mounted])
  
  // Use DOM theme as source of truth, fall back to next-themes
  const isDark = !mounted || domTheme === 'dark' || (domTheme === undefined && (resolvedTheme === "dark" || resolvedTheme === undefined))

  const colors: Colors = {
    bg: isDark ? "bg-[#0a0a0a]" : "bg-[#fafafa]",
    text: isDark ? "text-white" : "text-black",
    textMuted: isDark ? "text-white/50" : "text-black/50",
    textFaint: isDark ? "text-white/20" : "text-black/20",
    border: isDark ? "border-white/10" : "border-black/10",
    borderStrong: isDark ? "border-white/30" : "border-black/30",
    blockBg: isDark ? "bg-white/5" : "bg-black/5",
    blockBgStrong: isDark ? "bg-white/10" : "bg-black/10",
    blockSolid: isDark ? "bg-white" : "bg-black",
    blockFaint: isDark ? "bg-white/20" : "bg-black/20",
    stroke: isDark ? "#ffffff" : "#000000",
  }

  return (
    <div
      className={`relative w-full min-h-screen ${colors.bg} flex flex-col items-center justify-center p-4 md:p-12 overflow-x-hidden`}
    >
      {/* Header */}
      <div className="text-center mb-4 md:mb-16 max-w-5xl w-full mx-auto px-2">
        <div className="mb-2 md:mb-4">
          <AvalancheLogo className="w-8 h-8 sm:w-10 sm:h-10 mx-auto" />
        </div>
        <h1
          className={`text-base sm:text-xl md:text-3xl font-medium ${colors.text} uppercase tracking-[0.1em] sm:tracking-[0.2em] mb-4 md:mb-6 font-mono`}
        >
          Streaming Asynchronous Execution
        </h1>
        <p className={`text-[10px] sm:text-xs md:text-sm ${colors.textMuted} font-mono uppercase tracking-[0.1em] mb-4 md:mb-6`}>
          ACP-194: Decoupling Consensus and Execution
        </p>
        
        {/* Learn More links */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link 
            href="/docs/acps/194-streaming-asynchronous-execution"
            className={`group flex items-center gap-2 px-4 py-2 border ${colors.border} ${colors.blockBg} hover:${colors.blockBgStrong} transition-all`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="1.5" className="opacity-50 group-hover:opacity-100 transition-opacity">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span className={`text-xs ${colors.text} font-mono uppercase tracking-[0.1em]`}>Read Spec</span>
          </Link>
          
          <a 
            href="https://www.youtube.com/watch?v=yxAeRq4vSoQ"
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-2 px-4 py-2 border ${colors.border} ${colors.blockBg} hover:${colors.blockBgStrong} transition-all`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="1.5" className="opacity-50 group-hover:opacity-100 transition-opacity">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
            </svg>
            <span className={`text-xs ${colors.text} font-mono uppercase tracking-[0.1em]`}>Watch Video</span>
          </a>
        </div>
      </div>

      <div className="w-full max-w-5xl">
        {/* Problem statement hook */}
        <div className="pb-6 mb-6 md:-mt-4 md:pb-10 md:mb-10">
          <p className={`text-sm md:text-base ${colors.textMuted} leading-relaxed`}>
            Traditional blockchains have a bottleneck: consensus waits for execution, execution waits for consensus.
          </p>
          <p className={`text-sm md:text-base ${colors.text} mt-2 md:mt-3 font-medium`}>
            What if they could run in parallel?
          </p>
        </div>
        
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: THE PROBLEM - Synchronous Execution */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="-mb-2 md:mb-24">
          <div className="flex items-center gap-4 mb-3 md:mb-6">
            <span className={`text-[10px] uppercase tracking-[0.3em] ${colors.textFaint} font-mono`}>01</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
            <span className={`text-sm uppercase tracking-[0.2em] ${colors.text} font-medium`}>The Bottleneck</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
          </div>
          
          {/* Scale down on mobile to fit, keep desktop unchanged - negative margin compensates for transform scale */}
          <div className="overflow-hidden md:overflow-visible -mb-[60px] sm:-mb-[30px] md:mb-0">
            <div className="md:transform-none origin-top-left transform scale-[0.5] sm:scale-[0.7] md:scale-100 w-[200%] sm:w-[143%] md:w-full">
              <SynchronousExecution colors={colors} />
            </div>
          </div>

          {/* Interleaved Execution diagram */}
          <div className="overflow-hidden md:overflow-visible mt-4 md:mt-8 -mb-[40px] sm:-mb-[20px] md:mb-0">
            <div className="md:transform-none origin-top-left transform scale-[0.5] sm:scale-[0.7] md:scale-100 w-[200%] sm:w-[143%] md:w-full">
              <SynchronousExecutionDiagram colors={colors} />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: THE SOLUTION - SAE Visualization */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-2 md:mb-24">
          <div className="flex items-center gap-4 mb-3 md:mb-6">
            <span className={`text-[10px] uppercase tracking-[0.3em] ${colors.textFaint} font-mono`}>02</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
            <span className={`text-sm uppercase tracking-[0.2em] ${colors.text} font-medium`}>The Solution</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
          </div>

          {/* All SAE lanes scaled for mobile - negative margin compensates for transform scale dead space */}
          <div className="overflow-hidden md:overflow-visible -mb-[200px] sm:-mb-[80px] md:mb-0">
            <div className="md:transform-none origin-top-left transform scale-[0.55] sm:scale-[0.75] md:scale-100 w-[182%] sm:w-[133%] md:w-full">
              <StreamingAsyncExecution colors={colors} />
                </div>
          </div>
        </div>

        {/* Block Relationship diagram */}
        <div className="overflow-hidden md:overflow-visible -mb-[100px] sm:-mb-[50px] md:mb-8">
          <div className="md:transform-none origin-top-left transform scale-[0.5] sm:scale-[0.7] md:scale-100 w-[200%] sm:w-[143%] md:w-full">
            <BlockRelationship colors={colors} />
          </div>
        </div>

        {/* Assembly Line - simplified view, part of the solution */}
        {/* Scale down on mobile to fit, keep desktop unchanged */}
        <div className="mb-4 md:mt-8 md:mb-24 overflow-hidden md:overflow-visible -mt-[80px] sm:-mt-[40px] md:mt-0">
          <div className="md:transform-none origin-top-left transform scale-[0.4] sm:scale-[0.6] md:scale-100 w-[250%] sm:w-[166%] md:w-full -mb-[120px] sm:-mb-[60px] md:mb-0">
            <AssemblyLineCard colors={colors} />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: TECHNICAL DEEP DIVE - Block Relationship */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="pt-10 md:pt-0 md:mb-24">
          <div className="flex items-center gap-4 mb-3 md:mb-6">
            <span className={`text-[10px] uppercase tracking-[0.3em] ${colors.textFaint} font-mono`}>03</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
            <span className={`text-sm uppercase tracking-[0.2em] ${colors.text} font-medium`}>Under the Hood</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
          </div>
          
          {/* Scale down on mobile - use explicit height to avoid dead space from transform */}
          <div className="overflow-hidden md:overflow-visible h-[1600px] sm:h-[1900px] md:h-auto">
            <div className="md:transform-none origin-top-left transform scale-[0.45] sm:scale-[0.65] md:scale-100 w-[222%] sm:w-[154%] md:w-full">
              <UnderTheHood colors={colors} />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 4: BENEFITS - Results & Future */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="md:mb-16">
          <div className="flex items-center gap-4 mb-3 md:mb-6">
            <span className={`text-[10px] uppercase tracking-[0.3em] ${colors.textFaint} font-mono`}>04</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
            <span className={`text-sm uppercase tracking-[0.2em] ${colors.text} font-medium`}>The Payoff</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
          </div>
          
          {/* Scale down on mobile - use explicit height to avoid dead space from transform */}
          <div className="md:overflow-visible h-[750px] sm:h-[850px] md:h-auto overflow-hidden">
            <div className="md:transform-none origin-top-left transform scale-[0.55] sm:scale-[0.75] md:scale-100 w-[182%] sm:w-[133%] md:w-full">
              <Payoff colors={colors} />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* LEARN MORE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="pt-8 pb-12 md:pt-12 md:pb-16">
          <div className="flex items-center gap-4 mb-6 md:mb-8">
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
            <span className={`text-sm uppercase tracking-[0.2em] ${colors.text} font-medium`}>Learn More</span>
            <div className={`flex-1 h-px ${colors.border.replace("border", "bg")}`} />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              href="/docs/acps/194-streaming-asynchronous-execution"
              className={`group flex items-center gap-3 px-6 py-4 border ${colors.border} ${colors.blockBg} hover:${colors.blockBgStrong} transition-all`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="1.5" className="opacity-50 group-hover:opacity-100 transition-opacity">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <div className="text-left">
                <div className={`text-xs uppercase tracking-[0.15em] ${colors.textMuted} font-mono`}>Documentation</div>
                <div className={`text-sm ${colors.text} font-mono`}>ACP-194 Specification</div>
              </div>
            </Link>
            
            <a 
              href="https://www.youtube.com/watch?v=yxAeRq4vSoQ"
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center gap-3 px-6 py-4 border ${colors.border} ${colors.blockBg} hover:${colors.blockBgStrong} transition-all`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.stroke} strokeWidth="1.5" className="opacity-50 group-hover:opacity-100 transition-opacity">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
              </svg>
              <div className="text-left">
                <div className={`text-xs uppercase tracking-[0.15em] ${colors.textMuted} font-mono`}>Video</div>
                <div className={`text-sm ${colors.text} font-mono`}>Watch Explainer</div>
              </div>
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}
