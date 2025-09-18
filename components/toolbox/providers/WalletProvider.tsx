'use client';

import React from 'react';
import { AddChainModal } from './modals/AddChainModal';
import { WalletBootstrap } from '../components/console-header/wallet-bootstrap';

export function WalletProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            {/* Wallet initialization and event handling */}
            <WalletBootstrap />
            {/* Wallet-related modals */}
            <AddChainModal />
        </>
    );
}
