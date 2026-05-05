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
      // Tone-colored 3px left border on every toast variant. Combines
      // with Sonner's `richColors` (set on the Toaster mount in
      // `app/layout.client.tsx`) for a clear at-a-glance status hierarchy.
      // The action button gets a subtle styling pass so retry-style
      // affordances feel intentional rather than default-blue links.
      toastOptions={{
        classNames: {
          toast:
            "group-[.toaster]:rounded-lg group-[.toaster]:border-l-[3px]",
          success: "group-[.toaster]:!border-l-emerald-500",
          error: "group-[.toaster]:!border-l-red-500",
          warning: "group-[.toaster]:!border-l-amber-500",
          info: "group-[.toaster]:!border-l-sky-500",
          actionButton:
            "group-[.toast]:!bg-foreground group-[.toast]:!text-background group-[.toast]:!font-medium",
          cancelButton:
            "group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
