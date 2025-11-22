"use client";
import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import ConfigurableChart from "@/components/stats/ConfigurableChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Save, Globe, Lock, Copy, Check, Pencil, Loader2, Heart, Share2, Eye, CalendarIcon, RefreshCw, LayoutDashboard } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { LoginModal } from "@/components/login/LoginModal";

interface ChartConfig {
  id: string;
  title: string;
  colSpan: 6 | 12;
  dataSeries?: any[]; // DataSeries array from ConfigurableChart
  stackSameMetrics?: boolean;
  startTime?: string | null; // Local start time filter (ISO string)
  endTime?: string | null; // Local end time filter (ISO string)
}

function PlaygroundContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const playgroundId = searchParams.get("id");
  const { openLoginModal } = useLoginModalTrigger();
  
  const [playgroundName, setPlaygroundName] = useState("");
  const [savedPlaygroundName, setSavedPlaygroundName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [savedIsPublic, setSavedIsPublic] = useState(false);
  const [savedLink, setSavedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPlaygroundId, setCurrentPlaygroundId] = useState<string | null>(playgroundId);
  const [isOwner, setIsOwner] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [creator, setCreator] = useState<{
    id: string;
    name: string | null;
    user_name: string | null;
    image: string | null;
    profile_privacy: string | null;
  } | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  // Global time filters - ISO strings are the source of truth
  const [globalStartTime, setGlobalStartTime] = useState<string | null>(null);
  const [globalEndTime, setGlobalEndTime] = useState<string | null>(null);
  const [savedGlobalStartTime, setSavedGlobalStartTime] = useState<string | null>(null);
  const [savedGlobalEndTime, setSavedGlobalEndTime] = useState<string | null>(null);
  
  // Temporary state for editing (only used when popover is open) - includes date and time
  const [tempGlobalStartTime, setTempGlobalStartTime] = useState<Date | undefined>(undefined);
  const [tempGlobalEndTime, setTempGlobalEndTime] = useState<Date | undefined>(undefined);
  
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  const [showGlobalTimeFilterPopover, setShowGlobalTimeFilterPopover] = useState(false);
  
  // Derive date range and time strings from ISO strings
  const globalDateRange = useMemo<{ from: Date | undefined; to: Date | undefined }>(() => {
    if (globalStartTime && globalEndTime) {
      return {
        from: new Date(globalStartTime),
        to: new Date(globalEndTime),
      };
    }
    return { from: undefined, to: undefined };
  }, [globalStartTime, globalEndTime]);
  
  const globalStartTimeStr = useMemo(() => {
    return globalStartTime ? new Date(globalStartTime).toTimeString().slice(0, 5) : "00:00";
  }, [globalStartTime]);
  
  const globalEndTimeStr = useMemo(() => {
    return globalEndTime ? new Date(globalEndTime).toTimeString().slice(0, 5) : "23:59";
  }, [globalEndTime]);
  const hasLoadedRef = useRef(false);
  
  const initialCharts: ChartConfig[] = [
    { id: "1", title: "Chart 1", colSpan: 6, dataSeries: [] },
  ];
  const [charts, setCharts] = useState<ChartConfig[]>(initialCharts);
  const [savedCharts, setSavedCharts] = useState<ChartConfig[]>(initialCharts);
  const [searchTerm, setSearchTerm] = useState("");

  const handleColSpanChange = useCallback((chartId: string, newColSpan: 6 | 12) => {
    setCharts((prev) =>
      prev.map((chart) =>
        chart.id === chartId ? { ...chart, colSpan: newColSpan } : chart
      )
    );
  }, []);

  // Memoized callbacks for chart updates
  const handleTitleChange = useCallback((chartId: string, newTitle: string) => {
    setCharts((prev) =>
      prev.map((c) =>
        c.id === chartId ? { ...c, title: newTitle } : c
      )
    );
  }, []);

  const handleDataSeriesChange = useCallback((chartId: string, dataSeries: any[]) => {
    setCharts((prev) => {
      const currentChart = prev.find(c => c.id === chartId);
      // Only update if dataSeries actually changed
      if (currentChart && JSON.stringify(currentChart.dataSeries) === JSON.stringify(dataSeries)) {
        return prev;
      }
      return prev.map((c) =>
        c.id === chartId ? { ...c, dataSeries } : c
      );
    });
  }, []);

  const handleStackSameMetricsChange = useCallback((chartId: string, stackSameMetrics: boolean) => {
    setCharts((prev) =>
      prev.map((c) =>
        c.id === chartId ? { ...c, stackSameMetrics } : c
      )
    );
  }, []);

  const handleChartTimeFilterChange = useCallback((chartId: string, startTime: string | null, endTime: string | null) => {
    setCharts((prev) =>
      prev.map((c) =>
        c.id === chartId ? { ...c, startTime, endTime } : c
      )
    );
  }, []);

  const addChart = () => {
    const newId = String(charts.length + 1);
    setCharts([...charts, { id: newId, title: `Chart ${newId}`, colSpan: 12, dataSeries: [], stackSameMetrics: false }]);
  };

  const removeChart = (chartId: string) => {
    setCharts((prev) => {
      // If this is the last chart, create a new blank one instead of removing it
      if (prev.length === 1) {
        const newId = String(prev.length + 1);
        return [{ id: newId, title: `Blank Chart`, colSpan: 6, dataSeries: [], stackSameMetrics: false }];
      }
      // Otherwise, remove the chart normally
      return prev.filter((chart) => chart.id !== chartId);
    });
  };

  // Load playground data if ID is provided
  useEffect(() => {
    const loadPlayground = async () => {
      if (!playgroundId || hasLoadedRef.current) return;
      
      // Allow loading for public playgrounds even without auth
      if (status === "loading") return;
      
      hasLoadedRef.current = true;
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/playground?id=${playgroundId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError("Playground not found");
          } else {
            throw new Error("Failed to load playground");
          }
          return;
        }
        
        const playground = await response.json();
        setPlaygroundName(playground.name);
        setSavedPlaygroundName(playground.name);
        setIsPublic(playground.is_public);
        setSavedIsPublic(playground.is_public);
        setCurrentPlaygroundId(playground.id);
        setIsOwner(playground.is_owner || false);
        setIsFavorited(playground.is_favorited || false);
        setFavoriteCount(playground.favorite_count || 0);
        setViewCount(playground.view_count || 0);
        setCreator(playground.creator || null);
        setCreatedAt(playground.created_at || null);
        setUpdatedAt(playground.updated_at || null);
        
        // Load global time filters
        const startTime = playground.globalStartTime || null;
        const endTime = playground.globalEndTime || null;
        setGlobalStartTime(startTime);
        setGlobalEndTime(endTime);
        setSavedGlobalStartTime(startTime);
        setSavedGlobalEndTime(endTime);
        
        // Initialize temp state from loaded times
        if (startTime && endTime) {
          setTempGlobalStartTime(new Date(startTime));
          setTempGlobalEndTime(new Date(endTime));
        } else {
          setTempGlobalStartTime(undefined);
          setTempGlobalEndTime(undefined);
        }
        
        // Load charts from saved data
        if (playground.charts && Array.isArray(playground.charts)) {
          const loadedCharts = playground.charts.map((chart: any, index: number) => ({
            id: chart.id || String(index + 1),
            title: chart.title || `Chart ${index + 1}`,
            colSpan: chart.colSpan || 12,
            dataSeries: chart.dataSeries || [],
            stackSameMetrics: chart.stackSameMetrics || false,
            startTime: chart.startTime || null,
            endTime: chart.endTime || null
          }));
          setCharts(loadedCharts);
          setSavedCharts(loadedCharts.map((chart: ChartConfig) => ({
            ...chart,
            dataSeries: chart.dataSeries ? [...chart.dataSeries] : []
          })));
        }
        
        // Set shareable link
        const link = `${window.location.origin}/stats/playground?id=${playground.id}`;
        setSavedLink(link);
      } catch (err) {
        console.error("Error loading playground:", err);
        setError(err instanceof Error ? err.message : "Failed to load playground");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPlayground();
  }, [playgroundId, status]);

  // Reset hasLoadedRef when playgroundId changes
  useEffect(() => {
    hasLoadedRef.current = false;
  }, [playgroundId]);

  // Reset all state when navigating to blank playground (no ID)
  useEffect(() => {
    if (!playgroundId) {
      setPlaygroundName("");
      setSavedPlaygroundName("");
      setIsPublic(false);
      setSavedIsPublic(false);
      setSavedLink(null);
      setCurrentPlaygroundId(null);
      setIsOwner(true);
      setIsFavorited(false);
      setFavoriteCount(0);
      setViewCount(0);
      setCreator(null);
      setCreatedAt(null);
      setUpdatedAt(null);
      setGlobalStartTime(null);
      setGlobalEndTime(null);
      setSavedGlobalStartTime(null);
      setSavedGlobalEndTime(null);
      setTempGlobalStartTime(undefined);
      setTempGlobalEndTime(undefined);
      // Create new chart objects to ensure React detects the change and remounts ConfigurableChart
      const resetCharts: ChartConfig[] = [
        { id: `chart-${Date.now()}`, title: "Chart 1", colSpan: 6, dataSeries: [], stackSameMetrics: false }
      ];
      setCharts(resetCharts);
      setSavedCharts(resetCharts.map(chart => ({ ...chart })));
      setError(null);
    }
  }, [playgroundId]);

  // Initialize temp state when popover opens
  useEffect(() => {
    if (showGlobalTimeFilterPopover) {
      setTempGlobalStartTime(globalStartTime ? new Date(globalStartTime) : undefined);
      setTempGlobalEndTime(globalEndTime ? new Date(globalEndTime) : undefined);
    }
  }, [showGlobalTimeFilterPopover, globalStartTime, globalEndTime]);


  // Track view count when playground loads (only for non-owners)
  useEffect(() => {
    if (!currentPlaygroundId || isOwner) return;
    
    // Use sessionStorage to prevent duplicate counts from same session
    const viewKey = `playground_view_${currentPlaygroundId}`;
    const hasViewed = sessionStorage.getItem(viewKey);
    
    if (!hasViewed) {
      // Track view asynchronously without blocking
      fetch(`/api/playground/${currentPlaygroundId}/view`, {
        method: 'POST',
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.view_count !== undefined) {
            setViewCount(data.view_count);
            sessionStorage.setItem(viewKey, 'true');
          }
        })
        .catch(err => {
          console.error('Failed to track view:', err);
          // Silently fail - don't disrupt user experience
        });
    }
  }, [currentPlaygroundId, isOwner]);

  const handleSave = async () => {
    console.log("handleSave", status);
    if (status === "unauthenticated") {
      const callbackUrl = window.location.pathname + window.location.search;
      openLoginModal(callbackUrl);
      return;
    }
    
    if (status === "loading") {
      return; // Wait for authentication status to be determined
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const payload = {
        name: playgroundName,
        isPublic,
        globalStartTime: globalStartTime || null,
        globalEndTime: globalEndTime || null,
        charts: charts.map(chart => ({
          id: chart.id,
          title: chart.title,
          colSpan: chart.colSpan,
          dataSeries: chart.dataSeries || [],
          stackSameMetrics: chart.stackSameMetrics || false,
          startTime: chart.startTime || null,
          endTime: chart.endTime || null
        }))
      };
      
      let response;
      if (currentPlaygroundId) {
        // Update existing playground
        response = await fetch("/api/playground", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentPlaygroundId,
            ...payload
          })
        });
      } else {
        // Create new playground
        response = await fetch("/api/playground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save playground");
      }
      
      const playground = await response.json();
      
      // Update saved state
      setSavedCharts(charts.map(chart => ({
        ...chart,
        dataSeries: chart.dataSeries ? [...chart.dataSeries] : []
      })));
      setSavedPlaygroundName(playgroundName);
      setSavedIsPublic(isPublic);
      setSavedGlobalStartTime(globalStartTime);
      setSavedGlobalEndTime(globalEndTime);
      setCurrentPlaygroundId(playground.id);
      
      // Update URL and link
      const link = `${window.location.origin}/stats/playground?id=${playground.id}`;
      setSavedLink(link);
      router.replace(`/stats/playground?id=${playground.id}`, { scroll: false });
      setLinkCopied(false);
    } catch (err) {
      console.error("Error saving playground:", err);
      setError(err instanceof Error ? err.message : "Failed to save playground");
    } finally {
      setIsSaving(false);
    }
  };

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    // Check if name changed
    if (playgroundName !== savedPlaygroundName) return true;
    
    // Check if public/private changed
    if (isPublic !== savedIsPublic) return true;
    
    // Check if global time filters changed
    if (globalStartTime !== savedGlobalStartTime || globalEndTime !== savedGlobalEndTime) return true;
    
    // Check if charts changed (count, titles, colSpans, or dataSeries)
    if (charts.length !== savedCharts.length) return true;
    
    for (let i = 0; i < charts.length; i++) {
      const current = charts[i];
      const saved = savedCharts[i];
      if (!saved || current.id !== saved.id || current.title !== saved.title || current.colSpan !== saved.colSpan || current.stackSameMetrics !== saved.stackSameMetrics || current.startTime !== saved.startTime || current.endTime !== saved.endTime) {
        return true;
      }
      
      // Check if dataSeries changed
      const currentDataSeries = current.dataSeries || [];
      const savedDataSeries = saved.dataSeries || [];
      
      if (currentDataSeries.length !== savedDataSeries.length) return true;
      
      // Deep compare dataSeries
      const currentSorted = [...currentDataSeries].sort((a, b) => a.id.localeCompare(b.id));
      const savedSorted = [...savedDataSeries].sort((a, b) => a.id.localeCompare(b.id));
      
      for (let j = 0; j < currentSorted.length; j++) {
        const currentSeries = currentSorted[j];
        const savedSeries = savedSorted[j];
        
        if (!savedSeries || 
            currentSeries.id !== savedSeries.id ||
            currentSeries.name !== savedSeries.name ||
            currentSeries.color !== savedSeries.color ||
            currentSeries.yAxis !== savedSeries.yAxis ||
            currentSeries.visible !== savedSeries.visible ||
            currentSeries.chartStyle !== savedSeries.chartStyle ||
            currentSeries.chainId !== savedSeries.chainId ||
            currentSeries.metricKey !== savedSeries.metricKey ||
            currentSeries.zIndex !== savedSeries.zIndex) {
          return true;
        }
      }
    }
    
    return false;
  }, [charts, savedCharts, playgroundName, savedPlaygroundName, isPublic, savedIsPublic, globalStartTime, globalEndTime, savedGlobalStartTime, savedGlobalEndTime]);

  const copyLink = async () => {
    if (savedLink) {
      await navigator.clipboard.writeText(savedLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const shareOnX = () => {
    if (savedLink) {
      const text = isOwner 
        ? `check out my @avax ecosystem dashboard`
        : `check out this @avax ecosystem dashboard`;
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(savedLink)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleFavorite = async () => {
    if (status === "unauthenticated") {
      const callbackUrl = window.location.pathname + window.location.search;
      openLoginModal(callbackUrl);
      return;
    }

    if (!currentPlaygroundId || isFavoriting) return;

    setIsFavoriting(true);
    try {
      if (isFavorited) {
        // Unfavorite
        const response = await fetch(`/api/playground/favorite?playgroundId=${currentPlaygroundId}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          throw new Error("Failed to unfavorite playground");
        }

        const data = await response.json();
        setIsFavorited(false);
        setFavoriteCount(data.favorite_count || favoriteCount - 1);
      } else {
        // Favorite
        const response = await fetch("/api/playground/favorite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playgroundId: currentPlaygroundId })
        });

        if (!response.ok) {
          throw new Error("Failed to favorite playground");
        }

        const data = await response.json();
        setIsFavorited(true);
        setFavoriteCount(data.favorite_count || favoriteCount + 1);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
      setError(err instanceof Error ? err.message : "Failed to update favorite");
    } finally {
      setIsFavoriting(false);
    }
  };

  const filteredCharts = charts.filter((chart) =>
    chart.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
        <div className="container mx-auto px-6 py-10 pb-24 space-y-8">
          {/* Header Skeleton */}
          <div className="mb-10">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="h-10 w-64 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse mb-2" />
                <div className="h-4 w-48 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse mt-2" />
                <div className="h-3 w-64 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse mt-2" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-9 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-9 w-16 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
                <div className="h-9 w-20 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Search Skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-10 flex-1 max-w-sm bg-gray-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>

          {/* Chart Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            <div className="lg:col-span-12">
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-lg p-6">
                <div className="h-6 w-48 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse mb-4" />
                <div className="h-80 bg-gray-100 dark:bg-neutral-900 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
    <LoginModal />
      <div className="container mx-auto px-6 py-10 pb-24 space-y-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 group">
                <h1
                  contentEditable={isOwner}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    if (!isOwner) return;
                    const newName = e.currentTarget.textContent || "My Playground";
                    setPlaygroundName(newName);
                    setIsEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (!isOwner) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                    if (e.key === "Escape") {
                      e.currentTarget.textContent = playgroundName;
                      e.currentTarget.blur();
                    }
                  }}
                  onFocus={() => {
                    if (isOwner) setIsEditingName(true);
                  }}
                  className="text-4xl sm:text-4xl font-semibold tracking-tight text-black dark:text-white outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded px-2 -mx-2 min-w-[200px]"
                  style={{
                    cursor: isOwner && isEditingName ? "text" : isOwner ? "pointer" : "default",
                  }}
                >
                  {playgroundName || "My Playground"}
                </h1>
                {isOwner && <Pencil className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />}
              </div>
              {creator && creator.profile_privacy === "public" && (
                <div className="flex items-center gap-2 mt-2">
                  {creator.image && (
                    <img
                      src={creator.image}
                      alt={creator.user_name || creator.name || "User"}
                      className="h-6 w-6 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {creator.user_name || creator.name || "Unknown User"}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2 mt-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 flex-wrap">
                {(createdAt || updatedAt) && (
                  <>
                    {createdAt && (
                      <span className="whitespace-nowrap">Created {new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    )}
                    {createdAt && updatedAt && (
                      <span className="text-gray-400 dark:text-gray-600 hidden sm:inline">•</span>
                    )}
                    {updatedAt && (
                      <span className="whitespace-nowrap">
                        {createdAt && <span className="text-gray-400 dark:text-gray-600 sm:hidden mr-1.5">•</span>}
                        Updated {new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {isOwner && (
                <Button
                  onClick={() => {
                    if (status === "unauthenticated" || !session) {
                      const callbackUrl = "/stats/playground/my-dashboards";
                      openLoginModal(callbackUrl);
                    } else {
                      router.push("/stats/playground/my-dashboards");
                    }
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                  title="My Dashboards"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">My Dashboards</span>
                </Button>
              )}
            </div>
          </div>
          {!playgroundId && (
            <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
              Create and customize multiple charts with real-time chain metrics. Add metrics, configure visualizations, and share your insights.
            </p>
          )}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Search and Add Chart */}
        <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none z-10" />
              <Input
                placeholder="Search charts"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 pl-10 pr-10 rounded-lg border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-black dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full z-20 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {isOwner && (
              <>
                {/* Global Time Filters */}
                <Popover open={showGlobalTimeFilterPopover} onOpenChange={setShowGlobalTimeFilterPopover}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "relative flex items-center gap-2 px-3.5 h-10 rounded-lg border border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-black dark:text-white hover:bg-[#f5f5f6] dark:hover:bg-neutral-750 cursor-pointer",
                        (!globalDateRange.from && !globalDateRange.to) && "text-neutral-500 dark:text-neutral-400"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                      <span className="text-sm whitespace-nowrap">
                        {tempGlobalStartTime && tempGlobalEndTime
                          ? `${format(tempGlobalStartTime, "MMM d")} - ${format(tempGlobalEndTime, "MMM d")}`
                          : tempGlobalStartTime
                          ? format(tempGlobalStartTime, "PPP")
                          : globalDateRange.from && globalDateRange.to
                          ? `${format(globalDateRange.from, "MMM d")} - ${format(globalDateRange.to, "MMM d")}`
                          : globalDateRange.from
                          ? format(globalDateRange.from, "PPP")
                          : "Select date range"}
                      </span>
                      {(globalStartTime || globalEndTime || tempGlobalStartTime || tempGlobalEndTime) && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            // Clear temp state
                            setTempGlobalStartTime(undefined);
                            setTempGlobalEndTime(undefined);
                            // Clear actual state
                            setGlobalStartTime(null);
                            setGlobalEndTime(null);
                            // Trigger reload and close popover
                            setReloadTrigger(prev => prev + 1);
                            setShowGlobalTimeFilterPopover(false);
                          }}
                          className="ml-1 h-6 w-6 flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors cursor-pointer"
                          aria-label="Clear date filter"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              // Clear temp state
                              setTempGlobalStartTime(undefined);
                              setTempGlobalEndTime(undefined);
                              // Clear actual state
                              setGlobalStartTime(null);
                              setGlobalEndTime(null);
                              // Trigger reload and close popover
                              setReloadTrigger(prev => prev + 1);
                              setShowGlobalTimeFilterPopover(false);
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{
                        from: tempGlobalStartTime,
                        to: tempGlobalEndTime,
                      }}
                      onSelect={(range) => {
                        // Update dates, preserving existing times if dates already exist
                        if (range?.from) {
                          const newDate = new Date(range.from);
                          if (tempGlobalStartTime) {
                            // Preserve time from existing tempGlobalStartTime
                            newDate.setHours(tempGlobalStartTime.getHours(), tempGlobalStartTime.getMinutes(), 0, 0);
                          } else {
                            // Default to 00:00 if no existing time
                            newDate.setHours(0, 0, 0, 0);
                          }
                          setTempGlobalStartTime(newDate);
                        } else {
                          setTempGlobalStartTime(undefined);
                        }
                        
                        if (range?.to) {
                          const newDate = new Date(range.to);
                          if (tempGlobalEndTime) {
                            // Preserve time from existing tempGlobalEndTime
                            newDate.setHours(tempGlobalEndTime.getHours(), tempGlobalEndTime.getMinutes(), 0, 0);
                          } else {
                            // Default to 23:59 if no existing time
                            newDate.setHours(23, 59, 0, 0);
                          }
                          setTempGlobalEndTime(newDate);
                        } else {
                          setTempGlobalEndTime(undefined);
                        }
                      }}
                      initialFocus
                    />
                    <div className="p-3 border-t space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap min-w-[50px]">Start:</label>
                        <Input
                          type="time"
                          value={tempGlobalStartTime ? tempGlobalStartTime.toTimeString().slice(0, 5) : "00:00"}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(":").map(Number);
                            if (tempGlobalStartTime) {
                              const updated = new Date(tempGlobalStartTime);
                              updated.setHours(hours, minutes, 0, 0);
                              setTempGlobalStartTime(updated);
                            } else {
                              // If no date selected, create a new date with today's date
                              const today = new Date();
                              today.setHours(hours, minutes, 0, 0);
                              setTempGlobalStartTime(today);
                            }
                          }}
                          className="text-xs sm:text-sm"
                          disabled={!tempGlobalStartTime}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap min-w-[50px]">End:</label>
                        <Input
                          type="time"
                          value={tempGlobalEndTime ? tempGlobalEndTime.toTimeString().slice(0, 5) : "23:59"}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(":").map(Number);
                            if (tempGlobalEndTime) {
                              const updated = new Date(tempGlobalEndTime);
                              updated.setHours(hours, minutes, 0, 0);
                              setTempGlobalEndTime(updated);
                            } else {
                              // If no date selected, create a new date with today's date
                              const today = new Date();
                              today.setHours(hours, minutes, 0, 0);
                              setTempGlobalEndTime(today);
                            }
                          }}
                          className="text-xs sm:text-sm"
                          disabled={!tempGlobalEndTime}
                        />
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <Button
                          onClick={() => {
                            // Convert Date objects to ISO strings
                            const newStartTime = tempGlobalStartTime ? tempGlobalStartTime.toISOString() : null;
                            const newEndTime = tempGlobalEndTime ? tempGlobalEndTime.toISOString() : null;
                            
                            // Apply to actual state
                            setGlobalStartTime(newStartTime);
                            setGlobalEndTime(newEndTime);
                            
                            // Trigger reload and close popover
                            setReloadTrigger(prev => prev + 1);
                            setShowGlobalTimeFilterPopover(false);
                          }}
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                          title="Reload data"
                        >
                          <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                          Reload
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
              {isOwner ? (
                <>
                  <Button
                    onClick={addChart}
                    className="flex-shrink-0 bg-black dark:bg-white text-white dark:text-black transition-colors hover:bg-neutral-800 dark:hover:bg-neutral-200"
                  >
                    Add New Chart
                  </Button>
                  {savedLink && (
                  <>
                    <button
                      onClick={copyLink}
                      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                      title={linkCopied ? "Link copied!" : "Copy shareable link"}
                    >
                      {linkCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={shareOnX}
                      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                      title="Share on X (Twitter)"
                    >
                      <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                  </>
                )}
                {currentPlaygroundId && (
                  <>
                    <Button
                      onClick={handleFavorite}
                      disabled={true}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 h-auto transition-colors opacity-60 cursor-not-allowed ${
                        isFavorited
                          ? "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                          : "bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-neutral-700"
                      }`}
                      title="Favorite count"
                    >
                      <Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isFavorited ? "fill-current" : ""}`} />
                      {favoriteCount > 0 && <span className="text-xs sm:text-sm">{favoriteCount}</span>}
                    </Button>
                    {viewCount > 0 && (
                      <Button
                        disabled={true}
                        className="flex-shrink-0 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 h-auto transition-colors opacity-60 cursor-not-allowed bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-neutral-700"
                        title="View count"
                      >
                        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="text-xs sm:text-sm">{viewCount.toLocaleString()}</span>
                      </Button>
                    )}
                  </>
                )}
                <Button
                  onClick={() => setIsPublic(!isPublic)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                  title={isPublic ? "Make private" : "Make public"}
                >
                  {isPublic ? (
                    <>
                      <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Public</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Private</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="flex-shrink-0 bg-black dark:bg-white text-white dark:text-black transition-colors hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed px-2 sm:px-3 py-1.5 sm:py-2 h-auto text-xs sm:text-sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2 animate-spin" />
                      <span className="hidden sm:inline">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Save</span>
                    </>
                  )}
                </Button>
                </>
              ) : (
                <>
                  {savedLink && (
                  <>
                    <button
                      onClick={copyLink}
                      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                      title={linkCopied ? "Link copied!" : "Copy shareable link"}
                    >
                      {linkCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={shareOnX}
                      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                      title="Share on X (Twitter)"
                    >
                      <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                  </>
                )}
                {currentPlaygroundId && (
                  <>
                    <Button
                      onClick={handleFavorite}
                      disabled={isFavoriting}
                      className={`flex-shrink-0 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 h-auto transition-colors ${
                        isFavorited
                          ? "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200 dark:border-red-800"
                          : "bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700 border border-gray-200 dark:border-neutral-700"
                      }`}
                    >
                      {isFavoriting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                        </>
                      ) : (
                        <>
                          <Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isFavorited ? "fill-current" : ""}`} />
                          {favoriteCount > 0 && <span className="text-xs sm:text-sm">{favoriteCount}</span>}
                        </>
                      )}
                    </Button>
                    {viewCount > 0 && (
                      <Button
                        disabled={true}
                        className="flex-shrink-0 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 h-auto transition-colors opacity-60 cursor-not-allowed bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-neutral-700"
                        title="View count"
                      >
                        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="text-xs sm:text-sm">{viewCount.toLocaleString()}</span>
                      </Button>
                    )}
                  </>
                )}
                </>
              )}
            </div>
          </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {filteredCharts.map((chart) => (
            <div
              key={`${playgroundId || 'new'}-${chart.id}`}
              className={chart.colSpan === 6 ? "lg:col-span-6" : "lg:col-span-12"}
            >
              <ConfigurableChart
                title={chart.title}
                colSpan={chart.colSpan}
                initialDataSeries={chart.dataSeries || []}
                initialStackSameMetrics={chart.stackSameMetrics || false}
                onColSpanChange={isOwner ? (newColSpan) => handleColSpanChange(chart.id, newColSpan) : undefined}
                onTitleChange={isOwner ? (newTitle) => handleTitleChange(chart.id, newTitle) : undefined}
                onDataSeriesChange={isOwner ? (dataSeries) => handleDataSeriesChange(chart.id, dataSeries) : undefined}
                onStackSameMetricsChange={isOwner ? (stackSameMetrics) => handleStackSameMetricsChange(chart.id, stackSameMetrics) : undefined}
                onRemove={isOwner ? () => removeChart(chart.id) : undefined}
                disableControls={!isOwner}
                startTime={chart.startTime || globalStartTime || null}
                endTime={chart.endTime || globalEndTime || null}
                onTimeFilterChange={isOwner ? (startTime, endTime) => handleChartTimeFilterChange(chart.id, startTime, endTime) : undefined}
                reloadTrigger={reloadTrigger}
              />
            </div>
          ))}
        </div>

        {filteredCharts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-600 dark:text-neutral-400">
              No charts found matching "{searchTerm}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
        <div className="container mx-auto px-6 py-10 pb-24 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    }>
      <PlaygroundContent />
    </Suspense>
  );
}

