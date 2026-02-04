"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import notificationMeansDefaults from "../data/notifications_means.json";

// Type for notification channels
type NotificationChannels = [boolean, boolean]; // [Hub, Email]

// Type for notification preferences by key
interface NotificationPreferences {
  [key: string]: NotificationChannels;
}

// Type for a category with its notifications
type CategoryData = Record<string, Record<string, boolean[]>>;

// Channel names in order
const NOTIFICATION_CHANNELS = ["Hub", "Email"] as const;

// Helper function to split CamelCase/PascalCase/snake_case strings into readable text
const formatLabel = (text: string): string => {
  return text
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .trim() // Remove leading space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function Settings() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [notificationMeans, setNotificationMeans] = useState<NotificationPreferences>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Merge default values with user's saved preferences
  const mergeWithDefaults = (userPreferences: NotificationPreferences | null): NotificationPreferences => {
    const merged: NotificationPreferences = {};
    
    // Iterate through all categories in defaults
    (notificationMeansDefaults as unknown as CategoryData[]).forEach((categoryObj) => {
      const categoryName = Object.keys(categoryObj)[0];
      const categoryNotifications = categoryObj[categoryName];
      
      // Add all notifications from this category
      Object.entries(categoryNotifications).forEach(([key, defaultValue]) => {
        // Use user's value if exists, otherwise use default (ensure it's a tuple)
        merged[key] = (userPreferences?.[key] as NotificationChannels) || (defaultValue as NotificationChannels);
      });
    });
    
    return merged;
  };

  // Load user notification preferences on mount
  useEffect(() => {
    async function loadNotificationMeans() {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/profile/extended/${session.user.id}`);
        
        if (response.ok) {
          const profile = await response.json();
          const userPreferences = profile.notification_means || null;
          const mergedPreferences = mergeWithDefaults(userPreferences);
          setNotificationMeans(mergedPreferences);
        } else {
          console.error("Failed to load notification preferences");
          // Use defaults if API fails
          setNotificationMeans(mergeWithDefaults(null));
        }
      } catch (error) {
        console.error("Error loading notification preferences:", error);
        // Use defaults if error occurs
        setNotificationMeans(mergeWithDefaults(null));
      } finally {
        setIsLoading(false);
      }
    }

    loadNotificationMeans();
  }, [session?.user?.id]);

  // Handle switch toggle
  const handleToggle = async (notificationKey: string, channelIndex: number, newValue: boolean) => {
    if (!session?.user?.id || savingKey) return;

    const toggleKey = `${notificationKey}-${channelIndex}`;
    setSavingKey(toggleKey);

    // Update local state optimistically
    const updatedMeans = { ...notificationMeans };
    const currentValues = [...(updatedMeans[notificationKey] || [false, false])] as NotificationChannels;
    currentValues[channelIndex] = newValue;
    updatedMeans[notificationKey] = currentValues;
    setNotificationMeans(updatedMeans);

    // Save to backend
    try {
      const response = await fetch(`/api/profile/extended/${session.user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notification_means: updatedMeans,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save notification preferences");
      }

      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated.",
      });
    } catch (error) {
      console.error("Error saving notification preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });

      // Revert local state on error
      const revertedMeans = { ...notificationMeans };
      const revertedValues = [...currentValues] as NotificationChannels;
      revertedValues[channelIndex] = !newValue;
      revertedMeans[notificationKey] = revertedValues;
      setNotificationMeans(revertedMeans);
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Notification Settings</h2>
        <p className="text-muted-foreground">
          Manage how you receive notifications for different events.
        </p>
      </div>

      <Separator />

      <div className="space-y-6">
        {(notificationMeansDefaults as unknown as CategoryData[]).map((categoryObj, categoryIndex: number) => {
          const categoryName = Object.keys(categoryObj)[0];
          const categoryNotifications = categoryObj[categoryName];

          return (
            <div key={categoryIndex} className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{categoryName}</h3>
                <p className="text-sm text-muted-foreground">
                  Configure notification preferences for {categoryName.toLowerCase()} events
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.keys(categoryNotifications).map((notificationKey) => {
                  const values = notificationMeans[notificationKey] || [false, false];

                  return (
                    <div
                      key={notificationKey}
                      className="p-4 border rounded-lg bg-card"
                    >
                      <div className="mb-3">
                        <Label className="text-sm font-medium">
                          {formatLabel(notificationKey)}
                        </Label>
                      </div>

                      <div className="flex gap-4 justify-start">
                        {NOTIFICATION_CHANNELS.map((channelName, channelIndex) => {
                          const toggleKey = `${notificationKey}-${channelIndex}`;
                          const isThisSaving = savingKey === toggleKey;
                          
                          return (
                            <div
                              key={channelIndex}
                              className="flex flex-col items-center gap-2"
                            >
                              <Label
                                htmlFor={`${notificationKey}-${channelIndex}`}
                                className="text-xs font-normal cursor-pointer"
                              >
                                {channelName}
                              </Label>
                              <div className={isThisSaving ? "pointer-events-none" : ""}>
                                <Switch
                                  id={`${notificationKey}-${channelIndex}`}
                                  checked={values[channelIndex]}
                                  onCheckedChange={(checked) =>
                                    handleToggle(notificationKey, channelIndex, checked)
                                  }
                                  className="data-[state=unchecked]:bg-zinc-300 dark:data-[state=unchecked]:bg-zinc-600 data-[state=checked]:bg-primary opacity-100 disabled:opacity-100 cursor-pointer"
                                  style={{ opacity: 1 }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {categoryIndex < notificationMeansDefaults.length - 1 && (
                <Separator className="my-6" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

