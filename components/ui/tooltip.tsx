"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

/*
 * site-tooltips: a tooltip waits 400ms on the first hover, so a pointer crossing a form opens nothing by accident.
 * For 300ms after one closes, a neighbour under the same provider opens at once (Radix marks it
 * data-state="instant-open") and plays no animation. Both waits live on the provider. One wraps every page
 * (app/layout.client.tsx); a provider that sets a wait of its own keeps it for the tooltips under it (the evaluation
 * dashboard sets 150), and one with no props of its own inside another adds nothing, so its tooltips stay neighbours
 * of the rest (the console sidebar's, for one). A delayed open fades in from 97% at its trigger in 150ms on the strong ease-out and leaves in 100ms; under
 * Reduce Motion it only fades in, in 100ms (keyframes in app/global.css). The plate is ink, zinc-100 in the dark
 * theme: its 12px text passes 4.5:1 (white on the old #D66666 was 3.5:1). The page's --primary and
 * --muted-foreground are made for the page's ground, so the plate sets its own for the text it holds.
 */

/** True under a TooltipProvider. */
const UnderProvider = React.createContext(false)

function TooltipProvider({
  children,
  delayDuration,
  skipDelayDuration,
  disableHoverableContent,
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  const nested = React.useContext(UnderProvider)
  const ownSettings = [delayDuration, skipDelayDuration, disableHoverableContent].some((value) => value !== undefined)
  if (nested && !ownSettings) return <>{children}</>
  return (
    <UnderProvider value>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        delayDuration={delayDuration ?? 400}
        skipDelayDuration={skipDelayDuration ?? 300}
        disableHoverableContent={disableHoverableContent}
      >
        {children}
      </TooltipPrimitive.Provider>
    </UnderProvider>
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const root = <TooltipPrimitive.Root data-slot="tooltip" {...props} />
  return React.useContext(UnderProvider) ? root : <TooltipProvider>{root}</TooltipProvider>
}

function TooltipTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" className={cn("cursor-pointer", className)} {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          "[--primary:var(--color-zinc-50)] dark:[--primary:var(--color-zinc-900)] [--muted-foreground:var(--color-zinc-400)] dark:[--muted-foreground:var(--color-zinc-600)]",
          "data-[state=delayed-open]:animate-[site-search-in_150ms_var(--ease-out)] data-[state=closed]:animate-[acad-path-out_100ms_var(--ease-out)_forwards] motion-reduce:data-[state=delayed-open]:animate-[vs-fade-in_100ms_var(--ease-out)]!",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-zinc-900 fill-zinc-900 dark:bg-zinc-100 dark:fill-zinc-100 z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
