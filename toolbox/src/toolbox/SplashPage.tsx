import { ChevronRight, Layers, UserPen, MessageCircle, Coins, Droplet, Code, Settings, Wrench, Server } from 'lucide-react';

const SplashPage = () => {
  const features = [
    {
      title: "Create Chain",
      description: "Launch your custom L1 blockchain",
      icon: <Layers className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#createChain"
    },
    {
      title: "Add Validator",
      description: "Add validators to your L1 network",
      icon: <UserPen className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#addValidator"
    },
    {
      title: "ICM Relayer",
      description: "Set up cross-chain message relaying",
      icon: <MessageCircle className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",  
      href: "#icmRelayer"
    },
    {
      title: "Native Token Remote",
      description: "Deploy native token bridge contracts",
      icon: <Coins className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#deployNativeTokenRemote"
    },
    {
      title: "Deployer Allowlist",
      description: "Control contract deployment permissions",
      icon: <Settings className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#deployerAllowlist"
    },
    {
      title: "RPC Methods Check",
      description: "Verify node RPC endpoint functionality",
      icon: <Wrench className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#rpcMethodsCheck"
    },
    {
      title: "AvalancheGo Docker",
      description: "Set up node infrastructure with Docker",
      icon: <Server className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#avalanchegoDocker"
    },
    {
      title: "Faucet",
      description: "Get free AVAX tokens for testing",
      icon: <Droplet className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#faucet"
    }
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
      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {features.map((feature, index) => (
          <div
            key={index}
            onClick={() => handleCardClick(feature.href)}
            className="group block p-4 rounded-xl transition-all duration-300 bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-zinc-200/70 dark:border-zinc-700/70 shadow-md hover:shadow-xl hover:border-zinc-300/90 dark:hover:border-zinc-600/90 hover:bg-white dark:hover:bg-zinc-900/90 cursor-pointer relative overflow-hidden"
          >

            
            <div className="relative h-full min-h-[140px] flex flex-col">
              {/* Icon */}
              <div className="mb-3">
                <div className="w-10 h-10 flex items-center justify-center">
                  <div className="text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-300">
                    {feature.icon}
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 flex flex-col">
                <h3 className="text-lg font-bold mb-2 text-zinc-900 dark:text-white transition-colors duration-200 leading-tight group-hover:text-zinc-800 dark:group-hover:text-zinc-50">
                  {feature.title}
                </h3>
                
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug flex-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200">
                  {feature.description}
                </p>
              </div>
              
              {/* Arrow - positioned at bottom right */}
              <div className="flex justify-end mt-3">
                <div className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 transition-all duration-300 group-hover:scale-110">
                  <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors duration-200" />
                </div>
              </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-center">
          <a
            href="https://build.avax.network/academy/avalanche-fundamentals"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all duration-300 hover:scale-105"
          >
            <img src="/small-logo.png" alt="Avalanche" className="h-4 w-auto mr-2" />
            Academy
            <ChevronRight className="w-4 h-4 ml-2" />
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
            href="https://github.com/ava-labs/avalanche-starter-kit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all duration-300 hover:scale-105"
          >
            <Code className="w-4 h-4 mr-2 text-red-500" />
            Starter Kit
            <ChevronRight className="w-4 h-4 ml-2" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SplashPage; 