import { ChevronRight, Layers, UserPen, MessageCircle, Coins, Droplet, Code } from 'lucide-react';

const SplashPage = () => {
  const features = [
    {
      title: "Create L1",
      description: "Launch your custom blockchain",
      icon: <Layers className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#createChain"
    },
    {
      title: "Validators",
      description: "Configure and manage validator contracts",
      icon: <UserPen className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#deployValidatorManager"
    },
    {
      title: "Deploy ICM",
      description: "Set up cross-chain messaging for your L1",
      icon: <MessageCircle className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",  
      href: "#teleporterMessenger"
    },
    {
      title: "Deploy ICTT",
      description: "Set up cross-chain token transfers for your L1",
      icon: <Coins className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#deployExampleERC20"
    },
  ];

  const handleCardClick = (href: string) => {
    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.hash = href.substring(1);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-zinc-900 dark:text-white mb-6 tracking-tight leading-tight">
          Build Your{" "}
          <span className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-clip-text text-transparent font-extrabold">
            L1
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
          The complete toolkit for launching and managing Layer 1 blockchains on Avalanche
        </p>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        {features.map((feature, index) => (
          <div
            key={index}
            onClick={() => handleCardClick(feature.href)}
            className="group block p-8 rounded-2xl transition-all duration-200 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-sm border border-zinc-200/60 dark:border-zinc-700/60 shadow-lg hover:shadow-xl hover:border-zinc-300/80 dark:hover:border-zinc-600/80 cursor-pointer relative"
          >
            <div className="h-full min-h-[160px] flex flex-col items-center text-center">
              {/* Icon */}
              <div className="mb-6">
                <div className="w-14 h-14 flex items-center justify-center">
                  <div className="text-zinc-700 dark:text-zinc-300">
                    {feature.icon}
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-4 text-zinc-900 dark:text-white transition-colors duration-200 leading-tight">
                  {feature.title}
                </h3>
                
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed text-left">
                  {feature.description}
                </p>
              </div>
            </div>
            
            {/* Arrow - positioned absolutely in bottom right */}
            <div className="absolute bottom-4 right-6">
              <ChevronRight className="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors duration-200" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA Section */}
      <div className="text-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-2xl p-8">
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
          Ready to get started?
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-2xl mx-auto">
          Choose a tool from the sidebar to begin building your Layer 1 blockchain, or explore these helpful resources.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 justify-center">
          <a
            href="https://build.avax.network/academy/avalanche-fundamentals"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all duration-300 hover:scale-105"
          >
            <img src="/small-logo.png" alt="Avalanche" className="h-4 w-auto mr-2" />
            Academy
          </a>
          <a
            href="https://build.avax.network/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all duration-300 hover:scale-105"
          >
            <img src="/small-logo.png" alt="Avalanche" className="h-4 w-auto mr-2" />

            Documentation
            <ChevronRight className="w-4 h-4 ml-2" />
          </a>
          <a
            href="https://core.app/tools/testnet-faucet/?subnet=c&token=c"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all duration-300 hover:scale-105"
          >
            <Droplet className="w-4 h-4 mr-2 text-red-500" />
            Fuji Faucet
          </a>
          <a
            href="https://github.com/ava-labs/avalanche-starter-kit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all duration-300 hover:scale-105"
          >
            <Code className="w-4 h-4 mr-2 text-red-500" />
            Starter Kit
          </a>
        </div>
      </div>
    </div>
  );
};

export default SplashPage; 