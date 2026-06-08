"use client";

import * as React from "react";
import { Check, Tag, Wallet } from "lucide-react";
import { WalletConnectButton } from "../components/WalletConnectButton";
import type { ProfileWallet } from "./types";
import {
  WALLET_TAG_OPTIONS,
  normalizeWalletTag,
  WALLET_TAG_VALIDATION_MESSAGE,
} from "@/lib/profile/walletTag";

interface Props {
  wallets: ProfileWallet[];
  onAddWallet: (address: string, tag?: string, signature?: string, issuedAt?: string) => void;
  /** Called once per existing wallet when the user disconnects. */
  onRemove: (address: string) => void;
}

function shorten(addr: string): string {
  if (!addr || addr.length < 12) return addr || "";
  return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
}

export function WalletPanel({ wallets, onAddWallet, onRemove }: Props) {
  const [pendingTag, setPendingTag] = React.useState<(typeof WALLET_TAG_OPTIONS)[number]>("dev");
  const isConnected = wallets.length > 0;
  const lastAddress = wallets[wallets.length - 1]?.address;

  const handleAddWalletWithTag = (address: string, signature: string, issuedAt: string) => {
    const tag = normalizeWalletTag(pendingTag);
    onAddWallet(address, tag || undefined, signature, issuedAt);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={pendingTag}
          onChange={(event) => setPendingTag(event.target.value as (typeof WALLET_TAG_OPTIONS)[number])}
          className="pr-input"
          style={{ minWidth: 0, flex: 1 }}
          aria-label="Wallet tag"
          title={WALLET_TAG_VALIDATION_MESSAGE}
        >
          {WALLET_TAG_OPTIONS.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <WalletConnectButton
          onWalletConnected={handleAddWalletWithTag}
          existingAddresses={wallets.map((w) => w.address)}
        />
      </div>
      {!isConnected ? (
        <div />
      ) : (
        wallets.map((w, i) => (
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
              <span className="pr-label">
                EVM{w.label ? ` · ${w.label}` : ""}
                {w.tag ? ` · ${w.tag}` : ""}
              </span>
            </div>
            <div className="pr-bot">
              <div className="pr-addr" title={w.address}>
                {w.tag ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Tag size={14} /> {w.tag}
                  </span>
                ) : null}
                {w.tag ? " - " : ""}
                {shorten(w.address)}
              </div>
              <button
                type="button"
                className="pr-btn pr-btn--sm pr-btn--success"
                onClick={() => onRemove(w.address)}
                aria-label="Disconnect this wallet"
              >
                <Check size={12} /> Connected
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
