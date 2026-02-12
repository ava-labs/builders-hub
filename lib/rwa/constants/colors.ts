// Accent colors use Tailwind class names (for className-based styling).
// Chart colors use hex values (required by Recharts SVG rendering).
export const RWA_COLORS = {
  accent: {
    primary: 'indigo-600',
    secondary: 'indigo-500',
    tertiary: 'indigo-400',
  },
  chart: {
    transactedVolume: '#4338ca',   // indigo-700
    assetsFinanced: '#6366f1',     // indigo-500
    lenderRepayments: '#818cf8',   // indigo-400
    capitalUtilization: '#a5b4fc', // indigo-300
  },
} as const
