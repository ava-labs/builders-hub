'use client';

import React from 'react';
import { AddChainModal } from './modals/AddChainModal';
import { SwitchNetworkModal } from './modals/SwitchNetworkModal';
import { EditRpcUrlModal } from './modals/EditRpcUrlModal';
import { WalletSync } from '../components/console-header/WalletSync';
import { Web3Provider } from './Web3Provider';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <Web3Provider>
      {children}
      <WalletSync />
      <AddChainModal />
      <SwitchNetworkModal />
      <EditRpcUrlModal />
    </Web3Provider>
  );
}
