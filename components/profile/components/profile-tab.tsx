"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Profile from "./profile";
import Projects from "./projects";
import Settings from "./settings";
import { ProfileHeader } from "./ProfileHeader";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useProfileForm } from "./hooks/useProfileForm";
import { AvatarSeed } from "./DiceBearAvatar";
import { NounAvatarConfig } from "./NounAvatarConfig";

// Map hash values to tab values (case-insensitive)
const hashToTabMap: Record<string, string> = {
  'personal': 'personal',
  'projects': 'projects',
  'achievements': 'achievements',
  'achievement': 'achievements', 
  'settings': 'settings',
};

const validTabs = ['personal', 'projects', 'achievements', 'settings'];

interface ProfileTabProps {
  achievements?: ReactNode;
}

export default function ProfileTab({ achievements }: ProfileTabProps) {
  const { data: session } = useSession();
  const [isNounAvatarConfigOpen, setIsNounAvatarConfigOpen] = useState(false);
  const [nounAvatarSeed, setNounAvatarSeed] = useState<AvatarSeed | null>(null);
  const [nounAvatarEnabled, setNounAvatarEnabled] = useState(false);

  // Get profile data using the hook
  const { form, watchedValues, isLoading } = useProfileForm();

  // Load Noun avatar data
  useEffect(() => {
    async function loadNounAvatar() {
      try {
        const response = await fetch("/api/user/noun-avatar");
        if (response.ok) {
          const data = await response.json();
          setNounAvatarSeed(data.seed);
          setNounAvatarEnabled(data.enabled ?? false);
        }
      } catch (error) {
        console.error("Error loading Noun avatar:", error);
      }
    }
    loadNounAvatar();
  }, []);

  // Handle avatar save
  const handleNounAvatarSave = async (seed: AvatarSeed, enabled: boolean) => {
    setNounAvatarSeed(seed);
    setNounAvatarEnabled(enabled);
  };

  // Get initial tab from URL hash
  const getInitialTab = (): string => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1).toLowerCase();
      const tabValue = hashToTabMap[hash];
      if (tabValue && validTabs.includes(tabValue)) {
        return tabValue;
      }
    }
    return 'personal';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab);

  // Update URL hash when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (typeof window !== 'undefined') {
      const hash = value === 'personal' ? '' : `#${value}`;
      window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
    }
  };

  // Listen for hash changes (back/forward navigation or direct links)
  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash.slice(1).toLowerCase();
        const tabValue = hashToTabMap[hash];
        if (tabValue && validTabs.includes(tabValue)) {
          setActiveTab(tabValue);
        } else if (!hash) {
          // No hash means default to personal
          setActiveTab('personal');
        }
      }
    };

    // Check hash on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Profile Header + Tabs Navigation */}
          <div className="w-full lg:w-[300px] lg:shrink-0">
            <div className=" rounded-lg   p-6 lg:sticky lg:top-4 lg:self-start space-y-6">
              {/* Profile Header */}
              <ProfileHeader
                name={watchedValues.name}
                username={watchedValues.username}
                email={watchedValues.email || session?.user?.email}
                country={watchedValues.country}
                image={form.watch("image")}
                onEditAvatar={() => setIsNounAvatarConfigOpen(true)}
                nounAvatarSeed={nounAvatarSeed}
                nounAvatarEnabled={nounAvatarEnabled}
              />

              {/* Separator */}
              <div className="border-t border-zinc-200 dark:border-zinc-800"></div>

              {/* Tabs Navigation */}
              <TabsList className="flex flex-col h-auto w-full p-1 bg-zinc-50 dark:bg-zinc-900">
                <TabsTrigger 
                  value="personal" 
                  className="w-full justify-start  dark:data-[state=active]:bg-zinc-950"
                >
                  Personal
                </TabsTrigger>
                <TabsTrigger 
                  value="projects" 
                  className="w-full justify-start dark:data-[state=active]:bg-zinc-950"
                >
                  Projects
                </TabsTrigger>
                <TabsTrigger 
                  value="achievements" 
                  className="w-full justify-start  dark:data-[state=active]:bg-zinc-950"
                >
                  Achievements
                </TabsTrigger>
                {/* <TabsTrigger 
                  value="settings" 
                  className="w-full justify-start  dark:data-[state=active]:bg-zinc-950"
                >
                  Settings
                </TabsTrigger> */}
              </TabsList>
            </div>
          </div>

          {/* Right Content - Tab Content */}
          <div className="flex-1 min-w-0">
            <TabsContent value="personal" className="mt-1">
              <Profile />
            </TabsContent>

            <TabsContent value="projects" className="mt-1">
              <Projects />
            </TabsContent>

            <TabsContent value="achievements" className="mt-1">
              {achievements}
            </TabsContent>

            <TabsContent value="settings" className="mt-1">
              <Settings />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <NounAvatarConfig
        isOpen={isNounAvatarConfigOpen}
        onOpenChange={setIsNounAvatarConfigOpen}
        currentSeed={nounAvatarSeed}
        nounAvatarEnabled={nounAvatarEnabled}
        onSave={handleNounAvatarSave}
      />
    </>
  );
}

