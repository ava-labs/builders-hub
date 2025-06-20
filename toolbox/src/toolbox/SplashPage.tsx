import { ChevronRight, Layers, UserPen, MessageCircle, Coins } from 'lucide-react';

const SplashPage = () => {
  const features = [
    {
      title: "Create an L1",
      description: "Launch your own Layer 1 blockchain with custom parameters and genesis data.",
      icon: <Layers className="w-8 h-8" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#createChain"
    },
    {
      title: "Validator Management",
      description: "Deploy and manage validator contracts to control your L1's validator set.",
      icon: <UserPen className="w-8 h-8" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#deployValidatorManager"
    },
    {
      title: "Interchain Messaging",
      description: "Enable cross-L1 communication using ICM for seamless interoperability.",
      icon: <MessageCircle className="w-8 h-8" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",  
      href: "#teleporterMessenger"
    },
    {
      title: "Interchain Token Transfer",
      description: "Set up native cross-chain token bridges with ICTT for asset interoperability.",
      icon: <Coins className="w-8 h-8" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#deployExampleERC20"
    }
  ];

  const handleCardClick = (href: string) => {
    window.location.hash = href.substring(1);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="text-center mb-12">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-zinc-900 dark:text-white mb-6 tracking-tight leading-[0.9]">
          Build Your{" "}
          <span className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-clip-text text-transparent">
            L1
          </span>
        </h1>
        <p className="text-xl sm:text-2xl text-zinc-600 dark:text-zinc-300 max-w-4xl mx-auto leading-relaxed font-light">
          The complete toolkit for launching and managing Layer 1 blockchains on Avalanche
        </p>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {features.map((feature, index) => (
          <div
            key={index}
            onClick={() => handleCardClick(feature.href)}
            className="group cursor-pointer bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-2xl p-8 hover:shadow-xl hover:shadow-zinc-900/10 dark:hover:shadow-zinc-900/30 transition-all duration-300 hover:scale-[1.02] hover:border-zinc-300 dark:hover:border-zinc-600"
          >
            {/* Icon Section */}
            <div className={`${feature.bgColor} rounded-2xl p-4 w-fit mb-6 group-hover:scale-110 transition-transform duration-300`}>
              <div className="text-zinc-600 dark:text-zinc-300">
                {feature.icon}
              </div>
            </div>

            {/* Content */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white group-hover:text-zinc-800 dark:group-hover:text-zinc-100 transition-colors">
                  {feature.title}
                </h3>
                <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {feature.description}
              </p>
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
          Choose a tool from the sidebar to begin building your Layer 1 blockchain, or explore the Avalanche Academy for comprehensive guides.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://build.avax.network/academy/avalanche-fundamentals"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105"
          >
            <img src="/small-logo.png" alt="Avalanche" className="h-4 w-auto mr-2" />
            Avalanche Academy
          </a>
          <a
            href="https://build.avax.network/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-all duration-300 hover:scale-105"
          >
            View Documentation
            <ChevronRight className="w-4 h-4 ml-2" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SplashPage; 