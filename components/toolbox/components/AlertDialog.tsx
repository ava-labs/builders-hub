"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { cn } from "./utils"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

const buttonVariants = ({
  variant = "primary",
  className = "",
}: {
  variant?: "primary" | "secondary" | "outline" | "danger" | "outline-danger" | "light-danger"
  className?: string
} = {}) => {
  // Base classes
  const baseClasses = [
    "w-full",
    "text-sm font-medium shadow-sm",
    "transition-colors duration-300",
    "flex items-center justify-center gap-2",
    "cursor-pointer",
    "rounded-xl",
    "px-4 py-3"
  ];

  // Variant-specific classes
  let variantClasses = "";
  if (variant === "primary") {
    variantClasses = "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600";
  } else if (variant === "secondary") {
    variantClasses = "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50";
  } else if (variant === "outline") {
    variantClasses = "border-2 border-zinc-300 bg-transparent text-zinc-800 hover:bg-zinc-100 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:border-zinc-500";
  } else if (variant === "danger") {
    variantClasses = "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600";
  } else if (variant === "light-danger") {
    variantClasses = "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 dark:border-red-900/50";
  } else if (variant === "outline-danger") {
    variantClasses = "border-2 border-red-300 bg-transparent text-red-700 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:border-red-700";
  }

  // State classes (disabled)
  const stateClasses = "disabled:bg-zinc-200 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400 disabled:cursor-not-allowed";

  // Combine all classes
  return cn(
    ...baseClasses,
    variantClasses,
    stateClasses,
    className
  );
}

function AlertDialogAction({
  className,
  variant = "primary",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & {
  variant?: "primary" | "secondary" | "outline" | "danger" | "outline-danger" | "light-danger"
}) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}