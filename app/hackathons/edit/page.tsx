'use client';

import React, { useState, useEffect, memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { t } from './translations';
import { useSession, SessionProvider } from "next-auth/react";
import axios from 'axios';
import { initialData, IDataMain, IDataContent, IDataLatest, ITrack, ISchedule, ISpeaker, IResource, IPartner } from './initials';
import { LanguageButton } from './language-button';
import HackathonPreview from '@/components/hackathons/HackathonPreview';

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

const MyHackathonsList = ({ myHackathons, language, onSelect, selectedId, isDevrel }: { 
  myHackathons: any[], 
  language: 'en' | 'es', 
  onSelect: (hackathon: any) => void, 
  selectedId: string | null, 
  isDevrel: boolean
}) => {
  if (!myHackathons.length) return null;
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">
        {isDevrel ? (language === 'en' ? 'All Active Hackathons' : 'Todos los Hackathons Activos') : t[language].myHackathons}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {myHackathons.map((hackathon) => (
          <li
            key={hackathon.id}
            className={
              `text-sm px-3 py-2 rounded-md font-medium transition-colors duration-150 shadow-sm border border-zinc-300 dark:border-zinc-600 ` +
              (hackathon.id === selectedId
                ? 'bg-red-500 text-white'
                : 'bg-zinc-200 dark:bg-zinc-700 hover:bg-red-500 hover:text-white')
            }
            title={isDevrel ? `${hackathon.title} (Created by: ${hackathon.created_by_name || 'Unknown'})` : hackathon.title}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-3 h-3 rounded-full ${
                      hackathon.is_public 
                        ? 'bg-green-500' 
                        : 'bg-gray-400'
                    }`}
                    title={hackathon.is_public ? 'Public hackathon' : 'Private hackathon'}
                  />
                  <span className="cursor-pointer" onClick={() => onSelect(hackathon)}>
            {hackathon.title}
                  </span>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 py-1 h-auto cursor-pointer flex items-center gap-1 transition-transform duration-200 hover:scale-105 bg-white text-white border-gray-300 hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/hackathons/${hackathon.id}`, '_blank');
                    }}
                  >
                    <ExternalLink size={12} />
                    Go to Site
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 py-1 h-auto cursor-pointer flex items-center gap-1 transition-transform duration-200 hover:scale-105 bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(hackathon);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
              {isDevrel && hackathon.created_by_name && (
                <span className="text-xs opacity-75">
                  by {hackathon.created_by_name}
                </span>
              )}
            </div>
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
  onScrollToPreview: (section: string) => void;
    t: any; 
    language: 'en' | 'es';
    removing: { [key: string]: number | null };
    tracksLength: number;
  rawTrackDescriptions: { [key: number]: string };
  setRawTrackDescriptions: (value: { [key: number]: string } | ((prev: { [key: number]: string }) => { [key: number]: string })) => void;
  convertToHTML: (text: string) => string;
  };

const TrackItem = memo(function TrackItem({ track, index, collapsed, onChange, onDone, onExpand, onRemove, onScrollToPreview, t, language, removing, tracksLength, rawTrackDescriptions, setRawTrackDescriptions, convertToHTML }: TrackItemProps) {
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
            onValueChange={(value) => {
              onChange(index, 'icon', value);
              onScrollToPreview('tracks');
            }}
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select Icon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="server">Server</SelectItem>
              <SelectItem value="link">Link</SelectItem>
              <SelectItem value="brain-circuit">Brain Circuit</SelectItem>
              <SelectItem value="wrench">Wrench</SelectItem>
              <SelectItem value="shield">Shield</SelectItem>
              <SelectItem value="gamepad2">gamepad2</SelectItem>
              <SelectItem value="cpu">CPU</SelectItem>
            </SelectContent>
          </Select>
          <div className="mb-2 text-zinc-400 text-sm">{t[language].selectLogo}</div>
          <Select
            value={track.logo}
            onValueChange={(value) => {
              onChange(index, 'logo', value);
              onScrollToPreview('tracks');
            }}
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select Logo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="server">Server</SelectItem>
              <SelectItem value="link">Link</SelectItem>
              <SelectItem value="brain-circuit">Brain Circuit</SelectItem>
              <SelectItem value="wrench">Wrench</SelectItem>
              <SelectItem value="shield">Shield</SelectItem>
              <SelectItem value="gamepad2">gamepad2</SelectItem>
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
          <div className="mb-2 text-zinc-500 text-xs">Type a detailed description with formatting. Use the buttons below or type HTML directly.</div>
          {/* Formatting Toolbar for Track Description */}
          <div className="flex flex-wrap gap-2 mb-3 p-3 bg-zinc-800/50 border border-zinc-600 rounded-lg">
            <button
              type="button"
              onClick={() => {
                const textarea = document.querySelector(`textarea[name="track-description-${index}"]`) as HTMLTextAreaElement;
                if (textarea) {
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const selectedText = rawTrackDescriptions[index]?.substring(start, end) || '';
                  const newText = (rawTrackDescriptions[index] || '').substring(0, start) + `<b>${selectedText}</b>` + (rawTrackDescriptions[index] || '').substring(end);
                  setRawTrackDescriptions(prev => ({ ...prev, [index]: newText }));
                  const htmlText = convertToHTML(newText);
                  onChange(index, 'description', htmlText);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold"
              title="Bold (Ctrl+B)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => {
                const textarea = document.querySelector(`textarea[name="track-description-${index}"]`) as HTMLTextAreaElement;
                if (textarea) {
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const selectedText = rawTrackDescriptions[index]?.substring(start, end) || '';
                  const newText = (rawTrackDescriptions[index] || '').substring(0, start) + `<i>${selectedText}</i>` + (rawTrackDescriptions[index] || '').substring(end);
                  setRawTrackDescriptions(prev => ({ ...prev, [index]: newText }));
                  const htmlText = convertToHTML(newText);
                  onChange(index, 'description', htmlText);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm italic"
              title="Italic (Ctrl+I)"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => {
                const textarea = document.querySelector(`textarea[name="track-description-${index}"]`) as HTMLTextAreaElement;
                if (textarea) {
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const selectedText = rawTrackDescriptions[index]?.substring(start, end) || '';
                  const newText = (rawTrackDescriptions[index] || '').substring(0, start) + `<h1>${selectedText}</h1>` + (rawTrackDescriptions[index] || '').substring(end);
                  setRawTrackDescriptions(prev => ({ ...prev, [index]: newText }));
                  // Auto-convert to HTML
                  const htmlText = convertToHTML(newText);
                  onChange(index, 'description', htmlText);
                }
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
              title="Main Title (H1)"
            >
              H1
            </button>
            <button
              type="button"
              onClick={() => {
                const textarea = document.querySelector(`textarea[name="track-description-${index}"]`) as HTMLTextAreaElement;
                if (textarea) {
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const selectedText = rawTrackDescriptions[index]?.substring(start, end) || '';
                  const newText = (rawTrackDescriptions[index] || '').substring(0, start) + `<h2>${selectedText}</h2>` + (rawTrackDescriptions[index] || '').substring(end);
                  setRawTrackDescriptions(prev => ({ ...prev, [index]: newText }));
                  // Auto-convert to HTML
                  const htmlText = convertToHTML(newText);
                  onChange(index, 'description', htmlText);
                }
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
              title="Secondary Title (H2)"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => {
                const textarea = document.querySelector(`textarea[name="track-description-${index}"]`) as HTMLTextAreaElement;
                if (textarea) {
                  const start = textarea.selectionStart;
                  const newText = (rawTrackDescriptions[index] || '').substring(0, start) + '\n<br />\n' + (rawTrackDescriptions[index] || '').substring(start);
                  setRawTrackDescriptions(prev => ({ ...prev, [index]: newText }));
                  // Auto-convert to HTML
                  const htmlText = convertToHTML(newText);
                  onChange(index, 'description', htmlText);
                }
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
              title="Line Break"
            >
              BR
            </button>
          </div>
          <textarea
            name={`track-description-${index}`}
            placeholder="Enter your track description here... Use the formatting buttons above or type HTML directly. Changes are converted automatically."
            value={rawTrackDescriptions[index] || ''}
            onChange={(e) => {
              setRawTrackDescriptions(prev => ({ ...prev, [index]: e.target.value }));
              // Auto-convert to HTML on every change
              const htmlText = convertToHTML(e.target.value);
              onChange(index, 'description', htmlText);
            }}
            onKeyDown={(e) => {
              if (e.ctrlKey || e.metaKey) {
                const textarea = e.target as HTMLTextAreaElement;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selectedText = rawTrackDescriptions[index]?.substring(start, end) || '';
                if (e.key === 'b') {
                  e.preventDefault();
                  const newText = (rawTrackDescriptions[index] || '').substring(0, start) + `<b>${selectedText}</b>` + (rawTrackDescriptions[index] || '').substring(end);
                  setRawTrackDescriptions(prev => ({ ...prev, [index]: newText }));
                  const htmlText = convertToHTML(newText);
                  onChange(index, 'description', htmlText);
                } else if (e.key === 'i') {
                  e.preventDefault();
                  const newText = (rawTrackDescriptions[index] || '').substring(0, start) + `<i>${selectedText}</i>` + (rawTrackDescriptions[index] || '').substring(end);
                  setRawTrackDescriptions(prev => ({ ...prev, [index]: newText }));
                  const htmlText = convertToHTML(newText);
                  onChange(index, 'description', htmlText);
                }
              }
            }}
            className="w-full mb-3 p-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 resize-none h-32"
            required
          />
          {track.description && (
            <div className="mb-3">
              <div className="text-zinc-400 text-sm mb-2">HTML Preview:</div>
              <div className="p-3 bg-zinc-800 border border-zinc-600 rounded-lg text-green-400 text-xs font-mono whitespace-pre-wrap max-h-20 overflow-y-auto">
                {track.description}
              </div>
            </div>
          )}
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
            onChange={(e) => {
              onChange(index, 'date', e.target.value);
            }}
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
          <div className="mb-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    onPictureChange(index, event.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="w-full p-2 border border-zinc-600 rounded bg-zinc-800 text-zinc-200"
            />
          </div>
          <div className="mb-2">
          <Input
            type="text"
            placeholder="Or enter Picture URL"
            value={speaker.picture}
            onChange={e => onPictureChange(index, e.target.value)}
            className="w-full"
            />
          </div>
          {speaker.picture && speaker.picture.trim() !== "" && (
            <div className="mb-2">
              <img 
                src={speaker.picture} 
                alt={speaker.name} 
                className="w-20 h-20 object-cover rounded border border-zinc-600" 
              />
            </div>
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
        const currentDate = new Date();
        const unfinishedHackathons = response.data.hackathons.filter((hackathon: any) => {
          if (!hackathon.end_date) return true; 
          const endDate = new Date(hackathon.end_date);
          return endDate > currentDate;
        });
        console.log({response: response.data.hackathons, unfinishedHackathons});
        setMyHackathons(unfinishedHackathons);
      }
  }
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      if (session.user.custom_attributes?.includes("hackathonCreator") || 
          session.user.custom_attributes?.includes("team1-admin") ||
          session.user.custom_attributes?.includes("devrel")) {
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
      participants: Number(hackathon.participants) ?? 0,
      organizers: hackathon.organizers ?? '',
      is_public: hackathon.is_public ?? false,
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
      join_custom_text: "Join now",
      become_sponsor_link: hackathon.content?.become_sponsor_link ?? '',
      submission_custom_link: hackathon.content?.submission_custom_link ?? null,
      judging_guidelines: hackathon.content?.judging_guidelines ?? '',
      submission_deadline: toLocalDatetimeString(hackathon.content?.submission_deadline ?? ''),
      registration_deadline: toLocalDatetimeString(hackathon.content?.registration_deadline ?? ''),
    });
    setRawTrackText(hackathon.content?.tracks_text ?? "");
    const trackDescriptions: { [key: number]: string } = {};
    hackathon.content?.tracks?.forEach((track: any, index: number) => {
      if (track.description) {
        const rawText = track.description
          .replace(/<b>(.*?)<\/b>/g, '**$1**')
          .replace(/<i>(.*?)<\/i>/g, '*$1*')
          .replace(/<h1>(.*?)<\/h1>/g, '# $1')
          .replace(/<h2>(.*?)<\/h2>/g, '## $1')
          .replace(/<h3>(.*?)<\/h3>/g, '### $1')
          .replace(/<br\s*\/?>/g, '\n')
          .replace(/<p>(.*?)<\/p>/g, '$1')
          .replace(/<hr\s*\/?>/g, '---');
        trackDescriptions[index] = rawText;
      }
    });
    setRawTrackDescriptions(trackDescriptions);
    setFormDataLatest({
      start_date: toLocalDatetimeString(hackathon.start_date ?? ''),
      end_date: toLocalDatetimeString(hackathon.end_date ?? ''),
      timezone: hackathon.timezone ?? '',
      banner: hackathon.banner ?? '',
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
    images: false,
    about: false,
    trackText: false,
    content: false,
    last: false,
  });

  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [scrollTarget, setScrollTarget] = useState<string | undefined>();
  const [rawTrackText, setRawTrackText] = useState<string>('');
  const [rawTrackDescriptions, setRawTrackDescriptions] = useState<{ [key: number]: string }>({});

  const scrollToSection = (section: string) => {
    setScrollTarget(section);
    setTimeout(() => setScrollTarget(undefined), 1000);
  };

  const convertToMarkdown = (text: string) => {
    if (!text) return '';
    const paragraphs = text.split(/\n\s*\n/);
    return paragraphs
      .map(paragraph => {
        const trimmed = paragraph.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('#')) {
          return trimmed;
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          return trimmed;
        }
        if (trimmed.startsWith('---')) {
          return trimmed;
        }
        if (trimmed.includes('**') || trimmed.includes('*') || trimmed.includes('`')) {
          return trimmed;
        }
        return trimmed.replace(/\n/g, '\\n');
      })
      .filter(p => p.length > 0)
      .join('\\n\\n');
  };

  const convertToHTML = (text: string) => {
    if (!text) return '';
    const paragraphs = text.split(/\n\s*\n/);
    return paragraphs
      .map(paragraph => {
        const trimmed = paragraph.trim();
        if (!trimmed) return '';
        let formatted = trimmed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        formatted = formatted.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        formatted = formatted.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<i>$1</i>');
        formatted = formatted.replace(/^---$/gim, '<hr />');
        formatted = formatted.replace(/\n/g, '<br />');
        if (!formatted.startsWith('<h') && !formatted.startsWith('<hr')) {
          formatted = `<p>${formatted}</p>`;
        }
        return formatted;
      })
      .filter(p => p.length > 0)
      .join('');
  };

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

  const handleDone = (section: 'main' | 'images' | 'about' | 'trackText' | 'content' | 'last') => {
    setCollapsed({ ...collapsed, [section]: true });
  };

  const handleTrackDone = (index: number) => {
    setCollapsedTracks((prev) => prev.map((v, i) => (i === index ? true : v)));
  };

  const handleTrackExpand = (index: number) => {
    setCollapsedTracks((prev) => prev.map((v, i) => (i === index ? false : v)));
  };

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showEditActions, setShowEditActions] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEditActions) {
        const target = event.target as Element;
        if (!target.closest('.edit-actions-container')) {
          setShowEditActions(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEditActions]);
  const [fieldsToUpdate, setFieldsToUpdate] = useState<{ key: string, oldValue: any, newValue: any }[]>([]);

  const [loading, setLoading] = useState(false);

  const uploadBase64ToVercel = async (base64Data: string, fileName: string): Promise<string> => {
    try {
      const response = await fetch(base64Data);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('file', blob, fileName);
      const uploadResponse = await fetch('/api/file', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }
      
      const result = await uploadResponse.json();
      return result.url;
    } catch (error) {
      console.error('Error uploading base64 to Vercel:', error);
      throw error;
    }
  };

  const processBase64Images = async (data: any): Promise<any> => {
    const processedData = { ...data };
    const imageFields = ['banner', 'icon', 'small_banner'];
    for (const field of imageFields) {
      if (processedData[field] && processedData[field].startsWith('data:image/')) {
        const fileName = `builders-hub/hackathon-images/${processedData.title.toLowerCase().replace(/ /g, '-')}/${processedData.title}-${field}-${Date.now()}.${processedData[field].split(';')[0].split('/')[1]}`;
        try {
          console.log({fileName})
          processedData[field] = await uploadBase64ToVercel(processedData[field], fileName);
          console.log(`Uploaded ${field} to Vercel storage:`, processedData[field]);
        } catch (error) {
          console.error(`Failed to upload ${field}:`, error);
        }
      }
    }
    
    if (processedData.content?.speakers) {
      for (let i = 0; i < processedData.content.speakers.length; i++) {
        const speaker = processedData.content.speakers[i];
        if (speaker.picture && speaker.picture.startsWith('data:image/')) {
          const fileName = `builders-hub/hackathon-images/${processedData.title.toLowerCase().replace(/ /g, '-')}/speaker-${i}-${Date.now()}.${speaker.picture.split(';')[0].split('/')[1]}`;
          try {
            processedData.content.speakers[i].picture = await uploadBase64ToVercel(speaker.picture, fileName);
            console.log(`Uploaded speaker ${i} picture to Vercel storage:`, processedData.content.speakers[i].picture);
          } catch (error) {
            console.error(`Failed to upload speaker ${i} picture:`, error);
          }
        }
      }
    }
    
    return processedData;
  };

  const doSubmit = async () => {
    setLoading(true);
    let dataToSend 
    if (isSelectedHackathon)
      dataToSend= {...getDataToSend(), updated_by: session?.user?.id};
    else {
      dataToSend= {...getDataToSend(), created_by: session?.user?.id};
    }
    console.log({dataToSend, isSelectedHackathon});
    try {
      dataToSend = await processBase64Images(dataToSend);
      console.log('Processed data with uploaded images:', dataToSend);
    } catch (error) {
      console.error('Error processing base64 images:', error);
    }
    
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
            'id': session?.user?.id ?? '',
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

  const handleToggleVisibility = async (hackathonId: string, isPublic: boolean) => {
    try {
      console.log({isPublic})
      const response = await fetch(`/api/hackathons/${selectedHackathon?.id}`, {
        method: 'PUT', 
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.APIKEY ?? '',
          'id': session?.user?.id ?? '',
        },
        body: JSON.stringify({
          is_public: isPublic
        }),
      });

      if (response.ok) {
        setMyHackathons(prev => 
          prev.map(hackathon => 
            hackathon.id === hackathonId 
              ? { ...hackathon, is_public: isPublic }
              : hackathon
          )
        );
        
        if (selectedHackathon?.id === hackathonId) {
          setSelectedHackathon((prev: any) => prev ? { ...prev, is_public: isPublic } : null);
          setFormDataMain((prev: IDataMain) => ({ ...prev, is_public: isPublic }));
        }
        
        console.log(`Hackathon ${hackathonId} visibility updated to ${isPublic ? 'public' : 'private'}`);
      } else {
        console.error('Failed to update hackathon visibility');
      }
    } catch (error) {
      console.error('Error updating hackathon visibility:', error);
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

  const loadMockData = () => {
    setFormDataMain({
      title: "Avalanche 2025",
      description: "Build the future of Web3 on Avalanche. Join us for an exciting hackathon where we will create innovative blockchain solutions.",
      location: "Virtual & In-Person Events Worldwide",
      total_prizes: 10000,
      tags: ["Blockchain", "Web3", "DeFi", "NFT", "Avalanche"],
      participants: 100,
      organizers: "Avalanche Foundation & Partners",
      is_public: false
    });

    setFormDataLatest({
      start_date: "2025-10-15T09:00",
      end_date: "2025-10-17T18:00",
      timezone: "America/New_York",
      banner: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/Avalanche%20Chile/bannerchilehor.png",
      icon: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/Avalanche%20Chile/bannerchilehor.png",
      small_banner: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/Avalanche%20Chile/bannerchile.png"
    });

    setFormDataContent({
      tracks: [
        {
          icon: "wrench",
          logo: "wrench",
          name: "DeFi Innovation",
          partner: "Avalanche",
          description: "<b>DeFi Innovation:</b> Build the next generation of decentralized finance protocols. Create lending platforms, DEXs, yield farming strategies, or novel DeFi primitives that leverage Avalanche's high-speed, low-cost infrastructure.",
          short_description: "Build innovative DeFi protocols and applications on Avalanche."
        },
        {
          icon: "shield",
          logo: "shield", 
          name: "Security & Privacy",
          partner: "Avalanche",
          description: "<b>Security & Privacy:</b> Develop cutting-edge security solutions and privacy-preserving technologies. Build secure wallets, privacy protocols, or tools that enhance the security and privacy of blockchain applications.",
          short_description: "Create security solutions and privacy-preserving technologies."
        },
        {
          icon: "gamepad2",
          logo: "gamepad2",
          name: "Gaming & NFTs",
          partner: "Avalanche",
          description: "<b>Gaming & NFTs:</b> Revolutionize gaming with blockchain technology. Create play-to-earn games, NFT marketplaces, gaming infrastructure, or tools that bridge traditional gaming with Web3.",
          short_description: "Build gaming applications and NFT platforms on Avalanche."
        }
      ],
      schedule: [
        {
          url: null,
          date: "2025-10-15T09:00",
          name: "Opening Ceremony & Keynote",
          category: "Registration",
          location: "Main Stage",
          description: "Welcome to Avalanche Hackathon 2025! Join us for an inspiring opening ceremony with keynote speakers from the Avalanche ecosystem.",
          duration: 60
        },
        {
          url: null,
          date: "2025-10-15T10:30",
          name: "Team Formation & Networking",
          category: "Networking",
          location: "Networking Area",
          description: "Meet other participants, form teams, and start brainstorming your hackathon project ideas.",
          duration: 90
        },
        {
          url: null,
          date: "2025-10-15T14:00",
          name: "Technical Workshop: Building on Avalanche",
          category: "Workshop",
          location: "Workshop Room A",
          description: "Learn the fundamentals of building on Avalanche, including smart contract development and deployment.",
          duration: 120
        },
        {
          url: null,
          date: "2025-10-16T10:00",
          name: "Mentorship Sessions",
          category: "Workshop",
          location: "Mentor Lounge",
          description: "Get guidance from industry experts and experienced developers on your project.",
          duration: 180
        },
        {
          url: null,
          date: "2025-10-17T14:00",
          name: "Project Presentations",
          category: "Judging",
          location: "Main Stage",
          description: "Present your projects to judges and the community. Showcase your innovative solutions built on Avalanche.",
          duration: 240
        }
      ],
      speakers: [
        {
          icon: "Megaphone",
          name: "Dr. Emin Gün Sirer",
          category: "Keynote Speaker",
          picture: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/2259ff3def815083bf765c53d57327dc-1657109283036.jpg"
        }
      ],
      resources: [
        {
          icon: "BookOpen",
          link: "https://docs.avax.network",
          title: "Avalanche Documentation",
          description: "Complete guide to building on Avalanche"
        },
        {
          icon: "Github",
          link: "https://github.com/ava-labs",
          title: "Avalanche GitHub",
          description: "Open source repositories and examples"
        },
        {
          icon: "MessageCircle",
          link: "https://discord.gg/avalancheavax",
          title: "Avalanche Discord",
          description: "Join the community for support and discussions"
        }
      ],
      address: "Virtual Event - Join from anywhere in the world!",
      partners: [],
      tracks_text: "# 🚀 Avalanche Hackathon 2025\n\n## Welcome to the Future of Web3\n\nJoin us for an incredible 48-hour hackathon where developers, designers, and entrepreneurs come together to build the next generation of blockchain applications on **Avalanche**.\n\n### 🎯 What We're Looking For\n\n- **Innovation**: Breakthrough ideas that push the boundaries of what's possible\n- **Technical Excellence**: Well-architected, secure, and scalable solutions\n- **User Experience**: Applications that are intuitive and accessible to everyone\n- **Real-World Impact**: Solutions that solve actual problems and create value\n\n### 🏆 Prizes & Recognition\n\n- **1st Place**: $25,000 + Incubation Program\n- **2nd Place**: $15,000 + Mentorship\n- **3rd Place**: $10,000 + Community Support\n- **Special Tracks**: Additional prizes for DeFi, Gaming, and Security innovations\n\n### 🤝 Community & Support\n\nOur team of mentors, technical experts, and community members will be available throughout the hackathon to help you succeed. Don't hesitate to reach out for guidance, technical support, or just to chat about your ideas!\n\n---\n\n**Ready to build the future? Let's make it happen together!** 🚀",
      speakers_text: "Students will have access to the Avalanche Academy curriculum, as well as Avalanche documentation and the Avalanche faucet.",
      join_custom_link: "",
      join_custom_text: "Join now",
      judging_guidelines: "Projects will be evaluated based on innovation, technical implementation, user experience, and potential impact.",
      submission_deadline: "2026-03-17T16:00:00.000-04:00",
      registration_deadline: "",
      speakers_banner: "",
      become_sponsor_link: "",
      submission_custom_link: null
    });

    setCollapsed({
      main: true,
      images: true,
      about: true,
      trackText: true,
      content: true,
      last: true
    });

    setShowForm(true);
    setSelectedHackathon(null);
    setIsSelectedHackathon(false);
  };

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

  // Check if user has required permissions
  const hasRequiredPermissions = () => {
    if (!session?.user?.custom_attributes) return false;
    return session.user.custom_attributes.includes("team1-admin") || 
           session.user.custom_attributes.includes("hackathonCreator") || 
           session.user.custom_attributes.includes("devrel");
  };

  // Redirect unauthorized users
  React.useEffect(() => {
    if (status === "loading") return; // Still loading
    
    if (status === "unauthenticated") {
      window.location.href = "/login";
      return;
    }
    
    if (status === "authenticated" && !hasRequiredPermissions()) {
      window.location.href = "/";
      return;
    }
  }, [session, status]);

  // Show loading while checking authentication
  if (status === "loading") {
  return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Don't render if user is not authenticated or doesn't have permissions
  if (status === "unauthenticated" || (status === "authenticated" && !hasRequiredPermissions())) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-700 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">{t[language].editHackathons}</h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-600 rounded-full text-sm">
              <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
              <span className="text-white">Live Preview</span>
            </div>
            <LanguageButton 
              language={language} 
              onLanguageChange={setLanguage} 
              t={t} 
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={loadMockData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Load Mock Data
            </button>
            <Button onClick={() => { setShowForm(true); setSelectedHackathon(null); setIsSelectedHackathon(false); }} disabled={isSelectedHackathon}>
              {t[language].addNewHackathon}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Edit Form */}
        <div className="w-1/2 overflow-y-auto bg-zinc-950">
    <div className="container mx-auto px-4 py-8">
      <UpdateModal
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleConfirmUpdate}
        fieldsToUpdate={fieldsToUpdate}
        t={t}
        language={language}
      />
            
      <MyHackathonsList 
        myHackathons={myHackathons} 
        language={language} 
        onSelect={handleSelectHackathon} 
        selectedId={selectedHackathon?.id ?? null} 
        isDevrel={session?.user?.custom_attributes?.includes("devrel") || false}
      />
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
              {session?.user?.custom_attributes?.includes("devrel") && (
                <Button 
                  type="button" 
                  className={`${
                    formDataMain.is_public 
                      ? 'bg-orange-600 hover:bg-orange-700' 
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white`}
                  onClick={() => handleToggleVisibility(selectedHackathon.id, !formDataMain.is_public)}
                >
                  {formDataMain.is_public ? 'Hide' : 'Activate'}
                </Button>
              )}  
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
                <h2 className="text-2xl font-bold">Step 1: Basic Hackathon Info</h2>
                {collapsed.main && (
                  <button onClick={() => setCollapsed({ ...collapsed, main: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                    <ChevronRight className="w-5 h-5" /> {t[language].expand}
                  </button>
                )}
              </div>
              {!collapsed.main && (
                <>
                  <div className="mb-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-300 mb-2">Hackathon Details</h3>
                    <p className="text-sm text-green-200">Let's start with the basic information that will appear in your hackathon preview.</p>
                  </div>
                  
                  <div className="mb-2 text-zinc-400 text-sm">Hackathon Title</div>
                  <Input
                    type="text"
                    name="title"
                    placeholder="e.g., Avalanche Hackathon 2025, Build on Avalanche"
                    value={formDataMain.title}
                    onChange={(e) => {
                      setFormDataMain(prev => ({ ...prev, title: e.target.value }));
                      scrollToSection('about');
                    }}
                    className="w-full mb-4"
                    required
                  />
                  
                  <div className="mb-2 text-zinc-400 text-sm">Description</div>
                  <textarea
                    name="description"
                    placeholder="Describe your hackathon, its goals, and what participants will build..."
                    value={formDataMain.description}
                    onChange={(e) => {
                      setFormDataMain(prev => ({ ...prev, description: e.target.value }));
                      scrollToSection('about');
                    }}
                    className="w-full mb-4 p-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 resize-none h-24"
                    required
                  />
                  
                  <div className="mb-2 text-zinc-400 text-sm">Location</div>
                  <Input
                    type="text"
                    name="location"
                    placeholder="e.g., Online, New York, San Francisco"
                    value={formDataMain.location}
                    onChange={(e) => {
                      setFormDataMain(prev => ({ ...prev, location: e.target.value }));
                      scrollToSection('about');
                    }}
                    className="w-full mb-4"
                    required
                  />
                  <div className="flex flex-col space-y-2 bg-zinc-900/60 border border-zinc-700 rounded-lg p-4 my-4">
                    <label className="font-medium">Tags (Optional)</label>
                    <div className="mb-2 text-zinc-400 text-sm">Add relevant tags to help participants find your hackathon</div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {formDataMain.tags.map((tag, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={tag}
                            onChange={e => handleTagChange(idx, e.target.value)}
                            className="w-32 px-2 py-1 text-sm"
                            placeholder={`Tag ${idx + 1}`}
                          />
                          {formDataMain.tags.length > 1 && (
                            <button type="button" onClick={() => removeTag(idx)} className="text-red-500 hover:text-red-700 px-1">×</button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={addTag} className="text-green-500 hover:text-green-700 px-2 py-1 border border-green-500 rounded">+ Add Tag</button>
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
                <div className="text-zinc-400 italic">✓ Basic hackathon info completed</div>
              )}
            </div>
            
            {/* Step 2: Images & Branding */}
            <div className="bg-zinc-900/60 border border-zinc-700 rounded-lg p-6 my-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Step 2: Images & Branding</h2>
                {collapsed.images && (
                  <button onClick={() => setCollapsed({ ...collapsed, images: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                    <ChevronRight className="w-5 h-5" /> {t[language].expand}
                  </button>
                )}
              </div>
              {!collapsed.images && (
                <>
                  <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-300 mb-2">Hackathon Images & Branding</h3>
                    <p className="text-sm text-blue-200">Upload your hackathon banner, icon, and small banner. Images will be stored locally and uploaded to the database when you submit the form.</p>
                  </div>
                  
                  {/* Banner Image */}
                  <div className="mb-6">
                    <label className="font-medium text-xl mb-2 block">Main Banner:</label>
                    <div className="mb-2 text-zinc-400 text-sm">The main banner image displayed at the top of your hackathon page</div>
                    
                    <div className="mb-4">
                      <div className="flex gap-4 items-start">
                        {/* File Input */}
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const dataUrl = event.target?.result as string;
                                  setFormDataLatest({ ...formDataLatest, banner: dataUrl });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                          />
                        </div>
                        
                        {/* Or URL Input */}
                        <div className="flex-1">
                          <Input
                            type="text"
                            placeholder="Or enter banner URL"
                            value={formDataLatest.banner}
                            onChange={e => setFormDataLatest({ ...formDataLatest, banner: e.target.value })}
                            className="w-full"
                          />
                        </div>
                      </div>
                      
                      {/* Banner Preview */}
                      {formDataLatest.banner && (
                        <div className="mt-4">
                          <div className="text-zinc-400 text-sm mb-2">Preview (1600 x 909):</div>
                          <div className="relative w-full max-w-2xl mx-auto bg-zinc-800 border border-zinc-600 rounded-lg overflow-hidden" style={{ aspectRatio: '1600/909' }}>
                            <img
                              src={formDataLatest.banner}
                              alt="Banner preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = 'flex';
                              }}
                            />
                            <div className="hidden absolute inset-0 items-center justify-center text-zinc-500">
                              Invalid image URL
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  
                  {/* Icon Image 
                  <div className="mb-6">
                    <label className="font-medium text-xl mb-2 block">Icon:</label>
                    <div className="mb-2 text-zinc-400 text-sm">The small icon displayed next to your hackathon title</div>
                    
                    <div className="mb-4">
                      <div className="flex gap-4 items-start">
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const dataUrl = event.target?.result as string;
                                  setFormDataLatest({ ...formDataLatest, icon: dataUrl });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
                          />
                        </div>
                        
                        <div className="flex-1">
                          <Input
                            type="text"
                            placeholder="Or enter icon URL"
                            value={formDataLatest.icon}
                            onChange={e => setFormDataLatest({ ...formDataLatest, icon: e.target.value })}
                            className="w-full"
                          />
                        </div>
                      </div>
                      
                      {formDataLatest.icon && (
                        <div className="mt-4">
                          <div className="text-zinc-400 text-sm mb-2">Preview:</div>
                          <div className="relative w-16 h-16 bg-zinc-800 border border-zinc-600 rounded-lg overflow-hidden">
                            <img
                              src={formDataLatest.icon}
                              alt="Icon preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = 'flex';
                              }}
                            />
                            <div className="hidden absolute inset-0 items-center justify-center text-zinc-500 text-xs">
                              Invalid
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  */}

                  <div className="mb-6">
                    <label className="font-medium text-xl mb-2 block">Small Banner:</label>
                    <div className="mb-2 text-zinc-400 text-sm">A smaller banner image for additional branding</div>
                    
                    <div className="mb-4">
                      <div className="flex gap-4 items-start">
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const dataUrl = event.target?.result as string;
                                  setFormDataLatest({ ...formDataLatest, small_banner: dataUrl });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                          />
                        </div>
                        
                        <div className="flex-1">
                          <Input
                            type="text"
                            placeholder="Or enter small banner URL"
                            value={formDataLatest.small_banner}
                            onChange={e => setFormDataLatest({ ...formDataLatest, small_banner: e.target.value })}
                            className="w-full"
                          />
                        </div>
                      </div>
                      
                      {formDataLatest.small_banner && (
                        <div className="mt-4">
                          <div className="text-zinc-400 text-sm mb-2">Preview (601 x 1028):</div>
                          <div className="relative w-32 mx-auto bg-zinc-800 border border-zinc-600 rounded-lg overflow-hidden" style={{ aspectRatio: '601/1028' }}>
                            <img
                              src={formDataLatest.small_banner}
                              alt="Small banner preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = 'flex';
                              }}
                            />
                            <div className="hidden absolute inset-0 items-center justify-center text-zinc-500 text-xs">
                              Invalid image URL
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <button 
                      type="button"
                      onClick={() => handleDone('images')} 
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer"
                    >
                      {t[language].done} <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
              {collapsed.images && (
                <div className="text-zinc-400 italic">✓ Images & branding completed</div>
              )}
            </div>
            
            {/* Step 3: Participants & Prizes */}
            <div className="bg-zinc-900/60 border border-zinc-700 rounded-lg p-6 my-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Step 3: Participants & Prizes</h2>
                {collapsed.about && (
                  <button onClick={() => setCollapsed({ ...collapsed, about: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                    <ChevronRight className="w-5 h-5" /> {t[language].expand}
                  </button>
                )}
              </div>
              {!collapsed.about && (
                <>
                  <div className="mb-4 p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                    <h3 className="text-lg font-semibold text-orange-300 mb-2">Participants & Prize Information</h3>
                    <p className="text-sm text-orange-200">Now let's add details about participants and the prize pool.</p>
                  </div>
                  
                  <div className="mb-2 text-zinc-400 text-sm">Expected Number of Participants</div>
                  <Input
                    type="number"
                    name="participants"
                    placeholder="e.g., 100, 500, 1000"
                    value={formDataMain.participants?.toString() || ''}
                    onChange={(e) => {
                      setFormDataMain(prev => ({ ...prev, participants: Number(e.target.value) || 0 }));
                      scrollToSection('about');
                    }}
                    className="w-full mb-4"
                    required
                  />
                  {/*
                  <div className="mb-2 text-zinc-400 text-sm">Organizer Name/Organization</div>
                  <Input
                    type="text"
                    name="organizers"
                    placeholder="e.g., Avalanche Foundation, DevRel Team"
                    value={formDataMain.organizers || ''}
                    onChange={(e) => {
                      setFormDataMain(prev => ({ ...prev, organizers: e.target.value }));
                      scrollToSection('about');
                    }}
                    className="w-full mb-4"
                    required
                  />
                  */}
                  <div className="mb-2 text-zinc-400 text-sm">Total Prize Pool (USD)</div>
                  <Input
                    type="number"
                    name="total_prizes"
                    placeholder="e.g., 50000, 100000"
                    value={formDataMain.total_prizes?.toString() || ''}
                    onChange={(e) => {
                      setFormDataMain(prev => ({ ...prev, total_prizes: Number(e.target.value) || 0 }));
                      scrollToSection('tracks');
                    }}
                    className="w-full mb-4"
                    required
                  />
                  
                  <div className="flex justify-end mt-4">
                    <button 
                      type="button"
                      onClick={() => handleDone('about')} 
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer"
                    >
                      {t[language].done} <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
              {collapsed.about && (
                <div className="text-zinc-400 italic">✓ Participants & prizes completed</div>
              )}
            </div>
            
            {/* Step 4: Track Text */}
            <div className="bg-zinc-900/60 border border-zinc-700 rounded-lg p-6 my-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Step 4: Track Text</h2>
                {collapsed.trackText && (
                  <button onClick={() => setCollapsed({ ...collapsed, trackText: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                    <ChevronRight className="w-5 h-5" /> {t[language].expand}
                  </button>
                )}
              </div>
              {!collapsed.trackText && (
                <>
                  <div className="mb-4 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                    <h3 className="text-lg font-semibold text-purple-300 mb-2">Track Description</h3>
                    <p className="text-sm text-purple-200">Write detailed information about your hackathon tracks, program structure, and timeline. Use paragraphs and line breaks - they will be converted to markdown format.</p>
                  </div>
                  
                  <div className="mb-2 text-zinc-400 text-sm">Schedule Text:</div>
                  <div className="mb-2 text-zinc-500 text-xs">Write a step-by-step schedule outlining what will happen, either hour by hour or week by week. Use the formatting buttons below or type markdown directly.</div>
                  
                  {/* Formatting Toolbar */}
                  <div className="flex flex-wrap gap-2 mb-3 p-3 bg-zinc-800/50 border border-zinc-600 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = document.querySelector('textarea[name="tracks_text"]') as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = rawTrackText.substring(start, end);
                          const newText = rawTrackText.substring(0, start) + `**${selectedText}**` + rawTrackText.substring(end);
                          setRawTrackText(newText);
                          // Auto-convert to markdown
                          const markdownText = convertToMarkdown(newText);
                          setFormDataContent(prev => ({ ...prev, tracks_text: markdownText }));
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold"
                      title="Bold (Ctrl+B)"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = document.querySelector('textarea[name="tracks_text"]') as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = rawTrackText.substring(start, end);
                          const newText = rawTrackText.substring(0, start) + `*${selectedText}*` + rawTrackText.substring(end);
                          setRawTrackText(newText);
                          // Auto-convert to markdown
                          const markdownText = convertToMarkdown(newText);
                          setFormDataContent(prev => ({ ...prev, tracks_text: markdownText }));
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm italic"
                      title="Italic (Ctrl+I)"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = document.querySelector('textarea[name="tracks_text"]') as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = rawTrackText.substring(start, end);
                          const newText = rawTrackText.substring(0, start) + `# ${selectedText}` + rawTrackText.substring(end);
                          setRawTrackText(newText);
                          // Auto-convert to markdown
                          const markdownText = convertToMarkdown(newText);
                          setFormDataContent(prev => ({ ...prev, tracks_text: markdownText }));
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
                      title="Main Title (H1)"
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = document.querySelector('textarea[name="tracks_text"]') as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = rawTrackText.substring(start, end);
                          const newText = rawTrackText.substring(0, start) + `## ${selectedText}` + rawTrackText.substring(end);
                          setRawTrackText(newText);
                          // Auto-convert to markdown
                          const markdownText = convertToMarkdown(newText);
                          setFormDataContent(prev => ({ ...prev, tracks_text: markdownText }));
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
                      title="Secondary Title (H2)"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = document.querySelector('textarea[name="tracks_text"]') as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const selectedText = rawTrackText.substring(start, end);
                          const newText = rawTrackText.substring(0, start) + `### ${selectedText}` + rawTrackText.substring(end);
                          setRawTrackText(newText);
                          // Auto-convert to markdown
                          const markdownText = convertToMarkdown(newText);
                          setFormDataContent(prev => ({ ...prev, tracks_text: markdownText }));
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
                      title="Subtitle (H3)"
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = document.querySelector('textarea[name="tracks_text"]') as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const newText = rawTrackText.substring(0, start) + '\n---\n' + rawTrackText.substring(start);
                          setRawTrackText(newText);
                          // Auto-convert to markdown
                          const markdownText = convertToMarkdown(newText);
                          setFormDataContent(prev => ({ ...prev, tracks_text: markdownText }));
                        }
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
                      title="Horizontal Rule"
                    >
                      ---
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const textarea = document.querySelector('textarea[name="tracks_text"]') as HTMLTextAreaElement;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const newText = rawTrackText.substring(0, start) + '\n\n' + rawTrackText.substring(start);
                          setRawTrackText(newText);
                          // Auto-convert to markdown
                          const markdownText = convertToMarkdown(newText);
                          setFormDataContent(prev => ({ ...prev, tracks_text: markdownText }));
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      title="New Paragraph"
                    >
                      ¶
                    </button>
                  </div>
                  
                  <textarea
                    name="tracks_text"
                    placeholder="Enter your track description here... Use the formatting buttons above or type markdown directly. Changes are converted automatically."
                    value={rawTrackText}
                    onChange={(e) => {
                      setRawTrackText(e.target.value);
                      // Auto-convert to markdown on every change
                      const markdownText = convertToMarkdown(e.target.value);
                      setFormDataContent(prev => ({ ...prev, tracks_text: markdownText }));
                      scrollToSection('about');
                    }}
                    onKeyDown={(e) => {
                      // Keyboard shortcuts
                      if (e.ctrlKey || e.metaKey) {
                        const textarea = e.target as HTMLTextAreaElement;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const selectedText = rawTrackText.substring(start, end);
                        
                        if (e.key === 'b') {
                          e.preventDefault();
                          const newText = rawTrackText.substring(0, start) + `**${selectedText}**` + rawTrackText.substring(end);
                          setRawTrackText(newText);
                          const markdownText = convertToMarkdown(newText);
                          setFormDataContent(prev => ({ ...prev, tracks_text: markdownText }));
                        } else if (e.key === 'i') {
                          e.preventDefault();
                          const newText = rawTrackText.substring(0, start) + `*${selectedText}*` + rawTrackText.substring(end);
                          setRawTrackText(newText);
                          const markdownText = convertToMarkdown(newText);
                          setFormDataContent(prev => ({ ...prev, tracks_text: markdownText }));
                        }
                      }
                    }}
                    className="w-full mb-4 p-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 resize-none h-48"
                    required
                  />
                  
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setRawTrackText(formDataContent.tracks_text || '');
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                    >
                      Load Current
                    </button>
                    <div className="text-green-400 text-sm flex items-center">
                      ✓ Auto-converting to markdown as you type
                    </div>
                  </div>
                  
                  {formDataContent.tracks_text && (
                    <div className="mb-4">
                      <div className="text-zinc-400 text-sm mb-2">Markdown Preview:</div>
                      <div className="p-3 bg-zinc-800 border border-zinc-600 rounded-lg text-green-400 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {formDataContent.tracks_text}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end mt-4">
                    <button 
                      type="button"
                      onClick={() => handleDone('trackText')} 
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer"
                    >
                      {t[language].done} <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
              {collapsed.trackText && (
                <div className="text-zinc-400 italic">✓ Track text completed</div>
              )}
            </div>
            
            {/* Step 5: Content - Tracks, Schedule, etc. */}
            <div className="bg-zinc-900/60 border border-zinc-700 rounded-lg p-6 my-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Step 5: Content</h2>
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
                        onScrollToPreview={scrollToSection}
                        t={t}
                        language={language}
                        removing={removing}
                        tracksLength={formDataContent.tracks.length}
                        rawTrackDescriptions={rawTrackDescriptions}
                        setRawTrackDescriptions={setRawTrackDescriptions}
                        convertToHTML={convertToHTML}
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
                <h2 className="text-2xl font-bold">Step 6: Last Details</h2>
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
                      <Select
                        value={formDataLatest.timezone}
                        onValueChange={(value) => setFormDataLatest({ ...formDataLatest, timezone: value })}
                      >
                        <SelectTrigger className="w-full mb-4">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">New York (EST/EDT) - GMT-5/-4</SelectItem>
                          <SelectItem value="America/Chicago">Chicago (CST/CDT) - GMT-6/-5</SelectItem>
                          <SelectItem value="America/Denver">Denver (MST/MDT) - GMT-7/-6</SelectItem>
                          <SelectItem value="America/Los_Angeles">Los Angeles (PST/PDT) - GMT-8/-7</SelectItem>
                          <SelectItem value="America/Toronto">Toronto (EST/EDT) - GMT-5/-4</SelectItem>
                          <SelectItem value="America/Vancouver">Vancouver (PST/PDT) - GMT-8/-7</SelectItem>
                          <SelectItem value="America/Mexico_City">Mexico City (CST/CDT) - GMT-6/-5</SelectItem>
                          <SelectItem value="America/Bogota">Bogotá, Colombia (COT) - GMT-5</SelectItem>
                          <SelectItem value="America/Costa_Rica">San José, Costa Rica (CST) - GMT-6</SelectItem>
                          <SelectItem value="America/Panama">Panama City, Panama (EST) - GMT-5</SelectItem>
                          <SelectItem value="America/Caracas">Caracas, Venezuela (VET) - GMT-4</SelectItem>
                          <SelectItem value="America/La_Paz">La Paz, Bolivia (BOT) - GMT-4</SelectItem>
                          <SelectItem value="America/Lima">Lima, Peru (PET) - GMT-5</SelectItem>
                          <SelectItem value="America/Sao_Paulo">São Paulo, Brazil (BRT) - GMT-3</SelectItem>
                          <SelectItem value="America/Santiago">Santiago, Chile (CLT) - GMT-3</SelectItem>
                          <SelectItem value="America/Buenos_Aires">Buenos Aires, Argentina (ART) - GMT-3</SelectItem>
                          <SelectItem value="Europe/London">London (GMT/BST) - GMT+0/+1</SelectItem>
                          <SelectItem value="Europe/Paris">Paris (CET/CEST) - GMT+1/+2</SelectItem>
                          <SelectItem value="Europe/Berlin">Berlin (CET/CEST) - GMT+1/+2</SelectItem>
                          <SelectItem value="Europe/Rome">Rome (CET/CEST) - GMT+1/+2</SelectItem>
                          <SelectItem value="Europe/Madrid">Madrid (CET/CEST) - GMT+1/+2</SelectItem>
                          <SelectItem value="Europe/Amsterdam">Amsterdam (CET/CEST) - GMT+1/+2</SelectItem>
                          <SelectItem value="Europe/Zurich">Zurich (CET/CEST) - GMT+1/+2</SelectItem>
                          <SelectItem value="Europe/Stockholm">Stockholm (CET/CEST) - GMT+1/+2</SelectItem>
                          <SelectItem value="Europe/Moscow">Moscow (MSK) - GMT+3</SelectItem>
                          <SelectItem value="Asia/Tokyo">Tokyo (JST) - GMT+9</SelectItem>
                          <SelectItem value="Asia/Shanghai">Shanghai (CST) - GMT+8</SelectItem>
                          <SelectItem value="Asia/Hong_Kong">Hong Kong (HKT) - GMT+8</SelectItem>
                          <SelectItem value="Asia/Singapore">Singapore (SGT) - GMT+8</SelectItem>
                          <SelectItem value="Asia/Seoul">Seoul (KST) - GMT+9</SelectItem>
                          <SelectItem value="Asia/Mumbai">Mumbai (IST) - GMT+5:30</SelectItem>
                          <SelectItem value="Asia/Dubai">Dubai (GST) - GMT+4</SelectItem>
                          <SelectItem value="Asia/Jerusalem">Jerusalem (IST) - GMT+2/+3</SelectItem>
                          <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT) - GMT+10/+11</SelectItem>
                          <SelectItem value="Australia/Melbourne">Melbourne (AEST/AEDT) - GMT+10/+11</SelectItem>
                          <SelectItem value="Australia/Perth">Perth (AWST) - GMT+8</SelectItem>
                          <SelectItem value="Pacific/Auckland">Auckland (NZST/NZDT) - GMT+12/+13</SelectItem>
                          <SelectItem value="Pacific/Honolulu">Honolulu (HST) - GMT-10</SelectItem>
                        </SelectContent>
                      </Select>
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
        </div>
        <div className="w-1/2 border-l border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="h-full">
            <HackathonPreview 
              hackathonData={{
                id: selectedHackathon?.id,
                title: formDataMain.title,
                description: formDataMain.description,
                location: formDataMain.location,
                total_prizes: formDataMain.total_prizes,
                tags: formDataMain.tags,
                participants: formDataMain.participants,
                organizers: formDataMain.organizers,
                banner: formDataLatest.banner,
                content: {
                  tracks_text: formDataContent.tracks_text,
                  tracks: formDataContent.tracks,
                  schedule: formDataContent.schedule,
                  speakers: formDataContent.speakers,
                  resources: formDataContent.resources,
                  partners: formDataContent.partners.map(p => typeof p === 'string' ? p : p.name).filter(Boolean),
                  join_custom_link: formDataContent.join_custom_link || undefined,
                  join_custom_text: formDataContent.join_custom_text || undefined,
                  submission_custom_link: formDataContent.submission_custom_link ? formDataContent.submission_custom_link : undefined,
                  judging_guidelines: formDataContent.judging_guidelines,
                  submission_deadline: formDataContent.submission_deadline,
                  registration_deadline: formDataContent.registration_deadline,
                },
                start_date: formDataLatest.start_date,
                end_date: formDataLatest.end_date,
                status: 'UPCOMING',
              }}
              isRegistered={false}
              scrollTarget={scrollTarget}
            />
          </div>
        </div>
      </div>
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