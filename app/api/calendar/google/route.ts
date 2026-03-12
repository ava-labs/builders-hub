import { NextRequest, NextResponse } from 'next/server';
import { transformGoogleEventsToSchedule, GoogleCalendarEvent } from '@/lib/hackathons/schedule-strategy';

/**
 * Google Calendar API route
 * 
 * Fetches events from a PUBLIC Google Calendar using an API Key.
 * Requires GOOGLE_CALENDAR_API_KEY environment variable.
 * 
 * Query parameters:
 * - calendarId: The Google Calendar ID (required)
 * - maxResults: Maximum number of events to fetch (default: 100)
 * - timeMin: Only fetch events after this ISO date
 * - timeMax: Only fetch events before this ISO date
 */

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    const calendarId = searchParams.get('calendarId');
    const maxResults = searchParams.get('maxResults') || '100';
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');

    if (!calendarId) {
      return NextResponse.json(
        { error: 'calendarId is required' },
        { status: 400 }
      );
    }

    // Fetch all events using pagination
    const allEvents: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined = undefined;

    do {
      // Build Google Calendar API URL
      const apiParams = new URLSearchParams({
        key: apiKey,
        maxResults: '250', // Max allowed per request
        singleEvents: 'true',
        orderBy: 'startTime',
        // Include conference data (Google Meet links, etc.)
        conferenceDataVersion: '1',
      });

      if (timeMin) {
        apiParams.set('timeMin', timeMin);
      }
      if (timeMax) {
        apiParams.set('timeMax', timeMax);
      }
      if (pageToken) {
        apiParams.set('pageToken', pageToken);
      }

      const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${apiParams.toString()}`;

      const response = await fetch(calendarUrl, {
        next: { revalidate: 60 }, // Cache for 1 minute (reduced for faster updates)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Google Calendar API error:', error);
        
        if (response.status === 404) {
          return NextResponse.json(
            { error: 'Calendar not found. Make sure the calendar is public and the ID is correct.' },
            { status: 404 }
          );
        }
        
        return NextResponse.json(
          { error: `Google Calendar API error: ${response.status}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      const events = (data.items || []) as GoogleCalendarEvent[];
      allEvents.push(...events);
      
      // Get next page token for pagination
      pageToken = data.nextPageToken;
    } while (pageToken);

    const events = allEvents;
    
    // Transform to ScheduleActivity format
    const schedule = transformGoogleEventsToSchedule(events);
    
    // Get calendar timezone from first event or calendar metadata
    const calendarTimeZone = events[0]?.start?.timeZone || '';

    return NextResponse.json({
      schedule,
      totalEvents: events.length,
      calendarId,
      timeZone: calendarTimeZone,
    });
  } catch (error) {
    console.error('Google Calendar API error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}
