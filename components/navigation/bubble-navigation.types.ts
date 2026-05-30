import type { LucideIcon } from "lucide-react";

export interface BubbleNavItem {
    id: string;
    label: string;
    href?: string;
    icon?: LucideIcon;
}

export interface BubbleNavigationConfig {
    items: BubbleNavItem[];
    activeColor: string;
    darkActiveColor: string;
    focusRingColor: string;
    pulseColor: string;
    darkPulseColor: string;
    darkTextColor?: string; // Text color for dark mode active items (e.g., "dark:text-zinc-900")
    activeTextColor?: string; // Text/icon color for active items in icon-based nav
    buttonPadding?: string;
    buttonSpacing?: string;
    buttonScale?: string;
}
