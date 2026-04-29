"use client"

import { useTheme } from "@/components/content-design/theme-observer"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  // Use the project's MutationObserver-based theme hook (returns
  // 'light' | 'dark') instead of next-themes — the latter isn't actually
  // wired into the layout and would resolve to undefined → Sonner's
  // 'system' fallback, which detects OS preference and could mismatch
  // the site's chosen theme.
  const theme = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
