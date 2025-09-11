export interface BubbleNavItem {
    id: string;
    label: string;
    href: string;
}

export interface BubbleNavigationConfig {
    items: BubbleNavItem[];
    activeColor: string;
    darkActiveColor: string;
    focusRingColor: string;
    pulseColor: string;
    darkPulseColor: string;
    buttonPadding?: string;
    buttonSpacing?: string;
    buttonScale?: string;
}
