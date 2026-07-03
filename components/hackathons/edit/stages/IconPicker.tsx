'use client'

import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { ICON_MAP, ICON_KEYS, ICON_OPTIONS, type IconKey } from '../icon-registry'

export type { IconKey }
export { ICON_MAP, ICON_KEYS }

/** Renders a lucide icon by its string key. Returns null if key is not found. */
export function renderStageIcon(
  key: string | undefined | null,
  size: number = 18
): React.ReactNode {
  if (!key) return null
  // PascalCase key (e.g. "Trophy")
  const Icon = ICON_MAP[key]
  if (Icon) return <Icon size={size} />
  // Fallback: kebab-case to PascalCase (e.g. "git-branch" → "GitBranch")
  const pascal = key.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  const FallbackIcon = ICON_MAP[pascal]
  if (FallbackIcon) return <FallbackIcon size={size} />
  return null
}

/** Converts PascalCase icon key to a readable lowercase label */
function formatLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()
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
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Persist required default icon on mount (no empty allowed)
  useEffect(() => {
    if (!ICON_MAP[value as IconKey]) {
      onChange(ICON_KEYS[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const effective = ICON_MAP[value as IconKey] ? value : ICON_KEYS[0]
  const SelectedIcon = ICON_MAP[effective as IconKey]

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        // Open upward: bottom of dropdown sits 4px above the button
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        zIndex: 9999,
      })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const dropdown = open
    ? ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-2 w-56 max-h-64 overflow-y-auto"
        >
          <div className="grid grid-cols-3 gap-1">
            {ICON_KEYS.map((key) => {
              const Icon = ICON_MAP[key]
              return (
                <button
                  key={key}
                  type="button"
                  title={key}
                  onClick={() => { onChange(key); setOpen(false) }}
                  className={[
                    'flex flex-col items-center gap-1 p-2 rounded-md text-xs transition-colors',
                    effective === key
                      ? 'bg-red-50 dark:bg-red-900/30 ring-1 ring-red-400 text-red-600 dark:text-red-400'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
                  ].join(' ')}
                >
                  <Icon size={16} />
                  <span className="truncate w-full text-center">{formatLabel(key)}</span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <div className="space-y-1">
      {label && (
        <p className="text-sm font-medium leading-none">{label}</p>
      )}
      <div className="relative inline-block">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-sm"
        >
          <SelectedIcon size={16} />
          <span className="capitalize">{formatLabel(effective)}</span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
        </button>
        {dropdown}
      </div>
    </div>
  )
}


