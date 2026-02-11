"use client";

import React, { useMemo } from "react";
import MiniNetworkDiagram, { MiniChainData, MiniICMFlow } from '@/components/stats/MiniNetworkDiagram';
import l1ChainsData from '@/constants/l1-chains.json';

interface ChainOverviewMetrics {
	chainId: string;
	chainName: string;
	chainLogoURI: string;
	txCount: number;
	tps: number;
	activeAddresses: number;
	icmMessages: number;
	validatorCount: number | string;
}

interface OverviewMetrics {
	chains: ChainOverviewMetrics[];
	aggregated: {
		totalTxCount: number;
		totalTps: number;
		totalActiveAddresses: number;
		totalICMMessages: number;
		totalValidators: number;
		activeChains: number;
	};
	timeRange: string;
	last_updated: number;
}

interface ICMFlowData {
	sourceChainId: string;
	targetChainId: string;
	messageCount: number;
}

export interface GlobeData {
	metrics: OverviewMetrics | null;
	icmFlows: ICMFlowData[];
}

// Category-based colors for pulse waves and ICM messages
function getCategoryColor(category?: string): string {
	switch (category) {
		case "Primary":
			return "#e84142"; // Avalanche red
		case "Gaming":
			return "#22c55e"; // Green
		case "DeFi":
			return "#3b82f6"; // Blue
		case "Enterprise":
		case "Institutions":
			return "#a855f7"; // Purple
		case "Infrastructure":
			return "#f97316"; // Orange
		case "Creative":
			return "#ec4899"; // Pink
		case "RWAs":
			return "#f59e0b"; // Amber
		case "Payments":
			return "#06b6d4"; // Cyan
		default:
			return "#8b5cf6"; // Default purple
	}
}

// Generate color from chain name as fallback
function stringToColor(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}
	const hue = Math.abs(hash % 360);
	return `hsl(${hue}, 70%, 55%)`;
}

interface SponsorsProps {
	globeData?: GlobeData;
}

export const Sponsors = ({ globeData }: SponsorsProps) => {
	const metrics = globeData?.metrics || null;
	const icmFlows = globeData?.icmFlows || [];
	const loading = !globeData;

	// Transform API data to MiniChainData format
	const chainData: MiniChainData[] = useMemo(() => {
		if (!metrics?.chains) return [];

		// Avalanche C-Chain chainId
		const AVALANCHE_CCHAIN_ID = '43114';
		// Shrapnel chainId - excluded from display
		const SHRAPNEL_CHAIN_ID = '2044';

		// Find Avalanche C-Chain data
		const avalancheChain = metrics.chains.find(c => c.chainId === AVALANCHE_CCHAIN_ID);

		// Get L1 chains excluding Avalanche C-Chain (it will be the center) and Shrapnel
		// Score chains by multiple metrics for better representation
		const l1Chains = metrics.chains
			.filter(chain => chain.chainId !== AVALANCHE_CCHAIN_ID && chain.chainId !== SHRAPNEL_CHAIN_ID)
			.map(chain => {
				// Calculate composite activity score
				const tpsScore = (chain.tps || 0) * 10; // Weight TPS heavily
				const txScore = Math.sqrt(chain.txCount || 0) * 0.1;
				const addressScore = Math.sqrt(chain.activeAddresses || 0) * 0.5;
				const validatorScore = typeof chain.validatorCount === 'number' ? chain.validatorCount : 0;
				const icmScore = Math.sqrt(chain.icmMessages || 0) * 0.3;
				
				const activityScore = tpsScore + txScore + addressScore + validatorScore + icmScore;
				
				return { ...chain, activityScore };
			})
			.filter(chain => chain.activityScore > 0)
			.sort((a, b) => b.activityScore - a.activityScore)
			.slice(0, 40); // Show top 40 most active L1 chains

		// Calculate total TPS (including Avalanche) for aggregate display
		const totalTps = metrics.chains.reduce((sum, c) => sum + (c.tps || 0), 0);

		// Add Avalanche C-Chain as the primary/center node
		const result: MiniChainData[] = [{
			id: AVALANCHE_CCHAIN_ID,
			chainId: AVALANCHE_CCHAIN_ID,
			name: 'Avalanche',
			logo: avalancheChain?.chainLogoURI || 'https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg',
			color: '#e84142',
			category: 'Primary Network',
			link: '/stats/overview',
			isPrimary: true,
			tps: totalTps, // Aggregate TPS for pulse effect
			validatorCount: typeof avalancheChain?.validatorCount === 'number' ? avalancheChain.validatorCount : undefined,
		}];

		// Add L1 chains from API
		l1Chains.forEach(chain => {
			// Get additional info from l1-chains.json
			const l1Chain = l1ChainsData.find(
				(c: any) => c.chainId === chain.chainId || 
				c.chainName.toLowerCase() === chain.chainName.toLowerCase()
			);

			const category = l1Chain?.category || 'General';
			const slug = l1Chain?.slug;
			// Use API logo first, fallback to l1-chains.json logo
			const logo = chain.chainLogoURI || l1Chain?.chainLogoURI;

			// Only include chains that have a valid logo
			if (!logo) return;

			result.push({
				id: chain.chainId,
				chainId: chain.chainId, // Include chainId for ICM matching
				name: chain.chainName,
				logo,
				color: l1Chain?.color || getCategoryColor(category) || stringToColor(chain.chainName),
				category,
				link: slug ? `/stats/l1/${slug}` : undefined,
				isPrimary: false,
				validatorCount: typeof chain.validatorCount === 'number' ? chain.validatorCount : undefined,
				tps: chain.tps || 0, // Include TPS for pulse effect
			});
		});

		return result;
	}, [metrics]);

	// Transform ICM flows to MiniICMFlow format
	const icmFlowsData: MiniICMFlow[] = useMemo(() => {
		if (!icmFlows.length) return [];
		
		return icmFlows.map(flow => ({
			sourceChainId: flow.sourceChainId,
			targetChainId: flow.targetChainId,
			messageCount: flow.messageCount,
		}));
	}, [icmFlows]);

	// Show loading skeleton
	if (loading) {
		return (
			<div className="relative w-full h-[700px] flex items-center justify-center">
				<div className="relative w-[650px] h-[650px] flex items-center justify-center">
					{/* Animated orbital rings */}
					<div className="absolute inset-0 flex items-center justify-center">
						<div className="absolute w-[200px] h-[200px] rounded-full border border-zinc-200 dark:border-zinc-800 animate-[spin_20s_linear_infinite]" />
						<div className="absolute w-[350px] h-[350px] rounded-full border border-zinc-200/60 dark:border-zinc-800/60 animate-[spin_30s_linear_infinite_reverse]" />
						<div className="absolute w-[500px] h-[500px] rounded-full border border-zinc-200/40 dark:border-zinc-800/40 animate-[spin_40s_linear_infinite]" />
						<div className="absolute w-[600px] h-[600px] rounded-full border border-zinc-200/20 dark:border-zinc-800/20 animate-[spin_50s_linear_infinite_reverse]" />
					</div>
					
					{/* Pulsing center */}
					<div className="relative z-10">
						<div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/10 dark:from-red-500/30 dark:to-red-600/20 animate-pulse flex items-center justify-center">
							<div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500/30 to-red-600/20 dark:from-red-500/40 dark:to-red-600/30 animate-[pulse_1.5s_ease-in-out_infinite]" />
						</div>
						{/* Expanding pulse ring */}
						<div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-[ping_2s_ease-out_infinite]" />
					</div>
					
					{/* Floating dots representing chains - pre-calculated positions to avoid hydration mismatch */}
					{[
						{ x: 100, y: 0, delay: 0 },
						{ x: 156, y: 90, delay: 0.15 },
						{ x: 130, y: 225, delay: 0.3 },
						{ x: 0, y: 100, delay: 0.45 },
						{ x: -78, y: 135, delay: 0.6 },
						{ x: -225, y: 130, delay: 0.75 },
						{ x: -100, y: 0, delay: 0.9 },
						{ x: -156, y: -90, delay: 1.05 },
						{ x: -130, y: -225, delay: 1.2 },
						{ x: 0, y: -100, delay: 1.35 },
						{ x: 78, y: -135, delay: 1.5 },
						{ x: 225, y: -130, delay: 1.65 },
					].map((dot, i) => (
						<div
							key={i}
							className="absolute w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-700 animate-pulse"
							style={{
								left: `calc(50% + ${dot.x}px - 8px)`,
								top: `calc(50% + ${dot.y}px - 8px)`,
								animationDelay: `${dot.delay}s`,
							}}
						/>
					))}
					
					{/* Loading text */}
					<div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-zinc-400 dark:text-zinc-500">
						Loading network...
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="relative w-full h-[760px] flex items-center justify-center">
			<MiniNetworkDiagram
				chains={chainData}
				icmFlows={icmFlowsData}
				containerSize={650}
				autoRotate={true}
				autoRotateSpeed={0.1}
				className="mx-auto"
			/>
		</div>
	);
};
