"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { GraduationCap } from 'lucide-react';

const AVALANCHE_LOGO_SRC =
    "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Avalanche_Logomark_Red.svg";
const SOLIDITY_LOGO_SRC =
    "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/solidity_logo.svg";

function MaskedSvgIcon({
    src,
    className,
    alt,
}: {
    src: string;
    className?: string;
    alt: string;
}) {
    // Uses CSS mask so the icon color follows `currentColor` (matches Lucide icons),
    // while still loading the SVG from Vercel storage.
    return (
        <span
            role="img"
            aria-label={alt}
            className={cn("inline-block bg-current", className)}
            style={{
                WebkitMaskImage: `url(${src})`,
                maskImage: `url(${src})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskPosition: "center",
                maskPosition: "center",
            }}
        />
    );
}

// Avalanche Logo (hosted SVG, color via currentColor)
function AvalancheLogo({ className }: { className?: string }) {
    return (
        <MaskedSvgIcon
            src={AVALANCHE_LOGO_SRC}
            alt="Avalanche"
            className={className}
        />
    );
}

// Solidity Logo (hosted SVG, color via currentColor)
function SolidityLogo({ className }: { className?: string }) {
    return (
        <MaskedSvgIcon
            src={SOLIDITY_LOGO_SRC}
            alt="Solidity"
            className={className}
        />
    );
}

const academyItems = [
    { id: "avalanche", label: "Avalanche L1", href: "/academy/avalanche-l1", icon: AvalancheLogo, iconSize: "w-7 h-7", padding: "14px" },
    { id: "blockchain", label: "Blockchain", href: "/academy/blockchain", icon: SolidityLogo, iconSize: "w-9 h-9", padding: "10px" },
    { id: "entrepreneur", label: "Entrepreneur", href: "/academy/entrepreneur", icon: GraduationCap, iconSize: "w-7 h-7", padding: "14px" },
];

function getActiveItem(pathname: string): string {
    if (pathname === "/academy/entrepreneur" || pathname.startsWith("/academy/entrepreneur/")) {
        return "entrepreneur";
    } else if (pathname === "/academy/blockchain" || pathname.startsWith("/academy/blockchain/")) {
        return "blockchain";
    } else if (
        pathname === "/academy" ||
        pathname === "/academy/avalanche-l1" ||
        pathname.startsWith("/academy/avalanche-l1/") ||
        (pathname.startsWith("/academy/") &&
            !pathname.startsWith("/academy/blockchain") &&
            !pathname.startsWith("/academy/entrepreneur"))
    ) {
        return "avalanche";
    }
    return "avalanche";
}

// Check if we're on a main academy landing page (not inside a course)
function isMainAcademyPage(pathname: string): boolean {
    const mainPages = [
        "/academy",
        "/academy/avalanche-l1",
        "/academy/blockchain",
        "/academy/entrepreneur"
    ];
    return mainPages.includes(pathname);
}

// Onboarding tooltip component - hand-drawn style annotation (positioned above bubble nav)
function OnboardingTooltip({ onDismiss }: { onDismiss: () => void }) {
    return (
        <>
            {/* Load Patrick Hand font from Google Fonts - lighter handwriting style */}
            <link 
                href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" 
                rel="stylesheet" 
            />
            <style jsx>{`
                @keyframes tooltip-fade-in {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .onboarding-tooltip {
                    animation: tooltip-fade-in 0.5s ease-out forwards;
                }
            `}</style>
            {/* Positioned above the bubble nav - bubble nav is at top-1/2, left-3 */}
            <div 
                className="onboarding-tooltip fixed left-3 z-40 hidden lg:block cursor-pointer"
                style={{ top: 'calc(50% - 200px)' }}
                onClick={onDismiss}
            >
                {/* Text annotation */}
                <p 
                    className="text-lg text-zinc-650 dark:text-zinc-100 max-w-[140px] leading-snug text-center"
                    style={{ fontFamily: "'Patrick Hand', cursive" }}
                >
                    Switch between our academies!
                </p>
                
                {/* Hand-drawn curved arrow pointing down to bubble nav */}
                <svg 
                    className="mx-auto mt-1 w-[40px] h-[35px]"
                    viewBox="0 0 40 35" 
                    fill="none"
                >
                    {/* Curved arrow path pointing down - shorter */}
                    <path 
                        d="M20 2 Q 22 12, 20 22" 
                        stroke="currentColor" 
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="text-zinc-650 dark:text-zinc-100"
                        fill="none"
                    />
                    {/* Second stroke for sketchy effect */}
                    <path 
                        d="M21 3 Q 23 13, 21 23" 
                        stroke="currentColor" 
                        strokeWidth="1"
                        strokeLinecap="round"
                        opacity="0.3"
                        className="text-zinc-650 dark:text-zinc-100"
                        fill="none"
                    />
                    {/* Arrow head pointing down */}
                    <path 
                        d="M14 20 L20 30 L26 20" 
                        stroke="currentColor" 
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-zinc-650 dark:text-zinc-100"
                        fill="none"
                    />
                </svg>
            </div>
        </>
    );
}

export function AcademyBubbleNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [activeItem, setActiveItem] = useState(() => getActiveItem(pathname));
    const [isVisible, setIsVisible] = useState(() => isMainAcademyPage(pathname));
    const [showOnboarding, setShowOnboarding] = useState(false);
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        setActiveItem(getActiveItem(pathname));
        setIsVisible(isMainAcademyPage(pathname));
    }, [pathname]);

    // Check if onboarding should be shown (first visit in session)
    useEffect(() => {
        if (typeof window !== 'undefined' && isVisible) {
            const hasSeenOnboarding = sessionStorage.getItem('academy-onboarding-seen');
            if (!hasSeenOnboarding) {
                // Small delay to let the page render first
                const timer = setTimeout(() => {
                    setShowOnboarding(true);
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [isVisible]);

    const dismissOnboarding = () => {
        setShowOnboarding(false);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('academy-onboarding-seen', 'true');
        }
    };

    const handleItemClick = (item: typeof academyItems[0]) => {
        // Dismiss onboarding when user interacts with nav
        if (showOnboarding) {
            dismissOnboarding();
        }
        if (item.href) {
            setActiveItem(item.id);
            router.push(item.href);
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    };

    // Don't render if not on a main academy page
    if (!isVisible) {
        return null;
    }

    return (
        <>
        <style jsx global>{`
            @keyframes bubble-pulse {
                0%, 100% {
                    transform: scale(1);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1), 0 0 0 rgba(239, 68, 68, 0);
                }
                50% {
                    transform: scale(1.01);
                    box-shadow: 0 14px 20px -4px rgba(0, 0, 0, 0.15), 0 6px 10px -5px rgba(0, 0, 0, 0.12), 0 0 20px rgba(239, 68, 68, 0.25);
                }
            }
        `}</style>
        
        {/* Onboarding tooltip */}
        {showOnboarding && <OnboardingTooltip onDismiss={dismissOnboarding} />}
        
        <nav
            className="fixed left-3 top-1/2 -translate-y-1/2 z-30 hidden lg:block"
        >
            <div className="flex flex-col items-start gap-2">
                {academyItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeItem === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className={cn(
                                "group flex items-center cursor-pointer rounded-full",
                                "bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm shadow-lg border border-gray-200/50 dark:border-zinc-800/50",
                                isActive
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all duration-300 ease-out"
                            )}
                            style={{
                                padding: item.padding,
                                ...(isActive && {
                                    animation: 'bubble-pulse 1.90s ease-in-out infinite',
                                }),
                            }}
                            title={item.label}
                        >
                            <Icon className={cn(item.iconSize, "flex-shrink-0")} />
                            <div
                                className={cn(
                                    "overflow-hidden transition-all duration-300 ease-out whitespace-nowrap",
                                    isActive
                                        ? "max-w-[120px] opacity-100 ml-3 pr-2"
                                        : "max-w-0 opacity-0 ml-0 pr-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:ml-3 group-hover:pr-2"
                                )}
                            >
                                <span className="font-semibold text-sm">
                                    {item.label}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </nav>
        </>
    );
}
