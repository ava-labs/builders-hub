"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { GraduationCap } from 'lucide-react';

// Avalanche Logo SVG
function AvalancheLogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 254 254" fill="currentColor" className={className}>
            <path d="M95.2 172.2H57.1c-4.3 0-6.5 0-8-0.7-1.7-0.7-3-2-3.7-3.7-0.7-1.6-0.7-3.7-0.7-8V51.1c0-4.3 0-6.5 0.7-8 0.7-1.7 2-3 3.7-3.7 1.6-0.7 3.7-0.7 8-0.7h38.1c4.3 0 6.5 0 8 0.7 1.7 0.7 3 2 3.7 3.7 0.7 1.6 0.7 3.7 0.7 8v108.7c0 4.3 0 6.5-0.7 8-0.7 1.7-2 3-3.7 3.7-1.5 0.7-3.7 0.7-8 0.7z"/>
            <path d="M171.8 214.4h-89.6c-7.5 0-11.3 0-13.9-1.2-2.9-1.3-5.2-3.6-6.5-6.5-1.2-2.6-1.2-6.4-1.2-13.9v-10.6c0-7.5 0-11.3 1.2-13.9 1.3-2.9 3.6-5.2 6.5-6.5 2.6-1.2 6.4-1.2 13.9-1.2h89.6c7.5 0 11.3 0 13.9 1.2 2.9 1.3 5.2 3.6 6.5 6.5 1.2 2.6 1.2 6.4 1.2 13.9v10.6c0 7.5 0 11.3-1.2 13.9-1.3 2.9-3.6 5.2-6.5 6.5-2.6 1.2-6.4 1.2-13.9 1.2z"/>
            <path d="M196.9 172.2h-38.1c-4.3 0-6.5 0-8-0.7-1.7-0.7-3-2-3.7-3.7-0.7-1.6-0.7-3.7-0.7-8V51.1c0-4.3 0-6.5 0.7-8 0.7-1.7 2-3 3.7-3.7 1.6-0.7 3.7-0.7 8-0.7h38.1c4.3 0 6.5 0 8 0.7 1.7 0.7 3 2 3.7 3.7 0.7 1.6 0.7 3.7 0.7 8v108.7c0 4.3 0 6.5-0.7 8-0.7 1.7-2 3-3.7 3.7-1.5 0.7-3.7 0.7-8 0.7z"/>
        </svg>
    );
}

// Solidity Logo SVG
function SolidityLogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 256 256" fill="currentColor" className={className}>
            <path d="M165.7 0L128 69.1 90.3 0H0l37.7 69.1L0 138.3h90.3L128 69.1l37.7 69.2H256l-37.7-69.2L256 0z" opacity="0.45"/>
            <path d="M90.3 256l37.7-69.1 37.7 69.1H256l-37.7-69.1 37.7-69.2h-90.3L128 186.9l-37.7-69.2H0l37.7 69.2L0 256z" opacity="0.6"/>
            <path d="M128 69.1l37.7 69.2H90.3z" opacity="0.8"/>
            <path d="M128 186.9l-37.7-69.2h75.4z" opacity="0.8"/>
        </svg>
    );
}

const academyItems = [
    { id: "avalanche", label: "Avalanche L1", href: "/academy/avalanche-l1", icon: AvalancheLogo },
    { id: "blockchain", label: "Blockchain", href: "/academy/blockchain", icon: SolidityLogo },
    { id: "entrepreneur", label: "Entrepreneur", href: "/academy/entrepreneur", icon: GraduationCap },
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

export function AcademyBubbleNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [activeItem, setActiveItem] = useState(() => getActiveItem(pathname));
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        setActiveItem(getActiveItem(pathname));
    }, [pathname]);

    const handleItemClick = (item: typeof academyItems[0]) => {
        if (item.href) {
            setActiveItem(item.id);
            router.push(item.href);
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    };

    return (
        <nav
            className="fixed left-3 top-1/2 -translate-y-1/2 z-50 hidden lg:block"
        >
            <div className="flex flex-col items-start gap-1.5">
                {academyItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeItem === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className={cn(
                                "group flex items-center cursor-pointer rounded-full transition-all duration-300 ease-out",
                                "bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm shadow-md border border-gray-200/50 dark:border-zinc-800/50",
                                isActive
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            )}
                            style={{
                                padding: "10px",
                            }}
                            title={item.label}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            <div
                                className={cn(
                                    "overflow-hidden transition-all duration-300 ease-out whitespace-nowrap",
                                    isActive
                                        ? "max-w-[90px] opacity-100 ml-2 pr-1"
                                        : "max-w-0 opacity-0 ml-0 pr-0 group-hover:max-w-[90px] group-hover:opacity-100 group-hover:ml-2 group-hover:pr-1"
                                )}
                            >
                                <span className="font-medium text-xs">
                                    {item.label}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
