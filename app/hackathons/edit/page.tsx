'use client';

import React, { useState, useEffect, memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash, ChevronDown, ChevronRight } from 'lucide-react';
import { t } from './translations';
import { useSession, SessionProvider } from "next-auth/react";
import axios from 'axios';
import { initialData, IDataMain, IDataContent, IDataLatest, ITrack, ISchedule, ISpeaker, IResource, IPartner } from './initials';
import { LanguageButton } from './language-button';


function toLocalDatetimeString(isoString: string) {
  if (!isoString) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(isoString)) {
    const date = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(isoString)) return isoString;
  const date = new Date(isoString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso8601(datetimeLocal: string) {
  if (!datetimeLocal) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(datetimeLocal)) return datetimeLocal;
  const date = new Date(datetimeLocal);
  return date.toISOString();
}

const MyHackathonsList = ({ myHackathons, language, onSelect, selectedId }: { myHackathons: any[], language: 'en' | 'es', onSelect: (hackathon: any) => void, selectedId: string | null }) => {
  if (!myHackathons.length) return null;
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">{t[language].myHackathons}</h2>
      <ul className="flex flex-wrap gap-2">
        {myHackathons.map((hackathon) => (
          <li
            key={hackathon.id}
            className={
              `text-sm px-3 py-1 rounded-md font-medium cursor-pointer transition-colors duration-150 shadow-sm border border-zinc-300 dark:border-zinc-600 ` +
              (hackathon.id === selectedId
                ? 'bg-red-500 text-white'
                : 'bg-zinc-200 dark:bg-zinc-700 hover:bg-red-500 hover:text-white')
            }
            title={hackathon.title}
            onClick={() => onSelect(hackathon)}
          >
            {hackathon.title}
          </li>
        ))}
      </ul>
    </div>
  );
};

const UpdateModal = ({ open, onClose, onConfirm, fieldsToUpdate, t, language }: {
  open: boolean,
  onClose: () => void,
  onConfirm: () => void,
  fieldsToUpdate: { key: string, oldValue: any, newValue: any }[],
  t: any,
  language: 'en' | 'es',
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 max-w-lg w-full">
        <h2 className="text-lg font-bold mb-4">{t[language].confirmUpdateTitle || 'Confirm Update'}</h2>
        <p className="mb-2">{t[language].confirmUpdateText || 'You are about to update the following fields:'}</p>
        <ul className="mb-4 list-disc pl-6">
          {fieldsToUpdate.map(({ key, oldValue, newValue }) => (
            <li key={key} className="mb-1">
              <span className="font-semibold">{key}:</span> <span className="text-red-600 line-through">{String(oldValue)}</span> → <span className="text-green-600">{String(newValue)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600">{t[language].cancel}</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">{t[language].update}</button>
        </div>
      </div>
    </div>
  );
};

type TrackItemProps = {
    track: ITrack;
    index: number;
    collapsed: boolean;
    onChange: (index: number, field: string, value: any) => void;
    onDone: (index: number) => void;
    onExpand: (index: number) => void;
    onRemove: (index: number) => void;
    t: any; 
    language: 'en' | 'es';
    removing: { [key: string]: number | null };
    tracksLength: number;
  };

const TrackItem = memo(function TrackItem({ track, index, collapsed, onChange, onDone, onExpand, onRemove, t, language, removing, tracksLength }: TrackItemProps) {
  return (
    <div
      className={`border border-zinc-700 rounded-lg p-4 mb-6 bg-zinc-900/40 relative transition-all duration-300 ease-in-out ${removing[`track-${index}`] ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100'}`}
    >
      {tracksLength > 1 && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg p-2 transition-transform duration-200 hover:scale-110 flex items-center justify-center cursor-pointer"
          title={t[language].removeTrack}
        >
          <Trash className="w-5 h-5" />
        </button>
      )}
      <h3 className="text-lg font-semibold mb-2">Track {index + 1}</h3>
      {collapsed ? (
        <div className="flex justify-end">
          <button type="button" onClick={() => onExpand(index)} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
            <ChevronRight className="w-5 h-5" /> {t[language].expand}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 text-zinc-400 text-sm">{t[language].selectIcon}</div>
          <Select
            value={track.icon}
            onValueChange={(value) => onChange(index, 'icon', value)}
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select Icon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="server">Server</SelectItem>
              <SelectItem value="link">Link</SelectItem>
              <SelectItem value="brain-circuit">Brain Circuit</SelectItem>
              <SelectItem value="wrench">Wrench</SelectItem>
              <SelectItem value="cpu">CPU</SelectItem>
            </SelectContent>
          </Select>
          <div className="mb-2 text-zinc-400 text-sm">{t[language].selectLogo}</div>
          <Select
            value={track.logo}
            onValueChange={(value) => onChange(index, 'logo', value)}
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select Logo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="server">Server</SelectItem>
              <SelectItem value="link">Link</SelectItem>
              <SelectItem value="brain-circuit">Brain Circuit</SelectItem>
              <SelectItem value="wrench">Wrench</SelectItem>
              <SelectItem value="cpu">CPU</SelectItem>
            </SelectContent>
          </Select>
          <div className="mb-2 text-zinc-400 text-sm">{t[language].trackName}</div>
          <Input
            type="text"
            placeholder="Name"
            value={track.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            className="w-full mb-3"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">{t[language].trackPartner}</div>
          <Input
            type="text"
            placeholder="Partner"
            value={track.partner}
            onChange={(e) => onChange(index, 'partner', e.target.value)}
            className="w-full mb-3"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">{t[language].trackDescription}</div>
          <Input
            type="text"
            placeholder="Description"
            value={track.description}
            onChange={(e) => onChange(index, 'description', e.target.value)}
            className="w-full mb-3"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">{t[language].shortDescription}</div>
          <Input
            type="text"
            placeholder="Short Description"
            value={track.short_description}
            onChange={(e) => onChange(index, 'short_description', e.target.value)}
            className="w-full mb-1"
            required
          />
          <div className="flex justify-end mt-2">
            <button type="button" onClick={() => onDone(index)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer">
              {t[language].done} <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

type ScheduleItemProps = {
  event: ISchedule;
  index: number;
  collapsed: boolean;
  onChange: (index: number, field: string, value: any) => void;
  onDone: (index: number) => void;
  onExpand: (index: number) => void;
  onRemove: (index: number) => void;
  t: any;
  language: 'en' | 'es';
  removing: { [key: string]: number | null };
  scheduleLength: number;
  toLocalDatetimeString: (isoString: string) => string;
};

const ScheduleItem = memo(function ScheduleItem({ event, index, collapsed, onChange, onDone, onExpand, onRemove, t, language, removing, scheduleLength, toLocalDatetimeString }: ScheduleItemProps) {
  return (
    <div className={`border border-zinc-700 rounded-lg p-4 mb-6 bg-zinc-900/40 relative transition-all duration-300 ease-in-out ${removing[`schedule-${index}`] ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100'}`}>
      {scheduleLength > 1 && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg p-2 transition-transform duration-200 hover:scale-110 flex items-center justify-center cursor-pointer"
          title={t[language].removeSchedule}
        >
          <Trash className="w-5 h-5" />
        </button>
      )}
      <h3 className="text-lg font-semibold mb-2">Schedule {index + 1}</h3>
      {collapsed ? (
        <div className="flex justify-end">
          <button type="button" onClick={() => onExpand(index)} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
            <ChevronRight className="w-5 h-5" /> {t[language].expand}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 text-zinc-400 text-sm">{t[language].scheduleDate}</div>
          <Input
            type="datetime-local"
            placeholder="Date"
            value={toLocalDatetimeString(event.date)}
            onChange={(e) => onChange(index, 'date', e.target.value)}
            className="w-full mb-3"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">{t[language].scheduleName}</div>
          <Input
            type="text"
            placeholder="Name"
            value={event.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            className="w-full mb-3"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">{t[language].scheduleCategory}</div>
          <Select
            value={event.category}
            onValueChange={(value) => onChange(index, 'category', value)}
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Registration">Registration</SelectItem>
              <SelectItem value="Food">Food</SelectItem>
              <SelectItem value="Info session">Info session</SelectItem>
              <SelectItem value="Networking">Networking</SelectItem>
              <SelectItem value="Workshop">Workshop</SelectItem>
              <SelectItem value="Hacking">Hacking</SelectItem>
              <SelectItem value="Wellness">Wellness</SelectItem>
              <SelectItem value="Deadline">Deadline</SelectItem>
              <SelectItem value="Judging">Judging</SelectItem>
              <SelectItem value="Ceremony">Ceremony</SelectItem>
            </SelectContent>
          </Select>
          <div className="mb-2 text-zinc-400 text-sm">{t[language].scheduleLocation}</div>
          <Input
            type="text"
            placeholder="Location"
            value={event.location}
            onChange={(e) => onChange(index, 'location', e.target.value)}
            className="w-full mb-3"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">{t[language].scheduleDescription}</div>
          <Input
            type="text"
            placeholder="Description"
            value={event.description}
            onChange={(e) => onChange(index, 'description', e.target.value)}
            className="w-full mb-3"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">{t[language].scheduleDuration}</div>
          <Input
            type="number"
            placeholder="Duration (minutes)"
            value={event.duration}
            onChange={(e) => onChange(index, 'duration', e.target.value)}
            className="w-full mb-1"
            required
            min="1"
          />
          <div className="flex justify-end mt-2">
            <button type="button" onClick={() => onDone(index)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer">
              {t[language].done} <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

type SpeakerItemProps = {
  speaker: ISpeaker;
  index: number;
  collapsed: boolean;
  onChange: (index: number, field: string, value: any) => void;
  onDone: (index: number) => void;
  onExpand: (index: number) => void;
  onRemove: (index: number) => void;
  t: any;
  language: 'en' | 'es';
  removing: { [key: string]: number | null };
  speakersLength: number;
  onPictureChange: (index: number, url: string) => void;
};

const SpeakerItem = memo(function SpeakerItem({ speaker, index, collapsed, onChange, onDone, onExpand, onRemove, t, language, removing, speakersLength, onPictureChange }: SpeakerItemProps) {
  return (
    <div className={`border border-zinc-700 rounded-lg p-4 mb-6 bg-zinc-900/40 relative transition-all duration-300 ease-in-out ${removing[`speaker-${index}`] ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100'}`}>
      {speakersLength > 1 && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg p-2 transition-transform duration-200 hover:scale-110 flex items-center justify-center cursor-pointer"
          title={t[language].removeSpeaker}
        >
          <Trash className="w-5 h-5" />
        </button>
      )}
      <h3 className="text-lg font-semibold mb-2">Speaker {index + 1}</h3>
      {collapsed ? (
        <div className="flex justify-end">
          <button type="button" onClick={() => onExpand(index)} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
            <ChevronRight className="w-5 h-5" /> {t[language].expand}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 text-zinc-400 text-sm">{t[language].speakerIcon}</div>
          <Select
            value={speaker.icon}
            onValueChange={(value) => onChange(index, 'icon', value)}
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select Icon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="code">Code</SelectItem>
              <SelectItem value="megaphone">Megaphone</SelectItem>
            </SelectContent>
          </Select>
          <div className="mb-2 text-zinc-400 text-sm">{t[language].speakerName}</div>
          <Input
            type="text"
            placeholder="Name"
            value={speaker.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            className="w-full mb-3"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">{t[language].speakerCompany}</div>
          <Input
            type="text"
            placeholder="Category"
            value={speaker.category}
            onChange={(e) => onChange(index, 'category', e.target.value)}
            className="w-full mb-1"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">Picture</div>
          <Input
            type="text"
            placeholder="Picture URL"
            value={speaker.picture}
            onChange={e => onPictureChange(index, e.target.value)}
            className="w-full mb-2"
          />
          {speaker.picture && (
            <img src={speaker.picture} alt={speaker.name} className="w-16 h-16 object-cover rounded mb-2" />
          )}
          <div className="flex justify-end mt-2">
            <button type="button" onClick={() => onDone(index)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer">
              {t[language].done} <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

type ResourceItemProps = {
  resource: IResource;
  index: number;
  collapsed: boolean;
  onChange: (index: number, field: string, value: any) => void;
  onDone: (index: number) => void;
  onExpand: (index: number) => void;
  onRemove: (index: number) => void;
  t: any;
  language: 'en' | 'es';
  removing: { [key: string]: number | null };
  resourcesLength: number;
};

const ResourceItem = memo(function ResourceItem({ resource, index, collapsed, onChange, onDone, onExpand, onRemove, t, language, removing, resourcesLength }: ResourceItemProps) {
  return (
    <div className={`border border-zinc-700 rounded-lg p-4 mb-6 bg-zinc-900/40 relative transition-all duration-300 ease-in-out ${removing[`resource-${index}`] ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100'}`}>
      {resourcesLength > 1 && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg p-2 transition-transform duration-200 hover:scale-110 flex items-center justify-center cursor-pointer"
          title={t[language].removeResource}
        >
          <Trash className="w-5 h-5" />
        </button>
      )}
      <h3 className="text-lg font-semibold mb-2">Resource {index + 1}</h3>
      {collapsed ? (
        <div className="flex justify-end">
          <button type="button" onClick={() => onExpand(index)} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
            <ChevronRight className="w-5 h-5" /> {t[language].expand}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 text-zinc-400 text-sm">{t[language].resourceIcon}</div>
          <Select
            value={resource.icon}
            onValueChange={(value) => onChange(index, 'icon', value)}
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select Icon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="app-window">App Window</SelectItem>
              <SelectItem value="pickaxe">Pickaxe</SelectItem>
              <SelectItem value="package">Package</SelectItem>
              <SelectItem value="layout-grid">Layout Grid</SelectItem>
            </SelectContent>
          </Select>
          <div className="mb-2 text-zinc-400 text-sm">{t[language].resourceLink}</div>
          <Input
            type="text"
            placeholder="Link"
            value={resource.link}
            onChange={(e) => onChange(index, 'link', e.target.value)}
            className="w-full mb-3"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">{t[language].resourceTitle}</div>
          <Input
            type="text"
            placeholder="Title"
            value={resource.title}
            onChange={(e) => onChange(index, 'title', e.target.value)}
            className="w-full mb-3"
            required
          />
          <div className="mb-2 text-zinc-400 text-sm">{t[language].resourceDescription}</div>
          <Input
            type="text"
            placeholder="Description"
            value={resource.description}
            onChange={(e) => onChange(index, 'description', e.target.value)}
            className="w-full mb-1"
            required
          />
          <div className="flex justify-end mt-2">
            <button type="button" onClick={() => onDone(index)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer">
              {t[language].done} <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

const HackathonsEdit = () => {
  const { data: session, status } = useSession();
  const [myHackathons, setMyHackathons] = useState<any[]>([]);
  const [isSelectedHackathon, setIsSelectedHackathon] = useState(false);
  const [selectedHackathon, setSelectedHackathon] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formDataMain, setFormDataMain] = useState<IDataMain>(initialData.main);
  const [formDataContent, setFormDataContent] = useState<IDataContent>({
    ...initialData.content,
    partners: [{ name: '', logo: '' }],
  });
  const [formDataLatest, setFormDataLatest] = useState<IDataLatest>(initialData.latest);

  const getMyHackathons = async () => {
    const response = await axios.get(
        `/api/hackathons`,
        {
            headers: {
                id: session?.user?.id,
            }
        }
      );
      if (response.data?.hackathons?.length > 0) {
        console.log({response: response.data.hackathons});
          setMyHackathons(response.data.hackathons)
      }
  }
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      if (session.user.custom_attributes?.includes("hackathonCreator")) {
        getMyHackathons()
      }
    }
  }, [session, status]);

  const handleSelectHackathon = (hackathon: any) => {
    setIsSelectedHackathon(true);
    setSelectedHackathon(hackathon);
    setFormDataMain({
      title: hackathon.title ?? '',
      description: hackathon.description ?? '',
      location: hackathon.location ?? '',
      total_prizes: Number(hackathon.total_prizes) ?? 0,
      tags: hackathon.tags ?? [''],
    });
    console.log({hackathon});
    setFormDataContent({
      ...(hackathon.content ?? {}),
      tracks: hackathon.content?.tracks ?? [{ icon: '', logo: '', name: '', partner: '', description: '', short_description: '' }],
      address: hackathon.content?.address ?? '',
      partners: hackathon.content?.partners ?? [''],
      schedule: hackathon.content?.schedule ?? [{ url: null, date: '', name: '', category: '', location: '', description: '', duration: 0 }],
      speakers: (hackathon.content?.speakers ?? [{ icon: '', name: '', category: '', picture: '' }]).map((s: any) => ({ ...s, picture: s.picture ?? '' })),
      resources: hackathon.content?.resources ?? [{ icon: '', link: '', title: '', description: '' }],
      tracks_text: hackathon.content?.tracks_text ?? '',
      speakers_text: hackathon.content?.speakers_text ?? '',
      join_custom_link: hackathon.content?.join_custom_link ?? '',
      join_custom_text: hackathon.content?.join_custom_text ?? null,
      become_sponsor_link: hackathon.content?.become_sponsor_link ?? '',
      submission_custom_link: hackathon.content?.submission_custom_link ?? null,
      judging_guidelines: hackathon.content?.judging_guidelines ?? '',
      submission_deadline: toLocalDatetimeString(hackathon.content?.submission_deadline ?? ''),
      registration_deadline: toLocalDatetimeString(hackathon.content?.registration_deadline ?? ''),
    });
    setFormDataLatest({
      start_date: toLocalDatetimeString(hackathon.start_date ?? ''),
      end_date: toLocalDatetimeString(hackathon.end_date ?? ''),
      timezone: hackathon.timezone ?? '',
      banner: hackathon.banner ?? '',
      participants: Number(hackathon.participants) ?? 0,
      icon: hackathon.icon ?? '',
      small_banner: hackathon.small_banner ?? '',
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setIsSelectedHackathon(false);
    setSelectedHackathon(null);
    setFormDataMain(initialData.main);
    setFormDataContent(initialData.content);
    setFormDataLatest(initialData.latest);
    setShowForm(false);
  };

  const [removing, setRemoving] = useState<{ [key: string]: number | null }>({});
  const [collapsed, setCollapsed] = useState({
    main: false,
    content: false,
    last: false,
  });

  const [language, setLanguage] = useState<'en' | 'es'>('en');

  const [collapsedTracks, setCollapsedTracks] = useState<boolean[]>(formDataContent.tracks.map(() => false));


  useEffect(() => {
    setCollapsedTracks((prev) => {
      if (formDataContent.tracks.length > prev.length) {
        return [...prev, ...Array(formDataContent.tracks.length - prev.length).fill(false)];
      } else if (formDataContent.tracks.length < prev.length) {
        return prev.slice(0, formDataContent.tracks.length);
      }
      return prev;
    });
  }, [formDataContent.tracks.length]);

  const [collapsedSchedules, setCollapsedSchedules] = useState<boolean[]>(formDataContent.schedule.map(() => false));
  const [collapsedSpeakers, setCollapsedSpeakers] = useState<boolean[]>(formDataContent.speakers.map(() => false));
  const [collapsedResources, setCollapsedResources] = useState<boolean[]>(formDataContent.resources.map(() => false));

  useEffect(() => {
    setCollapsedSchedules((prev) => {
      if (formDataContent.schedule.length > prev.length) {
        return [...prev, ...Array(formDataContent.schedule.length - prev.length).fill(false)];
      } else if (formDataContent.schedule.length < prev.length) {
        return prev.slice(0, formDataContent.schedule.length);
      }
      return prev;
    });
  }, [formDataContent.schedule.length]);
  useEffect(() => {
    setCollapsedSpeakers((prev) => {
      if (formDataContent.speakers.length > prev.length) {
        return [...prev, ...Array(formDataContent.speakers.length - prev.length).fill(false)];
      } else if (formDataContent.speakers.length < prev.length) {
        return prev.slice(0, formDataContent.speakers.length);
      }
      return prev;
    });
  }, [formDataContent.speakers.length]);
  useEffect(() => {
    setCollapsedResources((prev) => {
      if (formDataContent.resources.length > prev.length) {
        return [...prev, ...Array(formDataContent.resources.length - prev.length).fill(false)];
      } else if (formDataContent.resources.length < prev.length) {
        return prev.slice(0, formDataContent.resources.length);
      }
      return prev;
    });
  }, [formDataContent.resources.length]);

 
  const handleScheduleDone = (idx: number) => {
    setCollapsedSchedules((prev) => prev.map((v, i) => (i === idx ? true : v)));
  };
  const handleScheduleExpand = (idx: number) => {
    setCollapsedSchedules((prev) => prev.map((v, i) => (i === idx ? false : v)));
  };
  const handleSpeakerDone = (idx: number) => {
    setCollapsedSpeakers((prev) => prev.map((v, i) => (i === idx ? true : v)));
  };
  const handleSpeakerExpand = (idx: number) => {
    setCollapsedSpeakers((prev) => prev.map((v, i) => (i === idx ? false : v)));
  };
  const handleResourceDone = (idx: number) => {
    setCollapsedResources((prev) => prev.map((v, i) => (i === idx ? true : v)));
  };
  const handleResourceExpand = (idx: number) => {
    setCollapsedResources((prev) => prev.map((v, i) => (i === idx ? false : v)));
  };

  const animateRemove = (type: string, index: number, removeFn: (i: number) => void) => {
    setRemoving((prev) => ({ ...prev, [`${type}-${index}`]: Date.now() }));
    setTimeout(() => {
      removeFn(index);
      setRemoving((prev) => ({ ...prev, [`${type}-${index}`]: null }));
    }, 300);
  };

  const handleTagChange = (index: number, value: string) => {
    const newTags = [...formDataMain.tags];
    newTags[index] = value;
    setFormDataMain({ ...formDataMain, tags: newTags });
  };

  const addTag = () => {
    setFormDataMain({ ...formDataMain, tags: [...formDataMain.tags, ''] });
  };

  const removeTag = (index: number) => {
    const newTags = formDataMain.tags.filter((_, i) => i !== index);
    setFormDataMain({ ...formDataMain, tags: newTags });
  };

  const handlePartnerInputChange = (index: number, value: string) => {
    const newPartners = [...formDataContent.partners];
    newPartners[index] = { ...newPartners[index], name: value };
    setFormDataContent({
      ...formDataContent,
      partners: newPartners,
    });
  };

  const addPartner = () => {
    setFormDataContent({
      ...formDataContent,
      partners: [...formDataContent.partners, { name: '', logo: '' }],
    });
  };

  const removePartner = (index: number) => {
    const newPartners = formDataContent.partners.filter((_, i) => i !== index);
    setFormDataContent({
      ...formDataContent,
      partners: newPartners,
    });
  };

  const addTrack = () => {
    setFormDataContent({
      ...formDataContent,
      tracks: [
        ...formDataContent.tracks,
        {
          icon: '',
          logo: '',
          name: '',
          partner: '',
          description: '',
          short_description: '',
        },
      ],
    });
  };

  const addSchedule = () => {
    setFormDataContent({
      ...formDataContent,
      schedule: [
        ...formDataContent.schedule,
        {
          url: null,
          date: '',
          name: '',
          category: '',
          location: '',
          description: '',
          duration: 0,
        },
      ],
    });
  };

  const addSpeaker = () => {
    setFormDataContent({
      ...formDataContent,
      speakers: [
        ...formDataContent.speakers,
        { icon: '', name: '', category: '', picture: '' },
      ],
    });
  };

  const addResource = () => {
    setFormDataContent({
      ...formDataContent,
      resources: [
        ...formDataContent.resources,
        { icon: '', link: '', title: '', description: '' },
      ],
    });
  };

  const removeTrack = (index: number) => {
    if (formDataContent.tracks.length > 1) {
      const newTracks = formDataContent.tracks.filter((_, i) => i !== index);
      setFormDataContent({ ...formDataContent, tracks: newTracks });
    }
  };

  const removeSchedule = (index: number) => {
    if (formDataContent.schedule.length > 1) {
      const newSchedule = formDataContent.schedule.filter((_, i) => i !== index);
      setFormDataContent({ ...formDataContent, schedule: newSchedule });
    }
  };

  const removeSpeaker = (index: number) => {
    if (formDataContent.speakers.length > 1) {
      const newSpeakers = formDataContent.speakers.filter((_, i) => i !== index);
      setFormDataContent({ ...formDataContent, speakers: newSpeakers });
    }
  };

  const removeResource = (index: number) => {
    if (formDataContent.resources.length > 1) {
      const newResources = formDataContent.resources.filter((_, i) => i !== index);
      setFormDataContent({ ...formDataContent, resources: newResources });
    }
  };

  const getDataToSend = () => {
    const content = { ...formDataContent };
    content.submission_deadline = toIso8601(content.submission_deadline);
    content.registration_deadline = toIso8601(content.registration_deadline);
    content.schedule = content.schedule.map(ev => ({ ...ev, date: toIso8601(ev.date) }));
    const latest = { ...formDataLatest };
    latest.start_date = toIso8601(latest.start_date);
    latest.end_date = toIso8601(latest.end_date);
    return {
      ...formDataMain,
      content,
      ...latest,
      top_most: true,
      organizers: null,
      custom_link: null,
      status: selectedHackathon?.status ?? "UPCOMING"
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const handleDone = (section: 'main' | 'content' | 'last') => {
    setCollapsed({ ...collapsed, [section]: true });
  };

  const handleTrackDone = (index: number) => {
    setCollapsedTracks((prev) => prev.map((v, i) => (i === index ? true : v)));
  };

  const handleTrackExpand = (index: number) => {
    setCollapsedTracks((prev) => prev.map((v, i) => (i === index ? false : v)));
  };

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [fieldsToUpdate, setFieldsToUpdate] = useState<{ key: string, oldValue: any, newValue: any }[]>([]);

  const [loading, setLoading] = useState(false);

  const doSubmit = async () => {
    setLoading(true);
    const dataToSend = {...getDataToSend(), created_by: session?.user?.id};
    console.log({dataToSend, isSelectedHackathon});
    if (!isSelectedHackathon) {
      try {
        const response = await fetch('/api/hackathons', {
          method: 'POST', 
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.APIKEY ?? '',
          },
          body: JSON.stringify(dataToSend),
        });
        
        if (response.status === 200) {
          setShowUpdateModal(true);
          setFieldsToUpdate([{
            key: 'success',
            oldValue: '',
            newValue: 'Hackathon created successfully!'
          }]);
          setFormDataMain(initialData.main);
          setFormDataContent(initialData.content);
          setFormDataLatest(initialData.latest);
          setShowForm(false);
          setIsSelectedHackathon(false);
          setSelectedHackathon(null);
          await getMyHackathons();
        }
      } catch (error) {
        console.error('Error creating hackathon:', error);
      } finally {
        setLoading(false);
      }
    } else {
      console.log({selectedHackathon, id: selectedHackathon?.id});
      try {

        const response = await fetch(`/api/hackathons/${selectedHackathon?.id}`, {
          method: 'PUT', 
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.APIKEY ?? '',
          },
          body: JSON.stringify(dataToSend),
        });
        
       if (response.status === 200) {
          setFormDataMain(initialData.main);
          setFormDataContent(initialData.content);
          setFormDataLatest(initialData.latest);
          setShowForm(false);
          setIsSelectedHackathon(false);
          setSelectedHackathon(null);
          await getMyHackathons();
        }
      } catch (error) {
        console.error('Error updating hackathon:', error);
      } finally {
        setLoading(false);
      }
    }
    
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteClick = async () => {
    console.log('delete');
    try {
      const response = await fetch(`/api/hackathons/${selectedHackathon?.id}`, {
        method: 'DELETE', 
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.APIKEY ?? '',
        },
      });
      console.log(response);
    } catch (error) {
      console.error('Error deleting hackathon:', error);
    }
  }

  const handleUpdateClick = () => {
    const dataToSend = getDataToSend();
    const changedFields: { key: string, oldValue: any, newValue: any }[] = [];
    if (selectedHackathon) {
      Object.keys(dataToSend).forEach(key => {
        const oldValue = (selectedHackathon as any)[key];
        const newValue = (dataToSend as any)[key];
        if (typeof newValue === 'object') {
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changedFields.push({ key, oldValue: JSON.stringify(oldValue), newValue: JSON.stringify(newValue) });
          }
        } else {
          if (oldValue !== newValue) {
            changedFields.push({ key, oldValue, newValue });
          }
        }
      });
    }
    setFieldsToUpdate(changedFields);
    setShowUpdateModal(true);
  };

  const handleConfirmUpdate = () => {
    setShowUpdateModal(false);
    doSubmit();
  };

  const handleTrackFieldChange = useCallback((idx: number, field: string, value: any) => {
    setFormDataContent(prev => {
      const newTracks = [...prev.tracks];
      newTracks[idx] = { ...newTracks[idx], [field]: value };
      return { ...prev, tracks: newTracks };
    });
  }, [setFormDataContent]);

  const handleScheduleFieldChange = useCallback((idx: number, field: string, value: any) => {
    setFormDataContent(prev => {
      const newSchedule = [...prev.schedule];
      newSchedule[idx] = { ...newSchedule[idx], [field]: field === 'duration' ? Number(value) : value };
      return { ...prev, schedule: newSchedule };
    });
  }, [setFormDataContent]);

  const handleSpeakerFieldChange = useCallback((idx: number, field: string, value: any) => {
    setFormDataContent(prev => {
      const newSpeakers = [...prev.speakers];
      newSpeakers[idx] = { ...newSpeakers[idx], [field]: value };
      return { ...prev, speakers: newSpeakers };
    });
  }, [setFormDataContent]);

  const handleResourceFieldChange = useCallback((idx: number, field: string, value: any) => {
    setFormDataContent(prev => {
      const newResources = [...prev.resources];
      newResources[idx] = { ...newResources[idx], [field]: value };
      return { ...prev, resources: newResources };
    });
  }, [setFormDataContent]);

  const handlePartnerLogoChange = (index: number, url: string) => {
    const newPartners = [...formDataContent.partners];
    newPartners[index] = { ...newPartners[index], logo: url };
    setFormDataContent({
      ...formDataContent,
      partners: newPartners,
    });
  };

  const handleSpeakerPictureChange = (index: number, url: string) => {
    setFormDataContent(prev => {
      const newSpeakers = [...prev.speakers];
      newSpeakers[index] = { ...newSpeakers[index], picture: url };
      return { ...prev, speakers: newSpeakers };
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <UpdateModal
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleConfirmUpdate}
        fieldsToUpdate={fieldsToUpdate}
        t={t}
        language={language}
      />
      <LanguageButton 
        language={language} 
        onLanguageChange={setLanguage} 
        t={t} 
      />
      <h1 className="text-3xl font-bold mb-4">{t[language].editHackathons}</h1>
      <MyHackathonsList myHackathons={myHackathons} language={language} onSelect={handleSelectHackathon} selectedId={selectedHackathon?.id ?? null} />
      <Button onClick={() => { setShowForm(true); setSelectedHackathon(null); setIsSelectedHackathon(false); }} className="mb-4" disabled={isSelectedHackathon}>
        {t[language].addNewHackathon}
      </Button>
      {showForm && (
        <>
          {isSelectedHackathon && (
            <div className="flex gap-2 mb-4">
              <Button onClick={handleCancelEdit} variant="outline">
                {t[language].cancel}
              </Button>
              <Button type="button" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleUpdateClick}>
                {t[language].update}
              </Button>  
              {/* <Button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete
              </Button> */}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-zinc-900/60 border border-zinc-700 rounded-lg p-6 my-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">{t[language].mainTopics}</h2>
                {collapsed.main && (
                  <button onClick={() => setCollapsed({ ...collapsed, main: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                    <ChevronRight className="w-5 h-5" /> {t[language].expand}
                  </button>
                )}
              </div>
              {!collapsed.main && (
                <>
                  <div className="mb-2 text-zinc-400 text-sm">{t[language].mainName}</div>
                  <Input
                    type="text"
                    name="title"
                    placeholder="Title"
                    value={formDataMain.title}
                    onChange={(e) => {
                      setFormDataMain(prev => ({ ...prev, title: e.target.value }));
                    }}
                    className="w-full mb-4"
                    required
                  />
                  <div className="mb-2 text-zinc-400 text-sm">{t[language].description}</div>
                  <Input
                    type="text"
                    name="description"
                    placeholder="Description"
                    value={formDataMain.description}
                    onChange={(e) => {
                      setFormDataMain(prev => ({ ...prev, description: e.target.value }));
                    }}
                    className="w-full mb-4"
                    required
                  />
                  <div className="mb-2 text-zinc-400 text-sm">{t[language].city}</div>
                  <Input
                    type="text"
                    name="location"
                    placeholder="Location"
                    value={formDataMain.location}
                    onChange={(e) => {
                      setFormDataMain(prev => ({ ...prev, location: e.target.value }));
                    }}
                    className="w-full mb-4"
                    required
                  />
                  <div className="mb-2 text-zinc-400 text-sm">{t[language].totalPrizes}</div>
                  <Input
                    type="number"
                    name="total_prizes"
                    placeholder="Total Prizes"
                    value={formDataMain.total_prizes}
                    onChange={(e) => {
                      setFormDataMain(prev => ({ ...prev, total_prizes: Number(e.target.value) }));
                    }}
                    className="w-full mb-4"
                    required
                  />
                  <div className="flex flex-col space-y-2 bg-zinc-900/60 border border-zinc-700 rounded-lg p-4 my-4">
                    <label className="font-medium">Tags:</label>
                    <div className="mb-2 text-zinc-400 text-sm">{t[language].tagsHelp}</div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {formDataMain.tags.map((tag, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={tag}
                            onChange={e => handleTagChange(idx, e.target.value)}
                            className="w-32 px-2 py-1 text-sm"
                            placeholder={`Tag ${idx + 1}`}
                            required
                          />
                          {formDataMain.tags.length > 1 && (
                            <button type="button" onClick={() => removeTag(idx)} className="text-red-500 hover:text-red-700 px-1">×</button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={addTag} className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white ml-2">
                        <span className="text-lg font-bold">+</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button 
                      type="button"
                      onClick={() => handleDone('main')} 
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer"
                    >
                      {t[language].done} <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
              {collapsed.main && (
                <div className="text-zinc-400 italic">{t[language].mainTopicsCompleted}</div>
              )}
            </div>
            <div className="bg-zinc-900/60 border border-zinc-700 rounded-lg p-6 my-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">{t[language].content}</h2>
                {collapsed.content && (
                  <button onClick={() => setCollapsed({ ...collapsed, content: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                    <ChevronRight className="w-5 h-5" /> {t[language].expand}
                  </button>
                )}
              </div>
              {!collapsed.content && (
                <>
                  <div className="space-y-4">
                    <label className="font-medium text-xl">{t[language].tracks}:</label>
                    {formDataContent.tracks.map((track, index) => (
                      <TrackItem
                        key={index}
                        track={track}
                        index={index}
                        collapsed={collapsedTracks[index]}
                        onChange={handleTrackFieldChange}
                        onDone={handleTrackDone}
                        onExpand={handleTrackExpand}
                        onRemove={animateRemove.bind(null, 'track', index, removeTrack)}
                        t={t}
                        language={language}
                        removing={removing}
                        tracksLength={formDataContent.tracks.length}
                      />
                    ))}
                    <div className="flex justify-end">
                      <Button type="button" onClick={addTrack} className="mt-2 bg-red-500 hover:bg-red-600 text-white flex items-center gap-2">
                        <Plus className="w-4 h-4" /> {t[language].addTrack}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="font-medium text-xl mb-2 block">{t[language].address}:</label>
                    <div className="mb-2 text-zinc-400 text-sm">{t[language].addressHelp}</div>
                    <Input
                      type="text"
                      placeholder="Address"
                      value={formDataContent.address}
                      onChange={(e) => setFormDataContent({ ...formDataContent, address: e.target.value })}
                      className="w-full mb-4"
                      required
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="font-medium text-xl mb-2 block">{t[language].partners}:</label>
                    <div className="mb-2 text-zinc-400 text-sm">{t[language].partnersHelp}</div>
                    <div className="flex flex-wrap gap-2 items-center mb-4">
                      {formDataContent.partners.map((partner, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={partner.name}
                            onChange={e => handlePartnerInputChange(idx, e.target.value)}
                            className="w-40 px-2 py-1 text-sm"
                            placeholder={`Partner ${idx + 1}`}
                            required
                          />
                          <Input
                            type="text"
                            placeholder="Logo URL"
                            value={partner.logo}
                            onChange={e => handlePartnerLogoChange(idx, e.target.value)}
                            className="w-40 px-2 py-1 text-sm"
                          />
                          {partner.logo && (
                            <img src={partner.logo} alt={`${partner.name} logo`} className="w-10 h-10 object-cover rounded" />
                          )}
                          {formDataContent.partners.length > 1 && (
                            <button type="button" onClick={() => removePartner(idx)} className="text-red-500 hover:text-red-700 px-1">×</button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={addPartner} className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white ml-2">
                        <span className="text-lg font-bold">+</span>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="font-medium text-xl mb-2 block">{t[language].schedule}:</label>
                    <div className="mb-2 text-zinc-400 text-sm">{t[language].scheduleHelp}</div>
                    {formDataContent.schedule.map((event, index) => (
                      <ScheduleItem
                        key={index}
                        event={event}
                        index={index}
                        collapsed={collapsedSchedules[index]}
                        onChange={handleScheduleFieldChange}
                        onDone={handleScheduleDone}
                        onExpand={handleScheduleExpand}
                        onRemove={animateRemove.bind(null, 'schedule', index, removeSchedule)}
                        t={t}
                        language={language}
                        removing={removing}
                        scheduleLength={formDataContent.schedule.length}
                        toLocalDatetimeString={toLocalDatetimeString}
                      />
                    ))}
                    <div className="flex justify-end">
                      <Button type="button" onClick={addSchedule} className="mt-2 bg-red-500 hover:bg-red-600 text-white flex items-center gap-2">
                        <Plus className="w-4 h-4" /> {t[language].addSchedule}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="font-medium text-xl mb-2 block">{t[language].speakers}:</label>
                    {formDataContent.speakers.map((speaker, index) => (
                      <SpeakerItem
                        key={index}
                        speaker={speaker}
                        index={index}
                        collapsed={collapsedSpeakers[index]}
                        onChange={handleSpeakerFieldChange}
                        onDone={handleSpeakerDone}
                        onExpand={handleSpeakerExpand}
                        onRemove={animateRemove.bind(null, 'speaker', index, removeSpeaker)}
                        t={t}
                        language={language}
                        removing={removing}
                        speakersLength={formDataContent.speakers.length}
                        onPictureChange={handleSpeakerPictureChange}
                      />
                    ))}
                    <div className="flex justify-end">
                      <Button type="button" onClick={addSpeaker} className="mt-2 bg-red-500 hover:bg-red-600 text-white flex items-center gap-2">
                        <Plus className="w-4 h-4" /> {t[language].addSpeaker}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="font-medium text-xl mb-2 block">{t[language].resources}:</label>
                    {formDataContent.resources.map((resource, index) => (
                      <ResourceItem
                        key={index}
                        resource={resource}
                        index={index}
                        collapsed={collapsedResources[index]}
                        onChange={handleResourceFieldChange}
                        onDone={handleResourceDone}
                        onExpand={handleResourceExpand}
                        onRemove={animateRemove.bind(null, 'resource', index, removeResource)}
                        t={t}
                        language={language}
                        removing={removing}
                        resourcesLength={formDataContent.resources.length}
                      />
                    ))}
                    <div className="flex justify-end">
                      <Button type="button" onClick={addResource} className="mt-2 bg-red-500 hover:bg-red-600 text-white flex items-center gap-2">
                        <Plus className="w-4 h-4" /> {t[language].addResource}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].trackText}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].trackTextHelp}</div>
                      <Input
                        type="text"
                        placeholder="Tracks Text"
                        value={formDataContent.tracks_text}
                        onChange={e => setFormDataContent({ ...formDataContent, tracks_text: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].speakerText}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].speakerTextHelp}</div>
                      <Input
                        type="text"
                        placeholder="Speakers Text"
                        value={formDataContent.speakers_text}
                        onChange={e => setFormDataContent({ ...formDataContent, speakers_text: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].speakersBanner || 'Speakers Banner'}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].speakersBannerHelp || 'Text for the speakers banner.'}</div>
                      <Input
                        type="text"
                        placeholder="Speakers Banner"
                        value={formDataContent.speakers_banner}
                        onChange={e => setFormDataContent({ ...formDataContent, speakers_banner: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].joinCustomLink}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].joinCustomLinkHelp}</div>
                      <Input
                        type="text"
                        placeholder="Join Custom Link"
                        value={formDataContent.join_custom_link}
                        onChange={e => setFormDataContent({ ...formDataContent, join_custom_link: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].joinCustomText || 'Join Custom Text'}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].joinCustomTextHelp || 'Text for the join custom link.'}</div>
                      <Input
                        type="text"
                        placeholder="Join Custom Text"
                        value={formDataContent.join_custom_text || ''}
                        onChange={e => setFormDataContent({ ...formDataContent, join_custom_text: e.target.value || null })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].judgingGuidelines}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].judgingGuidelinesHelp}</div>
                      <Input
                        type="text"
                        placeholder="Judging Guidelines"
                        value={formDataContent.judging_guidelines}
                        onChange={e => setFormDataContent({ ...formDataContent, judging_guidelines: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].submissionDeadline}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].submissionDeadlineHelp}</div>
                      <Input
                        type="datetime-local"
                        placeholder="Submission Deadline"
                        value={formDataContent.submission_deadline}
                        onChange={(e) => setFormDataContent({ ...formDataContent, submission_deadline: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].registrationDeadline}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].registrationDeadlineHelp}</div>
                      <Input
                        type="datetime-local"
                        placeholder="Registration Deadline"
                        value={formDataContent.registration_deadline}
                        onChange={(e) => setFormDataContent({ ...formDataContent, registration_deadline: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button 
                      type="button"
                      onClick={() => handleDone('content')} 
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer"
                    >
                      {t[language].done} <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
              {collapsed.content && (
                <div className="text-zinc-400 italic">{t[language].contentCompleted}</div>
              )}
            </div>
            <div className="bg-zinc-900/60 border border-zinc-700 rounded-lg p-6 my-6 mt-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">{t[language].lastDetails}</h2>
                {collapsed.last && (
                  <button onClick={() => setCollapsed({ ...collapsed, last: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                    <ChevronRight className="w-5 h-5" /> {t[language].expand}
                  </button>
                )}
              </div>
              {!collapsed.last && (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].startDate}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].startDateHelp}</div>
                      <Input
                        type="datetime-local"
                        placeholder="Start Date"
                        value={formDataLatest.start_date}
                        onChange={(e) => setFormDataLatest({ ...formDataLatest, start_date: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].endDate}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].endDateHelp}</div>
                      <Input
                        type="datetime-local"
                        placeholder="End Date"
                        value={formDataLatest.end_date}
                        onChange={(e) => setFormDataLatest({ ...formDataLatest, end_date: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].timezone}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].timezoneHelp}</div>
                      <Input
                        type="text"
                        placeholder="Timezone"
                        value={formDataLatest.timezone}
                        onChange={e => setFormDataLatest({ ...formDataLatest, timezone: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].banner}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].bannerHelp}</div>
                      <Input
                        type="text"
                        placeholder="Banner URL"
                        value={formDataLatest.banner}
                        onChange={e => setFormDataLatest({ ...formDataLatest, banner: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].icon || 'Icon'}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].iconHelp || 'Text for the icon.'}</div>
                      <Input
                        type="text"
                        placeholder="Icon"
                        value={formDataLatest.icon}
                        onChange={e => setFormDataLatest({ ...formDataLatest, icon: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].smallBanner || 'Small Banner'}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].smallBannerHelp || 'Text for the small banner.'}</div>
                      <Input
                        type="text"
                        placeholder="Small Banner"
                        value={formDataLatest.small_banner}
                        onChange={e => setFormDataLatest({ ...formDataLatest, small_banner: e.target.value })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-medium text-xl mb-2 block">{t[language].participants}:</label>
                      <div className="mb-2 text-zinc-400 text-sm">{t[language].participantsHelp}</div>
                      <Input
                        type="number"
                        placeholder="Participants"
                        value={formDataLatest.participants}
                        onChange={e => setFormDataLatest({ ...formDataLatest, participants: Number(e.target.value) })}
                        className="w-full mb-4"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <button 
                      type="button"
                      onClick={() => handleDone('last')} 
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer"
                    >
                      {t[language].done} <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
              {collapsed.last && (
                <div className="text-zinc-400 italic">{t[language].lastDetailsCompleted}</div>
              )}
            </div>
            {!isSelectedHackathon && (
              <Button type="submit" className="bg-red-500 hover:bg-red-600 text-white">
                {t[language].submit}
              </Button>
            )}
          </form>
        </>
      )}
      {loading && (
              <div className="flex justify-center items-center my-4">
                <svg className="animate-spin h-8 w-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
              </div>
            )}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 max-w-lg w-full">
            <h2 className="text-lg font-bold mb-4">Are you sure you want to delete the hackathon?</h2>
            <p className="mb-4">This action cannot be undone.<br/>Hackathon: <span className="font-semibold">{selectedHackathon?.title}</span></p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer">Cancel</button>
              <button onClick={() => { setShowDeleteModal(false); handleDeleteClick(); }} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Page() {
  return (
    <SessionProvider>
      <HackathonsEdit />
    </SessionProvider>
  );
} 