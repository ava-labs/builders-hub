"use client";

import { Fragment, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { AllMetrics, HistoricalData } from "@/lib/rwa/types";
import { CHIP, OFF } from "./ProtocolFilters";
import { readAll } from "./RwaTransactions";

/* The old dashboard's export menu: the pool's figures and daily history
   as CSV, every transfer as CSV, and the dashboard itself as a PDF report
   or a PNG image, both captured in the light theme. */

interface ExportSource {
  slug: string;
  metrics: AllMetrics | null;
  historical: HistoricalData | null;
  /** the id of the element the PDF and the image capture */
  target: string;
}

interface ExportKind {
  label: string;
  /** the data files, then the pictures of the page */
  group: "data" | "page";
  ready: (s: ExportSource) => boolean;
  run: (s: ExportSource) => Promise<void>;
}

export const EXPORTS: ExportKind[] = [
  {
    label: "CSV data",
    group: "data",
    ready: (s) => !!(s.metrics || s.historical),
    run: async ({ metrics, historical }) => {
      const { exportHistoricalToCSV, exportMetricsToCSV } = await import("@/lib/rwa/export/csv");
      if (metrics) exportMetricsToCSV(metrics);
      if (historical) exportHistoricalToCSV(historical);
    },
  },
  {
    label: "Transaction CSV",
    group: "data",
    ready: () => true,
    run: async ({ slug }) => {
      const transfers = await readAll(slug, "all", "date", "desc");
      const { exportTransactionsToCSV } = await import("@/lib/rwa/export/csv");
      exportTransactionsToCSV(transfers);
    },
  },
  {
    label: "PDF report",
    group: "page",
    ready: () => true,
    run: async ({ target }) => {
      const { exportDashboardToPDF } = await import("@/lib/rwa/export/pdf");
      await exportDashboardToPDF(target);
    },
  },
  {
    label: "PNG image",
    group: "page",
    ready: () => true,
    run: async ({ target }) => {
      const { exportDashboardToImage } = await import("@/lib/rwa/export/image");
      await exportDashboardToImage(target);
    },
  },
];

const ITEM = "cursor-pointer rounded-none font-mono text-[11px] text-zinc-700 focus:bg-zinc-100 dark:text-zinc-200 dark:focus:bg-zinc-900";

export function ExportMenu(source: ExportSource) {
  const [busy, setBusy] = useState(false);
  const exportAs = async (kind: ExportKind) => {
    setBusy(true);
    try {
      await kind.run(source);
      toast.success(`${kind.label} downloaded`);
    } catch (err) {
      toast.error("Export failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={busy} className={cn(CHIP, OFF, "uppercase tracking-[0.1em]")}>
          <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
          {busy ? "Exporting…" : "Export"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem] rounded-none border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
        {EXPORTS.map((kind, i) => (
          <Fragment key={kind.label}>
            {i > 0 && kind.group !== EXPORTS[i - 1].group && <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />}
            <DropdownMenuItem disabled={!kind.ready(source)} onSelect={() => void exportAs(kind)} className={ITEM}>
              {kind.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
