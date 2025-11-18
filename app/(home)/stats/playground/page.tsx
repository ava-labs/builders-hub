"use client";
import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import ConfigurableChart from "@/components/stats/ConfigurableChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, Save, Globe, Lock, Copy, Check, Pencil, Loader2, Heart, Share2 } from "lucide-react";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { LoginModal } from "@/components/login/LoginModal";

interface ChartConfig {
  id: string;
  title: string;
  colSpan: 6 | 12;
  dataSeries?: any[]; // DataSeries array from ConfigurableChart
}

function PlaygroundContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const playgroundId = searchParams.get("id");
  const { openLoginModal } = useLoginModalTrigger();
  
  const [playgroundName, setPlaygroundName] = useState("My Playground");
  const [savedPlaygroundName, setSavedPlaygroundName] = useState("My Playground");
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
  const [creator, setCreator] = useState<{
    id: string;
    name: string | null;
    user_name: string | null;
    image: string | null;
    profile_privacy: string | null;
  } | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
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

  const addChart = () => {
    const newId = String(charts.length + 1);
    setCharts([...charts, { id: newId, title: `Chart ${newId}`, colSpan: 12 }]);
  };

  const removeChart = (chartId: string) => {
    setCharts((prev) => prev.filter((chart) => chart.id !== chartId));
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
        setCreator(playground.creator || null);
        setCreatedAt(playground.created_at || null);
        setUpdatedAt(playground.updated_at || null);
        
        // Load charts from saved data
        if (playground.charts && Array.isArray(playground.charts)) {
          const loadedCharts = playground.charts.map((chart: any, index: number) => ({
            id: chart.id || String(index + 1),
            title: chart.title || `Chart ${index + 1}`,
            colSpan: chart.colSpan || 12,
            dataSeries: chart.dataSeries || []
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
        charts: charts.map(chart => ({
          id: chart.id,
          title: chart.title,
          colSpan: chart.colSpan,
          dataSeries: chart.dataSeries || []
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
    
    // Check if charts changed (count, titles, colSpans, or dataSeries)
    if (charts.length !== savedCharts.length) return true;
    
    for (let i = 0; i < charts.length; i++) {
      const current = charts[i];
      const saved = savedCharts[i];
      if (!saved || current.id !== saved.id || current.title !== saved.title || current.colSpan !== saved.colSpan) {
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
  }, [charts, savedCharts, playgroundName, savedPlaygroundName, isPublic, savedIsPublic]);

  const copyLink = async () => {
    if (savedLink) {
      await navigator.clipboard.writeText(savedLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
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
        <div className="container mx-auto px-6 py-10 pb-24 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
                  {playgroundName}
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
              {(createdAt || updatedAt) && (
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-500">
                  {createdAt && (
                    <>
                      <span>Created {new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </>
                  )}
                  {createdAt && updatedAt && (
                    <span className="text-gray-400 dark:text-gray-600">•</span>
                  )}
                  {updatedAt && (
                    <span>Updated {new Date(updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isOwner ? (
                <>
                  {savedLink && (
                    <button
                      onClick={copyLink}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                      title={linkCopied ? "Link copied!" : "Copy shareable link"}
                    >
                      {linkCopied ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-4 w-4" />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                    title={isPublic ? "Make private" : "Make public"}
                  >
                    {isPublic ? (
                      <Globe className="h-5 w-5" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </button>
                  <Button
                    onClick={handleFavorite}
                    disabled={true}
                    className={`flex-shrink-0 flex items-center gap-2 transition-colors opacity-60 cursor-not-allowed ${
                      isFavorited
                        ? "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                        : "bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-neutral-700"
                    }`}
                    title="Favorite count"
                  >
                    <Heart className={`h-4 w-4 ${isFavorited ? "fill-current" : ""}`} />
                    {favoriteCount > 0 && <span className="text-sm">{favoriteCount}</span>}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className="flex-shrink-0 bg-black dark:bg-white text-white dark:text-black transition-colors hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  {savedLink && (
                    <button
                      onClick={copyLink}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                      title={linkCopied ? "Link copied!" : "Copy shareable link"}
                    >
                      {linkCopied ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-4 w-4" />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  )}
                  <Button
                    onClick={handleFavorite}
                    disabled={isFavoriting}
                    className={`flex-shrink-0 flex items-center gap-2 transition-colors ${
                      isFavorited
                        ? "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200 dark:border-red-800"
                        : "bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700 border border-gray-200 dark:border-neutral-700"
                    }`}
                  >
                    {isFavoriting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </>
                    ) : (
                      <>
                        <Heart className={`h-4 w-4 ${isFavorited ? "fill-current" : ""}`} />
                        {favoriteCount > 0 && <span className="text-sm">{favoriteCount}</span>}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
          <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
            Create and customize multiple charts with real-time chain metrics. Add metrics, configure visualizations, and share your insights.
          </p>
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Search and Add Chart */}
        {isOwner && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none z-10" />
              <Input
                placeholder="Search charts"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 rounded-lg border-[#e1e2ea] dark:border-neutral-700 bg-[#fcfcfd] dark:bg-neutral-800 transition-colors focus-visible:border-black dark:focus-visible:border-white focus-visible:ring-0 text-black dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
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
            <Button
              onClick={addChart}
              className="ml-auto flex-shrink-0 bg-black dark:bg-white text-white dark:text-black transition-colors hover:bg-neutral-800 dark:hover:bg-neutral-200"
            >
              Add New Chart
            </Button>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {filteredCharts.map((chart) => (
            <div
              key={chart.id}
              className={chart.colSpan === 6 ? "lg:col-span-6" : "lg:col-span-12"}
            >
              <ConfigurableChart
                title={chart.title}
                colSpan={chart.colSpan}
                initialDataSeries={chart.dataSeries || []}
                onColSpanChange={isOwner ? (newColSpan) => handleColSpanChange(chart.id, newColSpan) : undefined}
                onTitleChange={isOwner ? (newTitle) => handleTitleChange(chart.id, newTitle) : undefined}
                onDataSeriesChange={isOwner ? (dataSeries) => handleDataSeriesChange(chart.id, dataSeries) : undefined}
                disableControls={!isOwner}
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

