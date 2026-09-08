"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ALL = "all";

const STATUS_OPTIONS = [
  // First, because it is the only one that waits on an admin.
  { value: "pending_review", label: "Awaiting approval" },
  { value: "collecting", label: "Collecting" },
  { value: "deciding", label: "Quotes ready" },
  { value: "engaged", label: "Engaged" },
  { value: "expired", label: "Expired" },
  { value: "withdrawn", label: "Withdrawn" },
];

const SUBSIDY_OPTIONS = [
  { value: "none", label: "No decision" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
];

/** URL-driven filters (status, subsidy, deadline · board 1a): the server page
 * refetches on every change. Each select carries an "All" sentinel so one
 * filter clears without resetting the row. */
export function RequestsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}${params.size > 0 ? `?${params.toString()}` : ""}`);
  };

  const status = searchParams.get("status") ?? "";
  const subsidy = searchParams.get("subsidy") ?? "";
  const deadlineBefore = searchParams.get("deadline_before") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter requests">
      <Select
        value={status}
        onValueChange={(value) => setParam("status", value === ALL ? null : value)}
      >
        <SelectTrigger className="h-10 w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={subsidy}
        onValueChange={(value) => setParam("subsidy", value === ALL ? null : value)}
      >
        <SelectTrigger className="h-10 w-36">
          <SelectValue placeholder="Subsidy" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any subsidy state</SelectItem>
          {SUBSIDY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={deadlineBefore}
        onChange={(event) => setParam("deadline_before", event.target.value || null)}
        aria-label="Deadline before"
        title="Deadline before"
        className="h-10 w-[160px]"
      />
      {status || subsidy || deadlineBefore ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname)}
          className="text-zinc-500"
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}
