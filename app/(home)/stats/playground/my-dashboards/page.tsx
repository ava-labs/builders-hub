"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Globe, Lock, Eye, Trash2, LayoutDashboard, Plus, Heart, ChevronsDownUp } from "lucide-react";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { LoginModal } from "@/components/login/LoginModal";
import { Card } from "@/components/ui/card";
import { toast } from "@/lib/toast";
import { StatsBubbleNav } from "@/components/stats/stats-bubble.config";
import { PlaygroundBackground } from "@/components/stats/PlaygroundBackground";

export default function MyDashboardsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { openLoginModal } = useLoginModalTrigger();
  
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchDashboards = useCallback(async () => {
    if (status === "unauthenticated") {
      const callbackUrl = window.location.pathname;
      openLoginModal(callbackUrl);
      return;
    }
    
    if (status === "loading") return;
    
    setDashboardsLoading(true);
    try {
      const response = await fetch("/api/playground");
      if (response.ok) {
        const data = await response.json();
        setDashboards(Array.isArray(data) ? data : []);
      }
      setHasFetched(true);
    } catch (err) {
      console.error("Error fetching dashboards:", err);
      setHasFetched(true);
    } finally {
      setDashboardsLoading(false);
    }
  }, [status, openLoginModal]);

  useEffect(() => {
    if (status !== "loading") {
      fetchDashboards();
    }
  }, [status, fetchDashboards]);

  const handleDeleteDashboard = async (id: string) => {
    if (!confirm("Are you sure you want to delete this dashboard?")) return;
    
    const promise = fetch(`/api/playground?id=${id}`, {
      method: "DELETE"
    }).then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete dashboard");
      }
      return response.json();
    });

    toast.promise(promise, {
      loading: "Deleting dashboard...",
      success: "Dashboard deleted successfully",
      error: (err) => err.message || "Failed to delete dashboard"
    });

    try {
      await promise;
      setDashboards(dashboards.filter(d => d.id !== id));
    } catch (err) {
      // Error already handled by toast.promise
    }
  };

  const handleOpenDashboard = (id: string) => {
    router.push(`/stats/playground?id=${id}`);
  };

  const handleToggleVisibility = async (e: React.MouseEvent, id: string, currentVisibility: boolean) => {
    e.stopPropagation(); // Prevent row click
    
    const newVisibility = !currentVisibility;
    const promise = fetch("/api/playground", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        isPublic: newVisibility
      })
    }).then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update visibility");
      }
      return response.json();
    });

    toast.promise(promise, {
      loading: `Updating visibility to ${newVisibility ? "public" : "private"}...`,
      success: `Dashboard is now ${newVisibility ? "public" : "private"}`,
      error: (err) => err.message || "Failed to update visibility"
    });

    try {
      await promise;
      // Update local state
      setDashboards(dashboards.map(d => 
        d.id === id ? { ...d, is_public: newVisibility } : d
      ));
    } catch (err) {
      // Error already handled by toast.promise
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-8 relative">
      <LoginModal />
      <PlaygroundBackground id="dashboards" />
      <div className="container mx-auto px-6 py-10 pb-24 space-y-8 relative z-10">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <h1 className="text-4xl sm:text-4xl font-semibold tracking-tight text-black dark:text-white">
                My Dashboards
              </h1>
              <p className="text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed mt-2">
                View and manage all your saved playground dashboards. Track engagement metrics, organize your analytics, and access your custom visualizations.
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <Button
                onClick={() => router.push("/stats/playground")}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                title="Create Dashboard"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Create Dashboard</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        {dashboardsLoading || !hasFetched ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <LayoutDashboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No dashboards found. Create your first dashboard by saving a playground.</p>
          </div>
        ) : (
          <Card className="overflow-hidden py-0 border-0 shadow-none rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[#fcfcfd] dark:bg-neutral-900">
                  <tr>
                    <th className="px-4 py-2 text-left">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Name
                      </span>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Visibility
                      </span>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Created
                      </span>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Updated
                      </span>
                    </th>
                    <th className="px-4 py-2 text-right">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Stats
                      </span>
                    </th>
                    <th className="px-4 py-2 text-center">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-950">
                  {dashboards.map((dashboard) => (
                    <tr
                      key={dashboard.id}
                      className="border-b border-slate-100 dark:border-neutral-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-neutral-800/50 cursor-pointer"
                      onClick={() => handleOpenDashboard(dashboard.id)}
                    >
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span className="font-medium text-black dark:text-white">
                          {dashboard.name || "Untitled Dashboard"}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <button
                          onClick={(e) => handleToggleVisibility(e, dashboard.id, dashboard.is_public)}
                          className="flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer group"
                          title={dashboard.is_public ? "Click to make private" : "Click to make public"}
                        >
                          {dashboard.is_public ? (
                            <>
                              <Globe className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-neutral-900 dark:text-neutral-100">Public</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-neutral-900 dark:text-neutral-100">Private</span>
                            </>
                          )}
                          <ChevronsDownUp className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors" />
                        </button>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {dashboard.created_at
                            ? new Date(dashboard.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "N/A"}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {dashboard.updated_at
                            ? new Date(dashboard.updated_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "N/A"}
                        </span>
                      </td>
                      <td className="border-r border-slate-100 dark:border-neutral-800 px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex items-center gap-1.5">
                            <Heart className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {(dashboard.favorite_count || 0).toLocaleString()}
                            </span>
                          </div>
                          <span className="text-gray-400 dark:text-gray-600">•</span>
                          <div className="flex items-center gap-1.5">
                            <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {(dashboard.view_count || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDashboard(dashboard.id);
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDashboard(dashboard.id);
                            }}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Bubble Navigation */}
        <StatsBubbleNav />
      </div>
    </div>
  );
}

