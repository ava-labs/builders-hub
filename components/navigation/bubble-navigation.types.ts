export interface BubbleNavItem {
    id: string;
    label: string;
    href?: string;
}

export interface BubbleNavigationConfig {
    items: BubbleNavItem[];
    activeColor: string;
    darkActiveColor: string;
    focusRingColor: string;
    pulseColor: string;
    darkPulseColor: string;
    darkTextColor?: string; // Text color for dark mode active items (e.g., "dark:text-zinc-900")
    buttonPadding?: string;
    buttonSpacing?: string;
    buttonScale?: string;
}
