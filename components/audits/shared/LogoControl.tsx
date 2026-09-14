"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { isAllowedLogoSrc } from "@/lib/audits/logoSrc";
import { monogramOf } from "@/components/audits/shared/format";

const MAX = 2 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg"];

export type LogoUploadResult = { url: string } | { error: string };

/** The admin default: the generic upload route; the sheet saves the URL later. */
async function uploadToFileRoute(file: File): Promise<LogoUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/file", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body.url !== "string") {
    return { error: typeof body.error === "string" ? body.error : "Upload failed." };
  }
  return { url: body.url };
}

/**
 * The logo tile: the stored mark when its URL passes isAllowedLogoSrc, the
 * monogram otherwise, failing closed at render exactly like the public row.
 * `lg` is the firm details identity row (44px), `md` the control (40px).
 */
export function LogoTile({
  value,
  firmName,
  size = "md",
}: {
  value: string | null;
  firmName: string;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-11 w-11" : "h-10 w-10";
  const showLogo = value ? isAllowedLogoSrc(value) : false;
  if (showLogo) {
    return (
      <span
        aria-hidden
        className={cn(
          box,
          "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value as string} alt="" className="h-[26px] w-[26px] object-contain" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        box,
        "flex shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-mono font-semibold text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
        size === "lg" ? "text-sm" : "text-[13px]",
      )}
    >
      {monogramOf(firmName)}
    </span>
  );
}

/**
 * Logo upload shared by the admin whitelist sheet (default `upload`: the
 * generic /api/file route, the URL is saved with the sheet) and the firm
 * details page (its own `upload` to the portal logo route, which stores and
 * saves in one step). The client pre-check is a friendliness layer; the
 * server enforces PNG/JPEG and the size. `onChange` may be async (the portal
 * removes through its route); the toast waits for it and a thrown Error is
 * shown as the message.
 */
export function LogoControl({
  value,
  onChange,
  firmName,
  upload = uploadToFileRoute,
  showTile = true,
}: {
  value: string | null;
  onChange: (url: string | null) => void | Promise<void>;
  firmName: string;
  upload?: (file: File) => Promise<LogoUploadResult>;
  showTile?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!OK_TYPES.includes(file.type) || file.size > MAX) {
      toast.error("Use a PNG or JPG under 2MB.");
      return;
    }
    setBusy(true);
    try {
      const result = await upload(file);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      await onChange(result.url);
      toast.success("Logo uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await onChange(null);
      toast.success("Logo removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {showTile ? <LogoTile value={value} firmName={firmName} /> : null}
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
            onClick={() => void handleRemove()}
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
