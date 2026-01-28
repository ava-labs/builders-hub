"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Card Skeleton
 * A loading placeholder for card components
 */
export function CardSkeleton({
  className,
  showHeader = true,
  showActions = false,
  lines = 3,
}: {
  className?: string;
  showHeader?: boolean;
  showActions?: boolean;
  lines?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-6 shadow-sm",
        className
      )}
    >
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          {showActions && <Skeleton className="h-8 w-8 rounded-md" />}
        </div>
      )}

      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "h-4",
              i === lines - 1 ? "w-3/4" : "w-full"
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Stats Card Skeleton
 * For metric/stats display cards
 */
export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/**
 * List Skeleton
 * Loading placeholder for list items
 */
export function ListSkeleton({
  count = 5,
  className,
  showIcon = true,
  showAction = false,
}: {
  count?: number;
  className?: string;
  showIcon?: boolean;
  showAction?: boolean;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} showIcon={showIcon} showAction={showAction} />
      ))}
    </div>
  );
}

/**
 * List Item Skeleton
 * Single list item placeholder
 */
export function ListItemSkeleton({
  className,
  showIcon = true,
  showAction = false,
}: {
  className?: string;
  showIcon?: boolean;
  showAction?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border p-3",
        className
      )}
    >
      {showIcon && <Skeleton className="h-10 w-10 rounded-md shrink-0" />}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      {showAction && <Skeleton className="h-8 w-20 rounded-md shrink-0" />}
    </div>
  );
}

/**
 * Table Skeleton
 * Loading placeholder for tables
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
  showHeader = true,
}: {
  rows?: number;
  columns?: number;
  className?: string;
  showHeader?: boolean;
}) {
  return (
    <div className={cn("rounded-md border", className)}>
      {/* Table Header */}
      {showHeader && (
        <div className="flex gap-4 border-b bg-muted/50 p-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={`header-${i}`}
              className={cn(
                "h-4",
                i === 0 ? "w-24" : i === columns - 1 ? "w-16" : "w-32"
              )}
            />
          ))}
        </div>
      )}

      {/* Table Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 p-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`${rowIndex}-${colIndex}`}
                className={cn(
                  "h-4",
                  colIndex === 0 ? "w-24" : colIndex === columns - 1 ? "w-16" : "w-32"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Form Skeleton
 * Loading placeholder for forms
 */
export function FormSkeleton({
  fields = 4,
  className,
  showTitle = true,
  showSubmit = true,
}: {
  fields?: number;
  className?: string;
  showTitle?: boolean;
  showSubmit?: boolean;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {showTitle && (
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      )}

      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <FormFieldSkeleton key={i} />
        ))}
      </div>

      {showSubmit && (
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      )}
    </div>
  );
}

/**
 * Form Field Skeleton
 * Single form field placeholder
 */
export function FormFieldSkeleton({
  className,
  type = "input",
}: {
  className?: string;
  type?: "input" | "textarea" | "select";
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton
        className={cn(
          "w-full rounded-md",
          type === "textarea" ? "h-24" : "h-10"
        )}
      />
    </div>
  );
}

/**
 * Page Header Skeleton
 * Loading placeholder for page headers
 */
export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Sidebar Item Skeleton
 * For sidebar navigation items
 */
export function SidebarItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2", className)}>
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

/**
 * Sidebar Skeleton
 * Full sidebar loading state
 */
export function SidebarSkeleton({
  groups = 3,
  itemsPerGroup = 4,
  className,
}: {
  groups?: number;
  itemsPerGroup?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 p-4", className)}>
      {Array.from({ length: groups }).map((_, groupIndex) => (
        <div key={groupIndex} className="space-y-1">
          <Skeleton className="h-3 w-20 mb-2" />
          {Array.from({ length: itemsPerGroup }).map((_, itemIndex) => (
            <SidebarItemSkeleton key={itemIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Avatar Skeleton
 */
export function AvatarSkeleton({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <Skeleton
      className={cn("rounded-full", sizeClasses[size], className)}
    />
  );
}

/**
 * Badge Skeleton
 */
export function BadgeSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-5 w-16 rounded-full", className)} />;
}

/**
 * Wallet Connection Skeleton
 * For wallet display loading states
 */
export function WalletSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-md border p-2", className)}>
      <Skeleton className="h-6 w-6 rounded-full" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}

/**
 * Transaction List Skeleton
 * For transaction history loading
 */
export function TransactionListSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border p-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Validator Card Skeleton
 * For validator information cards
 */
export function ValidatorCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 shadow-sm", className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <BadgeSkeleton />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Chart Skeleton
 * For chart/graph loading states
 */
export function ChartSkeleton({
  className,
  height = 200,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <Skeleton className="w-full rounded-md" style={{ height }} />
    </div>
  );
}

/**
 * Full Page Loading Skeleton
 * For entire page loading states
 */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <PageHeaderSkeleton />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>

      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}
