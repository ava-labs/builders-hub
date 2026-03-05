import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  badge?: string
  className?: string
}

export function SectionHeader({ title, badge, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <h2 className="text-xl font-semibold">{title}</h2>
      {badge && (
        <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
          {badge}
        </span>
      )}
    </div>
  )
}
