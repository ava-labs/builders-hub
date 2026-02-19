import notificationMeansDefaults from '@/components/profile/data/notifications_means.json';

// Type definitions for the JSON structure
export type NotificationPreference = [boolean, boolean]; // [Hub, Email]
export type NotificationMeans = Record<string, NotificationPreference>;

type CategoryNotifications = Record<string, NotificationPreference>;
type CategoryObject = Record<string, CategoryNotifications>;
type NotificationMeansDefaults = CategoryObject[];

/**
 * Gets the default notification preferences from the JSON configuration
 * @returns Object with all notification keys and their default values [Hub, Email]
 */
export function getDefaultNotificationMeans(): NotificationMeans {
  const defaults: NotificationMeans = {};
  const typedDefaults = notificationMeansDefaults as unknown as NotificationMeansDefaults;
  
  // Iterate through all categories in the JSON
  typedDefaults.forEach((categoryObj: CategoryObject) => {
    const categoryName = Object.keys(categoryObj)[0];
    const categoryNotifications = categoryObj[categoryName];
    
    if (categoryNotifications) {
      // Add all notifications from this category to the defaults object
      Object.entries(categoryNotifications).forEach(([key, value]) => {
        defaults[key] = value;
      });
    }
  });
  
  return defaults;
}
