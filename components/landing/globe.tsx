"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import * as AvatarPrimitive from "@radix-ui/react-avatar";

// Premium constellation animation styles
const constellationStyles = `
  @keyframes gentle-expand {
    0%, 100% { 
      transform: scale(1);
    }
    50% { 
      transform: scale(1.05);
    }
  }
  
  @keyframes gentle-pulse {
    0%, 100% { 
      opacity: 0.6;
      transform: scale(1);
    }
    50% { 
      opacity: 1;
      transform: scale(1.05);
    }
  }
  
  @keyframes elegant-glow {
    0%, 100% { 
      box-shadow: 0 0 20px rgba(220, 38, 38, 0.3);
    }
    50% { 
      box-shadow: 0 0 40px rgba(220, 38, 38, 0.6), 0 0 80px rgba(220, 38, 38, 0.2);
    }
  }
  
  @keyframes connection-draw {
    0% { 
      stroke-dashoffset: 100%;
      opacity: 0;
    }
    50% { 
      opacity: 0.4;
    }
    100% { 
      stroke-dashoffset: 0%;
      opacity: 0.6;
    }
  }
  
  @keyframes constellation-sparkle {
    0%, 100% { 
      opacity: 0.2;
      transform: scale(0.8);
    }
    50% { 
      opacity: 1;
      transform: scale(1.2);
    }
  }
  
  .animate-gentle-expand {
    animation: gentle-expand 4s ease-in-out infinite;
  }
  
  .animate-gentle-pulse {
    animation: gentle-pulse 4s ease-in-out infinite;
  }
  
  .animate-elegant-glow {
    animation: elegant-glow 3s ease-in-out infinite;
  }
  
  .animate-connection-draw {
    animation: connection-draw 2s ease-out forwards;
  }
  
  .animate-constellation-sparkle {
    animation: constellation-sparkle 3s ease-in-out infinite;
  }
  
  /* Premium glassmorphism effects */
  .premium-glass {
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .dark .premium-glass {
    background: rgba(10, 10, 10, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  /* Elegant hover transitions */
  .elegant-hover {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .elegant-hover:hover {
    transform: translateY(-8px) scale(1.05);
  }
  
  /* Premium shadow effects */
  .premium-shadow {
    box-shadow: 
      0 10px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
  
  .dark .premium-shadow {
    box-shadow: 
      0 10px 25px -5px rgba(0, 0, 0, 0.5),
      0 10px 10px -5px rgba(0, 0, 0, 0.3);
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = constellationStyles;
  document.head.appendChild(styleSheet);
}

type AvatarItem = {
	name: string;
	image: string;
	link: string;
	type?: string;
};

export const Sponsors = () => {
	return (
		<div className="relative w-full h-[600px] flex items-center justify-center">
			<div className="relative w-full h-full max-w-4xl mx-auto">
				
				{/* Central Avalanche Hub */}
				<TooltipProvider delayDuration={100}>
					<Tooltip>
						<TooltipTrigger className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
													<Link href={"https://www.avax.network/"} target="_blank">
													<div className="group elegant-hover animate-gentle-expand">
							<div className="relative premium-glass premium-shadow rounded-full p-6 group-hover:bg-white/20 dark:group-hover:bg-slate-800/40 transition-all duration-500">
										
										{/* Premium glow ring */}
										<div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>
										
										{/* Elegant border ring */}
										<div className="absolute inset-0 rounded-full border-2 border-red-500/30 group-hover:border-red-500/60 transition-colors duration-300"></div>
										
										{/* Main logo */}
										<AvalancheLogo className="w-16 h-16 relative z-10 transition-all duration-300 group-hover:scale-110 drop-shadow-lg" fill="#dc2626"/>
										
										{/* Subtle inner highlight */}
										<div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
									</div>
								</div>
							</Link>
						</TooltipTrigger>
						<TooltipContent className="bg-white dark:bg-[#0A0A0A] border-red-500/20 text-slate-800 dark:text-slate-100 premium-shadow">
							<div className="text-center px-3 py-2">
								<p className="font-bold text-lg text-red-600 dark:text-red-400">Avalanche</p>
								<p className="text-sm text-slate-600 dark:text-slate-300">The Primary Network</p>
							</div>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				
				<EcosystemConstellation />
				
				{/* Placeholder Chain - "Your Chain Here!" */}
				<TooltipProvider delayDuration={100}>
					<Tooltip>
						<TooltipTrigger className="absolute top-1/3 -left-8 transform -translate-y-1/2 z-30">
							<div className="group elegant-hover">
								<div className="relative premium-glass premium-shadow rounded-full p-4 border-2 border-dashed border-slate-300/50 dark:border-slate-600/50 group-hover:border-slate-400/70 dark:group-hover:border-slate-500/70 transition-all duration-500 bg-white/5 dark:bg-slate-800/20">
									
									{/* Placeholder glow */}
									<div className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-400/10 via-slate-300/10 to-slate-400/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>
									
									{/* Plus icon placeholder */}
									<div className="w-12 h-12 rounded-full bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-center">
										<svg className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
										</svg>
									</div>									
								</div>
							</div>
						</TooltipTrigger>
						<TooltipContent className="bg-white dark:bg-[#0A0A0A] border-slate-300/30 dark:border-slate-600/30 text-slate-800 dark:text-slate-100 premium-shadow">
							<div className="text-center px-3 py-2">
								<p className="font-bold text-sm text-slate-600 dark:text-slate-300">Ready to Join?</p>
								<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Build your chain with Avalanche</p>
							</div>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		</div>
	);
};

// Premium constellation-style network display
const EcosystemConstellation = () => {
	// Primary tier - Most important partnerships (larger display)
	const primaryNetworks: AvatarItem[] = [
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
	const secondaryNetworks: AvatarItem[] = [
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

	// Create sophisticated multi-orbital positioning
	const createMultiOrbitalPositions = () => {
		// Primary orbit - inner ring, larger size
		const primaryPositions = primaryNetworks.map((network, index) => {
			const angle = (index / primaryNetworks.length) * 2 * Math.PI;
			const radius = 140; // Closer to center
			const x = Math.cos(angle) * radius;
			const y = Math.sin(angle) * radius;
			
			return {
				...network,
				x: x + ((index * 5) % 7 - 3) * 2, // Subtle randomization
				y: y + ((index * 7) % 9 - 4) * 2,
				delay: index * 0.15,
				size: 'primary',
				tier: 'primary'
			};
		});

		// Secondary orbit - outer ring, smaller size
		const secondaryPositions = secondaryNetworks.map((network, index) => {
			const angle = (index / secondaryNetworks.length) * 2 * Math.PI;
			const radius = 220 + (index % 2) * 30; // Varied distance for depth
			const x = Math.cos(angle) * radius;
			const y = Math.sin(angle) * radius;
			
			return {
				...network,
				x: x + ((index * 3) % 11 - 5) * 3,
				y: y + ((index * 9) % 13 - 6) * 3,
				delay: index * 0.1 + 1, // Delayed after primary
				size: 'secondary',
				tier: 'secondary'
			};
		});

		return [...primaryPositions, ...secondaryPositions];
	};

	const allPositionedNetworks = createMultiOrbitalPositions();

	const getNetworkTheme = (type: string) => {
		switch (type) {
			case "Gaming":
				return {
					accent: "from-green-500/20 to-emerald-500/20",
					border: "border-green-500/30 hover:border-green-400/60",
					glow: "group-hover:shadow-green-500/20"
				};
			case "DeFi":
				return {
					accent: "from-blue-500/20 to-sky-500/20",
					border: "border-blue-500/30 hover:border-blue-400/60",
					glow: "group-hover:shadow-blue-500/20"
				};
			case "Enterprise":
				return {
					accent: "from-purple-500/20 to-violet-500/20",
					border: "border-purple-500/30 hover:border-purple-400/60",
					glow: "group-hover:shadow-purple-500/20"
				};
			case "Infrastructure":
				return {
					accent: "from-orange-500/20 to-amber-500/20",
					border: "border-orange-500/30 hover:border-orange-400/60",
					glow: "group-hover:shadow-orange-500/20"
				};
			case "Creative":
				return {
					accent: "from-pink-500/20 to-rose-500/20",
					border: "border-pink-500/30 hover:border-pink-400/60",
					glow: "group-hover:shadow-pink-500/20"
				};
			default:
				return {
					accent: "from-slate-500/20 to-gray-500/20",
					border: "border-slate-500/30 hover:border-slate-400/60",
					glow: "group-hover:shadow-slate-500/20"
				};
		}
	};

	return (
		<div className="absolute inset-0">

			{/* All network nodes */}
			{allPositionedNetworks.map((network, index) => (
				<NetworkNode
					key={`${network.name}-${index}`}
					network={network}
					index={index}
					theme={getNetworkTheme(network.type || 'default')}
				/>
			))}
		</div>
	);
};

// Premium individual network node
const NetworkNode = ({ network, index, theme }: { 
	network: any, 
	index: number, 
	theme: any 
}) => {
	// Get category-specific accent color
	const getAccentColor = (type: string) => {
		switch (type) {
			case "Gaming": return "from-green-500 to-emerald-500";
			case "DeFi": return "from-blue-500 to-sky-500";
			case "Enterprise": return "from-purple-500 to-violet-500";
			case "Infrastructure": return "from-orange-500 to-amber-500";
			case "Creative": return "from-pink-500 to-rose-500";
			default: return "from-slate-500 to-gray-500";
		}
	};

	return (
		<TooltipProvider delayDuration={100}>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className="absolute z-20 group"
						style={{
							left: '50%',
							top: '50%',
							transform: `translate(-50%, -50%) translate(${network.x}px, ${network.y}px)`,
							animationDelay: `${network.delay}s`
						}}
					>
						<Link href={network.link} target="_blank">
							<div className="relative elegant-hover">
								
								{/* Premium hover glow */}
								<div className={`absolute inset-0 rounded-full bg-gradient-to-r ${theme.accent} blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500 -z-10`}></div>
								
								{/* Main avatar container */}
								<div className={`relative premium-glass premium-shadow rounded-full p-3 ${theme.border} ${theme.glow} transition-all duration-300 group-hover:scale-110`}>
									
									{/* Inner content */}
									<div className="relative bg-white/90 dark:bg-[#0A0A0A]/90 rounded-full p-2 backdrop-blur-sm">
										<Avatar className="w-10 h-10">
											<AvatarImage 
												src={network.image} 
												alt={network.name} 
												className="object-cover rounded-full filter brightness-105 contrast-110" 
											/>
										</Avatar>
									</div>
									
									{/* Category-specific accent indicators */}
									<div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r ${getAccentColor(network.type)} opacity-60 group-hover:opacity-100 transition-opacity duration-300`}></div>
								</div>
							</div>
						</Link>
					</div>
				</TooltipTrigger>
				<TooltipContent 
					className="premium-glass border-red-500/20 text-slate-800 dark:text-slate-100 premium-shadow z-[9999] bg-white dark:bg-[#0A0A0A]"
					sideOffset={8}
				>
					<div className="text-center px-3 py-2">
						<p className="font-bold text-sm">{network.name}</p>
						{network.type && (
							<p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{network.type}</p>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

// Premium Avatar components
const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex shrink-0 overflow-hidden rounded-full transition-all duration-300",
      className,
    )}
    {...props}
  />
));

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));

Avatar.displayName = AvatarPrimitive.Root.displayName;
AvatarImage.displayName = AvatarPrimitive.Image.displayName;