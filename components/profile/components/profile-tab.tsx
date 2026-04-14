"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Profile from "./profile";
import Projects from "./projects";
import Settings from "./settings";
import { ProfileHeader } from "./ProfileHeader";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useProfileForm, getProfileCompletionPercentage } from "./hooks/useProfileForm";
import { AvatarSeed } from "./DiceBearAvatar";
import { NounAvatarConfig } from "./NounAvatarConfig";
import { useUserAvatar } from "@/components/context/UserAvatarContext";

const validTabs = ['personal', 'projects', 'achievements', 'settings'];

interface ProfileTabProps {
  achievements?: ReactNode;
}

export default function ProfileTab({ achievements }: ProfileTabProps) {
  const { data: session } = useSession();
  const avatarContext = useUserAvatar();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isNounAvatarConfigOpen, setIsNounAvatarConfigOpen] = useState(false);
  const [nounAvatarSeed, setNounAvatarSeed] = useState<AvatarSeed | null>(null);
  const [nounAvatarEnabled, setNounAvatarEnabled] = useState(false);

  // Single form instance so header progress updates while editing (watchedValues shared)
  const {
    form,
    watchedValues,
    isLoading,
    isSaving,
    isAutoSaving,
    githubConnected,
    setGithubConnected,
    handleRemoveSkill,
    handleAddSocial,
    handleRemoveSocial,
    handleAddWallet,
    handleRemoveWallet,
    onSubmit,
  } = useProfileForm();

  const handleGithubDisconnect = async () => {
    await fetch('/api/auth/github-link/disconnect', { method: 'DELETE' });
    setGithubConnected(false);
    form.setValue('github', '', { shouldDirty: false });
  };

  // Load Noun avatar data and sincronizar con contexto (para que UserButton lo muestre)
  useEffect(() => {
    async function loadNounAvatar() {
      try {
        const response = await fetch("/api/user/noun-avatar");
        if (response.ok) {
          const data = await response.json();
          const seed = data.seed ?? null;
          const enabled = data.enabled ?? false;
          setNounAvatarSeed(seed);
          setNounAvatarEnabled(enabled);
          avatarContext?.setNounAvatar(seed, enabled);
        }
      } catch (error) {
        console.error("Error loading Noun avatar:", error);
      }
    }
    loadNounAvatar();
  }, [avatarContext?.setNounAvatar]);

  // Handle avatar save: actualizar estado local y contexto para que UserButton refleje el cambio
  const handleNounAvatarSave = async (seed: AvatarSeed, enabled: boolean) => {
    setNounAvatarSeed(seed);
    setNounAvatarEnabled(enabled);
    avatarContext?.setNounAvatar(seed, enabled);
  };

  const tabParam = searchParams.get('tab');
  const activeTab = validTabs.includes(tabParam ?? '') ? (tabParam ?? 'personal') : 'personal';

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'personal') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`);
  };

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
                completionPercentage={getProfileCompletionPercentage(watchedValues)}
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
              <Profile
                form={form}
                watchedValues={watchedValues}
                isSaving={isSaving}
                isAutoSaving={isAutoSaving}
                githubConnected={githubConnected}
                onGithubDisconnect={handleGithubDisconnect}
                handleRemoveSkill={handleRemoveSkill}
                handleAddSocial={handleAddSocial}
                handleRemoveSocial={handleRemoveSocial}
                handleAddWallet={handleAddWallet}
                handleRemoveWallet={handleRemoveWallet}
                onSubmit={onSubmit}
              />
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

