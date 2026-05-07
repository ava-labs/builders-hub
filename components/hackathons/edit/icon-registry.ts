import {
  Trophy, Star, Rocket, Code, Globe, Zap, Users, Calendar,
  CheckCircle, Lock, Wrench, Shield, Target, Lightbulb,
  Package, Database, Cpu, GitBranch, BarChart, Layers,
  Award, FileText, Link, Heart, Server, BrainCircuit,
  Gamepad2, AppWindow, Pickaxe, LayoutGrid, Megaphone, Terminal,
  Flame, Flag, Compass, BookOpen, Bell, Wifi, Monitor, Send,
  Key, Building2, GraduationCap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Single source of truth for all available icons across the editor */
const ICON_REGISTRY: { pascalKey: string; kebabKey: string; Icon: LucideIcon }[] = [
  // Infrastructure & Dev
  { pascalKey: 'Server',      kebabKey: 'server',       Icon: Server },
  { pascalKey: 'Cpu',         kebabKey: 'cpu',          Icon: Cpu },
  { pascalKey: 'Terminal',    kebabKey: 'terminal',     Icon: Terminal },
  { pascalKey: 'Database',    kebabKey: 'database',     Icon: Database },
  { pascalKey: 'Code',        kebabKey: 'code',         Icon: Code },
  { pascalKey: 'BrainCircuit',kebabKey: 'brain-circuit',Icon: BrainCircuit },
  { pascalKey: 'AppWindow',   kebabKey: 'app-window',   Icon: AppWindow },
  { pascalKey: 'Monitor',     kebabKey: 'monitor',      Icon: Monitor },
  { pascalKey: 'Wifi',        kebabKey: 'wifi',         Icon: Wifi },
  // Web3 & Tooling
  { pascalKey: 'Link',        kebabKey: 'link',         Icon: Link },
  { pascalKey: 'GitBranch',   kebabKey: 'git-branch',   Icon: GitBranch },
  { pascalKey: 'Package',     kebabKey: 'package',      Icon: Package },
  { pascalKey: 'Pickaxe',     kebabKey: 'pickaxe',      Icon: Pickaxe },
  { pascalKey: 'Layers',      kebabKey: 'layers',       Icon: Layers },
  { pascalKey: 'LayoutGrid',  kebabKey: 'layout-grid',  Icon: LayoutGrid },
  { pascalKey: 'FileText',    kebabKey: 'file-text',    Icon: FileText },
  // Security
  { pascalKey: 'Shield',      kebabKey: 'shield',       Icon: Shield },
  { pascalKey: 'Lock',        kebabKey: 'lock',         Icon: Lock },
  { pascalKey: 'Key',         kebabKey: 'key',          Icon: Key },
  // Gaming & Rewards
  { pascalKey: 'Gamepad2',    kebabKey: 'gamepad2',     Icon: Gamepad2 },
  { pascalKey: 'Trophy',      kebabKey: 'trophy',       Icon: Trophy },
  { pascalKey: 'Star',        kebabKey: 'star',         Icon: Star },
  { pascalKey: 'Award',       kebabKey: 'award',        Icon: Award },
  // Communication
  { pascalKey: 'Megaphone',   kebabKey: 'megaphone',    Icon: Megaphone },
  { pascalKey: 'Bell',        kebabKey: 'bell',         Icon: Bell },
  { pascalKey: 'Send',        kebabKey: 'send',         Icon: Send },
  // Tools & Navigation
  { pascalKey: 'Wrench',      kebabKey: 'wrench',       Icon: Wrench },
  { pascalKey: 'Target',      kebabKey: 'target',       Icon: Target },
  { pascalKey: 'Compass',     kebabKey: 'compass',      Icon: Compass },
  { pascalKey: 'Flag',        kebabKey: 'flag',         Icon: Flag },
  // Data & Analytics
  { pascalKey: 'BarChart',    kebabKey: 'bar-chart',    Icon: BarChart },
  { pascalKey: 'Zap',         kebabKey: 'zap',          Icon: Zap },
  { pascalKey: 'Globe',       kebabKey: 'globe',        Icon: Globe },
  // People & Community
  { pascalKey: 'Users',       kebabKey: 'users',        Icon: Users },
  { pascalKey: 'Calendar',    kebabKey: 'calendar',     Icon: Calendar },
  { pascalKey: 'GraduationCap',kebabKey: 'graduation-cap',Icon: GraduationCap },
  { pascalKey: 'Building2',   kebabKey: 'building-2',   Icon: Building2 },
  // Misc
  { pascalKey: 'Rocket',      kebabKey: 'rocket',       Icon: Rocket },
  { pascalKey: 'Lightbulb',   kebabKey: 'lightbulb',    Icon: Lightbulb },
  { pascalKey: 'Heart',       kebabKey: 'heart',        Icon: Heart },
  { pascalKey: 'Flame',       kebabKey: 'flame',        Icon: Flame },
  { pascalKey: 'CheckCircle', kebabKey: 'check-circle', Icon: CheckCircle },
  { pascalKey: 'BookOpen',    kebabKey: 'book-open',    Icon: BookOpen },
]

/** PascalCase key → LucideIcon (used by Stages Cards/Tags) */
export const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_REGISTRY.map(({ pascalKey, Icon }) => [pascalKey, Icon])
)

export type IconKey = string

export const ICON_KEYS: string[] = ICON_REGISTRY.map(({ pascalKey }) => pascalKey)

/** kebab-case value + Icon (used by Tracks / Resources in page.tsx) */
export const ICON_OPTIONS: { value: string; Icon: LucideIcon }[] = ICON_REGISTRY.map(
  ({ kebabKey, Icon }) => ({ value: kebabKey, Icon })
)
