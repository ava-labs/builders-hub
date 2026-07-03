"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import "@/components/profile/shell/styles.css";

interface SignOutComponentProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export default function SignOutComponent({
  isOpen,
  onOpenChange,
  onConfirm,
}: SignOutComponentProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await Promise.all([
        onConfirm(),
        new Promise((resolve) => setTimeout(resolve, 300)),
      ]);
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="profile sm:max-w-[440px] rounded-2xl"
        style={{
          background: "var(--pr-g-100)",
          borderColor: "var(--pr-hairline)",
          padding: 24,
          gap: 18,
        }}
      >
        <DialogHeader className="space-y-0">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span
              className="pr-ico"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--pr-avax-tint)",
                color: "var(--pr-avax)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
              aria-hidden
            >
              <LogOut size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DialogTitle asChild>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                    color: "var(--pr-g-1000)",
                    textAlign: "left",
                  }}
                >
                  Sign out of Builder Hub?
                </h3>
              </DialogTitle>
              <DialogDescription asChild>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: "var(--pr-g-650)",
                    textAlign: "left",
                    lineHeight: 1.45,
                  }}
                >
                  You&apos;ll be returned to the home page and will need to
                  sign in again to come back to your profile.
                </div>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="pr-btn pr-btn--outline pr-btn--sm"
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="pr-btn pr-btn--primary pr-btn--sm"
            disabled={isConfirming}
            aria-busy={isConfirming}
          >
            {isConfirming ? "Signing out…" : "Yes, sign out"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
