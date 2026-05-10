"use client";

import * as React from "react";
import { Plus, Copy, X } from "lucide-react";
import { WalletIcon } from "./icons";
import type { ProfileWallet } from "./types";

interface Props {
  wallets: ProfileWallet[];
  onConnect: () => void;
  onRemove: (address: string) => void;
  onCopy?: (address: string) => void;
}

function shorten(addr: string): string {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

export function WalletPanel({ wallets, onConnect, onRemove, onCopy }: Props) {
  const handleCopy = (address: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(address);
    }
    onCopy?.(address);
  };

  if (wallets.length === 0) {
    return (
      <div
        className="pr-wallet"
        style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <WalletIcon size={28} />
          <div className="pr-empty">
            No EVM wallet connected yet — connect one to receive grants & rewards.
          </div>
          <button
            type="button"
            className="pr-btn pr-btn--sm pr-empty-cta"
            onClick={onConnect}
          >
            <Plus size={14} /> Connect Wallet
          </button>
        </div>
      </div>
    );
  }

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
          <div className="pr-bot">
            {w.balance ? (
              <span className="pr-bal">{w.balance} AVAX</span>
            ) : (
              <span style={{ fontFamily: "var(--pr-mono)", fontSize: 11, opacity: 0.6 }}>
                {/* TODO(profile-redesign): persist wallet balance */}
                Connected
              </span>
            )}
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                className="pr-btn pr-btn--sm pr-action-btn"
                onClick={() => handleCopy(w.address)}
                aria-label="Copy wallet address"
              >
                <Copy size={12} /> Copy
              </button>
              <button
                type="button"
                className="pr-btn pr-btn--sm pr-action-btn"
                onClick={() => onRemove(w.address)}
                aria-label="Remove wallet"
              >
                <X size={12} /> Remove
              </button>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="pr-btn pr-btn--outline pr-btn--sm"
        onClick={onConnect}
        style={{ alignSelf: "flex-start" }}
      >
        <Plus size={14} /> Add another wallet
      </button>
    </div>
  );
}
