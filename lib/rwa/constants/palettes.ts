export interface RWAPalette {
  name: string
  shades: {
    900: string
    800: string
    700: string
    600: string
    500: string
    400: string
    300: string
  }
}

export const PALETTE_PRESETS: RWAPalette[] = [
  {
    name: 'Indigo',
    shades: {
      900: '#312e81',
      800: '#3730a3',
      700: '#4338ca',
      600: '#4f46e5',
      500: '#6366f1',
      400: '#818cf8',
      300: '#a5b4fc',
    },
  },
  {
    name: 'Violet',
    shades: {
      900: '#4c1d95',
      800: '#5b21b6',
      700: '#6d28d9',
      600: '#7c3aed',
      500: '#8b5cf6',
      400: '#a78bfa',
      300: '#c4b5fd',
    },
  },
  {
    name: 'Blue',
    shades: {
      900: '#1e3a5f',
      800: '#1e40af',
      700: '#1d4ed8',
      600: '#2563eb',
      500: '#3b82f6',
      400: '#60a5fa',
      300: '#93c5fd',
    },
  },
  {
    name: 'Emerald',
    shades: {
      900: '#064e3b',
      800: '#065f46',
      700: '#047857',
      600: '#059669',
      500: '#10b981',
      400: '#34d399',
      300: '#6ee7b7',
    },
  },
  {
    name: 'Rose',
    shades: {
      900: '#881337',
      800: '#9f1239',
      700: '#be123c',
      600: '#e11d48',
      500: '#f43f5e',
      400: '#fb7185',
      300: '#fda4af',
    },
  },
  {
    name: 'Amber',
    shades: {
      900: '#78350f',
      800: '#92400e',
      700: '#b45309',
      600: '#d97706',
      500: '#f59e0b',
      400: '#fbbf24',
      300: '#fcd34d',
    },
  },
]
