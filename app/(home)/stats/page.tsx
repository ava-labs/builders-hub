"use client";

import type React from "react";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  Users,
  FileCode,
  BarChart3,
  Loader2,
} from "lucide-react";

interface ChainMetrics {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  weeklyTxCount: number | string;
  weeklyContractsDeployed: number | string;
  weeklyActiveAddresses: number | string;
}

type SortField = keyof ChainMetrics;
type SortDirection = "asc" | "desc";

export default function AvalancheMetrics() {
  const [chainMetrics, setChainMetrics] = useState<ChainMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("weeklyTxCount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const parseCSV = (csvText: string): ChainMetrics[] => {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");
    const data: ChainMetrics[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current);

      if (values.length >= headers.length) {
        const chainName = values[1].replace(/"/g, "");
        const chainLogoURI = values[2].replace(/"/g, "");

        // Helper function to parse metric values
        const parseMetricValue = (value: string): number | string => {
          if (value === "N/A" || value === "") return "N/A";
          const parsed = Number.parseInt(value);
          return isNaN(parsed) ? "N/A" : parsed;
        };

        data.push({
          chainId: values[0],
          chainName: chainName.toUpperCase(),
          chainLogoURI: chainLogoURI,
          weeklyTxCount: parseMetricValue(values[3]),
          weeklyContractsDeployed: parseMetricValue(values[4]),
          weeklyActiveAddresses: parseMetricValue(values[5]),
        });
      }
    }

    return data;
  };

  useEffect(() => {
    const fetchCSVData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/data/chain-metrics.csv");

        if (!response.ok) {
          throw new Error(`Failed to fetch CSV: ${response.status}`);
        }

        const csvText = await response.text();
        const metrics = parseCSV(csvText);

        setChainMetrics(metrics);

        const lastModified = response.headers.get("last-modified");
        if (lastModified) {
          setLastUpdated(new Date(lastModified).toLocaleString());
        } else {
          setLastUpdated(new Date().toLocaleString());
        }
      } catch (err: any) {
        console.error("Error fetching CSV data:", err);
        setError(err?.message || "Failed to load metrics data");
      }

      setLoading(false);
    };

    fetchCSVData();
  }, []);

  const formatNumber = (num: number): string => {
    if (num === 0) return "0";
    if (num < 1000) return num.toLocaleString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
    return `${(num / 1000000).toFixed(1)}M`;
  };

  const formatFullNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const getActivityStatus = (
    transactions: number | string,
    addresses: number | string
  ) => {
    const txCount = typeof transactions === "number" ? transactions : 0;
    const addrCount = typeof addresses === "number" ? addresses : 0;

    if (txCount === 0 && addrCount === 0)
      return { label: "Inactive", variant: "secondary" as const };
    if (txCount < 100 && addrCount < 1000)
      return { label: "Low", variant: "outline" as const };
    if (txCount < 1000 && addrCount < 10000)
      return { label: "Medium", variant: "default" as const };
    return { label: "High", variant: "default" as const };
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedData = [...chainMetrics].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Handle mixed types (number vs string)
    const aNum = typeof aValue === "number" ? aValue : 0;
    const bNum = typeof bValue === "number" ? bValue : 0;

    return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
  });

  const SortButton = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-semibold hover:bg-transparent text-foreground"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </span>
    </Button>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg font-medium">Loading chain metrics...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Fetching latest data from CSV
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Failed to Load Data
                </h3>
                <p className="text-destructive text-sm">{error}</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (chainMetrics.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  No Data Available
                </h3>
                <p className="text-muted-foreground text-sm">
                  No chain metrics found in the CSV file.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-6 md:py-12 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Avalanche Mainnet L1 Stats
            </h1>
            <p className="text-muted-foreground mt-1">
              An opinionated collection of stats for the Avalanche Mainnet L1s.
              Updated daily.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-muted-foreground">Last updated</p>
            <p className="text-sm font-medium">{lastUpdated || "Just now"}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                <span className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400">
                  Total Mainnet L1s
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                {chainMetrics.length}
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                <span className="text-xs md:text-sm font-medium text-green-600 dark:text-green-400">
                  Weekly Active Chains
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                {
                  chainMetrics.filter((chain) => {
                    const txCount =
                      typeof chain.weeklyTxCount === "number"
                        ? chain.weeklyTxCount
                        : 0;
                    const addrCount =
                      typeof chain.weeklyActiveAddresses === "number"
                        ? chain.weeklyActiveAddresses
                        : 0;
                    return txCount > 0 || addrCount > 0;
                  }).length
                }
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-800">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                <span className="text-xs md:text-sm font-medium text-purple-600 dark:text-purple-400">
                  Weekly Deployed Contracts
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                {formatFullNumber(
                  chainMetrics.reduce((sum, chain) => {
                    const contracts =
                      typeof chain.weeklyContractsDeployed === "number"
                        ? chain.weeklyContractsDeployed
                        : 0;
                    return sum + contracts;
                  }, 0)
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
                <span className="text-xs md:text-sm font-medium text-orange-600 dark:text-orange-400">
                  Weekly Active Addresses
                </span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-orange-700 dark:text-orange-300 mt-1">
                {formatFullNumber(
                  chainMetrics.reduce((sum, chain) => {
                    const addresses =
                      typeof chain.weeklyActiveAddresses === "number"
                        ? chain.weeklyActiveAddresses
                        : 0;
                    return sum + addresses;
                  }, 0)
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <BarChart3 className="h-5 w-5 text-primary" />
              L1 Metrics Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2">
                    <TableHead className="font-semibold py-4 min-w-[200px] px-4">
                      <SortButton field="chainName">L1 Name</SortButton>
                    </TableHead>
                    <TableHead className="font-semibold text-center min-w-[140px]">
                      <SortButton field="weeklyTxCount">
                        <span className="hidden lg:flex items-center gap-1">
                          <BarChart3 className="h-4 w-4 text-blue-600" />
                          Weekly Transactions
                        </span>
                        <span className="lg:hidden">Transactions</span>
                      </SortButton>
                    </TableHead>
                    <TableHead className="font-semibold text-center min-w-[140px]">
                      <SortButton field="weeklyContractsDeployed">
                        <span className="hidden lg:flex items-center gap-1">
                          <FileCode className="h-4 w-4 text-purple-600" />
                          Contracts Deployed
                        </span>
                        <span className="lg:hidden">Contracts</span>
                      </SortButton>
                    </TableHead>
                    <TableHead className="font-semibold text-center min-w-[140px]">
                      <SortButton field="weeklyActiveAddresses">
                        <span className="hidden lg:flex items-center gap-1">
                          <Users className="h-4 w-4 text-orange-600" />
                          Active Addresses
                        </span>
                        <span className="lg:hidden">Addresses</span>
                      </SortButton>
                    </TableHead>
                    <TableHead className="font-semibold text-center min-w-[100px]">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((chain, index) => {
                    const activityStatus = getActivityStatus(
                      chain.weeklyTxCount,
                      chain.weeklyActiveAddresses
                    );
                    return (
                      <TableRow
                        key={chain.chainId}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-medium py-4 p-4">
                          <div className="flex items-center gap-3">
                            {chain.chainLogoURI ? (
                              <Image
                                src={chain.chainLogoURI || "/placeholder.svg"}
                                alt={`${chain.chainName} logo`}
                                width={32}
                                height={32}
                                className="rounded-full ring-2 ring-border flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                {chain.chainName.charAt(0)}
                              </div>
                            )}
                            <span className="font-semibold text-sm md:text-base truncate">
                              {chain.chainName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-mono font-semibold text-sm ${
                              typeof chain.weeklyTxCount === "number" &&
                              chain.weeklyTxCount > 0
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {typeof chain.weeklyTxCount === "number"
                              ? formatFullNumber(chain.weeklyTxCount)
                              : chain.weeklyTxCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-mono font-semibold text-sm ${
                              typeof chain.weeklyContractsDeployed ===
                                "number" && chain.weeklyContractsDeployed > 0
                                ? "text-purple-600 dark:text-purple-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {typeof chain.weeklyContractsDeployed === "number"
                              ? formatFullNumber(chain.weeklyContractsDeployed)
                              : chain.weeklyContractsDeployed}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-mono font-semibold text-sm ${
                              typeof chain.weeklyActiveAddresses === "number" &&
                              chain.weeklyActiveAddresses > 0
                                ? "text-orange-600 dark:text-orange-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {typeof chain.weeklyActiveAddresses === "number"
                              ? formatFullNumber(chain.weeklyActiveAddresses)
                              : chain.weeklyActiveAddresses}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={activityStatus.variant}
                            className="font-medium text-xs"
                          >
                            {activityStatus.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Data is updated daily via automated script. Chain logos and metrics
            are fetched from CSV data source.
          </p>
        </div>
      </main>
    </div>
  );
}
