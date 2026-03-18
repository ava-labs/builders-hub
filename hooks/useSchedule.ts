'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScheduleActivity } from '@/types/hackathons';
import {
  ScheduleDataSource,
  ScheduleContext,
  DatabaseScheduleStrategy,
  GoogleCalendarStrategy,
  GoogleCalendarConfig,
  createScheduleStrategy,
} from '@/lib/hackathons/schedule-strategy';

export type ScheduleSource = 'database' | 'google-calendar';

interface UseScheduleOptions {
  /** The source to fetch schedule from */
  source?: ScheduleSource;
  /** The hackathon ID */
  hackathonId: string;
  /** Existing schedule data from DB (used when source is 'database') */
  existingSchedule?: ScheduleActivity[];
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
  /** Google Calendar configuration (required when source is 'google-calendar') */
  googleCalendarConfig?: GoogleCalendarConfig;
}

interface UseScheduleReturn {
  /** The schedule activities */
  schedule: ScheduleActivity[];
  /** Loading state */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** The current data source name */
  sourceName: string;
  /** Calendar timezone from the source (if available) */
  calendarTimeZone: string | undefined;
  /** Refetch the schedule */
  refetch: () => Promise<void>;
  /** Change the data source */
  setSource: (source: ScheduleSource, config?: GoogleCalendarConfig) => void;
}

/**
 * Hook to fetch hackathon schedule using the Strategy pattern
 * Allows switching between database and Google Calendar data sources
 */
export function useSchedule({
  source = 'database',
  hackathonId,
  existingSchedule = [],
  fetchOnMount = true,
  googleCalendarConfig,
}: UseScheduleOptions): UseScheduleReturn {
  const [schedule, setSchedule] = useState<ScheduleActivity[]>(existingSchedule);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentSource, setCurrentSource] = useState<ScheduleSource>(source);
  const [calendarTimeZone, setCalendarTimeZone] = useState<string | undefined>(undefined);

  // Fetch schedule when source/config changes
  useEffect(() => {
    if (!fetchOnMount) return;

    const strategy = createScheduleStrategy(source, googleCalendarConfig);
    setCurrentSource(source);

    const doFetch = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await strategy.getSchedule(hackathonId, existingSchedule);
        setSchedule(result.schedule);
        if (result.timeZone) {
          setCalendarTimeZone(result.timeZone);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch schedule'));
        // Fallback to existing schedule on error
        setSchedule(existingSchedule);
      } finally {
        setIsLoading(false);
      }
    };

    doFetch();
  }, [source, googleCalendarConfig?.calendarId, hackathonId, fetchOnMount]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    const strategy = createScheduleStrategy(currentSource, googleCalendarConfig);
    setIsLoading(true);
    setError(null);

    try {
      const result = await strategy.getSchedule(hackathonId, existingSchedule);
      setSchedule(result.schedule);
      if (result.timeZone) {
        setCalendarTimeZone(result.timeZone);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch schedule'));
      setSchedule(existingSchedule);
    } finally {
      setIsLoading(false);
    }
  }, [currentSource, googleCalendarConfig, hackathonId, existingSchedule]);

  // Change source programmatically
  const setSource = useCallback((newSource: ScheduleSource, config?: GoogleCalendarConfig) => {
    setCurrentSource(newSource);
    // The useEffect will trigger a refetch due to source change
  }, []);

  // Update schedule when existingSchedule changes (for DB source)
  useEffect(() => {
    if (currentSource === 'database' && existingSchedule.length > 0) {
      setSchedule(existingSchedule);
    }
  }, [existingSchedule, currentSource]);

  return {
    schedule,
    isLoading,
    error,
    sourceName: currentSource,
    calendarTimeZone,
    refetch,
    setSource,
  };
}

export type {
  ScheduleDataSource,
  GoogleCalendarConfig,
};

export {
  ScheduleContext,
  DatabaseScheduleStrategy,
  GoogleCalendarStrategy,
  createScheduleStrategy,
};