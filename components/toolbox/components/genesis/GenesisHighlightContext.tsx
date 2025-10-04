"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

interface GenesisHighlightContextType {
    highlightPath: string | null;
    setHighlightPath: (path: string | null) => void;
    clearHighlight: () => void;
}

const GenesisHighlightContext = createContext<GenesisHighlightContextType | undefined>(undefined);

interface GenesisHighlightProviderProps {
    children: ReactNode;
}

export function GenesisHighlightProvider({ children }: GenesisHighlightProviderProps) {
    const [highlightPath, setHighlightPath] = useState<string | null>(null);

    const clearHighlight = () => {
        setHighlightPath(null);
    };

    const value = {
        highlightPath,
        setHighlightPath,
        clearHighlight
    };

    return (
        <GenesisHighlightContext.Provider value={value}>
            {children}
        </GenesisHighlightContext.Provider>
    );
}

export function useGenesisHighlight() {
    const context = useContext(GenesisHighlightContext);
    if (context === undefined) {
        throw new Error('useGenesisHighlight must be used within a GenesisHighlightProvider');
    }
    return context;
}
