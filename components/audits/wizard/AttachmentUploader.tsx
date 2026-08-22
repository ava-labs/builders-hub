"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_ATTACHMENT_BYTES } from "@/types/audits";
import type { AuditWizardValues } from "@/components/audits/wizard/types";

const ACCEPT = ".pdf,.txt,.md,image/*";
const ACCEPTED_TYPES = /^(application\/pdf|text\/plain|text\/markdown|image\/)/;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Uploads go straight from the browser to Vercel Blob via the token exchange
 * at /api/audits/attachments/upload (128MB would never fit through a
 * function body). On success the file lands in the form's attachments list,
 * which the autosave PATCHes onto the draft; removing only unlinks it.
 */
export function AttachmentUploader() {
  const { setValue, watch } = useFormContext<AuditWizardValues>();
  const attachments = watch("attachments");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name} is over the 128MB limit.`);
          continue;
        }
        if (!ACCEPTED_TYPES.test(file.type)) {
          toast.error(`${file.name}: only pdf, text and image files are accepted.`);
          continue;
        }
        const blob = await upload(`audits/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/audits/attachments/upload",
        });
        setValue(
          "attachments",
          [...attachments, { name: file.name, url: blob.url, size: file.size }],
          { shouldDirty: true },
        );
      }
    } catch (error) {
      console.error("Attachment upload failed:", error);
      toast.error("Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {attachments.map((attachment, index) => (
        <div
          key={attachment.url}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-white/10"
        >
          <FileText aria-hidden className="h-4 w-4 shrink-0 text-zinc-500" />
          <span className="min-w-0 flex-1 truncate text-sm">{attachment.name}</span>
          <span className="shrink-0 font-mono text-xs text-zinc-500">
            {formatSize(attachment.size)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() =>
              setValue(
                "attachments",
                attachments.filter((_, i) => i !== index),
                { shouldDirty: true },
              )
            }
            aria-label={`Remove ${attachment.name}`}
          >
            <X aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-11 md:h-9"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Paperclip aria-hidden className="mr-1.5 h-4 w-4" />
        )}
        {uploading ? "Uploading…" : "Attach files"}
      </Button>
    </div>
  );
}
