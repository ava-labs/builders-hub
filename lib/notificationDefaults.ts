import notificationMeansDefaults from '@/components/profile/data/notifications_means.json';

/**
 * Gets the default notification preferences from the JSON configuration
 * @returns Object with all notification keys and their default values [Hub, Email]
 */
export function getDefaultNotificationMeans(): Record<string, [boolean, boolean]> {
  const defaults: Record<string, [boolean, boolean]> = {};
  
  // Iterate through all categories in the JSON
  (notificationMeansDefaults as any[]).forEach((categoryObj: any) => {
    const categoryName = Object.keys(categoryObj)[0];
    const categoryNotifications = categoryObj[categoryName];
    
    if (categoryNotifications) {
      // Add all notifications from this category to the defaults object
      Object.entries(categoryNotifications).forEach(([key, value]) => {
        defaults[key] = value as [boolean, boolean];
      });
    }
  });
  
  return defaults;
}
