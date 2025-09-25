import Image from 'next/image';

interface TokenBackgroundProps {
  className?: string;
}

const tokenLogos = [
    'avax.png',
    'tether.png',
    'usdc.png',
    'bitcoin.png',
    'arena.png',
    'beam.png',
    'coq.png',
    'aave.png',
    'gun.png',
    'chainlink.png'
];

export const TokenBackground: React.FC<TokenBackgroundProps> = ({ className = '' }) => {
  // Split tokens into two columns
  const midPoint = Math.ceil(tokenLogos.length / 2);
  const firstColumn = tokenLogos.slice(0, midPoint);
  const secondColumn = tokenLogos.slice(midPoint);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}>
      {/* Rotated container for diagonal effect */}
      <div className="absolute inset-0 -rotate-20 scale-125 -translate-x-4">
        {/* First Column - Moving Up */}
        <div className="absolute right-16 w-7 h-full">
          <div className="flex flex-col gap-3 animate-infinite-scroll-up">
            {/* Duplicate the list multiple times for seamless loop */}
            {Array.from({ length: 8 }, (_, setIndex) => 
              firstColumn.map((logo, index) => (
                <div key={`col1-set${setIndex}-${index}`} className="w-7 h-7 opacity-75 flex-shrink-0">
                  <Image
                    src={`/images/${logo}`}
                    alt=""
                    width={28}
                    height={28}
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Second Column - Moving Down */}
        <div className="absolute right-4 w-7 h-full">
          <div className="flex flex-col gap-3 animate-infinite-scroll-down">
            {/* Duplicate the list multiple times for seamless loop */}
            {Array.from({ length: 8 }, (_, setIndex) => 
              secondColumn.map((logo, index) => (
                <div key={`col2-set${setIndex}-${index}`} className="w-7 h-7 opacity-50 flex-shrink-0">
                  <Image
                    src={`/images/${logo}`}
                    alt=""
                    width={28}
                    height={28}
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gradient overlay to fade tokens */}
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/10 to-background/80 pointer-events-none" />
    </div>
  );
};
