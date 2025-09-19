'use client';

interface ElectricEffectProps {
     className?: string;
}

export const ElectricEffect: React.FC<ElectricEffectProps> = ({ className = '' }) => {
     return (
          <div className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}>
               {/* Electric bolts */}
               <div className="absolute right-8 top-4 w-1 h-12 bg-gradient-to-b from-transparent via-yellow-400/40 to-transparent animate-electric-pulse"
                    style={{ animationDelay: '0s', animationDuration: '1.5s' }} />

               <div className="absolute right-12 top-8 w-0.5 h-8 bg-gradient-to-b from-transparent via-blue-400/50 to-transparent animate-electric-pulse"
                    style={{ animationDelay: '0.5s', animationDuration: '2s' }} />

               <div className="absolute right-16 top-12 w-1 h-6 bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent animate-electric-pulse"
                    style={{ animationDelay: '1s', animationDuration: '1.8s' }} />

               <div className="absolute right-4 top-12 w-1 h-6 bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent animate-electric-pulse"
                    style={{ animationDelay: '1s', animationDuration: '1.8s' }} />

               <div className="absolute right-0 top-4 w-1 h-12 bg-gradient-to-b from-transparent via-yellow-400/40 to-transparent animate-electric-pulse"
                    style={{ animationDelay: '0s', animationDuration: '1.5s' }} />

               {/* Electric sparks */}
               <div className="absolute right-10 top-6 w-1 h-1 bg-yellow-400 rounded-full animate-ping"
                    style={{ animationDelay: '0.2s', animationDuration: '2.5s' }} />

               <div className="absolute right-14 top-10 w-0.5 h-0.5 bg-blue-400 rounded-full animate-ping"
                    style={{ animationDelay: '0.8s', animationDuration: '2s' }} />

               <div className="absolute right-6 top-14 w-1 h-1 bg-cyan-400 rounded-full animate-ping"
                    style={{ animationDelay: '1.3s', animationDuration: '2.2s' }} />

               {/* Electric glow */}
               <div className="absolute right-4 top-0 w-20 h-full bg-gradient-to-l from-yellow-400/5 via-blue-400/3 to-transparent animate-electric-pulse"
                    style={{ animationDuration: '3s' }} />

               {/* Zap icon enhancement */}
               <div className="absolute right-[-30%] bottom-[-25%] text-yellow-400 opacity-50 pointer-events-none select-none z-0"
                    style={{ height: '80%', width: '80%' }}>
                    <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
                         <path d="M13 0L0 13h7v11l13-13h-7V0z" />
                    </svg>
               </div>

               {/* Gradient overlay */}
               <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/5 to-background/80 pointer-events-none" />
          </div>
     );
};
