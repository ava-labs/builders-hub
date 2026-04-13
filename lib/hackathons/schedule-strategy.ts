import { ScheduleActivity } from '@/types/hackathons';
import { apiFetch } from '@/lib/api/client';

/**
 * Result from schedule data source including metadata
 */
export interface ScheduleResult {
  schedule: ScheduleActivity[];
  /** Calendar timezone (if available from source) */
  timeZone?: string;
}

/**
 * Strategy Pattern for fetching hackathon schedule data
 * Allows switching between different data sources (DB, Google Calendar, etc.)
 */

export interface ScheduleDataSource {
  /**
   * Fetches schedule activities for a hackathon
   * @param hackathonId - The ID of the hackathon
   * @param existingSchedule - Optional existing schedule data (for DB strategy)
   * @returns Promise with schedule result including activities and metadata
   */
  getSchedule(hackathonId: string, existingSchedule?: ScheduleActivity[]): Promise<ScheduleResult>;
  
  /**
   * Returns the name of the data source for debugging/logging
   */
  getSourceName(): string;
}

/**
 * Database Strategy - Uses the schedule data that comes from the DB (current behavior)
 */
export class DatabaseScheduleStrategy implements ScheduleDataSource {
  async getSchedule(hackathonId: string, existingSchedule?: ScheduleActivity[]): Promise<ScheduleResult> {
    // Simply return the existing schedule from DB
    // This maintains the current behavior where data is already loaded
    return { schedule: existingSchedule || [] };
  }

  getSourceName(): string {
    return 'database';
  }
}

/**
 * Google Calendar Strategy - Fetches schedule from a Google Calendar via server API
 * 
 * Uses OAuth credentials (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET) through a server-side API route.
 * This is more secure than using a public API key and supports private calendars.
 * 
 * @example
 * const strategy = new GoogleCalendarStrategy({
 *   calendarId: 'hackathon-calendar@group.calendar.google.com',
 * });
 */
export interface GoogleCalendarConfig {
  /** The Google Calendar ID */
  calendarId: string;
  /** Optional: Maximum number of events to fetch */
  maxResults?: number;
  /** Optional: Only fetch events after this date */
  timeMin?: Date;
  /** Optional: Only fetch events before this date */
  timeMax?: Date;
}

export class GoogleCalendarStrategy implements ScheduleDataSource {
  private config: GoogleCalendarConfig;

  constructor(config: GoogleCalendarConfig) {
    this.config = {
      maxResults: 100,
      ...config,
    };
  }

  async getSchedule(hackathonId: string): Promise<ScheduleResult> {
    const { calendarId, maxResults, timeMin, timeMax } = this.config;
    
    // Call our server-side API route that handles OAuth authentication
    const params = new URLSearchParams({
      calendarId,
      maxResults: String(maxResults),
    });

    if (timeMin) {
      params.set('timeMin', timeMin.toISOString());
    }
    if (timeMax) {
      params.set('timeMax', timeMax.toISOString());
    }

    try {
      const data = await apiFetch<{ schedule: ScheduleActivity[]; timeZone?: string }>(
        `/api/calendar/google?${params.toString()}`
      );
      return {
        schedule: data.schedule,
        timeZone: data.timeZone,
      };
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      throw error;
    }
  }

  getSourceName(): string {
    return 'google-calendar';
  }
}

// Google Calendar API types (for server-side use)
export interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  organizer?: {
    displayName?: string;
    email?: string;
  };
  htmlLink?: string;
  /** Google Meet link if video conferencing is enabled */
  hangoutLink?: string;
  /** Conference data with entry points (Meet, phone, etc.) */
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
      label?: string;
    }>;
    conferenceSolution?: {
      name?: string;
      iconUri?: string;
    };
  };
  extendedProperties?: {
    shared?: Record<string, string>;
  };
}

/**
 * Transforms Google Calendar events to ScheduleActivity format
 * This function is used by the server-side API route
 */
export function transformGoogleEventsToSchedule(events: GoogleCalendarEvent[]): ScheduleActivity[] {
  return events.map((event) => {
    const startDate = new Date(event.start?.dateTime || event.start?.date || '');
    const endDate = new Date(event.end?.dateTime || event.end?.date || '');
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

    // Parse extended properties or description for additional metadata
    const metadata = parseEventMetadata(event);
    
    // Extract category prefix from title (e.g., "[Workshop] Building Apps")
    const rawTitle = event.summary || 'Untitled Event';
    const { category: titleCategory, cleanTitle } = extractTitlePrefix(rawTitle);
    
    // Check for Google Meet or other video conferencing
    const meetLink = event.hangoutLink || 
      event.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri;
    
    // Keep physical location separate from video call
    const location = event.location || metadata.location || 'TBD';
    
    // Use calendar event link as URL
    const url = event.htmlLink || '';

    return {
      stage: metadata.stage || 'main',
      date: startDate.toISOString(),
      duration: durationMinutes,
      name: cleanTitle,
      description: stripMetadataFromDescription(event.description || ''),
      host_name: metadata.hostName || '',
      host_media: metadata.hostMedia || '',
      host_icon: metadata.hostIcon || '',
      location,
      category: metadata.category || titleCategory || inferCategory(rawTitle),
      url,
      video_call_url: meetLink || undefined,
    };
  });
}

interface EventMetadata {
  stage?: string;
  category?: string;
  hostName?: string;
  hostMedia?: string;
  hostIcon?: string;
  location?: string;
}

/**
 * Parse additional metadata from event description or extended properties
 * Format in description: [key: value] on separate lines
 */
function parseEventMetadata(event: GoogleCalendarEvent): EventMetadata {
  const metadata: EventMetadata = {};
  
  // Check extended properties first
  if (event.extendedProperties?.shared) {
    const props = event.extendedProperties.shared;
    metadata.stage = props.stage;
    metadata.category = props.category;
    metadata.hostName = props.hostName;
    metadata.hostMedia = props.hostMedia;
    metadata.hostIcon = props.hostIcon;
    metadata.location = props.location;
  }

  // Parse from description as fallback (format: [key: value])
  if (event.description) {
    const metadataRegex = /\[(\w+):\s*([^\]]+)\]/g;
    let match;
    while ((match = metadataRegex.exec(event.description)) !== null) {
      const [, key, value] = match;
      const camelKey = key.replace(/_(\w)/g, (_, c) => c.toUpperCase());
      metadata[camelKey as keyof EventMetadata] = value.trim();
    }
  }

  return metadata;
}


/**
 * Remove metadata tags from description for clean display
 */
function stripMetadataFromDescription(description: string): string {
  return description.replace(/\[(\w+):\s*([^\]]+)\]/g, '').trim();
}

/**
 * Extract category prefix from title (e.g., "[Workshop] Building Apps" -> "Workshop")
 * Returns the category and the clean title without the prefix
 */
function extractTitlePrefix(title: string): { category: string | null; cleanTitle: string } {
  const prefixMatch = title.match(/^\[([^\]]+)\]\s*/);
  if (prefixMatch) {
    return {
      category: prefixMatch[1].trim(),
      cleanTitle: title.slice(prefixMatch[0].length).trim()
    };
  }
  return { category: null, cleanTitle: title };
}

/**
 * Infer category from event title if not explicitly set
 */
function inferCategory(title: string): string {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('workshop')) return 'Workshop';
  if (lowerTitle.includes('ceremony')) return 'Ceremony';
  if (lowerTitle.includes('networking') || lowerTitle.includes('mixer')) return 'Networking';
  if (lowerTitle.includes('mentor')) return 'Mentoring';
  if (lowerTitle.includes('judging') || lowerTitle.includes('demo')) return 'Judging';
  if (lowerTitle.includes('submission') || lowerTitle.includes('deadline')) return 'Deadline';
  if (lowerTitle.includes('hacking')) return 'Hacking';
  
  return 'General';
}

/**
 * Schedule Strategy Context - Manages which strategy to use
 */
export class ScheduleContext {
  private strategy: ScheduleDataSource;

  constructor(strategy?: ScheduleDataSource) {
    // Default to database strategy
    this.strategy = strategy || new DatabaseScheduleStrategy();
  }

  setStrategy(strategy: ScheduleDataSource): void {
    this.strategy = strategy;
  }

  getStrategy(): ScheduleDataSource {
    return this.strategy;
  }

  async getSchedule(hackathonId: string, existingSchedule?: ScheduleActivity[]): Promise<ScheduleResult> {
    return this.strategy.getSchedule(hackathonId, existingSchedule);
  }

  getSourceName(): string {
    return this.strategy.getSourceName();
  }
}

/**
 * Factory function to create the appropriate strategy based on configuration
 */
export function createScheduleStrategy(
  source: 'database' | 'google-calendar' = 'database',
  config?: GoogleCalendarConfig
): ScheduleDataSource {
  switch (source) {
    case 'google-calendar':
      if (!config) {
        throw new Error('GoogleCalendarConfig is required for google-calendar source');
      }
      return new GoogleCalendarStrategy(config);
    case 'database':
    default:
      return new DatabaseScheduleStrategy();
  }
}

/**
 * Default schedule context instance
 * Can be configured at app level or per-component
 */
export const defaultScheduleContext = new ScheduleContext();
