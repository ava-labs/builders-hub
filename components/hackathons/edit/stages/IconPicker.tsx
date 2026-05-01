'use client'

import React from 'react'
import {
  Trophy, Star, Rocket, Code, Globe, Zap, Users, Calendar,
  CheckCircle, Lock, Wrench, Shield, Target, Lightbulb,
  Package, Database, Cpu, GitBranch, BarChart, Layers,
  Award, FileText, Link, Heart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type IconKey =
  | 'Trophy' | 'Star' | 'Rocket' | 'Code' | 'Globe' | 'Zap'
  | 'Users' | 'Calendar' | 'CheckCircle' | 'Lock' | 'Wrench'
  | 'Shield' | 'Target' | 'Lightbulb' | 'Package' | 'Database'
  | 'Cpu' | 'GitBranch' | 'BarChart' | 'Layers' | 'Award'
  | 'FileText' | 'Link' | 'Heart'

export const ICON_MAP: Record<IconKey, LucideIcon> = {
  Trophy, Star, Rocket, Code, Globe, Zap,
  Users, Calendar, CheckCircle, Lock, Wrench,
  Shield, Target, Lightbulb, Package, Database,
  Cpu, GitBranch, BarChart, Layers, Award,
  FileText, Link, Heart,
}

export const ICON_KEYS = Object.keys(ICON_MAP) as IconKey[]

/** Renders a lucide icon by its string key. Returns null if key is not found. */
export function renderStageIcon(
  key: string | undefined | null,
  size: number = 18
): React.ReactNode {
  if (!key) return null
  const Icon = ICON_MAP[key as IconKey]
  if (!Icon) return null
  return <Icon size={size} />
}

type IconPickerProps = {
  value: string
  onChange: (key: string) => void
  label?: string
}

export default function IconPicker({
  value,
  onChange,
  label,
}: IconPickerProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      {label && (
        <p className="text-sm font-medium leading-none">{label}</p>
      )}
      <div className="grid grid-cols-8 gap-1 rounded-md border border-input bg-background p-2">
        {/* "None" option */}
        <button
          type="button"
          title="No icon"
          onClick={() => onChange('')}
          className={[
            'flex items-center justify-center rounded p-1.5 text-xs transition-colors',
            !value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          ].join(' ')}
        >
          —
        </button>

        {ICON_KEYS.map((key) => {
          const Icon = ICON_MAP[key]
          return (
            <button
              key={key}
              type="button"
              title={key}
              onClick={() => onChange(key)}
              className={[
                'flex items-center justify-center rounded p-1.5 transition-colors',
                value === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              ].join(' ')}
            >
              <Icon size={16} />
            </button>
          )
        })}
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">Selected: {value}</p>
      )}
    </div>
  )
}
