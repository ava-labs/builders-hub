"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Timer } from "lucide-react";
import BubbleNavigation from "@/components/navigation/BubbleNavigation";

export default function StakingStats() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8 pb-24 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
              Staking Statistics
            </h1>
            <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
              Comprehensive staking metrics and analytics for the Avalanche
              network.
            </p>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Timer className="h-8 w-8 text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Coming Soon</h2>
              <p className="text-muted-foreground">
                Staking statistics and analytics are currently in development.
                Check back soon for comprehensive staking metrics.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Bubble Navigation */}
      <BubbleNavigation />
    </div>
  );
}
