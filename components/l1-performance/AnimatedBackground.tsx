// Animated Background Components
export const AnimatedBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    {/* Gradient Orbs */}
    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-[#EB4C50]/20 to-orange-500/20 rounded-full blur-3xl animate-pulse" style={{animationDuration: '8s'}} />
    <div className="absolute top-3/4 right-1/4 w-80 h-80 bg-gradient-to-r from-blue-500/15 to-purple-500/15 rounded-full blur-3xl animate-pulse" style={{animationDuration: '12s', animationDelay: '2s'}} />
    <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{animationDuration: '10s', animationDelay: '4s'}} />
    
    {/* Additional Gradient Orbs */}
    <div className="absolute top-1/6 right-1/6 w-72 h-72 bg-gradient-to-r from-purple-500/15 to-pink-500/15 rounded-full blur-3xl animate-pulse" style={{animationDuration: '9s', animationDelay: '1s'}} />
    <div className="absolute top-2/3 left-1/6 w-56 h-56 bg-gradient-to-r from-cyan-500/12 to-blue-500/12 rounded-full blur-3xl animate-pulse" style={{animationDuration: '11s', animationDelay: '3s'}} />
    <div className="absolute bottom-1/3 right-1/3 w-88 h-88 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-full blur-3xl animate-pulse" style={{animationDuration: '7s', animationDelay: '5s'}} />
    <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-gradient-to-r from-green-500/8 to-emerald-500/8 rounded-full blur-3xl animate-pulse" style={{animationDuration: '13s', animationDelay: '0.5s'}} />
    <div className="absolute bottom-1/6 left-1/4 w-64 h-64 bg-gradient-to-r from-indigo-500/12 to-purple-500/12 rounded-full blur-3xl animate-pulse" style={{animationDuration: '10.5s', animationDelay: '2.5s'}} />
    <div className="absolute top-1/3 right-1/2 w-40 h-40 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-full blur-3xl animate-pulse" style={{animationDuration: '8.5s', animationDelay: '4.5s'}} />
    
    {/* Network Grid Lines */}
    <div className="absolute inset-0 opacity-5">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="network-grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#network-grid)" />
      </svg>
    </div>
    
    {/* Animated Circuit Lines */}
    <div className="absolute inset-0">
      {/* Vertical Circuit Lines */}
      {[...Array(6)].map((_, i) => (
        <div
          key={`circuit-v-${i}`}
          className="absolute w-px bg-gradient-to-b from-transparent via-[#EB4C50]/20 to-transparent animate-circuit-vertical"
          style={{
            left: `${15 + i * 15}%`,
            top: '0%',
            height: '100%',
            animationDelay: `${i * 0.7}s`,
            animationDuration: '8s'
          }}
        />
      ))}
    </div>
    
    {/* Subtle Wave Effect */}
    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#EB4C50]/5 to-transparent animate-wave" style={{animationDuration: '8s'}} />
  </div>
); 