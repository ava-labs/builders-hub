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

const STATUS_OPTIONS = [
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

/** URL-driven filters: the server page refetches on every change. */
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={status} onValueChange={(value) => setParam("status", value)}>
        <SelectTrigger className="h-10 w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={subsidy} onValueChange={(value) => setParam("subsidy", value)}>
        <SelectTrigger className="h-10 w-40">
          <SelectValue placeholder="Subsidy" />
        </SelectTrigger>
        <SelectContent>
          {SUBSIDY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {status || subsidy ? (
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
