"use client";

import * as React from "react";
import { Check, Wallet } from "lucide-react";
import { WalletConnectButton } from "../components/WalletConnectButton";
import type { ProfileWallet } from "./types";

interface Props {
  wallets: ProfileWallet[];
  onAddWallet: (address: string) => void;
  /** Called once per existing wallet when the user disconnects. */
  onRemove: (address: string) => void;
}

function shorten(addr: string): string {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

export function WalletPanel({ wallets, onAddWallet, onRemove }: Props) {
  const isConnected = wallets.length > 0;
  const lastAddress = wallets[wallets.length - 1]?.address;

  const handleDisconnectAll = () => {
    // Iterate over a snapshot — onRemove may mutate the source array.
    for (const w of [...wallets]) onRemove(w.address);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {wallets.map((w, i) => (
        <div className="pr-wallet" key={w.address}>
          <div className="pr-top">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="pr-net">
                <span className="pr-d" /> Avalanche C-Chain
              </span>
              {i === 0 && (
                <span
                  className="pr-net"
                  style={{ background: "rgba(232,65,66,0.18)", color: "#ff6e6f" }}
                >
                  Primary
                </span>
              )}
            </div>
            <span className="pr-label">EVM{w.label ? ` · ${w.label}` : ""}</span>
          </div>
          <div className="pr-addr" title={w.address}>
            {shorten(w.address)}
          </div>
          {w.balance && (
            <div className="pr-bot">
              <span className="pr-bal">{w.balance} AVAX</span>
            </div>
          )}
        </div>
      ))}

      <div style={{ alignSelf: "flex-start" }}>
        {isConnected ? (
          <button
            type="button"
            className="pr-btn pr-btn--sm pr-btn--success"
            onClick={handleDisconnectAll}
            aria-label="Disconnect wallet"
          >
            <Check size={12} /> Connected
          </button>
        ) : (
          <WalletConnectButton
            onWalletConnected={onAddWallet}
            currentAddress={lastAddress}
            trigger={
              <button
                type="button"
                className="pr-btn pr-btn--sm pr-btn--outline"
              >
                <Wallet size={14} />
                Connect Wallet
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
