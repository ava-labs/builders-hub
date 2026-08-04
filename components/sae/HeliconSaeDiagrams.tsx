"use client"
import { useEffect, useState } from "react"
import { ParallelStreamsCard } from "./ParallelStreamsCard"
import { BlockRelationship } from "./UnderTheHood"
import { Colors } from "./types"

// The SAE diagrams used in the Helicon blog post, rendered live (instead of
// static PNGs) so they stay in sync with the Streaming Asynchronous Execution
// doc, and scaled to 70% so they sit comfortably inside the blog column. Theme
// detection mirrors TransactionLifecycle: the mobile toggle mutates the <html>
// class directly, so we watch it rather than relying only on next-themes.
const DIAGRAMS = {
  "parallel-streams": ParallelStreamsCard,
  "block-relationship": BlockRelationship,
} as const

export function HeliconSaeDiagram({ diagram }: { diagram: keyof typeof DIAGRAMS }) {
  const [mounted, setMounted] = useState(false)
  const [domTheme, setDomTheme] = useState<"dark" | "light">("dark")

  useEffect(() => {
    setMounted(true)
    setDomTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
  }, [])

  useEffect(() => {
    if (!mounted) return
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          setDomTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
        }
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [mounted])

  const isDark = !mounted || domTheme === "dark"

  const colors: Colors = {
    bg: "bg-transparent",
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

  const Diagram = DIAGRAMS[diagram]

  return (
    <div className="my-6 overflow-x-auto">
      {/* 30% smaller than the doc's full-size render */}
      <div className="[zoom:0.7]">
        <Diagram colors={colors} />
      </div>
    </div>
  )
}
