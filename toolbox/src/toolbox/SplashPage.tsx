import { ChevronRight, Droplet, Code, Wrench, Server, Github, FileText, ExternalLink, Plus, UserPlus, Radio, Banknote, Shield, FileCode, Zap, Repeat, ArrowUpDown } from 'lucide-react';

const SplashPage = () => {
  // Primary tier - Most important partnerships (larger display)
  const primaryNetworks = [
    {
      name: "FIFA Blockchain",
      image: "https://images.ctfassets.net/gcj8jwzm6086/27QiWdtdwCaIeFbYhA47KG/5b4245767fc39d68b566f215e06c8f3a/FIFA_logo.png",
      link: "https://collect.fifa.com/",
      type: "Gaming"
    },
    {
      name: "MapleStory Henesys",
      image: "https://images.ctfassets.net/gcj8jwzm6086/Uu31h98BapTCwbhHGBtFu/6b72f8e30337e4387338c82fa0e1f246/MSU_symbol.png",
      link: "https://nexon.com",
      type: "Gaming"
    },
    {
      name: "Dexalot Exchange",
      image: "https://images.ctfassets.net/gcj8jwzm6086/6tKCXL3AqxfxSUzXLGfN6r/be31715b87bc30c0e4d3da01a3d24e9a/dexalot-subnet.png",
      link: "https://dexalot.com/",
      type: "DeFi"
    },
    {
      name: "DeFi Kingdoms",
      image: "https://images.ctfassets.net/gcj8jwzm6086/6ee8eu4VdSJNo93Rcw6hku/2c6c5691e8a7c3b68654e5a4f219b2a2/chain-logo.png",
      link: "https://defikingdoms.com/",
      type: "Gaming"
    },
    {
      name: "Lamina1",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5KPky47nVRvtHKYV0rQy5X/e0d153df56fd1eac204f58ca5bc3e133/L1-YouTube-Avatar.png",
      link: "https://lamina1.com/",
      type: "Creative"
    },
    {
      name: "Green Dot Deloitte",
      image: "https://images.ctfassets.net/gcj8jwzm6086/zDgUqvR4J10suTQcNZ3dU/842b9f276bef338e68cb5d9f119cf387/green-dot.png",
      link: "https://www2.deloitte.com/us/en/pages/about-deloitte/solutions/future-forward-blockchain-alliances.html",
      type: "Enterprise"
    }
  ];

  // Secondary tier - Important but smaller display
  const secondaryNetworks = [
    {
      name: "Beam Gaming",
      image: "https://images.ctfassets.net/gcj8jwzm6086/2ZXZw0POSuXhwoGTiv2fzh/5b9d9e81acb434461da5addb1965f59d/chain-logo.png",
      link: "https://onbeam.com/",
      type: "Gaming"
    },
    {
      name: "KOROSHI Gaming",
      image: "https://images.ctfassets.net/gcj8jwzm6086/1cZxf8usDbuJng9iB3fkFd/1bc34bc28a2c825612eb697a4b72d29d/2025-03-30_07.28.32.jpg",
      link: "https://www.thekoroshi.com/",
      type: "Gaming"
    },
    {
      name: "Gunzilla Games",
      image: "https://images.ctfassets.net/gcj8jwzm6086/3z2BVey3D1mak361p87Vu/ca7191fec2aa23dfa845da59d4544784/unnamed.png",
      link: "https://gunzillagames.com/en/",
      type: "Gaming"
    },
    {
      name: "PLAYA3ULL Games",
      image: "https://images.ctfassets.net/gcj8jwzm6086/27mn0a6a5DJeUxcJnZr7pb/8a28d743d65bf35dfbb2e63ba2af7f61/brandmark_-_square_-_Sam_Thompson.png",
      link: "https://playa3ull.games/",
      type: "Gaming"
    },
    {
      name: "StraitsX",
      image: "https://images.ctfassets.net/gcj8jwzm6086/3jGGJxIwb3GjfSEJFXkpj9/2ea8ab14f7280153905a29bb91b59ccb/icon.png",
      link: "https://www.straitsx.com/",
      type: "DeFi"
    },
    {
      name: "CX Chain",
      image: "https://images.ctfassets.net/gcj8jwzm6086/3wVuWA4oz9iMadkIpywUMM/377249d5b8243e4dfa3a426a1af5eaa5/14.png",
      link: "https://node.cxchain.xyz/",
      type: "Gaming"
    },
    {
      name: "Intain Markets",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5MuFbCmddPQvITBBc5vOjw/151f8e688204263d78ded05d1844fa90/chain-logo__3_.png",
      link: "https://intainft.com/intain-markets",
      type: "Enterprise"
    },
    {
      name: "Jiritsu Network",
      image: "https://images.ctfassets.net/gcj8jwzm6086/2hYOV0TRFSvz9zcHW8LET8/c248bf05cc2c29aa1e2044555d999bcf/JiriProofs_Attestation_service_-_Revised__4_.png",
      link: "https://www.jiritsu.network/",
      type: "Enterprise"
    },
    {
      name: "PLYR Chain",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5K1xUbrhZPhSOEtsHoghux/b64edf007db24d8397613f7d9338260a/logomark_fullorange.svg",
      link: "https://plyr.network/",
      type: "Infrastructure"
    },
    {
      name: "Space Network",
      image: "https://images.ctfassets.net/gcj8jwzm6086/27oUMNb9hSTA7HfFRnqUtZ/2f80e6b277f4b4ee971675b5f73c06bf/Space_Symbol_256X256__v2.svg",
      link: "https://www.avax.network/about/blog/otherworlds-digital-collectibles-platform-solo-leveling-unlimited-launches-on-avalanche",
      type: "Infrastructure"
    },
    {
      name: "UPTN Platform",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5jmuPVLmmUSDrfXxbIrWwo/4bdbe8d55b775b613156760205d19f9f/symbol_UPTN_-_js_won.png",
      link: "https://www.uptn.io/",
      type: "Infrastructure"
    },
    {
      name: "Quboid",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5jRNt6keCaCe0Z35ZQbwtL/94f81aa95f9d9229111693aa6a705437/Quboid_Logo.jpg",
      link: "https://qubo.id/",
      type: "Infrastructure"
    },
    {
      name: "Feature Studio",
      image: "https://images.ctfassets.net/gcj8jwzm6086/2hWSbxXPv2QTPCtCaEp7Kp/522b520e7e5073f7e7459f9bd581bafa/FTR_LOGO_-_FLAT_BLACK.png",
      link: "https://feature.io/",
      type: "Creative"
    },
    {
      name: "Blitz Platform",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5ZhwQeXUwtVZPIRoWXhgrw/03d0ed1c133e59f69bcef52e27d1bdeb/image__2___2_.png",
      link: "https://blitz.gg/",
      type: "Infrastructure"
    },
    {
      name: "NUMINE Gaming",
      image: "https://images.ctfassets.net/gcj8jwzm6086/411JTIUnbER3rI5dpOR54Y/3c0a8e47d58818a66edd868d6a03a135/numine_main_icon.png",
      link: "https://numine.io/",
      type: "Gaming"
    },
    {
      name: "Tiltyard Studio",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5iZkicfOvjuwJYQqqCQN4y/9bdb761652d929459610c8b2da862cd5/android-chrome-512x512.png",
      link: "https://tiltyard.gg/",
      type: "Gaming"
    },
    {
      name: "Pulsar",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5rAfnDh8ogkkEJ6ryvtUQQ/8f7d53e5d669702b8e0fc459a337ab94/logo512.png",
      link: "https://pulsar.game/home",
      type: "Gaming"
    },
    {
      name: "PlayDapp",
      image: "https://images.ctfassets.net/gcj8jwzm6086/4TWXXjwAsXm1R2LURlFnQf/70219308f6727eab0291ee33e922672c/pda.png",
      link: "https://playdapp.io/",
      type: "Creative"
    }
  ];

  const features = [
    {
      title: "Create Chain",
      description: "Launch your custom L1 blockchain",
      icon: <Plus className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#createChain"
    },
    {
      title: "Add L1 Validator", 
      description: "Add validators to your L1 network",
      icon: <UserPlus className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#addValidator"
    },
    {
      title: "Deploy Teleporter",
      description: "Set up cross-chain messaging",
      icon: <Radio className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",  
      href: "#teleporterMessenger"
    },
    {
      title: "Native Token Remote",
      description: "Deploy native token bridge contracts",
      icon: <Banknote className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#deployNativeTokenRemote"
    },
    {
      title: "Deploy Proxy Contract",
      description: "Set up upgradeable contracts",
      icon: <Shield className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#deployProxyContract"
    },
    {
      title: "Deploy Validator Manager",
      description: "Manage L1 validator sets",
      icon: <FileCode className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#deployValidatorManager"
    },
    {
      title: "Initialize Validator Set",
      description: "Configure initial validators",
      icon: <Zap className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#initValidatorSet"
    },
    {
      title: "Format Converter",
      description: "Convert between data formats",
      icon: <Repeat className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#formatConverter"
    },
    {
      title: "Cross-Chain Transfer",
      description: "Transfer AVAX between P-Chain and C-Chain on the Primary Network",
      icon: <ArrowUpDown className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#crossChainTransfer"
    },
    {
      title: "RPC Methods Check",
      description: "Verify node RPC endpoint functionality",
      icon: <Wrench className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#rpcMethodsCheck"
    },
    {
      title: "L1 Node Setup with Docker",
      description: "Set up node infrastructure with Docker",
      icon: <Server className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#avalanchegoDockerL1"
    },
    {
      title: "Faucet",
      description: "Get free AVAX tokens for testing",
      icon: <Droplet className="w-6 h-6" />,
      bgColor: "bg-zinc-50 dark:bg-zinc-800/50",
      href: "#faucet"
    }
  ];

  // Combine primary and secondary networks, limiting to 12 for display
  const ecosystemChains = [...primaryNetworks, ...secondaryNetworks].slice(0, 12);

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

      {/* Ecosystem Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6 text-center">
          Explore Avalanche L1s
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {ecosystemChains.map((chain, index) => (
            <a
              key={index}
              href={chain.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-4 py-2.5 rounded-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-900/70 hover:border-zinc-300/50 dark:hover:border-zinc-700/50 transition-all duration-300 hover:scale-105"
              title={`${chain.name}${chain.type ? ` - ${chain.type}` : ''}`}
            >
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                <img 
                  src={chain.image} 
                  alt={chain.name}
                  className="w-full h-full object-contain filter dark:brightness-90 group-hover:scale-110 transition-transform duration-300 rounded-full"
                  onError={(e) => {
                    // Fallback to a placeholder if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `<div class="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400">${chain.name.substring(0, 2).toUpperCase()}</div>`;
                  }}
                />
              </div>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors duration-200 whitespace-nowrap">
                {chain.name}
              </span>
            </a>
          ))}
        </div>
        <div className="text-center mt-6">
          <a
            href="https://subnets.avax.network/subnets/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors duration-200"
          >
            View all ecosystem projects
            <ChevronRight className="w-4 h-4 ml-1" />
          </a>
        </div>
      </div>

      {/* Support Section */}
      <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
          Support
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            href="https://github.com/ava-labs/builders-hub/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <Github className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              <span className="font-medium text-zinc-900 dark:text-white">Github Issues</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </a>

          <a
            href="https://github.com/ava-labs/avalanche-starter-kit/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <Code className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              <span className="font-medium text-zinc-900 dark:text-white">App Examples</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </a>

          <a
            href="https://x.com/avax"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="font-medium text-zinc-900 dark:text-white">Avalanche on X</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </a>

          <a
            href="https://discord.gg/avax"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
              </svg>
              <span className="font-medium text-zinc-900 dark:text-white">Discord</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </a>

          <a
            href="https://t.me/avalancheacademy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
              </svg>
              <span className="font-medium text-zinc-900 dark:text-white">Builder Hub Telegram</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </a>

          <a
            href="https://build.avax.network/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              <span className="font-medium text-zinc-900 dark:text-white">Docs</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </a>

          <a
            href="https://build.avax.network/academy/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 group lg:col-span-3"
          >
            <div className="flex items-center gap-3">
              <img src="/small-logo.png" alt="Avalanche" className="h-5 w-auto" />
              <span className="font-medium text-zinc-900 dark:text-white">Academy</span>
            </div>
            <ExternalLink className="w-4 h-4 text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SplashPage; 
