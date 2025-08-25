"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

interface BubbleNavItem {
  id: string;
  label: string;
  href: string;
}

const navItems: BubbleNavItem[] = [
  { id: "validators", label: "Validators", href: "/stats/primary-network/validators" },
  { id: "c-chain", label: "C-Chain", href: "/stats/primary-network/c-chain" },
  { id: "avalanche-l1s", label: "Avalanche L1s", href: "/stats/l1" },
  { id: "staking", label: "Staking", href: "/stats/staking" }
];

export default function BubbleNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeItem, setActiveItem] = useState("validators");
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
    const currentItem = navItems.find((item) => pathname === item.href);
    if (currentItem) {
      setActiveItem(currentItem.id);
    }
  }, [pathname]);

  const handleItemClick = (item: BubbleNavItem) => {
    setActiveItem(item.id);
    router.push(item.href);
  };

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      <nav className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border border-gray-200 dark:border-gray-700 rounded-full p-4 shadow-lg">
        <div className="flex items-center justify-center space-x-2">
          {navItems.map((item, index) => {
            const isActive = activeItem === item.id;
            const isHovered = hoveredItem === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`
                  relative flex items-center justify-center
                  px-4 py-2 rounded-full
                  transition-all duration-300 ease-out
                  transform-gpu
                  ${
                    isActive
                      ? "bg-blue-600 dark:bg-blue-500 text-white scale-110 shadow-lg"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                  }
                  ${isHovered && !isActive ? "scale-105 shadow-md" : ""}
                  hover:shadow-xl
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
                  group
                  whitespace-nowrap text-sm font-medium
                `}
                aria-label={item.label}
              >
                <span
                  className={`
                  transition-transform duration-2000
                  ${isHovered ? "animate-pulse" : ""}
                `}
                >
                  {item.label}
                </span>

                <div
                  className={`
                  absolute inset-0 rounded-full
                  bg-gray-300/30 dark:bg-gray-600/30 scale-0
                  transition-transform duration-300
                  ${isActive ? "animate-ping" : ""}
                `}
                ></div>
              </button>
            );
          })}
        </div>

        <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
          <div className="absolute -top-2 -left-2 w-4 h-4 bg-gray-200/40 dark:bg-gray-600/40 rounded-full animate-pulse"></div>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-200/40 dark:bg-blue-400/40 rounded-full animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 -left-1 w-2 h-2 bg-gray-300/40 dark:bg-gray-500/40 rounded-full animate-pulse delay-500"></div>
        </div>
      </nav>
    </div>
  );
}
