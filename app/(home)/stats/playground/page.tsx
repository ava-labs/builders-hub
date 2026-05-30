"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LoginModal } from "@/components/login/LoginModal";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { toast } from "@/lib/toast";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { PlaygroundBackground } from "@/components/stats/PlaygroundBackground";
import { PlaygroundLoadingSkeleton } from "./_components/PlaygroundLoadingSkeleton";
import { PlaygroundHeader } from "./_components/PlaygroundHeader";
import { PlaygroundControlsBar } from "./_components/PlaygroundControlsBar";
import { ChartsGrid } from "./_components/ChartsGrid";
import type {
  ChartConfig,
  PlaygroundLoadResponse,
} from "./_components/types";
import { usePlaygroundCharts } from "./_hooks/usePlaygroundCharts";
import { usePlaygroundMetadata } from "./_hooks/usePlaygroundMetadata";
import { useGlobalTimeFilter } from "./_hooks/useGlobalTimeFilter";
import { useChartDragAndDrop } from "./_hooks/useChartDragAndDrop";

function PlaygroundContent() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const playgroundId = searchParams.get("id");
  const { openLoginModal } = useLoginModalTrigger();

  const meta = usePlaygroundMetadata(playgroundId);
  const chartsState = usePlaygroundCharts();
  const filter = useGlobalTimeFilter();

  const [searchTerm, setSearchTerm] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [isLoading, setIsLoading] = useState(!!playgroundId);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  const drag = useChartDragAndDrop({
    canDragChart: () =>
      meta.isOwner && chartsState.filteredCharts(searchTerm).length > 1,
    onReorder: chartsState.handleChartReorder,
  });

  // ── Load playground when ID changes ────────────────────────────────────────
  useEffect(() => {
    const loadPlayground = async () => {
      if (!playgroundId || hasLoadedRef.current) return;
      // Wait for next-auth status; lets public playgrounds render even when
      // unauthenticated.
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
        const playground: PlaygroundLoadResponse = await response.json();

        // Hydrate metadata.
        meta.setPlaygroundName(playground.name);
        meta.setSavedPlaygroundName(playground.name);
        meta.setIsPublic(playground.is_public);
        meta.setSavedIsPublic(playground.is_public);
        meta.setCurrentPlaygroundId(playground.id);
        meta.setIsOwner(playground.is_owner || false);
        meta.setIsFavorited(playground.is_favorited || false);
        meta.setFavoriteCount(playground.favorite_count || 0);
        meta.setViewCount(playground.view_count || 0);
        meta.setCreator(playground.creator || null);
        meta.setCreatedAt(playground.created_at || null);
        meta.setUpdatedAt(playground.updated_at || null);

        // Hydrate global time filter.
        const startTime = playground.globalStartTime || null;
        const endTime = playground.globalEndTime || null;
        filter.setGlobalStartTime(startTime);
        filter.setGlobalEndTime(endTime);
        filter.setSavedGlobalStartTime(startTime);
        filter.setSavedGlobalEndTime(endTime);
        if (startTime && endTime) {
          filter.setTempGlobalStartTime(new Date(startTime));
          filter.setTempGlobalEndTime(new Date(endTime));
        } else {
          filter.setTempGlobalStartTime(undefined);
          filter.setTempGlobalEndTime(undefined);
        }

        // Hydrate charts.
        if (playground.charts && Array.isArray(playground.charts)) {
          const loadedCharts: ChartConfig[] = playground.charts.map(
            (chart, index) => ({
              id: chart.id || String(index + 1),
              title: chart.title || `Chart ${index + 1}`,
              colSpan: chart.colSpan || 12,
              dataSeries: chart.dataSeries || [],
              stackSameMetrics: chart.stackSameMetrics || false,
              abbreviateNumbers:
                chart.abbreviateNumbers !== undefined
                  ? chart.abbreviateNumbers
                  : true,
              startTime: chart.startTime || null,
              endTime: chart.endTime || null,
              brushStartIndex: chart.brushStartIndex ?? null,
              brushEndIndex: chart.brushEndIndex ?? null,
            })
          );
          chartsState.setCharts(loadedCharts);
          chartsState.setSavedCharts(
            loadedCharts.map((chart) => ({
              ...chart,
              dataSeries: chart.dataSeries ? [...chart.dataSeries] : [],
            }))
          );
        }

        meta.setSavedLink(
          `${window.location.origin}/stats/playground?id=${playground.id}`
        );
      } catch (err) {
        console.error("Error loading playground:", err);
        setError(err instanceof Error ? err.message : "Failed to load playground");
      } finally {
        setIsLoading(false);
      }
    };

    loadPlayground();
    // Intentionally limited deps: hooks expose stable setters and meta/filter
    // references should not retrigger this effect on every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playgroundId, status]);

  // Reset load gate + initial loading state when the playgroundId changes.
  useEffect(() => {
    hasLoadedRef.current = false;
    setIsLoading(!!playgroundId);
  }, [playgroundId]);

  // Reset all state when navigating to a blank playground (no ID).
  useEffect(() => {
    if (playgroundId) return;

    meta.resetAll();
    filter.resetAll();
    chartsState.resetToBlank();
    setError(null);
    setIsLoading(false);
    // Same scoped deps rationale as above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playgroundId]);

  // Track view count once per session for non-owners.
  useEffect(() => {
    if (!meta.currentPlaygroundId || meta.isOwner) return;
    const viewKey = `playground_view_${meta.currentPlaygroundId}`;
    if (sessionStorage.getItem(viewKey)) return;

    fetch(`/api/playground/${meta.currentPlaygroundId}/view`, {
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.view_count !== undefined) {
          meta.setViewCount(data.view_count);
          sessionStorage.setItem(viewKey, "true");
        }
      })
      .catch((err) => {
        console.error("Failed to track view:", err);
      });
    // Same scoped deps rationale as above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.currentPlaygroundId, meta.isOwner]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (status === "unauthenticated") {
      const callbackUrl = window.location.pathname + window.location.search;
      openLoginModal(callbackUrl);
      return;
    }
    if (status === "loading") return;

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: meta.playgroundName,
        isPublic: meta.isPublic,
        globalStartTime: filter.globalStartTime || null,
        globalEndTime: filter.globalEndTime || null,
        charts: chartsState.charts.map((chart) => ({
          id: chart.id,
          title: chart.title,
          colSpan: chart.colSpan,
          dataSeries: chart.dataSeries || [],
          stackSameMetrics: chart.stackSameMetrics || false,
          abbreviateNumbers:
            chart.abbreviateNumbers !== undefined
              ? chart.abbreviateNumbers
              : true,
          startTime: chart.startTime || null,
          endTime: chart.endTime || null,
          brushStartIndex: chart.brushStartIndex ?? null,
          brushEndIndex: chart.brushEndIndex ?? null,
        })),
      };

      const response = meta.currentPlaygroundId
        ? await fetch("/api/playground", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: meta.currentPlaygroundId, ...payload }),
          })
        : await fetch("/api/playground", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save playground");
      }

      const playground = await response.json();

      // Snapshot current values into "saved" slots.
      chartsState.setSavedCharts(
        chartsState.charts.map((chart) => ({
          ...chart,
          dataSeries: chart.dataSeries ? [...chart.dataSeries] : [],
        }))
      );
      meta.setSavedPlaygroundName(meta.playgroundName);
      meta.setSavedIsPublic(meta.isPublic);
      filter.setSavedGlobalStartTime(filter.globalStartTime);
      filter.setSavedGlobalEndTime(filter.globalEndTime);
      meta.setCurrentPlaygroundId(playground.id);

      const link = `${window.location.origin}/stats/playground?id=${playground.id}`;
      meta.setSavedLink(link);
      router.replace(`/stats/playground?id=${playground.id}`, { scroll: false });
      setLinkCopied(false);
    } catch (err) {
      console.error("Error saving playground:", err);
      setError(err instanceof Error ? err.message : "Failed to save playground");
    } finally {
      setIsSaving(false);
    }
  }, [status, openLoginModal, meta, filter, chartsState, router]);

  // ── Dirty checking ─────────────────────────────────────────────────────────
  const hasChanges = useMemo(() => {
    if (meta.playgroundName !== meta.savedPlaygroundName) return true;
    if (meta.isPublic !== meta.savedIsPublic) return true;
    if (
      filter.globalStartTime !== filter.savedGlobalStartTime ||
      filter.globalEndTime !== filter.savedGlobalEndTime
    ) {
      return true;
    }
    if (chartsState.charts.length !== chartsState.savedCharts.length) return true;

    for (let i = 0; i < chartsState.charts.length; i++) {
      const current = chartsState.charts[i];
      const saved = chartsState.savedCharts[i];
      if (
        !saved ||
        current.id !== saved.id ||
        current.title !== saved.title ||
        current.colSpan !== saved.colSpan ||
        current.stackSameMetrics !== saved.stackSameMetrics ||
        current.abbreviateNumbers !== saved.abbreviateNumbers ||
        current.startTime !== saved.startTime ||
        current.endTime !== saved.endTime ||
        current.brushStartIndex !== saved.brushStartIndex ||
        current.brushEndIndex !== saved.brushEndIndex
      ) {
        return true;
      }

      const currentDataSeries = current.dataSeries || [];
      const savedDataSeries = saved.dataSeries || [];
      if (currentDataSeries.length !== savedDataSeries.length) return true;

      const currentSorted = [...currentDataSeries].sort((a, b) =>
        a.id.localeCompare(b.id)
      );
      const savedSorted = [...savedDataSeries].sort((a, b) =>
        a.id.localeCompare(b.id)
      );
      for (let j = 0; j < currentSorted.length; j++) {
        const a = currentSorted[j];
        const b = savedSorted[j];
        if (
          !b ||
          a.id !== b.id ||
          a.name !== b.name ||
          a.color !== b.color ||
          a.yAxis !== b.yAxis ||
          a.visible !== b.visible ||
          a.chartStyle !== b.chartStyle ||
          a.chainId !== b.chainId ||
          a.metricKey !== b.metricKey ||
          a.zIndex !== b.zIndex
        ) {
          return true;
        }
      }
    }

    return false;
  }, [
    chartsState.charts,
    chartsState.savedCharts,
    meta.playgroundName,
    meta.savedPlaygroundName,
    meta.isPublic,
    meta.savedIsPublic,
    filter.globalStartTime,
    filter.globalEndTime,
    filter.savedGlobalStartTime,
    filter.savedGlobalEndTime,
  ]);

  // ── Sharing ────────────────────────────────────────────────────────────────
  const copyLink = useCallback(async () => {
    if (!meta.isPublic) {
      toast.warning(
        "Make dashboard public first",
        "Please make this dashboard public to share it with others."
      );
      return;
    }
    if (meta.savedLink) {
      await navigator.clipboard.writeText(meta.savedLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast.success("Link copied!");
    }
  }, [meta.isPublic, meta.savedLink]);

  const shareOnX = useCallback(() => {
    if (!meta.isPublic) {
      toast.warning(
        "Make dashboard public first",
        "Please make this dashboard public to share it with others."
      );
      return;
    }
    if (meta.savedLink) {
      const text = meta.isOwner
        ? "check out my @avax ecosystem dashboard"
        : "check out this @avax ecosystem dashboard";
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(meta.savedLink)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [meta.isPublic, meta.savedLink, meta.isOwner]);

  // ── Favorite ───────────────────────────────────────────────────────────────
  const handleFavorite = useCallback(async () => {
    if (status === "unauthenticated") {
      const callbackUrl = window.location.pathname + window.location.search;
      openLoginModal(callbackUrl);
      return;
    }
    if (!meta.currentPlaygroundId || isFavoriting) return;

    setIsFavoriting(true);
    try {
      if (meta.isFavorited) {
        const response = await fetch(
          `/api/playground/favorite?playgroundId=${meta.currentPlaygroundId}`,
          { method: "DELETE" }
        );
        if (!response.ok) throw new Error("Failed to unfavorite playground");
        const data = await response.json();
        meta.setIsFavorited(false);
        meta.setFavoriteCount(data.favorite_count || meta.favoriteCount - 1);
      } else {
        const response = await fetch("/api/playground/favorite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playgroundId: meta.currentPlaygroundId }),
        });
        if (!response.ok) throw new Error("Failed to favorite playground");
        const data = await response.json();
        meta.setIsFavorited(true);
        meta.setFavoriteCount(data.favorite_count || meta.favoriteCount + 1);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
      setError(err instanceof Error ? err.message : "Failed to update favorite");
    } finally {
      setIsFavoriting(false);
    }
  }, [status, openLoginModal, meta, isFavoriting]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <PlaygroundLoadingSkeleton />;
  }

  const visibleCharts = chartsState.filteredCharts(searchTerm);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8 relative">
      <LoginModal />
      <PlaygroundBackground id="playground" />
      <div className="container mx-auto px-6 py-10 pb-24 space-y-8 relative z-10">
        <PlaygroundHeader
          playgroundName={meta.playgroundName}
          onPlaygroundNameChange={meta.setPlaygroundName}
          isOwner={meta.isOwner}
          currentPlaygroundId={meta.currentPlaygroundId}
          isPublic={meta.isPublic}
          savedLink={meta.savedLink}
          linkCopied={linkCopied}
          onCopyLink={copyLink}
          onShareOnX={shareOnX}
          viewCount={meta.viewCount}
          favoriteCount={meta.favoriteCount}
          isFavorited={meta.isFavorited}
          isFavoriting={isFavoriting}
          onToggleFavorite={handleFavorite}
          creator={meta.creator}
          createdAt={meta.createdAt}
          updatedAt={meta.updatedAt}
          showSubtitle={!playgroundId}
          error={error}
        />

        <PlaygroundControlsBar
          isOwner={meta.isOwner}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filter={filter}
          onAddChart={chartsState.addChart}
          isPublic={meta.isPublic}
          onTogglePublic={() => meta.setIsPublic(!meta.isPublic)}
          hasChanges={hasChanges}
          isSaving={isSaving}
          onSave={handleSave}
        />

        <ChartsGrid
          charts={visibleCharts}
          playgroundId={playgroundId}
          isOwner={meta.isOwner}
          globalStartTime={filter.globalStartTime}
          globalEndTime={filter.globalEndTime}
          reloadTrigger={filter.reloadTrigger}
          playgroundCharts={chartsState.playgroundCharts}
          searchTerm={searchTerm}
          drag={drag}
          onColSpanChange={chartsState.handleColSpanChange}
          onTitleChange={chartsState.handleTitleChange}
          onDataSeriesChange={chartsState.handleDataSeriesChange}
          onStackSameMetricsChange={chartsState.handleStackSameMetricsChange}
          onAbbreviateNumbersChange={chartsState.handleAbbreviateNumbersChange}
          onTimeFilterChange={chartsState.handleChartTimeFilterChange}
          onBrushChange={chartsState.handleBrushChange}
          onChartDataReady={chartsState.handleChartDataReady}
          onRemove={chartsState.removeChart}
        />
      </div>

      <StatsBubbleNav />
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8">
          <div className="container mx-auto px-6 py-10 pb-24 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      }
    >
      <PlaygroundContent />
    </Suspense>
  );
}
