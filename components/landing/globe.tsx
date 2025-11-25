"use client";

import React from "react";
import SphereImageGrid, { ImageData } from '@/components/ui/img-sphere';

type NetworkItem = {
	name: string;
	image: string;
	link: string;
	type?: string;
};

export const Sponsors = () => {
	// Combine all networks into a single array for the sphere
	const allNetworks: NetworkItem[] = [
		// Avalanche - The Primary Network
		{
			name: "Avalanche",
			image: "https://images.ctfassets.net/gcj8jwzm6086/5VHupNKwnDYJvqMENeV7iJ/3e4b8ff10b69bfa31e70080a4b142cd0/avalanche-avax-logo.svg",
			link: "/docs/primary-network",
			type: "Primary"
		},
		// Primary networks
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
		},
		// Secondary networks
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
			name: "Tiltyard Studio",
			image: "https://images.ctfassets.net/gcj8jwzm6086/5iZkicfOvjuwJYQqqCQN4y/9bdb761652d929459610c8b2da862cd5/android-chrome-512x512.png",
			link: "https://tiltyard.gg/",
			type: "Gaming"
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
			name: "Blaze",
			image: "https://images.ctfassets.net/gcj8jwzm6086/6Whg7jeebEhQfwGAXEsGVh/ecbb11c6c54af7ff3766b58433580721/2025-04-10_16.28.46.jpg",
			link: "https://blaze.stream/",
			type: "Creative"
		},
		{
			name: "Hashfire",
			image: "https://images.ctfassets.net/gcj8jwzm6086/4TCWxdtzvtZ8iD4255nAgU/e4d12af0a594bcf38b53a27e6beb07a3/FlatIcon_Large_.png",
			link: "https://hashfire.xyz/",
			type: "Enterprise"
		},
		{
			name: "PlayDapp",
			image: "https://images.ctfassets.net/gcj8jwzm6086/4TWXXjwAsXm1R2LURlFnQf/70219308f6727eab0291ee33e922672c/pda.png",
			link: "https://playdapp.io/",
			type: "Creative"
		}
	];

	// Convert networks to ImageData format with category for border colors
	const sphereImages: ImageData[] = allNetworks.map((network, index) => ({
		id: `network-${index}`,
		src: network.image,
		alt: network.name,
		title: network.name,
		description: network.type,
		category: network.type, // This will be used for border coloring
		link: network.link, // Link to open on click
		isPrimary: network.type === "Primary" // Make Avalanche larger
	}));

	return (
		<div className="relative w-full h-[600px] flex items-center justify-center">
			<SphereImageGrid
				images={sphereImages}
				containerSize={550}
				sphereRadius={200}
				autoRotate={true}
				autoRotateSpeed={0.08}
				dragSensitivity={0.5}
				baseImageScale={0.28}
				className="mx-auto"
			/>
		</div>
	);
};

