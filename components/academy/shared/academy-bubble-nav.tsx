"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { GraduationCap } from 'lucide-react';

// Avalanche Logo SVG - Official logomark
function AvalancheLogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 257 227" fill="currentColor" className={className}>
            <path d="M160.944 226.116H246.964C254.554 226.116 259.304 217.896 255.504 211.326L212.494 136.836C208.694 130.266 199.214 130.266 195.414 136.836L152.404 211.326C148.604 217.896 153.354 226.116 160.944 226.116Z"/>
            <path d="M171.704 66.1852L136.354 4.94523C132.784 -1.24477 123.844 -1.24477 120.274 4.94523L1.38358 210.865C-2.52642 217.645 2.36358 226.105 10.1836 226.105H80.9736C88.5236 226.105 95.4936 222.075 99.2636 215.545L171.704 90.0752C175.974 82.6852 175.974 73.5752 171.704 66.1852Z"/>
        </svg>
    );
}

// Solidity Logo SVG - Official logo
function SolidityLogo({ className }: { className?: string }) {
    return (
        <svg viewBox="-78.58515 -203.242 681.0713 1219.452" fill="currentColor" className={className}>
            <path d="M391.93 0L261.226 232.302H0L130.614 0H391.93" opacity=".45"/>
            <path d="M261.226 232.302h261.318L391.93 0H130.614z" opacity=".6"/>
            <path d="M130.614 464.514l130.612-232.212L130.614 0 0 232.302z" opacity=".8"/>
            <path d="M131.879 812.967l130.704-232.303h261.318L393.196 812.967H131.879" opacity=".45"/>
            <path d="M262.582 580.665H1.265l130.613 232.303h261.317z" opacity=".6"/>
            <path d="M393.196 348.453L262.582 580.665l130.614 232.303L523.9 580.665z" opacity=".8"/>
        </svg>
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

export function AcademyBubbleNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [activeItem, setActiveItem] = useState(() => getActiveItem(pathname));
    const [isVisible, setIsVisible] = useState(() => isMainAcademyPage(pathname));
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        setActiveItem(getActiveItem(pathname));
        setIsVisible(isMainAcademyPage(pathname));
    }, [pathname]);

    const handleItemClick = (item: typeof academyItems[0]) => {
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
        <style jsx>{`
            @keyframes bubble-breathe {
                0%, 100% {
                    transform: scale(1);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
                }
                50% {
                    transform: scale(1.03);
                    box-shadow: 0 14px 20px -4px rgba(0, 0, 0, 0.12), 0 6px 8px -5px rgba(0, 0, 0, 0.1), 0 0 15px rgba(232, 65, 66, 0.15);
                }
            }
            .bubble-active {
                animation: bubble-breathe 6s ease-in-out infinite;
            }
        `}</style>
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
                                    ? "text-red-600 dark:text-red-400 bubble-active"
                                    : "text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all duration-300 ease-out"
                            )}
                            style={{
                                padding: item.padding,
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
