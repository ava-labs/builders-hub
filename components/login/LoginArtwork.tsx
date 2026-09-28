import { AvalancheLogo } from '@/components/navigation/avalanche-logo';

const markLayers = [
  { x: 101, y: 188, width: 360, height: 311, opacity: 0.9 },
  { x: 117, y: 202, width: 328, height: 283, opacity: 0.8 },
  { x: 133, y: 216, width: 296, height: 255, opacity: 0.7 },
  { x: 149, y: 230, width: 264, height: 227, opacity: 0.6 },
  { x: 165, y: 244, width: 232, height: 199, opacity: 0.5 },
  { x: 181, y: 258, width: 200, height: 171, opacity: 0.4 },
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
      <rect x="58" y="82" width="444" height="521" rx="11" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
      <path d="M58 142h444" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
      <circle cx="88" cy="112" r="5" fill="currentColor" fillOpacity="0.45" />
      <circle cx="107" cy="112" r="5" fill="currentColor" fillOpacity="0.45" />
      <circle cx="126" cy="112" r="5" fill="currentColor" fillOpacity="0.45" />
      {markLayers.map((layer, index) => (
        <AvalancheLogo
          key={layer.width}
          className={index === 0 ? 'text-[#FD3648] dark:text-[#FF5A68]' : undefined}
          x={layer.x}
          y={layer.y}
          width={layer.width}
          height={layer.height}
          outline
          opacity={layer.opacity}
        />
      ))}
    </svg>
  );
}
