"use client";

import * as React from "react";
import { Check, AlertTriangle } from "lucide-react";

export interface ToastSpec {
  id: string;
  message: string;
  kind?: "success" | "error";
}

interface Props {
  toasts: ToastSpec[];
}

export function ToastHost({ toasts }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="pr-toast-host">
      {toasts.map((t) => {
        const kind = t.kind ?? "success";
        return (
          <div key={t.id} className={`pr-toast pr-${kind}`} role="status">
            <span className="pr-ti" aria-hidden>
              {kind === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
            </span>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
