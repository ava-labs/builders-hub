"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const dashboardOptions = [
  {
    name: "Overview",
    url: "https://ava-labs-inc.metabaseapp.com/public/dashboard/b487e2de-eb24-474b-bf0d-ae025224238f",
  },
  {
    name: "Network Status",
    url: "https://ava-labs-inc.metabaseapp.com/public/dashboard/8a177616-8c27-4fc3-aaaf-03c14fecd727",
  },
  {
    name: "Staking",
    url: "https://ava-labs-inc.metabaseapp.com/public/dashboard/249aea4f-6f83-45f4-8ed7-5cbdf9e9b026",
  },
  {
    name: "Validator Performance",
    url: "https://ava-labs-inc.metabaseapp.com/public/dashboard/e84ef214-40d9-42e8-8db6-21cec652cc90",
  },
  {
    name: "Validator Health Check",
    url: "https://ava-labs-inc.metabaseapp.com/public/dashboard/09b92700-1a8c-4f74-bdeb-79a9f5873cf7",
  },
  {
    name: "Reward Distribution",
    url: "https://ava-labs-inc.metabaseapp.com/public/dashboard/3e895234-4c31-40f7-a3ee-4656f6caf535",
  },
  {
    name: "Avalanche L1 Validator Fees",
    url: "https://ava-labs-inc.metabaseapp.com/public/dashboard/a457d97d-ab2a-4041-9267-ef40f78003e3",
  },
];

export default function Page() {
  const [selectedUrl, setSelectedUrl] = useState(dashboardOptions[0].url);
  const [selectedName, setSelectedName] = useState(dashboardOptions[0].name);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadStartTime, setLoadStartTime] = useState(Date.now());

  const handleDashboardSelect = (value: string) => {
    const selected = dashboardOptions.find((option) => option.url === value);
    if (selected) {
      setSelectedUrl(value);
      setSelectedName(selected.name);
      setIsLoading(true);
      setHasError(false);
      setLoadStartTime(Date.now());
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Auto-hide loading after 10 seconds to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [loadStartTime, isLoading]);

  return (
    <>
      <style jsx global>{`
        footer {
          display: none !important;
        }
        /* Hide any element with footer-related class names */
        [class*="footer" i] {
          display: none !important;
        }
      `}</style>
      <div className="min-h-screen bg-white">
        {/* Header Section */}
        <div className="backdrop-blur sticky top-0 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-primary" />
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                  Avalanche Stats
                </h1>
              </div>

              {/* Dashboard Selector */}
              <div className="w-64 md:w-80">
                <Select
                  onValueChange={handleDashboardSelect}
                  value={selectedUrl}
                >
                  <SelectTrigger className="h-10 text-sm md:text-base">
                    <SelectValue placeholder="Select dashboard..." />
                  </SelectTrigger>
                  <SelectContent align="start" className="w-64 md:w-80">
                    {dashboardOptions.map((option) => (
                      <SelectItem
                        key={option.url}
                        value={option.url}
                        className="text-sm md:text-base py-3"
                      >
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="relative">
          {/* Error State */}
          {hasError && (
            <div className="absolute inset-0 z-20 bg-white flex items-center justify-center p-6">
              <div className="max-w-md w-full">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="mt-2">
                    Failed to load the dashboard. This might be due to network
                    issues or the dashboard being temporarily unavailable.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2 mt-4 justify-center">
                  <Button
                    onClick={() => window.location.reload()}
                    variant="default"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
                <div>
                  <p className="text-foreground font-medium">
                    Loading {selectedName}...
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This may take a few moments
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Iframe Container with Cropping */}
          <div
            className="w-full overflow-hidden"
            style={{ height: "calc(100vh - 120px)" }}
          >
            <iframe
              src={selectedUrl}
              className="w-full border-0 bg-white"
              style={{
                height: "calc(100vh - 120px + 82px + 80px)",
                marginTop: "-82px",
              }}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title={`${selectedName} Dashboard`}
              allow="fullscreen"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </>
  );
}
