import { withApi, successResponse, ValidationError, NotFoundError, InternalError } from '@/lib/api';
import { transformGoogleEventsToSchedule, GoogleCalendarEvent } from '@/lib/hackathons/schedule-strategy';

const CALENDAR_ID_REGEX = /^[a-zA-Z0-9._@:+\-]+$/;
const MAX_CALENDAR_ID_LENGTH = 200;
const FETCH_TIMEOUT_MS = 10_000;

export const GET = withApi(async (req) => {
  const calendarId = req.nextUrl.searchParams.get('calendarId');
  const timeMin = req.nextUrl.searchParams.get('timeMin');
  const timeMax = req.nextUrl.searchParams.get('timeMax');

  // Validate inputs first so clients get proper 400s, not 500s
  if (!calendarId) {
    throw new ValidationError('calendarId is required');
  }

  if (calendarId.length > MAX_CALENDAR_ID_LENGTH || !CALENDAR_ID_REGEX.test(calendarId)) {
    throw new ValidationError('Invalid calendarId format');
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY;

  if (!apiKey) {
    throw new InternalError('Google Calendar API not configured');
  }

  const allEvents: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const apiParams = new URLSearchParams({
      key: apiKey,
      maxResults: '250',
      singleEvents: 'true',
      orderBy: 'startTime',
      conferenceDataVersion: '1',
    });

    if (timeMin) apiParams.set('timeMin', timeMin);
    if (timeMax) apiParams.set('timeMax', timeMax);
    if (pageToken) apiParams.set('pageToken', pageToken);

    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${apiParams.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(calendarUrl, {
        signal: controller.signal,
        next: { revalidate: 60 },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new NotFoundError('Calendar');
        }
        throw new InternalError(`Google Calendar API error: ${response.status}`);
      }

      const data = await response.json();
      const events = (data.items || []) as GoogleCalendarEvent[];
      allEvents.push(...events);
      pageToken = data.nextPageToken;
    } finally {
      clearTimeout(timeoutId);
    }
  } while (pageToken);

  const schedule = transformGoogleEventsToSchedule(allEvents);
  const calendarTimeZone = allEvents[0]?.start?.timeZone || '';

  return successResponse({
    schedule,
    totalEvents: allEvents.length,
    calendarId,
    timeZone: calendarTimeZone,
  });
});
