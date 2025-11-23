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
import { toast } from "@/lib/toast";

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
    if (!isPublic) {
      toast.warning("Make dashboard public first", "Please make this dashboard public to share it with others.");
      return;
    }
    if (savedLink) {
      await navigator.clipboard.writeText(savedLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast.success("Link copied!");
    }
  };

  const shareOnX = () => {
    if (!isPublic) {
      toast.warning("Make dashboard public first", "Please make this dashboard public to share it with others.");
      return;
    }
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
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8 relative">
    <LoginModal />
      {/* Background decoration */}
      <span
        className="absolute inset-0 z-0 h-[32rem] overflow-hidden pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(49.63% 57.02% at 58.99% -7.2%, hsl(var(--primary)/0.1) 39.4%, transparent 100%)',
        }}
      >
          <svg
            width="790"
            height="640"
            viewBox="0 0 790 718"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute -top-16 left-0"
          >
          <mask
            id="mask-dark-playground"
            style={{
              maskType: 'alpha',
            }}
            maskUnits="userSpaceOnUse"
            x="0"
            y="-143"
            width="936"
            height="861"
          >
            <ellipse cx="468.373" cy="287.536" rx="467.627" ry="430.464" fill="url(#radial-dark-playground)" />
          </mask>
          <g mask="url(#mask-dark-playground)" className="fill-primary">
            <path d="M506.419 281.855L446.417 297.931V359.885L506.419 343.71V281.855Z" fillOpacity="0.05" />
            <path d="M384.768 188.752L324.766 204.828V266.781L384.768 250.606V188.752Z" fillOpacity="0.05" />
            <path d="M263.625 347.002L203.623 363.078V425.031L263.625 408.856V347.002Z" fillOpacity="0.05" />
            <path d="M385.089 440.096L325.087 456.172V518.125L385.089 501.95V440.096Z" fillOpacity="0.05" />
            <path d="M627.756 123.527L567.754 139.603V201.557L627.756 185.382V123.527Z" fillOpacity="0.05" />
            <path d="M445.32 46.918L385.318 62.994V124.947L445.32 108.772V46.918Z" fillOpacity="0.05" />
            <path d="M749.192 279.59L689.19 295.666V357.619L749.192 341.444V279.59Z" fillOpacity="0.05" />
            <path d="M627.905 437.912L567.903 453.988V515.941L627.905 499.766V437.912Z" fillOpacity="0.05" />
            <path d="M202.491 175.656L142.489 191.732V253.685L202.491 237.511V175.656Z" fillOpacity="0.05" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M446.54 -79.1784L949.537 -213.956L949.278 -214.922L446.54 -80.2137V-87.9997H445.54V-79.9457L385.832 -63.947V-87.9997H384.832V-63.679L325.124 -47.6803V-87.9997H324.124V-47.4124L264.416 -31.4137V-87.9997H263.416V-31.1457L203.708 -15.147L203.708 -87.9997H202.708L202.708 -14.8791L143 1.11966L143 -87.9997H142L142 1.3876L-80.8521 61.1006L-80.5932 62.0666L142 2.42287V64.2363L-65.1402 119.739L-64.8814 120.705L142 65.2715L142 127.085L-49.4278 178.378L-49.1689 179.344L142 128.12V189.936L-33.7155 237.019L-33.4566 237.985L142 190.971V252.787L-18.0025 295.659L-17.7437 296.625L142 253.822V315.635L-2.29068 354.298L-2.03186 355.264L142 316.671V378.484L13.4218 412.937L13.6806 413.903L142 379.519V441.335L29.1341 471.577L29.3929 472.543L142 442.37V504.184L44.8466 530.216L45.1054 531.182L142 505.219V567.032L60.5591 588.855L60.8179 589.82L142 568.068V629.881L76.2715 647.493L76.5303 648.459L142 630.917V692.732L91.9838 706.134L92.2426 707.1L142 693.767V698.42H143V693.499L202.708 677.501V698.42H203.708V677.233L263.416 661.234V698.42H264.416V660.966L324.124 644.967V698.42H325.124V644.699L384.832 628.701V690.514L107.696 764.773L107.954 765.738L384.832 691.549V698.42H385.832V691.281L445.54 675.283V698.42H446.54V675.015L506.248 659.016V698.42H507.248V658.748L566.956 642.749V698.42H567.956V642.481L627.664 626.483V688.298L123.409 823.413L123.667 824.379L627.664 689.334V698.42H628.664V689.066L688.372 673.067V698.42H689.372V672.799L749.08 656.8V698.42H750.08V656.532L809.788 640.534V698.42H810.788V640.266L870.496 624.267V698.42H871.496V623.999L931.204 608V698.42H932.204V607.732L1153.8 548.357L1153.54 547.391L932.204 606.697V544.881L1138.08 489.716L1137.83 488.75L932.204 543.846V482.033L1122.37 431.077L1122.11 430.111L932.204 480.997V419.182L1106.66 372.437L1106.4 371.471L932.204 418.147V356.333L1090.95 313.798L1090.69 312.832L932.204 355.298V293.484L1075.24 255.159L1074.98 254.193L932.204 292.449V230.636L1059.52 196.521L1059.26 195.555L932.204 229.6V167.785L1043.81 137.88L1043.55 136.914L932.204 166.75V104.936L1028.1 79.2413L1027.84 78.2754L932.204 103.901V42.0874L1012.39 20.6027L1012.13 19.6367L932.204 41.0522V-20.7634L996.674 -38.0379L996.415 -39.0039L932.204 -21.7987L932.204 -83.6142L980.961 -96.6786L980.702 -97.6445L932.204 -84.6495V-87.9997H931.204V-84.3815L871.496 -68.3828V-87.9997H870.496V-68.1149L810.788 -52.1161V-87.9997H809.788V-51.8482L750.08 -35.8495V-87.9997H749.08V-35.5815L689.372 -19.5828L689.372 -81.3963L965.249 -155.317L964.99 -156.283L689.372 -82.4316V-87.9997H688.372V-82.1637L628.664 -66.1649V-87.9997H627.664V-65.897L567.956 -49.8983V-87.9997H566.956V-49.6303L507.248 -33.6316V-87.9997H506.248V-33.3637L446.54 -17.365L446.54 -79.1784ZM445.54 -78.9104L385.832 -62.9117L385.832 -1.09831L445.54 -17.097L445.54 -78.9104ZM384.832 -62.6438L325.124 -46.6451L325.124 15.1684L384.832 -0.830353L384.832 -62.6438ZM324.124 -46.3771L264.416 -30.3784L264.416 31.435L324.124 15.4363L324.124 -46.3771ZM263.416 -30.1104L203.708 -14.1117V47.7017L263.416 31.703L263.416 -30.1104ZM202.708 -13.8438L143 2.15492V63.9683L202.708 47.9696V-13.8438ZM628.664 -65.1297L688.372 -81.1284L688.372 -19.3149L628.664 -3.31616L628.664 -65.1297ZM567.956 -48.863L627.664 -64.8617L627.664 -3.04822L567.956 12.9505L567.956 -48.863ZM507.248 -32.5964L566.956 -48.5951L566.956 13.2184L507.248 29.2172L507.248 -32.5964ZM446.54 -16.3297L506.248 -32.3284L506.248 29.4851L446.54 45.4838V-16.3297ZM385.832 -0.0630493L445.54 -16.0618V45.7517L385.832 61.7505V-0.0630493ZM325.124 16.2036L384.832 0.20491V62.0184L325.124 78.0171V16.2036ZM264.416 32.4703L324.124 16.4716V78.2851L264.416 94.2838V32.4703ZM203.708 48.7369L263.416 32.7382V94.5517L203.708 110.55V48.7369ZM143 65.0036L202.708 49.0049V110.818L143 126.817L143 65.0036ZM931.204 -83.3463L871.496 -67.3475L871.496 -5.53207L931.204 -21.5308L931.204 -83.3463ZM870.496 -67.0796L810.788 -51.0809L810.788 10.7346L870.496 -5.26411L870.496 -67.0796ZM809.788 -50.8129L750.08 -34.8142L750.08 27.0013L809.788 11.0025L809.788 -50.8129ZM749.08 -34.5463L689.372 -18.5476V43.2679L749.08 27.2692L749.08 -34.5463ZM688.372 -18.2796L628.664 -2.2809V59.5346L688.372 43.5359V-18.2796ZM627.664 -2.01295L567.956 13.9858V75.8012L627.664 59.8025V-2.01295ZM566.956 14.2537L507.248 30.2524V92.0679L566.956 76.0692V14.2537ZM506.248 30.5204L446.54 46.5191V108.335L506.248 92.3358V30.5204ZM445.54 46.787L385.832 62.7857V124.601L445.54 108.603V46.787ZM384.832 63.0537L325.124 79.0524V140.868L384.832 124.869V63.0537ZM324.124 79.3203L264.416 95.319V157.135L324.124 141.136V79.3203ZM263.416 95.587L203.708 111.586V173.401L263.416 157.402V95.587ZM202.708 111.854L143 127.852V189.668L202.708 173.669V111.854ZM871.496 -4.49677L931.204 -20.4955V41.3201L871.496 57.3188V-4.49677ZM810.788 11.7699L870.496 -4.22882V57.5868L810.788 73.5855V11.7699ZM750.08 28.0365L809.788 12.0378V73.8534L750.08 89.8521V28.0365ZM689.372 44.3032L749.08 28.3045V90.1201L689.372 106.119V44.3032ZM628.664 60.5699L688.372 44.5711V106.387L628.664 122.385V60.5699ZM567.956 76.8365L627.664 60.8378V122.653L567.956 138.652V76.8365ZM507.248 93.1032L566.956 77.1045V138.92L507.248 154.919V93.1032ZM446.54 109.37L506.248 93.3711V155.187L446.54 171.185V109.37ZM385.832 125.636L445.54 109.638V171.453L385.832 187.452V125.636ZM325.124 141.903L384.832 125.904V187.72L325.124 203.719V141.903ZM264.416 158.17L324.124 142.171V203.987L264.416 219.985V158.17ZM203.708 174.436L263.416 158.438V220.253L203.708 236.252V174.436ZM143 190.703L202.708 174.704V236.52L143 252.519V190.703ZM143 253.554V315.367L202.708 299.369V237.555L143 253.554ZM203.708 237.287V299.101L263.416 283.102V221.289L203.708 237.287ZM264.416 221.021V282.834L324.124 266.835V205.022L264.416 221.021ZM325.124 204.754V266.567L384.832 250.569V188.755L325.124 204.754ZM385.832 188.487V250.301L445.54 234.302V172.489L385.832 188.487ZM446.54 172.221V234.034L506.248 218.035V156.222L446.54 172.221ZM507.248 155.954V217.767L566.956 201.769V139.955L507.248 155.954ZM567.956 139.687V201.501L627.664 185.502V123.689L567.956 139.687ZM628.664 123.421V185.234L688.372 169.235V107.422L628.664 123.421ZM689.372 107.154V168.967L749.08 152.969V91.1554L689.372 107.154ZM750.08 90.8874V152.701L809.788 136.702V74.8887L750.08 90.8874ZM810.788 74.6208V136.434L870.496 120.435V58.622L810.788 74.6208ZM871.496 58.3541V120.167L931.204 104.169V42.3554L871.496 58.3541ZM871.496 121.203L931.204 105.204V167.018L871.496 183.016V121.203ZM810.788 137.469L870.496 121.471V183.284L810.788 199.283V137.469ZM750.08 153.736L809.788 137.737V199.551L750.08 215.55V153.736ZM689.372 170.003L749.08 154.004V215.818L689.372 231.816V170.003ZM628.664 186.269L688.372 170.271V232.084L628.664 248.083V186.269ZM567.956 202.536L627.664 186.537V248.351L567.956 264.35V202.536ZM507.248 218.803L566.956 202.804V264.617L507.248 280.616V218.803ZM446.54 235.069L506.248 219.071V280.884L446.54 296.883V235.069ZM385.832 251.336L445.54 235.337V297.151L385.832 313.15V251.336ZM325.124 267.603L384.832 251.604V313.417L325.124 329.416V267.603ZM264.416 283.869L324.124 267.871V329.684L264.416 345.683V283.869ZM203.708 300.136L263.416 284.137V345.951L203.708 361.95V300.136ZM143 316.403L202.708 300.404V362.217L143 378.216V316.403ZM143 379.251V441.067L202.708 425.068V363.253L143 379.251ZM203.708 362.985V424.8L263.416 408.802V346.986L203.708 362.985ZM264.416 346.718V408.534L324.124 392.535V330.719L264.416 346.718ZM325.124 330.451V392.267L384.832 376.268V314.453L325.124 330.451ZM385.832 314.185V376L445.54 360.002V298.186L385.832 314.185ZM446.54 297.918V359.734L506.248 343.735V281.919L446.54 297.918ZM507.248 281.651V343.467L566.956 327.468V265.653L507.248 281.651ZM567.956 265.385V327.2L627.664 311.202V249.386L567.956 265.385ZM628.664 249.118V310.934L688.372 294.935V233.119L628.664 249.118ZM689.372 232.852V294.667L749.08 278.668V216.853L689.372 232.852ZM750.08 216.585V278.4L809.788 262.402V200.586L750.08 216.585ZM810.788 200.318V262.134L870.496 246.135V184.319L810.788 200.318ZM871.496 184.052V245.867L931.204 229.868V168.053L871.496 184.052ZM871.496 246.902L931.204 230.904V292.717L871.496 308.716V246.902ZM810.788 263.169L870.496 247.17V308.984L810.788 324.982V263.169ZM750.08 279.436L809.788 263.437V325.25L750.08 341.249V279.436ZM689.372 295.702L749.08 279.704V341.517L689.372 357.516V295.702ZM628.664 311.969L688.372 295.97V357.784L628.664 373.782V311.969ZM567.956 328.236L627.664 312.237V374.05L567.956 390.049V328.236ZM507.248 344.502L566.956 328.504V390.317L507.248 406.316V344.502ZM446.54 360.769L506.248 344.77V406.584L446.54 422.582V360.769ZM385.832 377.036L445.54 361.037V422.85L385.832 438.849V377.036ZM325.124 393.302L384.832 377.304V439.117L325.124 455.116V393.302ZM264.416 409.569L324.124 393.57V455.384L264.416 471.382V409.569ZM203.708 425.836L263.416 409.837V471.65L203.708 487.649V425.836ZM143 442.102L202.708 426.104V487.917L143 503.916V442.102ZM143 504.951V566.765L202.708 550.766V488.952L143 504.951ZM203.708 488.684V550.498L263.416 534.499V472.686L203.708 488.684ZM264.416 472.418V534.231L324.124 518.232V456.419L264.416 472.418ZM325.124 456.151V517.965L384.832 501.966V440.152L325.124 456.151ZM385.832 439.884V501.698L445.54 485.699V423.886L385.832 439.884ZM446.54 423.618V485.431L506.248 469.433V407.619L446.54 423.618ZM507.248 407.351V469.165L566.956 453.166V391.352L507.248 407.351ZM567.956 391.084V452.898L627.664 436.899V375.086L567.956 391.084ZM628.664 374.818V436.631L688.372 420.633V358.819L628.664 374.818ZM689.372 358.551V420.365L749.08 404.366V342.552L689.372 358.551ZM750.08 342.284V404.098L809.788 388.099V326.286L750.08 342.284ZM810.788 326.018V387.831L870.496 371.833V310.019L810.788 326.018ZM871.496 309.751V371.565L931.204 355.566V293.752L871.496 309.751ZM871.496 372.6L931.204 356.601V418.415L871.496 434.413V372.6ZM810.788 388.867L870.496 372.868V434.681L810.788 450.68V388.867ZM750.08 405.133L809.788 389.135V450.948L750.08 466.947V405.133ZM689.372 421.4L749.08 405.401V467.215L689.372 483.213V421.4ZM628.664 437.667L688.372 421.668V483.481L628.664 499.48V437.667ZM567.956 453.933L627.664 437.935V499.748L567.956 515.747V453.933ZM507.248 470.2L566.956 454.201V516.015L507.248 532.013V470.2ZM446.54 486.467L506.248 470.468V532.281L446.54 548.28V486.467ZM385.832 502.733L445.54 486.734V548.548L385.832 564.547V502.733ZM325.124 519L384.832 503.001V564.815L325.124 580.813V519ZM264.416 535.267L324.124 519.268V581.081L264.416 597.08V535.267ZM203.708 551.533L263.416 535.534V597.348L203.708 613.347V551.533ZM143 567.8L202.708 551.801V613.615L143 629.613V567.8ZM143 630.649V692.464L202.708 676.465V614.65L143 630.649ZM203.708 614.382V676.197L263.416 660.199V598.383L203.708 614.382ZM264.416 598.115V659.931L324.124 643.932V582.117L264.416 598.115ZM325.124 581.849V643.664L384.832 627.665V565.85L325.124 581.849ZM385.832 565.582V627.397L445.54 611.399V549.583L385.832 565.582ZM446.54 549.315V611.131L506.248 595.132V533.317L446.54 549.315ZM507.248 533.049V594.864L566.956 578.865V517.05L507.248 533.049ZM567.956 516.782V578.597L627.664 562.599V500.783L567.956 516.782ZM628.664 500.515V562.331L688.372 546.332V484.517L628.664 500.515ZM689.372 484.249V546.064L749.08 530.065V468.25L689.372 484.249ZM750.08 467.982V529.797L809.788 513.799V451.983L750.08 467.982ZM810.788 451.715V513.531L870.496 497.532V435.717L810.788 451.715ZM871.496 435.449V497.264L931.204 481.265V419.45L871.496 435.449ZM385.832 690.246V628.433L445.54 612.434V674.247L385.832 690.246ZM446.54 673.979V612.166L506.248 596.167V657.981L446.54 673.979ZM507.248 657.713V595.899L566.956 579.901V641.714L507.248 657.713ZM567.956 641.446V579.633L627.664 563.634V625.447L567.956 641.446ZM628.664 625.18V563.366L688.372 547.367V609.181L628.664 625.18ZM689.372 608.913V547.099L749.08 531.101V592.914L689.372 608.913ZM750.08 592.646V530.833L809.788 514.834V576.647L750.08 592.646ZM810.788 576.38V514.566L870.496 498.567V560.381L810.788 576.38ZM871.496 560.113V498.299L931.204 482.301V544.114L871.496 560.113ZM628.664 626.215V688.03L688.372 672.032V610.216L628.664 626.215ZM689.372 609.948V671.764L749.08 655.765V593.949L689.372 609.948ZM750.08 593.681V655.497L809.788 639.498V577.683L750.08 593.681ZM810.788 577.415V639.23L870.496 623.232V561.416L810.788 577.415ZM871.496 561.148V622.964L931.204 606.965V545.149L871.496 561.148Z"
              fillOpacity="0.1"
            />
          </g>
          <defs>
            <radialGradient
              id="radial-dark-playground"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(468.373 287.536) rotate(90) scale(430.464 467.627)"
            >
              <stop stopColor="#D9D9D9" />
              <stop offset="1" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </span>
      <div className="container mx-auto px-6 py-10 pb-24 space-y-8 relative z-10">
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
              {/* Copy, Share, View count, Like count buttons */}
              {currentPlaygroundId && (
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {isPublic && savedLink && (
                    <>
                      <button
                        onClick={copyLink}
                        className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors cursor-pointer"
                        title={linkCopied ? "Link copied!" : "Copy shareable link"}
                      >
                        {linkCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={shareOnX}
                        className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors cursor-pointer"
                        title="Share on X (Twitter)"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Share</span>
                      </button>
                    </>
                  )}
                  {!isPublic && savedLink && (
                    <>
                      <button
                        onClick={copyLink}
                        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 transition-colors opacity-60 cursor-pointer"
                        title="Make public to copy link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </button>
                      <button
                        onClick={shareOnX}
                        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 transition-colors opacity-60 cursor-pointer"
                        title="Make public to share"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Share</span>
                      </button>
                    </>
                  )}
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    <Eye className="h-3.5 w-3.5" />
                    <span>{viewCount.toLocaleString()} views</span>
                  </div>
                  {isOwner ? (
                    <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                      <Heart className={`h-3.5 w-3.5 ${isFavorited ? "fill-current text-red-500" : ""}`} />
                      <span>{favoriteCount} likes</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleFavorite}
                      disabled={isFavoriting}
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        isFavorited
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      }`}
                      title={isFavorited ? "Unlike" : "Like"}
                    >
                      {isFavoriting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>...</span>
                        </>
                      ) : (
                        <>
                          <Heart className={`h-3.5 w-3.5 ${isFavorited ? "fill-current" : ""}`} />
                          <span>{favoriteCount} likes</span>
                        </>
                      )}
                    </button>
                  )}
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
              ) : null}
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

