'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { t, type EventsLang } from '@/lib/events/i18n';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

type TimezoneSelectorModalProps = {
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  timeZone: string;
  setTimeZoneAction: React.Dispatch<React.SetStateAction<string>>;
  lang: EventsLang;
};

type TimezoneRow = {
  id: string;
  city: string;
  region: string;
  flag: string;
  offsetMinutes: number;
  offsetLabel: string;
  localTime: string;
  searchText: string;
};

const nestedRegionCountryCodes: Record<string, string> = {
  Argentina: 'AR',
  Indiana: 'US',
  Kentucky: 'US',
  North_Dakota: 'US',
};

const cityCountryCodes: Record<string, string> = {
  Abidjan: 'CI',
  Accra: 'GH',
  Addis_Ababa: 'ET',
  Amsterdam: 'NL',
  Anchorage: 'US',
  Auckland: 'NZ',
  Bangkok: 'TH',
  Berlin: 'DE',
  Bogota: 'CO',
  Buenos_Aires: 'AR',
  Cairo: 'EG',
  Chicago: 'US',
  Dubai: 'AE',
  Dublin: 'IE',
  Hong_Kong: 'HK',
  Honolulu: 'US',
  Jerusalem: 'IL',
  Johannesburg: 'ZA',
  London: 'GB',
  Los_Angeles: 'US',
  Madrid: 'ES',
  Mexico_City: 'MX',
  Moscow: 'RU',
  New_York: 'US',
  Paris: 'FR',
  Rome: 'IT',
  Santiago: 'CL',
  Sao_Paulo: 'BR',
  Seoul: 'KR',
  Shanghai: 'CN',
  Singapore: 'SG',
  Stockholm: 'SE',
  Sydney: 'AU',
  Tokyo: 'JP',
  Toronto: 'CA',
  Vancouver: 'CA',
  Zurich: 'CH',
};

function getTimezoneOffset(tz: string, date: Date): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  if (minutes === 0) return `UTC${sign}${hours}`;
  return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
}

function formatDiff(diffMinutes: number, sameLabel: string): string {
  if (diffMinutes === 0) return sameLabel;

  const sign = diffMinutes > 0 ? '+' : '-';
  const absMinutes = Math.abs(diffMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  if (minutes === 0) return `${sign}${hours}h`;
  if (hours === 0) return `${sign}${minutes}m`;
  return `${sign}${hours}h ${minutes}m`;
}

function formatZoneSegment(segment: string): string {
  return segment.replace(/_/g, ' ');
}

function getCountryCode(timeZone: string): string {
  const parts = timeZone.split('/');
  const city = parts[parts.length - 1];
  const nestedRegion = parts.length > 2 ? parts[1] : '';

  return nestedRegionCountryCodes[nestedRegion] || cityCountryCodes[city] || '';
}

function getRegionName(timeZone: string, locale: string, date: Date): string {
  const timeZoneName = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: 'longGeneric',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  if (timeZoneName && !/^GMT|^UTC/.test(timeZoneName)) {
    return timeZoneName;
  }

  const countryCode = getCountryCode(timeZone);
  const countryName = countryCode
    ? new Intl.DisplayNames([locale], { type: 'region' }).of(countryCode)
    : '';
  if (countryName) return countryName;

  const parts = timeZone.split('/');
  const regionSegment = parts.length > 2 ? parts[1] : parts[0];
  return formatZoneSegment(regionSegment);
}

function getFlagEmoji(timeZone: string): string {
  const countryCode = getCountryCode(timeZone);

  if (!countryCode) return '';

  return countryCode
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
}

function getTimezones(locale: string, date: Date): TimezoneRow[] {
  return Intl.supportedValuesOf('timeZone')
    .map((timeZone) => {
      const parts = timeZone.split('/');
      const city = formatZoneSegment(parts[parts.length - 1]);
      const region = getRegionName(timeZone, locale, date);
      const offsetMinutes = getTimezoneOffset(timeZone, date);
      const localTime = new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date);

      return {
        id: timeZone,
        city,
        region,
        flag: getFlagEmoji(timeZone),
        offsetMinutes,
        offsetLabel: formatOffset(offsetMinutes),
        localTime,
        searchText: `${city} ${region}`.toLowerCase(),
      };
    });
}

function sortByCity(timezones: TimezoneRow[]): TimezoneRow[] {
  return [...timezones].sort(
    (a, b) =>
      a.city.localeCompare(b.city) ||
      a.region.localeCompare(b.region) ||
      a.id.localeCompare(b.id)
  );
}

export function TimezoneSelectorModal({
  open,
  onOpenChangeAction: onOpenChange,
  timeZone,
  setTimeZoneAction: setTimeZone,
  lang,
}: TimezoneSelectorModalProps) {
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => new Date());
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, [open]);

  const timezones = useMemo(() => getTimezones(locale, now), [locale, now]);
  const selectedOffset =
    timezones.find((timezone) => timezone.id === timeZone)?.offsetMinutes ?? 0;
  const filteredTimezones = useMemo(() => {
    const query = search.trim().toLowerCase();
    const results = query
      ? timezones.filter((timezone) => timezone.searchText.includes(query))
      : timezones;
    return sortByCity(results);
  }, [search, timezones]);
  const showFlags =
    timezones.length > 0 && timezones.every((timezone) => timezone.flag);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='max-h-[85vh] gap-0 overflow-hidden border-border bg-background p-3 text-foreground sm:max-w-4xl'
        hideCloseButton
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchInputRef.current?.focus();
        }}
      >
        <DialogTitle className='sr-only'>
          {t(lang, 'schedule.timezoneSelector.modalTitle')}
        </DialogTitle>
        <DialogDescription className='sr-only'>
          {t(lang, 'schedule.timezoneSelector.modalDescription')}
        </DialogDescription>

        <div className='border-b border-border p-6'>
          <div className='relative'>
            <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(
                lang,
                'schedule.timezoneSelector.searchPlaceholder'
              )}
              className='pl-9'
            />
          </div>
        </div>

        <div className='overflow-x-auto'>
          <div className='min-w-[720px]'>
            <div className='grid grid-cols-[minmax(18rem,1fr)_5.5rem_5.5rem_7rem] border-b border-border px-6 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
              <span>{t(lang, 'schedule.timezoneSelector.city')}</span>
              <span className='text-right'>
                {t(lang, 'schedule.timezoneSelector.utc')}
              </span>
              <span className='text-right'>
                {t(lang, 'schedule.timezoneSelector.diff')}
              </span>
              <span className='text-right'>
                {t(lang, 'schedule.timezoneSelector.localTime')}
              </span>
            </div>

            <div className='max-h-[60vh] overflow-y-auto p-4'>
              {filteredTimezones.length === 0 && (
                <div className='px-3 py-8 text-center text-sm text-muted-foreground'>
                  {t(lang, 'schedule.timezoneSelector.empty')}
                </div>
              )}

              {filteredTimezones.map((timezone) => {
                const isSelected = timezone.id === timeZone;
                const diffLabel = formatDiff(
                  timezone.offsetMinutes - selectedOffset,
                  t(lang, 'schedule.timezoneSelector.same')
                );

                return (
                  <button
                    key={timezone.id}
                    type='button'
                    onClick={() => {
                      setTimeZone(timezone.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      'grid w-full cursor-pointer grid-cols-[minmax(18rem,1fr)_5.5rem_5.5rem_7rem] items-center rounded-md px-5 py-4 text-left text-sm transition-colors hover:bg-secondary hover:text-secondary-foreground hover:ring-1 hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected &&
                        'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                    )}
                  >
                    <span className='flex min-w-0 items-center gap-3'>
                      {showFlags && timezone.flag && (
                        <span
                          className='text-lg leading-none'
                          aria-hidden='true'
                        >
                          {timezone.flag}
                        </span>
                      )}
                      <span className='min-w-0'>
                        <span className='block truncate font-semibold'>
                          {timezone.city}
                        </span>
                        <span
                          className={cn(
                            'block truncate text-xs text-muted-foreground',
                            isSelected && 'text-primary-foreground/80'
                          )}
                        >
                          {timezone.region}
                        </span>
                      </span>
                    </span>
                    <span className='text-right tabular-nums'>
                      {timezone.offsetLabel}
                    </span>
                    <span className='text-right tabular-nums'>{diffLabel}</span>
                    <span className='text-right tabular-nums'>
                      {timezone.localTime}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
