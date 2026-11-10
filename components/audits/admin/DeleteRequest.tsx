"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AUDITS_DIALOG, CARD } from "@/components/audits/shared/classes";

/**
 * The dialog's warning: what goes with the request, and that nothing brings
 * it back. Quotes and firms are named because they are what cannot be rebuilt.
 */
export function deleteWarning(quoteCount: number, firmCount: number): string {
  const quotes = quoteCount > 0 ? `, its ${quoteCount} quote${quoteCount === 1 ? "" : "s"}` : "";
  const firms =
    firmCount === 0
      ? ""
      : firmCount === 1
        ? " The firm that received it will no longer see it."
        : ` The ${firmCount} firms that received it will no longer see it.`;
  return `This deletes the request${quotes} and its activity trail.${firms} This can't be undone.`;
}

/**
 * Permanent delete for an audit admin (Joey, 2026-10-06: a project resubmitted
 * and its first proposal had to go). The button only opens the dialog; the
 * delete runs from the dialog, which is the double check.
 */
export function DeleteRequest({
  requestId,
  projectName,
  quoteCount,
  firmCount,
}: {
  requestId: string;
  projectName: string;
  quoteCount: number;
  /** Firms the request was fanned out to. */
  firmCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/admin/requests/${requestId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't delete this request.");
        // A 404 or 409 means the request changed under the dialog: re-read it.
        router.refresh();
        return;
      }
      setOpen(false);
      toast.success(`${projectName} deleted.`);
      router.replace("/audits/admin/requests");
    } catch {
      toast.error("We couldn't delete this request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${CARD} p-5`}>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-[#A2AFB2]">
        For a test, a duplicate, or a request the project asked to remove. There is no undo.
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="mt-4 h-10 border-brand-deep/40 text-brand-deep hover:bg-brand/5 dark:border-brand-soft/40 dark:text-brand-soft"
          >
            Delete request
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className={AUDITS_DIALOG}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {projectName} permanently?</AlertDialogTitle>
            <AlertDialogDescription>{deleteWarning(quoteCount, firmCount)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep request</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                // Keep the dialog open until the server answers.
                event.preventDefault();
                void remove();
              }}
              className="border border-brand-deep/35 bg-transparent text-brand-deep shadow-none hover:bg-brand-deep/5 dark:border-brand-soft/35 dark:text-brand-soft dark:hover:bg-brand-soft/10"
            >
              {busy ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
