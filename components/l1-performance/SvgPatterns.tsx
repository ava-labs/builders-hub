// SVG Background Components
export const GridPattern = () => (
  <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

export const DotsPattern = () => (
  <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="1" fill="currentColor" opacity="0.1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#dots)" />
  </svg>
);

export const WavePattern = () => (
  <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="wave" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M 0 30 Q 15 0 30 30 T 60 30" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.05"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#wave)" />
  </svg>
);

export const HexagonPattern = () => (
  <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="hexagon" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M 15 0 L 30 8.66 L 30 21.65 L 15 30 L 0 21.65 L 0 8.66 Z" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.05"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hexagon)" />
  </svg>
); 