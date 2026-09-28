import { AvalancheLogo } from '@/components/navigation/avalanche-logo';

const markLayers = [
  { x: 151, y: 233, width: 360, height: 311, opacity: 0.9 },
  { x: 167, y: 247, width: 328, height: 283, opacity: 0.8 },
  { x: 183, y: 261, width: 296, height: 255, opacity: 0.7 },
  { x: 199, y: 275, width: 264, height: 227, opacity: 0.6 },
  { x: 215, y: 289, width: 232, height: 199, opacity: 0.5 },
  { x: 231, y: 303, width: 200, height: 171, opacity: 0.4 },
];

export function LoginArtwork({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 559 685"
      fill="none"
      className={`text-zinc-900 dark:text-zinc-100 ${className}`}
      aria-hidden="true"
      {...props}
    >
      <rect x="61" y="28" width="421" height="499" rx="11" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" />
      <rect
        x="288"
        y="267"
        width="270"
        height="417"
        rx="11"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="2"
      />

      <path
        d="M26 105h70M59 16c1-2 3-2 4 0l15 28c2 4 5 5 9 2l20-18c3-3 6-1 5 3L97 81c-1 3-3 4-6 4H31c-3 0-5-1-6-4L10 31c-1-4 2-6 5-3l21 18c4 3 7 2 9-2l14-28Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {markLayers.map((layer) => (
        <AvalancheLogo
          key={layer.width}
          id={`login-mark-${layer.width}`}
          x={layer.x}
          y={layer.y}
          width={layer.width}
          height={layer.height}
          outline
          opacity={layer.opacity}
        />
      ))}

      <rect x="60" y="549" width="76" height="21" rx="10.5" fill="#FF838D" stroke="#FF394A" />
      <text x="98" y="563" fill="#161617" fontSize="11" textAnchor="middle" fontFamily="Arial, sans-serif">
        Avalanche
      </text>
      <rect x="471" y="119" width="87" height="21" rx="10.5" fill="#FF838D" stroke="#FF394A" />
      <text x="514.5" y="133" fill="#161617" fontSize="11" textAnchor="middle" fontFamily="Arial, sans-serif">
        Builders Hub
      </text>
    </svg>
  );
}
