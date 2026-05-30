"use client";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export const POS_L1_SUBNET_IDS: Record<string, string> = {
  "21uUaTxVdR3Sp6SJhpcSrdH1g66aFoE8mPQDvwKJCjXNexo5y6": "Kite",
  eYwmVU67LmSfZb1RwqCMhBYkFyG8ftxn6jAwqzFmxC9STBWLC: "Beam",
  WChFQ1twkXBLxZGo4qojC9AgizFrRdMRnPCK9FZmisY7z6pUs: "CX",
  wenKDikJWAYQs3f2v9JhV86fC6kHZwkFZsuUBftnmgZ4QXPnu: "Dexalot",
};

const PRIMARY_NETWORK_COLOR = "#E84142";
const POS_L1_COLOR = "#3B82F6";
const POA_L1_COLOR = "#A78BFA";

interface SubnetStat {
  id: string;
  name: string;
  nodes: number;
  isL1: boolean;
}

export interface ValidatorPieCardProps {
  primaryNetworkCount: number | null;
  subnetStats: SubnetStat[] | null;
  loading?: boolean;
}

interface Slice {
  category: "primary" | "pos" | "poa";
  label: string;
  count: number;
  color: string;
  members: { name: string; count: number }[];
}

export function ValidatorPieCard({
  primaryNetworkCount,
  subnetStats,
  loading,
}: ValidatorPieCardProps) {
  const slices = useMemo<Slice[]>(() => {
    const result: Slice[] = [];

    if (typeof primaryNetworkCount === "number" && primaryNetworkCount > 0) {
      result.push({
        category: "primary",
        label: "Primary Network",
        count: primaryNetworkCount,
        color: PRIMARY_NETWORK_COLOR,
        members: [{ name: "Primary Network", count: primaryNetworkCount }],
      });
    }

    if (subnetStats?.length) {
      const posMembers: { name: string; count: number }[] = [];
      const poaMembers: { name: string; count: number }[] = [];
      let posTotal = 0;
      let poaTotal = 0;

      for (const subnet of subnetStats) {
        if (!subnet.isL1) continue;
        if (subnet.nodes <= 0) continue;
        if (POS_L1_SUBNET_IDS[subnet.id]) {
          posMembers.push({ name: subnet.name, count: subnet.nodes });
          posTotal += subnet.nodes;
        } else {
          poaMembers.push({ name: subnet.name, count: subnet.nodes });
          poaTotal += subnet.nodes;
        }
      }

      if (posTotal > 0) {
        posMembers.sort((a, b) => b.count - a.count);
        result.push({
          category: "pos",
          label: "Proof-of-Stake L1s",
          count: posTotal,
          color: POS_L1_COLOR,
          members: posMembers,
        });
      }

      if (poaTotal > 0) {
        poaMembers.sort((a, b) => b.count - a.count);
        result.push({
          category: "poa",
          label: "Proof-of-Authority L1s",
          count: poaTotal,
          color: POA_L1_COLOR,
          members: poaMembers,
        });
      }
    }

    return result;
  }, [primaryNetworkCount, subnetStats]);

  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const subnetDataMissing = subnetStats === null;

  return (
    <Card className="py-0 border-gray-200 rounded-md dark:border-gray-700">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="rounded-full p-2 sm:p-3 flex items-center justify-center"
              style={{ backgroundColor: `${PRIMARY_NETWORK_COLOR}20` }}
            >
              <Users className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: PRIMARY_NETWORK_COLOR }} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-normal">
                Validator Distribution
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                Primary Network vs Proof-of-Stake and Proof-of-Authority L1s
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pt-6 pb-6">
          {loading || subnetDataMissing ? (
            <div className="flex items-center justify-center h-[350px] text-sm text-muted-foreground">
              {loading ? "Loading…" : "Validator distribution unavailable."}
            </div>
          ) : total === 0 ? (
            <div className="flex items-center justify-center h-[350px] text-sm text-muted-foreground">
              No validator data available.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const slice = payload[0].payload as Slice;
                        const pct = total > 0 ? (slice.count / total) * 100 : 0;
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm font-mono text-xs">
                            <div className="font-medium mb-1">{slice.label}</div>
                            <div>
                              {slice.count.toLocaleString()} ({pct.toFixed(1)}%)
                            </div>
                            {slice.category !== "primary" && slice.members.length > 0 && (
                              <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                                {slice.members.slice(0, 6).map((m) => (
                                  <div key={m.name} className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">{m.name}</span>
                                    <span>{m.count.toLocaleString()}</span>
                                  </div>
                                ))}
                                {slice.members.length > 6 && (
                                  <div className="text-muted-foreground">
                                    +{slice.members.length - 6} more
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Pie
                      data={slices}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {slices.map((slice) => (
                        <Cell key={slice.category} fill={slice.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex flex-col gap-3">
                  {slices.map((slice) => {
                    const pct = total > 0 ? (slice.count / total) * 100 : 0;
                    return (
                      <div key={slice.category} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-sm"
                              style={{ backgroundColor: slice.color }}
                            />
                            <span>{slice.label}</span>
                          </div>
                          <div className="font-mono">
                            {slice.count.toLocaleString()}{" "}
                            <span className="text-muted-foreground">
                              ({pct.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        {slice.category !== "primary" && slice.members.length > 0 && (
                          <div className="pl-5 text-xs text-muted-foreground">
                            {slice.members
                              .slice(0, 3)
                              .map((m) => m.name)
                              .join(", ")}
                            {slice.members.length > 3 && ` +${slice.members.length - 3} more`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
