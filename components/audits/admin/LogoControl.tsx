"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isAllowedLogoSrc } from "@/lib/audits/logoSrc";
import { monogramOf } from "@/components/audits/shared/format";

const MAX = 2 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg"];

/**
 * Admin logo upload for the whitelist sheet. Reuses /api/file's mechanics (not
 * the profile LogoUploader's classes). Client pre-check is a friendliness
 * layer; the server enforces the PNG/JPEG allowlist. The saved URL is guarded
 * by isAllowedLogoSrc on write and again at render, failing closed to the
 * monogram.
 */
export function LogoControl({
  value,
  onChange,
  firmName,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  firmName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const showLogo = value ? isAllowedLogoSrc(value) : false;

  async function handleFile(file: File) {
    if (!OK_TYPES.includes(file.type) || file.size > MAX) {
      toast.error("Use a PNG or JPG under 2MB.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/file", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        toast.error(body.error ?? "Upload failed.");
        return;
      }
      onChange(body.url as string);
      toast.success("Logo uploaded.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      {showLogo ? (
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value as string} alt="" className="h-[26px] w-[26px] object-contain" />
        </span>
      ) : (
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-mono text-[13px] font-semibold text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
        >
          {monogramOf(firmName)}
        </span>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
          {value ? "Replace" : "Choose file"}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10"
            disabled={busy}
            onClick={() => {
              onChange(null);
              toast.success("Logo removed.");
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}
