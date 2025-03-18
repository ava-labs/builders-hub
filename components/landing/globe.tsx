"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AvalancheLogo } from '@/components/navigation/avalanche-logo';
import * as AvatarPrimitive from "@radix-ui/react-avatar";

export const Sponsors = () => {
	return (
		<div className="mt-20 flex flex-col justify-center gap-y-10 w-full ">
			<div className="relative flex h-[700px] w-full flex-col items-center justify-center overflow-hidden bg-background">
				<TooltipProvider delayDuration={100}>
					<Tooltip>
						<TooltipTrigger className="z-50 m-0 p-0">
							<Link href={"https://www.avax.network/"} target="_blank">
								<AvalancheLogo className="size-10" fill="currentColor"/>
							</Link>
						</TooltipTrigger>
						<TooltipContent className="bg-black rounded-lg border-0 text-center z-200 text-white font-semibold">
							Avalanche
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<Ripple />
			</div>
		</div>
	);
};

interface RippleProps {
  mainCircleSize?: number;
  mainCircleOpacity?: number;
  numCircles?: number;
  className?: string;
}

type AvatarItem = {
  name: string;
  image: string;
  link: string;
  type?: string;
};

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full",
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
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));

const Ripple = React.memo(function Ripple({
  mainCircleSize = 130,
  mainCircleOpacity = 0.24,
  numCircles = 6,
}: RippleProps) {
  const circle1: AvatarItem[] = [
    {
      name: "Shrapnel",
      image: "https://images.ctfassets.net/gcj8jwzm6086/3vru4toe9KAyUXpn5XQthq/714286de3f35ee92426853037e985f77/chain-logo.png",
      link: "https://www.shrapnel.com/"
    },
    {
      name: "Beam",
      image: "https://images.ctfassets.net/gcj8jwzm6086/2ZXZw0POSuXhwoGTiv2fzh/5b9d9e81acb434461da5addb1965f59d/chain-logo.png",
      link: "https://onbeam.com/"
    },
    {
      name: "Dexalot",
      image: "https://images.ctfassets.net/gcj8jwzm6086/6tKCXL3AqxfxSUzXLGfN6r/be31715b87bc30c0e4d3da01a3d24e9a/dexalot-subnet.png",
      link: "https://dexalot.com/"
    },
    {
      name: "Playdapp",
      image: "https://images.ctfassets.net/gcj8jwzm6086/4TWXXjwAsXm1R2LURlFnQf/70219308f6727eab0291ee33e922672c/pda.png",
      link: "https://playdapp.io/"
    }
  ];

  const circle2: AvatarItem[] = [
    {
      name: "Quboid",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5jRNt6keCaCe0Z35ZQbwtL/94f81aa95f9d9229111693aa6a705437/Quboid_Logo.jpg",
      link: "https://qubo.id/",
    },
    {
      name: "UPTN",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5jmuPVLmmUSDrfXxbIrWwo/4bdbe8d55b775b613156760205d19f9f/symbol_UPTN_-_js_won.png",
      link: "https://www.uptn.io/"
    },
    {
      name: "Pulsar",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5rAfnDh8ogkkEJ6ryvtUQQ/8f7d53e5d669702b8e0fc459a337ab94/logo512.png",
      link: "https://pulsar.game/home"
    },
    {
      name: "DeFi Kingdoms",
      image: "https://images.ctfassets.net/gcj8jwzm6086/6ee8eu4VdSJNo93Rcw6hku/2c6c5691e8a7c3b68654e5a4f219b2a2/chain-logo.png",
      link: "https://defikingdoms.com/"
    }
  ];

  const circle3: AvatarItem[] = [
    {
      name: "Lamina",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5KPky47nVRvtHKYV0rQy5X/e0d153df56fd1eac204f58ca5bc3e133/L1-YouTube-Avatar.png",
      link: "https://lamina1.com/",
    },
    {
      name: "Blitz",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5ZhwQeXUwtVZPIRoWXhgrw/03d0ed1c133e59f69bcef52e27d1bdeb/image__2___2_.png",
      link: "https://blitz.gg/",
    },
    {
      name: "StraitsX",
      image: "https://images.ctfassets.net/gcj8jwzm6086/3jGGJxIwb3GjfSEJFXkpj9/2ea8ab14f7280153905a29bb91b59ccb/icon.png",
      link: "https://www.straitsx.com/",
    },
    {
      name: "PLYR Chain",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5K1xUbrhZPhSOEtsHoghux/b64edf007db24d8397613f7d9338260a/logomark_fullorange.svg",
      link: "https://plyr.network/"
    }
  ];

  const circle4: AvatarItem[] = [
    {
      name: "Intain Markets",
      image: "https://images.ctfassets.net/gcj8jwzm6086/5MuFbCmddPQvITBBc5vOjw/151f8e688204263d78ded05d1844fa90/chain-logo__3_.png",
      link: "https://intainft.com/intain-markets",
    },
    {
      name: "Jiritsu Network",
      image: "https://images.ctfassets.net/gcj8jwzm6086/2hYOV0TRFSvz9zcHW8LET8/c248bf05cc2c29aa1e2044555d999bcf/JiriProofs_Attestation_service_-_Revised__4_.png",
      link: "https://www.jiritsu.network/",
    },
    {
      name: "Green Dot",
      image: "https://images.ctfassets.net/gcj8jwzm6086/zDgUqvR4J10suTQcNZ3dU/842b9f276bef338e68cb5d9f119cf387/green-dot.png",
      link: "https://www2.deloitte.com/us/en/pages/about-deloitte/solutions/future-forward-blockchain-alliances.html",
    },
    {
      name: "Gunzilla",
      image: "https://images.ctfassets.net/gcj8jwzm6086/3z2BVey3D1mak361p87Vu/ca7191fec2aa23dfa845da59d4544784/unnamed.png",
      link: "https://gunzillagames.com/en/",
    },
  ];

  return (
    <div>
      <div>
        {Array.from({ length: numCircles }, (_, i) => {
          const size = mainCircleSize + i * 70;
          const opacity = mainCircleOpacity - i * 0.03;
          const animationDelay = `${i * 0.06}s`;

          return (
            <div
              key={i}
              className={`absolute animate-ripple rounded-full bg-fd-foreground/25 shadow-xl border [--i:${i}]`}
              style={{
                width: `${size}px`,
                height: `${size}px`,
                opacity,
                animationDelay,
                borderWidth: "1px",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%) scale(1)",
              }}
            />
          );
        })}
        {Array.from({ length: numCircles }, (_, i) => {
          const animationDelay = `${i * 0.06}s`;

          return (
            <div
              key={i}
              className={`absolute z-30 animate-ripple rounded-full shadow-xl border [--i:${i}]`}
              style={{
                animationDelay,
                borderWidth: "1px",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%) scale(1)",
              }}
            >
              {i === 0 && (
                <div className="relative w-full h-full flex justify-center items-center">
                  {circle1.map((item, index) => {
                    const angle = (360 / circle1.length) * index;
                    const radius = mainCircleSize / 2;
                    const x = radius * Math.cos((angle * Math.PI) / 180);
                    const y = radius * Math.sin((angle * Math.PI) / 180);
                    return (
                      <div
                        key={index}
                        className="absolute"
                        style={{
                          top: "50%",
                          left: "50%",
                          transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                        }}
                      >
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger>
                              <Link href={item.link} target="_blank">
                                <Avatar className="border border-red-400 border-solid hover:border-dotted">
                                  <AvatarImage src={item.image} alt={item.name} />
                                </Avatar>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs font-semibold">{item.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                </div>
              )}

              {i === 1 && (
                <div className="relative w-full h-full flex justify-center items-center">
                  {circle2.map((item, index) => {
                    const angle = (360 / circle2.length) * index + 45; // Offset by 45 degrees
                    const radius = mainCircleSize / 2 + 70;
                    const x = radius * Math.cos((angle * Math.PI) / 180);
                    const y = radius * Math.sin((angle * Math.PI) / 180);
                    return (
                      <div
                        key={index}
                        className="absolute"
                        style={{
                          top: "50%",
                          left: "50%",
                          transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                        }}
                      >
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger>
                              <Link href={item.link} target="_blank">
                                <Avatar className="border border-red-400 border-solid hover:border-dotted">
                                  <AvatarImage src={item.image} alt={item.name} />
                                </Avatar>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs font-semibold">{item.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                </div>
              )}

              {i === 2 && (
                <div className="relative w-full h-full flex justify-center items-center">
                  {circle3.map((item, index) => {
                    const angle = (360 / circle3.length) * index;
                    const radius = mainCircleSize / 2 + 110;
                    const x = radius * Math.cos((angle * Math.PI) / 180);
                    const y = radius * Math.sin((angle * Math.PI) / 180);
                    return (
                      <div
                        key={index}
                        className="absolute"
                        style={{
                          top: "50%",
                          left: "50%",
                          transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                        }}
                      >
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger>
                              <Link href={item.link} target="_blank">
                                <Avatar className="border border-red-400 border-solid hover:border-dotted">
                                  <AvatarImage src={item.image} alt={item.name} />
                                </Avatar>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs font-semibold">{item.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                </div>
              )}

              {i === 3 && (
                <div className="relative w-full h-full flex justify-center items-center">
                  {circle4.map((item, index) => {
                    const angle = (360 / circle4.length) * index + 45; // Offset by 45 degrees
                    const radius = mainCircleSize / 2 + 150;
                    const x = radius * Math.cos((angle * Math.PI) / 180);
                    const y = radius * Math.sin((angle * Math.PI) / 180);
                    return (
                      <div
                        key={index}
                        className="absolute"
                        style={{
                          top: "50%",
                          left: "50%",
                          transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                        }}
                      >
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger>
                              <Link href={item.link} target="_blank">
                                <Avatar className="border border-red-400 border-solid hover:border-dotted">
                                  <AvatarImage src={item.image} alt={item.name} />
                                </Avatar>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs font-semibold">{item.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

Avatar.displayName = AvatarPrimitive.Root.displayName;
AvatarImage.displayName = AvatarPrimitive.Image.displayName;
Ripple.displayName = "Ripple";