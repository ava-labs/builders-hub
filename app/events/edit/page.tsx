'use client';

import React, { useState, useEffect, memo, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash, ChevronDown, ChevronRight, Database, PlusCircle, FileText, Layers, ImageIcon, Users, AlignLeft, LayoutGrid, ClipboardList, X, Save, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { ICON_OPTIONS } from '@/components/hackathons/edit/icon-registry';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import HackathonsList from '@/components/hackathons/edit/HackathonsList';
import { t } from './translations';
import { useSession, SessionProvider } from "next-auth/react";
import axios from 'axios';
import { initialData, IDataMain, IDataContent, IDataLatest, ITrack, ISchedule, ISpeaker, IResource, IPartner } from './initials';
import { LanguageButton } from './language-button';
import { EmailListInput } from '@/components/common/EmailListInput';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import HackathonsEditStages from '@/components/hackathons/edit/stages/Stages';
import HackathonPreviewTabs from '@/components/hackathons/edit/preview/Preview';
import { zodResolver } from '@/lib/zodResolver';
import { FieldErrors, useForm, useWatch } from 'react-hook-form';
import { HackathonEditFormValues, hackathonEditSchema } from '@/lib/hackathons/hackathon-edit.schema';
import { useEventsValidation, type ValidationIssue } from '@/hooks/use-events-validation';
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion'
import RemoveButton from '@/components/hackathons/edit/stages/RemoveButton';

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

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const ValidationErrorModal = ({
  open,
  onClose,
  issues,
  language,
  onNavigateTo,
}: {
  open: boolean;
  onClose: () => void;
  issues: ValidationIssue[];
  language: 'en' | 'es';
  onNavigateTo: (issue: ValidationIssue) => void;
}) => {
  if (!open) return null;

  const grouped = issues.reduce<Record<string, ValidationIssue[]>>((acc, issue) => {
    if (!acc[issue.section]) acc[issue.section] = [];
    acc[issue.section].push(issue);
    return acc;
  }, {});

  const title =
    language === 'es'
      ? `Corrige ${issues.length} error${issues.length > 1 ? 'es' : ''} antes de guardar`
      : `Fix ${issues.length} error${issues.length > 1 ? 's' : ''} before saving`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl p-6 max-w-lg w-full max-h-[80vh] mx-4 flex flex-col pointer-events-auto"
      >
        <div className="flex items-center gap-3 mb-5 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
            <span className="text-red-600 dark:text-red-400 font-bold text-sm">!</span>
          </div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-2"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(209 213 219) transparent',
          } as React.CSSProperties}
        >
          {Object.entries(grouped).map(([section, sectionIssues]) => (
            <div key={section}>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                {section}
              </p>
              <ul className="space-y-2">
                {sectionIssues.map((issue) => (
                  <li
                    key={issue.path}
                    className="flex items-center gap-2 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-md px-3 py-2"
                  >
                    <span className="text-red-500 flex-shrink-0">•</span>
                    <span className="text-zinc-800 dark:text-zinc-200 flex-1 min-w-0">
                      <span className="font-medium">{String(issue.label)}:</span>{' '}
                      <span className="text-zinc-600 dark:text-zinc-400">{String(issue.message)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateTo(issue)}
                      className="flex-shrink-0 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title={language === 'es' ? 'Ir al campo' : 'Go to field'}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-5 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 text-sm font-medium transition-colors"
          >
            {language === 'es' ? 'Entendido' : 'Got it'}
          </button>
        </div>
      </div>
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
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 max-w-4xl w-full max-h-[90vh] flex flex-col">
        <h2 className="text-lg font-bold mb-4 flex-shrink-0">{t[language].confirmUpdateTitle || 'Confirm Update'}</h2>
        <p className="mb-2 flex-shrink-0">{t[language].confirmUpdateText || 'You are about to update the following fields:'}</p>
        <ul className="list-disc pl-6 flex-1 min-h-0 overflow-y-auto overflow-x-auto mb-4">
          {fieldsToUpdate.map(({ key, oldValue, newValue }) => (
            <li key={key} className="mb-1">
              <div className="font-semibold mb-1">{key}:</div>
              <div className="overflow-x-auto max-w-full border border-gray-200 dark:border-gray-700 rounded p-2">
                <div className="text-red-600 dark:text-red-500 line-through whitespace-nowrap text-sm min-w-max">{String(oldValue)}</div>
              </div>
              <div className="overflow-x-auto max-w-full border border-gray-200 dark:border-gray-700 rounded p-2">
                <div className="text-green-600 dark:text-green-500 whitespace-nowrap text-sm min-w-max">{String(newValue)}</div>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-red-400">{t[language].cancel}</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">{t[language].update}</button>
        </div>
      </div>
    </div>
  );
};

function SubformFieldError({
  fieldError,
  field,
}: {
  fieldError?: (field: string) => string | null;
  field: string;
}): React.ReactNode {
  const msg = fieldError?.(field);
  if (!msg) return null;
  return <p className="text-red-500 text-sm -mt-2 mb-2">{msg}</p>;
}



const IconPicker = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const effective = ICON_OPTIONS.find((o) => o.value === value) ? value : ICON_OPTIONS[0].value;
  const selected = ICON_OPTIONS.find((o) => o.value === effective) ?? ICON_OPTIONS[0];

  // Persist default icon when value is unset (e.g. new record)
  useEffect(() => {
    if (!ICON_OPTIONS.find((o) => o.value === value)) {
      onChange(ICON_OPTIONS[0].value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-sm"
      >
        <selected.Icon className="w-4 h-4" />
        <span className="capitalize">{selected.value.replace(/-/g, ' ')}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
      </button>
      {open && (
        <div className="absolute z-50 bottom-full mb-1 left-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl p-2 min-w-[220px] max-h-64 overflow-y-auto">
          <div className="grid grid-cols-3 gap-1">
            {ICON_OPTIONS.map(({ value: v, Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => { onChange(v); setOpen(false); }}
                className={`flex flex-col items-center gap-1 p-2 rounded-md text-xs transition-colors ${
                  v === effective
                    ? 'bg-red-50 dark:bg-red-900/30 ring-1 ring-red-400 text-red-600 dark:text-red-400'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate w-full text-center">{v.replace(/-/g, ' ')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
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
  fieldError?: (field: string) => string | null;
};

const TrackItem = memo(function TrackItem({ track, index, collapsed, onChange, onDone, onExpand, onRemove, onScrollToPreview, t, language, removing, tracksLength, rawTrackDescriptions, setRawTrackDescriptions, convertToHTML, fieldError }: TrackItemProps) {
  return (
    <Accordion key={`track-${index}`} type="single" collapsible className="w-full rounded-md border px-4 py-0.5">
      <AccordionItem value={`item-${index}`}>
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between gap-2 py-1 text-sm font-medium outline-none [&[data-state=open]_svg.chevron]:rotate-180">
            <h3 className="text-lg font-semibold my-1">Track {index + 1}</h3>
            <div className="flex items-center gap-2">
              <ChevronDown className="chevron text-muted-foreground size-4 shrink-0 transition-transform duration-200" />
              {tracksLength > 1 && (
                <RemoveButton onRemove={() => onRemove(index)} tooltipLabel={t[language].removeTrack} size={18} />
              )}
            </div>
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        <AccordionContent>
        <>
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].trackName}</div>
          <Input
            type="text"
            placeholder="Name"
            value={track.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            className="w-full mb-3"
            required
          />
          <SubformFieldError fieldError={fieldError} field="name" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].trackPartner}</div>
          <Input
            type="text"
            placeholder="Partner"
            value={track.partner}
            onChange={(e) => onChange(index, 'partner', e.target.value)}
            className="w-full mb-3"
            required
          />
          <SubformFieldError fieldError={fieldError} field="partner" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].trackDescription}</div>
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
            className="w-full mb-3 p-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 resize-none h-32"
            required
          />
          <SubformFieldError fieldError={fieldError} field="description" />
          {track.description && (
            <div className="mb-3">
              <div className="text-zinc-700 dark:text-zinc-400 text-sm mb-2">HTML Preview:</div>
              <div className="p-3 bg-zinc-800 border border-zinc-600 rounded-lg text-green-400 text-xs font-mono whitespace-pre-wrap max-h-20 overflow-y-auto">
                {track.description}
              </div>
            </div>
          )}
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].shortDescription}</div>
          <Input
            type="text"
            placeholder="Short Description"
            value={track.short_description}
            onChange={(e) => onChange(index, 'short_description', e.target.value)}
            className="w-full mb-1"
            required
          />
          <SubformFieldError fieldError={fieldError} field="short_description" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">Icon</div>
          <div className="relative mb-3">
            <IconPicker
              value={track.logo || track.icon}
              onChange={(val) => {
                onChange(index, 'logo', val);
                onChange(index, 'icon', val);
                onScrollToPreview('tracks');
              }}
            />
          </div>
        </>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
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
  fieldError?: (field: string) => string | null;
};

const ScheduleItem = memo(function ScheduleItem({ event, index, collapsed, onChange, onDone, onExpand, onRemove, t, language, removing, scheduleLength, toLocalDatetimeString, fieldError }: ScheduleItemProps) {
  return (
    <Accordion key={`stage-${index}`} type="single" collapsible className="w-full rounded-md border px-4 py-0.5">
      <AccordionItem value={`item-${index}`}>
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between gap-2 py-1 text-sm font-medium outline-none [&[data-state=open]_svg.chevron]:rotate-180">
            <h3 className="text-lg font-semibold my-1">Schedule {index + 1}</h3>
            <div className="flex items-center gap-2">
              <ChevronDown className="chevron text-muted-foreground size-4 shrink-0 transition-transform duration-200" />
              <RemoveButton onRemove={() => onRemove(index)} tooltipLabel={t[language].removeSchedule} size={18} />
            </div>
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        <AccordionContent>
        <>
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].scheduleDate}</div>
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
          <SubformFieldError fieldError={fieldError} field="date" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].scheduleName}</div>
          <Input
            type="text"
            placeholder="Name"
            value={event.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            className="w-full mb-3"
            required
          />
          <SubformFieldError fieldError={fieldError} field="name" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].scheduleCategory}</div>
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
          <SubformFieldError fieldError={fieldError} field="category" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].scheduleLocation}</div>
          <Input
            type="text"
            placeholder="Location"
            value={event.location}
            onChange={(e) => onChange(index, 'location', e.target.value)}
            className="w-full mb-3"
            required
          />
          <SubformFieldError fieldError={fieldError} field="location" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].scheduleDescription}</div>
          <Input
            type="text"
            placeholder="Description"
            value={event.description}
            onChange={(e) => onChange(index, 'description', e.target.value)}
            className="w-full mb-3"
            required
          />
          <SubformFieldError fieldError={fieldError} field="description" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].scheduleDuration}</div>
          <Input
            type="number"
            placeholder="Duration (minutes)"
            value={event.duration}
            onChange={(e) => onChange(index, 'duration', e.target.value)}
            className="w-full mb-1"
            required
            min="1"
          />
          <SubformFieldError fieldError={fieldError} field="duration" />
          <SubformFieldError fieldError={fieldError} field="url" />
        </>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
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
  onApplyTemplate: (index: number, template: SpeakerTemplate) => void;
  speakerTemplates: SpeakerTemplate[];
  loadingSpeakerTemplates: boolean;
  onImageFileTooLarge: (fileSize: number) => void;
  fieldError?: (field: string) => string | null;
};
type SpeakerTemplate = {
  id: string;
  name: string;
  category: string;
  picture: string;
  icon: string;
};

const SpeakerItem = memo(function SpeakerItem({ speaker, index, collapsed, onChange, onDone, onExpand, onRemove, t, language, removing, speakersLength, onPictureChange, onImageFileTooLarge, onApplyTemplate, speakerTemplates, loadingSpeakerTemplates, fieldError }: SpeakerItemProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect((): void => {
    setIsMounted(true);
  }, []);

  const selectedTemplateId: string =
    speakerTemplates.find(
      (template: SpeakerTemplate) =>
        template.name === speaker.name &&
        template.category === speaker.category &&
        template.picture === speaker.picture
    )?.id ?? '__none__';

  const handleTemplateChange = (value: string): void => {
    if (value === '__none__') {
      return;
    }

    const selectedTemplate: SpeakerTemplate | undefined = speakerTemplates.find(
      (template: SpeakerTemplate) => template.id === value
    );

    if (!selectedTemplate) {
      return;
    }

    onApplyTemplate(index, selectedTemplate);
  };
  return (
    <Accordion key={`speaker-${index}`} type="single" collapsible className="w-full rounded-md border px-4 py-0.5">
      <AccordionItem value={`item-${index}`}>
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between gap-2 py-1 text-sm font-medium outline-none [&[data-state=open]_svg.chevron]:rotate-180">
            <h3 className="text-lg font-semibold my-1">Speaker {index + 1}</h3>
            <div className="flex items-center gap-2">
              <ChevronDown className="chevron text-muted-foreground size-4 shrink-0 transition-transform duration-200" />
              {speakersLength > 1 && (
                <RemoveButton onRemove={() => onRemove(index)} tooltipLabel={t[language].removeSpeaker} size={18} />
              )}
            </div>
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        <AccordionContent>
        <>
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">Default speaker</div>

          <div suppressHydrationWarning>
            <Select
              value={selectedTemplateId}
              onValueChange={handleTemplateChange}
              disabled={loadingSpeakerTemplates || !isMounted}
            >
              <SelectTrigger className="mb-3">
                <SelectValue
                  placeholder={
                    loadingSpeakerTemplates
                      ? 'Loading speakers...'
                      : 'Select a default speaker'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Custom speaker</SelectItem>
                {isMounted && speakerTemplates.map((template: SpeakerTemplate) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].speakerIcon}</div>
          <Select
            value={speaker.icon || '__none__'}
            onValueChange={(value: string) =>
              onChange(index, 'icon', value === '__none__' ? '' : value)
            }
          >
            <SelectTrigger className="mb-3">
              <SelectValue placeholder="Select Icon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No icon</SelectItem>
              <SelectItem value="code">Code</SelectItem>
              <SelectItem value="megaphone">Megaphone</SelectItem>
            </SelectContent>
          </Select> */}

          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].speakerName}</div>
          <Input
            type="text"
            placeholder="Name"
            value={speaker.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(index, 'name', e.target.value)
            }
            className="w-full mb-3"
            required
          />
          <SubformFieldError fieldError={fieldError} field="name" />

          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].speakerCompany}</div>
          <Input
            type="text"
            placeholder="Category"
            value={speaker.category}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(index, 'category', e.target.value)
            }
            className="w-full mb-1"
            required
          />
          <SubformFieldError fieldError={fieldError} field="category" />

          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">Picture</div>
          <div className="mb-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const file: File | undefined = e.target.files?.[0];
                if (file) {
                  if (file.size > MAX_FILE_SIZE) {
                    onImageFileTooLarge(file.size);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    onPictureChange(index, event.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="w-full p-2 border border-zinc-600 rounded bg-zinc-800 text-zinc-200 cursor-pointer"
            />
          </div>

          <div className="mb-2">
            <Input
              type="text"
              placeholder="Or enter Picture URL"
              value={speaker.picture}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onPictureChange(index, e.target.value)
              }
              className="w-full"
            />
          </div>
          <SubformFieldError fieldError={fieldError} field="picture" />

          {speaker.picture && speaker.picture.trim() !== '' && (
            <div className="mb-2">
              <img
                src={speaker.picture}
                alt={speaker.name}
                className="w-20 h-20 object-cover rounded border border-zinc-600"
              />
            </div>
          )}
        </>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
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
  fieldError?: (field: string) => string | null;
};

const ResourceItem = memo(function ResourceItem({ resource, index, collapsed, onChange, onDone, onExpand, onRemove, t, language, removing, resourcesLength, fieldError }: ResourceItemProps) {
  return (
    <Accordion key={`resource-${index}`} type="single" collapsible className="w-full rounded-md border px-4 py-0.5">
      <AccordionItem value={`item-${index}`}>
        <AccordionPrimitive.Header className="flex">
          <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between gap-2 py-1 text-sm font-medium outline-none [&[data-state=open]_svg.chevron]:rotate-180">
            <h3 className="text-lg font-semibold my-1">Resource {index + 1}</h3>
            <div className="flex items-center gap-2">
              <ChevronDown className="chevron text-muted-foreground size-4 shrink-0 transition-transform duration-200" />
              {resourcesLength > 1 && (
                <RemoveButton onRemove={() => onRemove(index)} tooltipLabel={t[language].removeResource} size={18} />
              )}
            </div>
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        <AccordionContent>
        <>
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].resourceLink}</div>
          <Input
            type="text"
            placeholder="Link"
            value={resource.link}
            onChange={(e) => onChange(index, 'link', e.target.value)}
            className="w-full mb-3"
            required
          />
          <SubformFieldError fieldError={fieldError} field="link" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].resourceTitle}</div>
          <Input
            type="text"
            placeholder="Title"
            value={resource.title}
            onChange={(e) => onChange(index, 'title', e.target.value)}
            className="w-full mb-3"
            required
          />
          <SubformFieldError fieldError={fieldError} field="title" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].resourceDescription}</div>
          <Input
            type="text"
            placeholder="Description"
            value={resource.description}
            onChange={(e) => onChange(index, 'description', e.target.value)}
            className="w-full mb-1"
            required
          />
          <SubformFieldError fieldError={fieldError} field="description" />
          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].resourceIcon}</div>
          <div className="relative mb-3">
            <IconPicker
              value={resource.icon}
              onChange={(val) => onChange(index, 'icon', val)}
            />
          </div>
        </>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
});

const HackathonsEdit = () => {
  const [speakerTemplates, setSpeakerTemplates] = useState<SpeakerTemplate[]>([]);
  const [loadingSpeakerTemplates, setLoadingSpeakerTemplates] = useState<boolean>(false);
  const { data: session, status } = useSession();
  const [myHackathons, setMyHackathons] = useState<any[]>([]);
  const [loadingHackathons, setLoadingHackathons] = useState<boolean>(true);
  const [isSelectedHackathon, setIsSelectedHackathon] = useState(false);
  const [selectedHackathon, setSelectedHackathon] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { control, setValue, getValues, reset, handleSubmit: handleFormSubmit, trigger, formState: { errors } } =
    useForm<HackathonEditFormValues>({
      resolver: zodResolver(hackathonEditSchema),
      defaultValues: {
        main: initialData.main,
        content: {
          ...initialData.content,
          partners: [{ name: '', logo: '' }],
          stages: [],
        },
        latest: initialData.latest,
        cohostsEmails: [],
      },
      mode: 'onChange',
      reValidateMode: 'onChange',
    });
  const formDataMain = useWatch({ control, name: 'main' }) ?? initialData.main;
  const formDataContent =
    useWatch({ control, name: 'content' }) ??
    ({
      ...initialData.content,
      partners: [{ name: '', logo: '' }],
      stages: [],
    } as IDataContent);
  const formDataLatest = useWatch({ control, name: 'latest' }) ?? initialData.latest;
  const cohostsEmails = useWatch({ control, name: 'cohostsEmails' }) ?? [];
  const setFormDataMain = useCallback((nextState: React.SetStateAction<IDataMain>) => {
    const nextValue =
      typeof nextState === 'function'
        ? (nextState as (prevState: IDataMain) => IDataMain)(getValues('main'))
        : nextState;
    setValue('main', nextValue, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }, [getValues, setValue]);
  const setFormDataContent = useCallback((nextState: React.SetStateAction<IDataContent>) => {
    const nextValue =
      typeof nextState === 'function'
        ? (nextState as (prevState: IDataContent) => IDataContent)(getValues('content'))
        : nextState;
    setValue('content', nextValue, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }, [getValues, setValue]);
  const setFormDataLatest = useCallback((nextState: React.SetStateAction<IDataLatest>) => {
    const nextValue =
      typeof nextState === 'function'
        ? (nextState as (prevState: IDataLatest) => IDataLatest)(getValues('latest'))
        : nextState;
    setValue('latest', nextValue, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }, [getValues, setValue]);
  const setCohostsEmails = useCallback((nextState: React.SetStateAction<string[]>) => {
    const nextValue =
      typeof nextState === 'function'
        ? (nextState as (prevState: string[]) => string[])(getValues('cohostsEmails'))
        : nextState;
    setValue('cohostsEmails', nextValue, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  }, [getValues, setValue]);
  const [activePreviewTab, setActivePreviewTab] = React.useState<
    'hackathon-preview' | 'stages-submit-form'
  >('hackathon-preview')

  const [selectedStageForm, setSelectedStageForm] = React.useState<string>('0')
  const { toast } = useToast();
  const getInlineError = (path: string): string | null => {
    const segments = path.split('.');
    let current: unknown = errors;
    for (const segment of segments) {
      if (!current || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[segment];
    }
    if (!current || typeof current !== 'object') return null;
    const message = (current as { message?: unknown }).message;
    return typeof message === 'string' && message.trim() ? message : null;
  };

  const getSpeakers = async (): Promise<void> => {
    setLoadingSpeakerTemplates(true);

    try {
      const response = await axios.get('/api/speakers');

      const speakers: SpeakerTemplate[] = Array.isArray(response.data)
        ? response.data.map((speaker: any): SpeakerTemplate => ({
          id: String(speaker.id),
          name: speaker.name ?? '',
          category: speaker.category ?? '',
          picture: speaker.picture ?? '',
          icon: speaker.icon ?? '',
        }))
        : [];

      setSpeakerTemplates(speakers);
    } catch (error: unknown) {
      console.error('Error loading speakers:', error);
      setSpeakerTemplates([]);
    } finally {
      setLoadingSpeakerTemplates(false);
    }
  };

  const getMyHackathons = async () => {
    setLoadingHackathons(true);
    try {
      const response = await axios.get(
        `/api/hackathons?joined_only=true`,
        {
          headers: {
            id: session?.user?.id,
          }
        }
      );
      const hackathons = response.data?.hackathons ?? [];
      console.log({ response: hackathons });
      setMyHackathons(hackathons);
    } catch (error) {
      console.error('Error loading hackathons:', error);
    } finally {
      setLoadingHackathons(false);
    }
  }
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      getMyHackathons();
      getSpeakers()
    }
  }, [session, status]);
  const handleApplySpeakerTemplate = useCallback(
    (idx: number, template: SpeakerTemplate): void => {
      setFormDataContent((prev: IDataContent) => {
        const newSpeakers = [...prev.speakers];
        newSpeakers[idx] = {
          ...newSpeakers[idx],
          name: template.name,
          category: template.category,
          // icon: template.icon,
          picture: template.picture,
        };
        return { ...prev, speakers: newSpeakers };
      });
    },
    []
  );

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
    console.log({ hackathon });
    setFormDataContent({
      ...(hackathon.content ?? {}),
      language: hackathon.content?.language === "es" ? "es" : "en",
      stages: hackathon.content?.stages ?? [],
      tracks: hackathon.content?.tracks ?? [{ icon: '', logo: '', name: '', partner: '', description: '', short_description: '' }],
      address: hackathon.content?.address ?? '',
      partners: hackathon.content?.partners ?? [''],
      schedule: hackathon.content?.schedule ?? [{ url: null, date: '', name: '', category: '', location: '', description: '', duration: 0 }],
      speakers: (hackathon.content?.speakers ?? []).map((s: any) => ({ ...s, picture: s.picture ?? '' })),
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
      custom_link: hackathon.custom_link ?? null,
      top_most: hackathon.top_most ?? false,
      event: hackathon.event ?? 'hackathon',
      new_layout: hackathon.new_layout ?? false,
      google_calendar_id: hackathon.google_calendar_id ?? null,
    });
    setCohostsEmails(hackathon.cohosts ?? []);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setIsSelectedHackathon(false);
    setSelectedHackathon(null);
    reset({
      main: initialData.main,
      content: {
        ...initialData.content,
        partners: [{ name: '', logo: '' }],
        stages: [],
      },
      latest: initialData.latest,
      cohostsEmails: [],
    });
    setShowForm(false);
  };

  const [removing, setRemoving] = useState<{ [key: string]: number | null }>({});
  const [collapsed, setCollapsed] = useState({
    main: false,
    images: false,
    stages: false,
    about: false,
    trackText: false,
    content: false,
    last: false,
  });

  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [scrollTarget, setScrollTarget] = useState<string | undefined>();
  const [rawTrackText, setRawTrackText] = useState<string>('');
  const [rawTrackDescriptions, setRawTrackDescriptions] = useState<{ [key: number]: string }>({});
  const [hasEditPermission, setHasEditPermission] = useState<boolean>(false);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);

  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const step1Ref = useRef<HTMLDivElement | null>(null);
  const step2Ref = useRef<HTMLDivElement | null>(null);
  const step3Ref = useRef<HTMLDivElement | null>(null);
  const step4Ref = useRef<HTMLDivElement | null>(null);
  const step5Ref = useRef<HTMLDivElement | null>(null);
  const step6Ref = useRef<HTMLDivElement | null>(null);
  const step7Ref = useRef<HTMLDivElement | null>(null);

  const [activeStep, setActiveStep] = useState<'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7'>('step1');
  const [contentTab, setContentTab] = useState<'tracks' | 'stages' | 'meta' | 'schedule' | 'resources' | 'speakers' | 'submission'>('tracks');

  const getDateRangeError = (start: string, end: string): string | null => {
    if (!start?.trim() || !end?.trim()) return null;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (isNaN(startTime) || isNaN(endTime)) return null;
    return endTime > startTime ? null : t[language].endDateBeforeStartDateError;
  };

  const scrollToSection = (section: string) => {
    setScrollTarget(section);
    setTimeout(() => setScrollTarget(undefined), 1000);
  };

  useEffect(() => {
    if (!session?.user) {
      setHasEditPermission(false);
      return;
    }
    const customAttributes: string[] = session.user.custom_attributes || [];
    const isSpecialRole =
      customAttributes.includes("hackathonCreator") ||
      customAttributes.includes("team1-admin") ||
      customAttributes.includes("devrel");

    // If no hackathon is selected, allow editing only for special roles (for creating new hackathons)
    if (!selectedHackathon) {
      setHasEditPermission(isSpecialRole);
      return;
    }

    // If hackathon is selected, check if user is creator/updater, special role, or cohost
    const userEmail = session.user.email || "";
    const isCohost =
      !!userEmail && Array.isArray(selectedHackathon.cohosts)
        ? selectedHackathon.cohosts.includes(userEmail)
        : false;
    setHasEditPermission(isSpecialRole || isCohost);
  }, [selectedHackathon, session]);

  const convertToMarkdown = (text: string) => {
    if (!text) return '';
    const paragraphs = text.split(/\n\s*\n/);
    return paragraphs
      .map(paragraph => {
        const trimmed = paragraph.trim();
        return trimmed;
      })
      .filter(p => p.length > 0)
      .join('\n\n');
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

  useEffect(() => {
    if (formDataLatest.event !== 'hackathon') {
      if (contentTab === 'tracks') {
        setContentTab('meta');
      }
    }
  }, [formDataLatest.event, contentTab]);

  useEffect(() => {
    const container = leftPanelRef.current;
    if (!container) return;

    const sections: { id: typeof activeStep; ref: React.RefObject<HTMLDivElement | null> }[] = [
      { id: 'step1', ref: step1Ref },
      { id: 'step2', ref: step2Ref },
      { id: 'step3', ref: step3Ref },
      { id: 'step4', ref: step4Ref },
      { id: 'step5', ref: step5Ref },
      { id: 'step6', ref: step6Ref },
      { id: 'step7', ref: step7Ref },
    ];

    const updateActiveStep = () => {
      const containerRect = container.getBoundingClientRect();
      let bestId: typeof activeStep = 'step1';
      let bestVisible = -Infinity;
      sections.forEach(({ id, ref }) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Visible overlap = intersection of section rect with container viewport
        const visibleTop = Math.max(rect.top, containerRect.top);
        const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
        const visibleHeight = visibleBottom - visibleTop;
        if (visibleHeight > bestVisible) {
          bestVisible = visibleHeight;
          bestId = id;
        }
      });
      setActiveStep(bestId);
    };

    container.addEventListener('scroll', updateActiveStep, { passive: true });
    updateActiveStep();

    return () => {
      container.removeEventListener('scroll', updateActiveStep);
    };
  }, [leftPanelRef.current]);

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
        { name: '', category: '', picture: '' },
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
    const newSchedule = formDataContent.schedule.filter((_, i) => i !== index);
    setFormDataContent({ ...formDataContent, schedule: newSchedule });
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
    latest.google_calendar_id = formDataLatest.google_calendar_id?.trim() || null;
    const { icon, ...latestWithoutIcon } = latest;
    return {
      ...formDataMain,
      content,
      ...latestWithoutIcon,
      cohosts: cohostsEmails,
      custom_link: formDataLatest.custom_link ? formDataLatest.custom_link : null,
      status: selectedHackathon?.status ?? "UPCOMING"
    };
  };

  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  const { onValidationError } = useEventsValidation(
    (issues) => {
      if (issues.length === 0) return;
      const fieldLabelMap: Record<string, string> = {
        date: 'Date', name: 'Name', category: 'Category', location: 'Location',
        description: 'Description', duration: 'Duration', url: 'URL', icon: 'Icon',
        link: 'Link', title: 'Title', logo: 'Logo', partner: 'Partner',
        short_description: 'Short Description',
      };
      const processed = issues.map((issue) => {
        const label = issue.label?.trim()
          ? issue.label
          : (() => {
              const seg = issue.path.split('.').pop() ?? '';
              return fieldLabelMap[seg] ?? (seg.charAt(0).toUpperCase() + seg.slice(1).replace(/_/g, ' '));
            })();
        const section = issue.section?.trim()
          ? issue.section
          : (() => {
              const m = issue.path.match(/^content\.(schedule|tracks|resources)\.(\d+)\./);
              if (m) {
                const typeMap: Record<string, string> = { schedule: 'Schedule', tracks: 'Track', resources: 'Resource' };
                return `${typeMap[m[1]]} ${Number(m[2]) + 1}`;
              }
              return issue.section;
            })();
        return { ...issue, label, section };
      });
      setValidationIssues(processed);
      setShowValidationModal(true);
    },
    language
  );

  const handleNavigateToError = useCallback((issue: ValidationIssue) => {
    setShowValidationModal(false);
    const { section, path } = issue;

    let collapsedKey: 'main' | 'images' | 'stages' | 'about' | 'trackText' | 'content' | 'last' | null = null;
    let targetRef: React.RefObject<HTMLDivElement | null> | null = null;
    let stepKey: 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7' = 'step1';

    if (section === 'Participants & Prizes') {
      collapsedKey = 'about'; targetRef = step4Ref; stepKey = 'step4';
    } else if (section === 'Basic Info' || path.startsWith('main.') || path === 'cohostsEmails') {
      collapsedKey = 'main'; targetRef = step1Ref; stepKey = 'step1';
    } else if (section === 'Stages' || path.startsWith('content.stages.')) {
      collapsedKey = 'stages'; targetRef = step2Ref; stepKey = 'step2';
    } else if (section === 'Images & Branding') {
      collapsedKey = 'images'; targetRef = step3Ref; stepKey = 'step3';
    } else if (section === 'Track Text' || path === 'content.tracks_text') {
      collapsedKey = 'trackText'; targetRef = step5Ref; stepKey = 'step5';
    } else if (section === 'Last Details') {
      collapsedKey = 'last'; targetRef = step7Ref; stepKey = 'step7';
    } else if (/^content\.schedule\.\d+\./.test(path)) {
      collapsedKey = 'content'; targetRef = step6Ref; stepKey = 'step6';
      setContentTab('schedule');
    } else if (/^content\.tracks\.\d+\./.test(path)) {
      collapsedKey = 'content'; targetRef = step6Ref; stepKey = 'step6';
      setContentTab('tracks');
    } else if (/^content\.resources\.\d+\./.test(path)) {
      collapsedKey = 'content'; targetRef = step6Ref; stepKey = 'step6';
      setContentTab('resources');
    } else if (section.startsWith('Content') || path.startsWith('content.')) {
      collapsedKey = 'content'; targetRef = step6Ref; stepKey = 'step6';
    }

    if (collapsedKey) setCollapsed(prev => ({ ...prev, [collapsedKey!]: false }));
    setActiveStep(stepKey);

    // Use requestAnimationFrame so the scroll happens after React re-renders the
    // expanded section. Scroll leftPanelRef directly — never use scrollIntoView
    // inside a fixed/overflow-hidden layout as it can scroll the body and break layout.
    requestAnimationFrame(() => {
      const container = leftPanelRef.current;
      const el = targetRef?.current;
      if (!container || !el) return;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      container.scrollBy({ top: elRect.top - containerRect.top - 16, behavior: 'smooth' });
    });
  }, []);

  const submitWithValidation = handleFormSubmit(
    () => {
      void doSubmit();
    },
    onValidationError
  );

  const handleDone = (section: 'main' | 'images' | 'stages' | 'about' | 'trackText' | 'content' | 'last') => {
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
    const imageFields = ['banner', 'small_banner'];
    for (const field of imageFields) {
      if (processedData[field] && processedData[field].startsWith('data:image/')) {
        const fileName = `builders-hub/hackathon-images/${processedData.title.toLowerCase().replace(/ /g, '-')}/${processedData.title}-${field}-${Date.now()}.${processedData[field].split(';')[0].split('/')[1]}`;
        try {
          console.log({ fileName })
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
    const dateErr = getDateRangeError(formDataLatest.start_date, formDataLatest.end_date);
    if (dateErr) {
      setDateRangeError(dateErr);
      setLoading(false);
      return;
    }
    setDateRangeError(null);
    let dataToSend
    if (selectedHackathon !== null)
      dataToSend = { ...getDataToSend(), updated_by: session?.user?.id };
    else {
      dataToSend = { ...getDataToSend(), created_by: session?.user?.id };
    }
    try {
      dataToSend = await processBase64Images(dataToSend);
      console.log('Processed data with uploaded images:', dataToSend);
    } catch (error) {
      console.error('Error processing base64 images:', error);
    }

    if (selectedHackathon === null) {
      try {
        const response = await fetch('/api/hackathons', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSend),
        });
        if (response.ok) {
          toast({
            title: 'Event created',
            description: 'Your event has been created successfully.',
            variant: 'success',
          });
          // No mostrar modal de confirmación de "update" en creación.
          // El popup solo tiene sentido cuando el usuario edita un evento existente.
          setShowUpdateModal(false);
          setFieldsToUpdate([]);
          reset({
            main: initialData.main,
            content: {
              ...initialData.content,
              partners: [{ name: '', logo: '' }],
              stages: [],
            },
            latest: initialData.latest,
            cohostsEmails: [],
          });
          setShowForm(false);
          setIsSelectedHackathon(false);
          setSelectedHackathon(null);
          await getMyHackathons();
        } else {
          const data = await response.json().catch(() => ({}));
          toast({
            title: 'Error creating event',
            description: typeof data?.error === 'string' ? data.error : 'Failed to create event. Please try again.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error creating hackathon:', error);
        toast({
          title: 'Error creating event',
          description: error instanceof Error ? error.message : 'An error occurred. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    } else {
      console.log({ selectedHackathon, id: selectedHackathon?.id });
      try {

        const response = await fetch(`/api/hackathons/${selectedHackathon?.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSend),
        });

        if (response.ok) {
          toast({
            title: 'Event updated',
            description: 'Your event has been updated successfully.',
            variant: 'success',
          });
          setShowUpdateModal(false);
          reset({
            main: initialData.main,
            content: {
              ...initialData.content,
              partners: [{ name: '', logo: '' }],
              stages: [],
            },
            latest: initialData.latest,
            cohostsEmails: [],
          });
          setShowForm(false);
          setIsSelectedHackathon(false);
          setSelectedHackathon(null);
          await getMyHackathons();
        } else {
          const data = await response.json().catch(() => ({}));
          toast({
            title: 'Error updating event',
            description: typeof data?.error === 'string' ? data.error : 'Failed to update event. Please try again.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error updating hackathon:', error);
        toast({
          title: 'Error updating event',
          description: error instanceof Error ? error.message : 'An error occurred. Please try again.',
          variant: 'destructive',
        });
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
        },
      });
      console.log(response);
    } catch (error) {
      console.error('Error deleting hackathon:', error);
    }
  }

  const handleToggleVisibility = async (hackathonId: string, isPublic: boolean) => {
    try {
      console.log({ isPublic })
      const response = await fetch(`/api/hackathons/${selectedHackathon?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
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

  const handleUpdateClick = async () => {
    const isValid = await trigger();
    if (!isValid) {
      // `errors` from formState may be stale after trigger(); let handleFormSubmit
      // re-validate to get fresh errors and call onValidationError correctly.
      void submitWithValidation();
      return;
    }
    const dateErr = getDateRangeError(formDataLatest.start_date, formDataLatest.end_date);
    if (dateErr) {
      setDateRangeError(dateErr);
      return;
    }
    setDateRangeError(null);
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
    if (selectedHackathon === null) {
      void submitWithValidation();
      return;
    }
    setShowUpdateModal(true);
  };

  const handleConfirmUpdate = () => {
    setShowUpdateModal(false);
    // En caso de que el modal se abra por algún motivo en modo creación,
    // evitamos re-ejecutar el submit.
    if (!isSelectedHackathon) return;
    submitWithValidation();
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
      banner: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Hackathon_assets/Template/main_banner_template.png",
      icon: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Hackathon_assets/Template/icon_template.png",
      small_banner: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Hackathon_assets/Template/small_banner_template.png",
      event: "hackathon",
      custom_link: null,
      top_most: false,
      google_calendar_id: null,
      new_layout: false,
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
          // icon: "Megaphone",
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
      submission_custom_link: null,
      stages: []
    });

    setCollapsed({
      main: true,
      images: true,
      stages: true,
      about: true,
      trackText: true,
      content: true,
      last: true
    });

    setShowForm(true);
    setSelectedHackathon(null);
    setIsSelectedHackathon(true);
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
      <div className="h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-zinc-900 dark:text-zinc-100 text-xl">Loading...</div>
      </div>
    );
  }

  // Don't render if user is not authenticated or doesn't have permissions
  if (status === "unauthenticated" || (status === "authenticated" && !hasRequiredPermissions())) {
    return null; // Will redirect via useEffect
  }


  const renderHackathonPreviewTabs = (): React.JSX.Element => {
    return (
      <HackathonPreviewTabs
        tabsProps={{
          hackathonData: {
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
              language: formDataContent.language,
              tracks_text: formDataContent.tracks_text,
              tracks: formDataContent.tracks,
              schedule: formDataContent.schedule,
              speakers: formDataContent.speakers,
              speakers_text: formDataContent.speakers_text,
              resources: formDataContent.resources,
              partners: formDataContent.partners
                .map((p) => (typeof p === 'string' ? p : p.name))
                .filter(Boolean),
              join_custom_link:
                formDataContent.join_custom_link || undefined,
              join_custom_text:
                formDataContent.join_custom_text || undefined,
              submission_custom_link:
                formDataContent.submission_custom_link || undefined,
              judging_guidelines: formDataContent.judging_guidelines,
              submission_deadline:
                formDataContent.submission_deadline,
              registration_deadline:
                formDataContent.registration_deadline,
              stages: formDataContent.stages,
            },
            start_date: formDataLatest.start_date,
            end_date: formDataLatest.end_date,
            status: 'UPCOMING',
          },
          isRegistered: false,
          scrollTarget,
        }}
        hackathon={selectedHackathon}
        activeTab={activePreviewTab}
        onActiveTabChange={setActivePreviewTab}
        selectedStageForm={selectedStageForm}
      />
    )
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      <Toaster />
      {/* Header */}
      <div className="bg-fd-background/80 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 pr-4 h-14 flex items-center justify-center">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t[language].editEvents}</h1>
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
          <div className="flex items-center gap-1.5">
            {isSelectedHackathon && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="shrink-0 p-1.5 rounded-full border transition-colors bg-white text-zinc-700 border-zinc-300 hover:bg-red-400 hover:text-white dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t[language].cancel}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={handleUpdateClick}
                        className="shrink-0 p-1.5 rounded-full border transition-colors bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{selectedHackathon ? t[language].update : t[language].save}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {session?.user?.custom_attributes?.includes("devrel") && selectedHackathon !== null && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(selectedHackathon.id, !formDataMain.is_public)}
                          className="shrink-0 p-1.5 rounded-full border transition-colors bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          {formDataMain.is_public ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{formDataMain.is_public ? 'Hide' : 'Activate'}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {formDataMain.is_public && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => window.open(`/events/${selectedHackathon.id}`, '_blank')}
                          className="shrink-0 p-1.5 rounded-full border transition-colors bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t[language].goToSite}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className="border-l border-zinc-300 dark:border-zinc-600 h-5 mx-0.5" />
              </>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={loadMockData}
                    disabled={selectedHackathon !== null}
                    className="shrink-0 p-1.5 rounded-full border transition-colors bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Database className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{selectedHackathon ? 'Cannot load mock data while editing' : 'Load Mock Data'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => { setShowForm(true); setSelectedHackathon(null); setIsSelectedHackathon(true); }}
                    disabled={isSelectedHackathon}
                    className="shrink-0 p-1.5 rounded-full border transition-colors bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t[language].addNewEvent}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* Left Panel - Edit Form */}
        <div
          ref={leftPanelRef}
          className="w-1/2 h-full min-h-0 overflow-y-auto bg-white dark:bg-zinc-950"
        >
          <div className="px-4 pt-2 pb-4 min-h-full flex flex-col">
            <UpdateModal
              open={showUpdateModal}
              onClose={() => setShowUpdateModal(false)}
              onConfirm={handleConfirmUpdate}
              fieldsToUpdate={fieldsToUpdate}
              t={t}
              language={language}
            />
            <ValidationErrorModal
              open={showValidationModal}
              onClose={() => setShowValidationModal(false)}
              issues={validationIssues}
              language={language}
              onNavigateTo={handleNavigateToError}
            />

            <HackathonsList
              myHackathons={myHackathons}
              language={language}
              onSelect={handleSelectHackathon}
              selectedId={selectedHackathon?.id ?? null}
              isDevrel={session?.user?.custom_attributes?.includes("devrel") || false}
              loading={loadingHackathons}
              forceCollapsed={isSelectedHackathon || showForm}
              fullHeight={!isSelectedHackathon && !showForm}
            />
            {(isSelectedHackathon || showForm) && (
              <div className="mt-2 mb-1 border-b border-zinc-200 dark:border-zinc-800" />
            )}
            {/* Sticky bar: step navigation (always visible when editing) */}
            {(isSelectedHackathon || (showForm && hasEditPermission)) && (
              <div className="sticky top-0 z-20 bg-white/95 dark:bg-zinc-950/98 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 mb-4">
                {showForm && hasEditPermission && (
                  <div className="flex justify-between gap-1.5 py-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsed.main) {
                                setCollapsed((prev) => ({ ...prev, main: false }));
                              }
                              setActiveStep('step1');
                              requestAnimationFrame(() => {
                                const container = leftPanelRef.current;
                                const el = step1Ref.current;
                                if (!container || !el) return;
                                const containerRect = container.getBoundingClientRect();
                                const elRect = el.getBoundingClientRect();
                                container.scrollBy({ top: elRect.top - containerRect.top - 16, behavior: 'smooth' });
                              });
                            }}
                            className={`shrink-0 p-1.5 rounded-full border transition-colors ${activeStep === 'step1'
                              ? 'bg-[#D66666] text-white border-[#D66666]'
                              : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
                              }`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t[language].mainTopics}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsed.stages) {
                                setCollapsed((prev) => ({ ...prev, stages: false }));
                              }
                              setActiveStep('step2');
                              requestAnimationFrame(() => {
                                const container = leftPanelRef.current;
                                const el = step2Ref.current;
                                if (!container || !el) return;
                                const containerRect = container.getBoundingClientRect();
                                const elRect = el.getBoundingClientRect();
                                container.scrollBy({ top: elRect.top - containerRect.top - 16, behavior: 'smooth' });
                              });
                            }}
                            className={`shrink-0 p-1.5 rounded-full border transition-colors ${activeStep === 'step2'
                              ? 'bg-[#D66666] text-white border-[#D66666]'
                              : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
                              }`}
                          >
                            <Layers className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Stages</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsed.images) {
                                setCollapsed((prev) => ({ ...prev, images: false }));
                              }
                              setActiveStep('step3');
                              requestAnimationFrame(() => {
                                const container = leftPanelRef.current;
                                const el = step3Ref.current;
                                if (!container || !el) return;
                                const containerRect = container.getBoundingClientRect();
                                const elRect = el.getBoundingClientRect();
                                container.scrollBy({ top: elRect.top - containerRect.top - 16, behavior: 'smooth' });
                              });
                            }}
                            className={`shrink-0 p-1.5 rounded-full border transition-colors ${activeStep === 'step3'
                              ? 'bg-[#D66666] text-white border-[#D66666]'
                              : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
                              }`}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Images & Branding</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsed.about) {
                                setCollapsed((prev) => ({ ...prev, about: false }));
                              }
                              setActiveStep('step4');
                              requestAnimationFrame(() => {
                                const container = leftPanelRef.current;
                                const el = step4Ref.current;
                                if (!container || !el) return;
                                const containerRect = container.getBoundingClientRect();
                                const elRect = el.getBoundingClientRect();
                                container.scrollBy({ top: elRect.top - containerRect.top - 16, behavior: 'smooth' });
                              });
                            }}
                            className={`shrink-0 p-1.5 rounded-full border transition-colors ${activeStep === 'step4'
                              ? 'bg-[#D66666] text-white border-[#D66666]'
                              : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
                              }`}
                          >
                            <Users className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{formDataLatest.event === 'hackathon' ? 'Participants & Prizes' : 'Organizer'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {formDataLatest.event === 'hackathon' && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (collapsed.trackText) {
                                  setCollapsed((prev) => ({ ...prev, trackText: false }));
                                }
                                setActiveStep('step5');
                                requestAnimationFrame(() => {
                                  const container = leftPanelRef.current;
                                  const el = step5Ref.current;
                                  if (!container || !el) return;
                                  const containerRect = container.getBoundingClientRect();
                                  const elRect = el.getBoundingClientRect();
                                  container.scrollBy({ top: elRect.top - containerRect.top - 16, behavior: 'smooth' });
                                });
                              }}
                              className={`shrink-0 p-1.5 rounded-full border transition-colors ${activeStep === 'step5'
                                ? 'bg-[#D66666] text-white border-[#D66666]'
                                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
                                }`}
                            >
                              <AlignLeft className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{t[language].trackText}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsed.content) {
                                setCollapsed((prev) => ({ ...prev, content: false }));
                              }
                              setActiveStep('step6');
                              requestAnimationFrame(() => {
                                const container = leftPanelRef.current;
                                const el = step6Ref.current;
                                if (!container || !el) return;
                                const containerRect = container.getBoundingClientRect();
                                const elRect = el.getBoundingClientRect();
                                container.scrollBy({ top: elRect.top - containerRect.top - 16, behavior: 'smooth' });
                              });
                            }}
                            className={`shrink-0 p-1.5 rounded-full border transition-colors ${activeStep === 'step6'
                              ? 'bg-[#D66666] text-white border-[#D66666]'
                              : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
                              }`}
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t[language].content}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              if (collapsed.last) {
                                setCollapsed((prev) => ({ ...prev, last: false }));
                              }
                              setActiveStep('step7');
                              requestAnimationFrame(() => {
                                const container = leftPanelRef.current;
                                const el = step7Ref.current;
                                if (!container || !el) return;
                                const containerRect = container.getBoundingClientRect();
                                const elRect = el.getBoundingClientRect();
                                container.scrollBy({ top: elRect.top - containerRect.top - 16, behavior: 'smooth' });
                              });
                            }}
                            className={`shrink-0 p-1.5 rounded-full border transition-colors ${activeStep === 'step7'
                              ? 'bg-[#D66666] text-white border-[#D66666]'
                              : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
                              }`}
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t[language].lastDetails}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            )}

            {showForm && hasEditPermission && (
              <>
                {/* Cohosts Section - Always Visible */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-2 text-blue-700 dark:text-blue-300">{t[language].cohostsTitle}</h2>
                  <p className="text-sm text-blue-700/90 dark:text-blue-200 mb-4">
                    {t[language].cohostsDescription}
                  </p>
                  <EmailListInput
                    value={cohostsEmails}
                    onChange={(emails) => {
                      setCohostsEmails(emails);
                    }}
                    placeholder={t[language].cohostsPlaceholder}
                    label={t[language].cohostsLabel}
                    description={t[language].cohostsHelp}
                  />
                  {getInlineError('cohostsEmails') && (
                    <p className="text-red-500 text-sm mt-2">{getInlineError('cohostsEmails')}</p>
                  )}
                </div>
                {/* Event Type option */}
                <div className="rounded-lg p-6 mb-6 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                    <div>
                      <h2 className='font-medium text-xl mb-2 block'>Event Type</h2>
                      <Select
                        value={formDataLatest.event}
                        onValueChange={(value) => {
                          setFormDataLatest(prev => ({ ...prev, event: value }));
                          console.log(value);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select event type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hackathon">Hackathon</SelectItem>
                          <SelectItem value="workshop">Workshop</SelectItem>
                          <SelectItem value="bootcamp">Bootcamp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Event Language */}
                    <div>
                      <h2 className='font-medium text-xl mb-2 block'>Event Language</h2>
                      <Select
                        value={(formDataContent.language ?? "en") as "en" | "es"}
                        onValueChange={(value) => {
                          const lang = value === "es" ? "es" : "en";
                          setFormDataContent((prev) => ({ ...prev, language: lang }));
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select event language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      id="new-layout"
                      checked={formDataLatest.new_layout}
                      onCheckedChange={(checked) => {
                        setFormDataLatest(prev => ({ ...prev, new_layout: checked }));
                      }}
                      className="cursor-pointer"
                    />
                    <label htmlFor="new-layout" className="text-sm font-medium cursor-pointer">
                      Use new layout (modern event page)
                    </label>
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-400 text-sm mt-2">
                    Toggle on for the modern layout (workshop-style), off for the legacy hackathon layout.
                  </p>
                </div>

                <form onSubmit={submitWithValidation} noValidate className="space-y-4">
                  <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 my-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 ref={step1Ref} className="text-2xl font-bold">Step 1: {t[language].mainTopics}</h2>
                      {collapsed.main && (
                        <button onClick={() => setCollapsed({ ...collapsed, main: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                          <ChevronRight className="w-5 h-5" /> {t[language].expand}
                        </button>
                      )}
                    </div>
                    {!collapsed.main && (
                      <>
                        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded-lg">
                          <h3 className="text-lg font-semibold text-green-700 dark:text-green-300 mb-2">Hackathon Details</h3>
                          <p className="text-sm text-green-800 dark:text-green-200">Let's start with the basic information that will appear in your hackathon preview.</p>
                        </div>

                        <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].mainName}</div>
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
                        {getInlineError('main.title') && (
                          <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('main.title')}</p>
                        )}

                        <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].description}</div>
                        <textarea
                          name="description"
                          placeholder="Describe your hackathon, its goals, and what participants will build..."
                          value={formDataMain.description}
                          onChange={(e) => {
                            setFormDataMain(prev => ({ ...prev, description: e.target.value }));
                            scrollToSection('about');
                          }}
                          className="w-full mb-4 p-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 resize-none h-24"
                          required
                        />
                        {getInlineError('main.description') && (
                          <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('main.description')}</p>
                        )}

                        <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].city}</div>
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
                        {getInlineError('main.location') && (
                          <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('main.location')}</p>
                        )}

                        <div className="flex flex-col space-y-2 bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 my-4">
                          <label className="font-medium">{t[language].tags}</label>
                          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].tagsHelp}</div>
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
                          {getInlineError('main.tags') && (
                            <p className="text-red-500 text-sm">{getInlineError('main.tags')}</p>
                          )}
                          {formDataMain.tags.map((_tag, idx) => (
                            <React.Fragment key={`tag-error-${idx}`}>
                              {getInlineError(`main.tags.${idx}`) && (
                                <p className="text-red-500 text-sm">{`Tag ${idx + 1}: ${getInlineError(`main.tags.${idx}`)}`}</p>
                              )}
                            </React.Fragment>
                          ))}
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
                      <div className="text-zinc-600 dark:text-zinc-400 italic">✓ {t[language].mainTopicsCompleted}</div>
                    )}
                  </div>
                  <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 my-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 ref={step2Ref} className="text-2xl font-bold">Step 2: Stages</h2>
                      {collapsed.stages && (
                        <button onClick={() => setCollapsed({ ...collapsed, stages: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                          <ChevronRight className="w-5 h-5" /> {t[language].expand}
                        </button>
                      )}
                    </div>

                    {collapsed.stages && (
                      <div className="text-zinc-600 dark:text-zinc-400 italic">✓ Stages completed</div>
                    )}
                    {
                      !collapsed.stages && (
                        <>
                          {getInlineError('content.stages') && (
                            <p className="text-red-500 text-sm mb-3">{getInlineError('content.stages')}</p>
                          )}
                          <HackathonsEditStages
                            formDataContent={formDataContent}
                            setFormDataContent={setFormDataContent}
                            setSelectedStageForm={setSelectedStageForm}
                            setActivePreviewTab={setActivePreviewTab as any}
                            language={language}
                          />
                          <div className="flex justify-end mt-4">
                            <button
                              type="button"
                              onClick={() => handleDone('stages')}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded flex items-center gap-1 cursor-pointer"
                            >
                              {t[language].done} <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                        </>

                      )
                    }
                  </div>

                  {/* Step 3: Images & Branding */}
                  <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 my-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 ref={step3Ref} className="text-2xl font-bold">Step 3: Images & Branding</h2>
                      {collapsed.images && (
                        <button onClick={() => setCollapsed({ ...collapsed, images: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                          <ChevronRight className="w-5 h-5" /> {t[language].expand}
                        </button>
                      )}
                    </div>
                    {!collapsed.images && (
                      <>
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                          <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2">Hackathon Images & Branding</h3>
                          <p className="text-sm text-blue-800 dark:text-blue-200">Upload your hackathon banner and small banner. Images will be stored locally and uploaded to the database when you submit the form.</p>
                        </div>

                        {/* Banner Image */}
                        <div className="mb-6">
                          <label className="font-medium text-xl mb-2 block">{ t[language].banner }:</label>
                          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{ t[language].bannerHelp }</div>

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
                                      if (file.size > MAX_FILE_SIZE) {
                                        toast({
                                          title: 'The file is too large (Max: 2MB).',
                                          description: 'Try compressing it.',
                                          variant: 'destructive',
                                        });
                                        return;
                                      }
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
                                {getInlineError('latest.banner') && (
                                  <p className="text-red-500 text-sm mt-2">{getInlineError('latest.banner')}</p>
                                )}
                              </div>
                            </div>

                            {/* Banner Preview */}
                            {formDataLatest.banner && (
                              <div className="mt-4">
                                <div className="text-zinc-700 dark:text-zinc-400 text-sm mb-2">Preview (1600 x 909):</div>
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


                        <div className="mb-6">
                          <label className="font-medium text-xl mb-2 block">{t[language].smallBanner}:</label>
                          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].smallBannerHelp}</div>

                          <div className="mb-4">
                            <div className="flex gap-4 items-start">
                              <div className="flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      if (file.size > MAX_FILE_SIZE) {
                                        toast({
                                          title: 'The file is too large (Max: 2MB).',
                                          description: 'Try compressing it.',
                                          variant: 'destructive',
                                        });
                                        return;
                                      }
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
                                {getInlineError('latest.small_banner') && (
                                  <p className="text-red-500 text-sm mt-2">{getInlineError('latest.small_banner')}</p>
                                )}
                              </div>
                            </div>

                            {formDataLatest.small_banner && (
                              <div className="mt-4">
                                <div className="text-zinc-700 dark:text-zinc-400 text-sm mb-2">Preview (601 x 1028):</div>
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
                      <div className="text-zinc-600 dark:text-zinc-400 italic">✓ Images & branding completed</div>
                    )}
                  </div>

                  {/* Step 3: Participants & Prizes (hackathon) or Organizer only (other events) */}
                  <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 my-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 ref={step4Ref} className="text-2xl font-bold">
                        {formDataLatest.event === 'hackathon' ? 'Step 4: Participants & Prizes' : 'Step 4: Organizer'}
                      </h2>
                      {collapsed.about && (
                        <button onClick={() => setCollapsed({ ...collapsed, about: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                          <ChevronRight className="w-5 h-5" /> {t[language].expand}
                        </button>
                      )}
                    </div>
                    {!collapsed.about && (
                      <>
                        {formDataLatest.event === 'hackathon' && (
                          <>
                            <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-500/30 rounded-lg">
                              <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-300 mb-2">Participants & Prize Information</h3>
                              <p className="text-sm text-orange-800 dark:text-orange-200">Now let's add details about participants and the prize pool.</p>
                            </div>
                          </>
                        )}

                        <>
                          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">Organizer Name/Organization</div>
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
                          {getInlineError('main.organizers') && (
                            <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('main.organizers')}</p>
                          )}
                        </>

                        {/* Step 4: Track Text - Only for Hackathons */}
                        {formDataLatest.event === 'hackathon' && (
                          <>
                            <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].totalPrizes}</div>
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
                            {getInlineError('main.total_prizes') && (
                              <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('main.total_prizes')}</p>
                            )}

                            <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].participants}</div>
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
                            {getInlineError('main.participants') && (
                              <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('main.participants')}</p>
                            )}
                          </>
                        )}
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
                      <div className="text-zinc-600 dark:text-zinc-400 italic">
                        {formDataLatest.event === 'hackathon' ? `✓ ${t[language].mainTopicsCompleted}` : '✓ Organizer completed'}
                      </div>
                    )}
                  </div>

                  {/* Step 4: Track Text - Only for Hackathons */}
                  {formDataLatest.event === 'hackathon' && (
                    <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 my-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 ref={step5Ref} className="text-2xl font-bold">Step 5: {t[language].trackText}</h2>
                        {collapsed.trackText && (
                          <button onClick={() => setCollapsed({ ...collapsed, trackText: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                            <ChevronRight className="w-5 h-5" /> {t[language].expand}
                          </button>
                        )}
                      </div>
                      {!collapsed.trackText && (
                        <>
                          <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-500/30 rounded-lg">
                            <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-2">Track Description</h3>
                            <p className="text-sm text-purple-800 dark:text-purple-200">Write detailed information about your hackathon tracks, program structure, and timeline. Use paragraphs and line breaks - they will be converted to markdown format.</p>
                          </div>

                          <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].trackText}</div>
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
                            className="w-full mb-4 p-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 resize-none h-48"
                            required
                          />
                          {getInlineError('content.tracks_text') && (
                            <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('content.tracks_text')}</p>
                          )}

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
                              <div className="text-zinc-700 dark:text-zinc-400 text-sm mb-2">Markdown Preview:</div>
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
                        <div className="text-zinc-600 dark:text-zinc-400 italic">✓ Track text completed</div>
                      )}
                    </div>
                  )}

                  {/* Step 5: Content - Tracks, Schedule, etc. */}
                  <div ref={step6Ref} className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 my-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl font-bold">Step 6: {t[language].content}</h2>
                      {collapsed.content && (
                        <button onClick={() => setCollapsed({ ...collapsed, content: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                          <ChevronRight className="w-5 h-5" /> {t[language].expand}
                        </button>
                      )}
                    </div>
                    {!collapsed.content && (
                      <>
                        {/* Inner tabs for content sections */}
                        <div className="mb-6">
                          <div className="flex flex-wrap gap-2">
                            {formDataLatest.event === 'hackathon' && (
                              <button
                                type="button"
                                onClick={() => setContentTab('tracks')}
                                className={`px-3 py-1 rounded-full text-xs border transition-colors ${contentTab === 'tracks'
                                  ? 'bg-red-600 text-white border-red-500'
                                  : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'
                                  }`}
                              >
                                {t[language].tracks}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setContentTab('meta')}
                              className={`px-3 py-1 rounded-full text-xs border transition-colors ${contentTab === 'meta'
                                ? 'bg-red-600 text-white border-red-500'
                                : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'
                                }`}
                            >
                              Meta
                            </button>
                            <button
                              type="button"
                              onClick={() => setContentTab('schedule')}
                              className={`px-3 py-1 rounded-full text-xs border transition-colors ${contentTab === 'schedule'
                                ? 'bg-red-600 text-white border-red-500'
                                : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'
                                }`}
                            >
                              {t[language].schedule}
                            </button>
                            <button
                              type="button"
                              onClick={() => setContentTab('resources')}
                              className={`px-3 py-1 rounded-full text-xs border transition-colors ${contentTab === 'resources'
                                ? 'bg-red-600 text-white border-red-500'
                                : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'
                                }`}
                            >
                              {t[language].resources}
                            </button>
                            <button
                              type="button"
                              onClick={() => setContentTab('speakers')}
                              className={`px-3 py-1 rounded-full text-xs border transition-colors ${contentTab === 'speakers'
                                ? 'bg-red-600 text-white border-red-500'
                                : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'
                                }`}
                            >
                              {t[language].speakers}
                            </button>

                          </div>
                        </div>

                        {/* Tracks Section - Only for Hackathons */}
                        {formDataLatest.event === 'hackathon' && contentTab === 'tracks' && (
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
                                fieldError={(f) => getInlineError(`content.tracks.${index}.${f}`)}
                              />
                            ))}
                            <div className="flex justify-end">
                              <Button type="button" onClick={addTrack} className="mt-2 bg-red-500 hover:bg-red-600 text-white flex items-center gap-2">
                                <Plus className="w-4 h-4" /> {t[language].addTrack}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Meta: Address + Google Calendar */}
                        {contentTab === 'meta' && (
                          <>
                            <div className="space-y-4">
                              <label className="font-medium text-xl mb-2 block">{t[language].address}:</label>
                              <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].addressHelp}</div>
                              <Input
                                type="text"
                                placeholder="Address"
                                value={formDataContent.address}
                                onChange={(e) => setFormDataContent({ ...formDataContent, address: e.target.value })}
                                className="w-full mb-4"
                                required
                              />
                              {getInlineError('content.address') && (
                                <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('content.address')}</p>
                              )}
                            </div>
                            <div className="space-y-4">
                              <label className="font-medium text-xl mb-2 block">{t[language].googleCalendarId}:</label>
                              <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].googleCalendarIdHelp}</div>
                              <Input
                                type="text"
                                placeholder="e.g. primary or abc123@group.calendar.google.com"
                                value={formDataLatest.google_calendar_id ?? ''}
                                onChange={(e) => setFormDataLatest({ ...formDataLatest, google_calendar_id: e.target.value || null })}
                                className="w-full mb-4"
                              />
                              {getInlineError('latest.google_calendar_id') && (
                                <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('latest.google_calendar_id')}</p>
                              )}
                            </div>
                          </>
                        )}

                        {/* Schedule */}
                        {contentTab === 'schedule' && (
                          <div className="space-y-4">
                            <label className="font-medium text-xl mb-2 block">{t[language].schedule}:</label>
                            <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].scheduleHelp}</div>
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
                                fieldError={(f) => getInlineError(`content.schedule.${index}.${f}`)}
                              />
                            ))}
                            <div className="flex justify-end">
                              <Button type="button" onClick={addSchedule} className="mt-2 bg-red-500 hover:bg-red-600 text-white flex items-center gap-2">
                                <Plus className="w-4 h-4" /> {t[language].addSchedule}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Resources Section - For all event types */}
                        {contentTab === 'resources' && (
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
                                fieldError={(f) => getInlineError(`content.resources.${index}.${f}`)}
                              />
                            ))}
                            <div className="flex justify-end">
                              <Button type="button" onClick={addResource} className="mt-2 bg-red-500 hover:bg-red-600 text-white flex items-center gap-2">
                                <Plus className="w-4 h-4" /> {t[language].addResource}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Speakers */}
                        {contentTab === 'speakers' && (
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
                                onApplyTemplate={handleApplySpeakerTemplate}
                                speakerTemplates={speakerTemplates}
                                loadingSpeakerTemplates={loadingSpeakerTemplates}
                                onImageFileTooLarge={() =>
                                  toast({
                                    title: 'The file is too large (Max: 2MB).',
                                    description: 'Try compressing it.',
                                    variant: 'destructive',
                                  })
                                }
                                fieldError={(f) => getInlineError(`content.speakers.${index}.${f}`)}
                              />
                            ))}
                            <div className="flex justify-end">
                              <Button type="button" onClick={addSpeaker} className="mt-2 bg-red-500 hover:bg-red-600 text-white flex items-center gap-2">
                                <Plus className="w-4 h-4" /> {t[language].addSpeaker}
                              </Button>
                            </div>
                          </div>
                        )}

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
                      <div className="text-zinc-600 dark:text-zinc-400 italic">{t[language].contentCompleted}</div>
                    )}
                  </div>
                  <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 my-6 mt-10">
                    <div className="flex items-center justify-between mb-4">
                      <h2 ref={step7Ref} className="text-2xl font-bold">Step 7: {t[language].lastDetails}</h2>
                      {collapsed.last && (
                        <button onClick={() => setCollapsed({ ...collapsed, last: false })} className="flex items-center gap-1 text-zinc-400 hover:text-red-500 cursor-pointer">
                          <ChevronRight className="w-5 h-5" /> {t[language].expand}
                        </button>
                      )}
                    </div>
                    {!collapsed.last && (
                      <>
                        <div className="space-y-4">
                          {/* Top Most checkbox
                    <div className="flex items-center gap-2 mb-4">
                      <Checkbox
                        id="top_most"
                        name="top_most"
                        checked={formDataLatest.top_most}
                        onCheckedChange={(checked) => {
                          setFormDataLatest(prev => ({ ...prev, top_most: checked }));
                        }}
                      />
                      <label htmlFor="top_most" className="text-zinc-700 dark:text-zinc-400 text-sm cursor-pointer">
                        Top most
                      </label>
                    </div>
                    */}
                          <div>
                            <label className="font-medium text-xl mb-2 block">{t[language].startDate}:</label>
                            <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].startDateHelp}</div>
                            <Input
                              type="datetime-local"
                              placeholder="Start Date"
                              value={formDataLatest.start_date}
                              onChange={(e) => {
                                const start = e.target.value;
                                setFormDataLatest({ ...formDataLatest, start_date: start });
                                setDateRangeError(getDateRangeError(start, formDataLatest.end_date));
                              }}
                              className="w-full mb-4"
                              required
                            />
                            {getInlineError('latest.start_date') && (
                              <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('latest.start_date')}</p>
                            )}
                          </div>
                          <div>
                            <label className="font-medium text-xl mb-2 block">{t[language].endDate}:</label>
                            <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].endDateHelp}</div>
                            <Input
                              type="datetime-local"
                              placeholder="End Date"
                              value={formDataLatest.end_date}
                              onChange={(e) => {
                                const end = e.target.value;
                                setFormDataLatest({ ...formDataLatest, end_date: end });
                                setDateRangeError(getDateRangeError(formDataLatest.start_date, end));
                              }}
                              className="w-full mb-4"
                              required
                            />
                            {getInlineError('latest.end_date') && (
                              <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('latest.end_date')}</p>
                            )}
                            {dateRangeError && (
                              <p className="text-red-500 text-sm mt-1 mb-4">{dateRangeError}</p>
                            )}
                          </div>
                          {formDataLatest.event === 'hackathon' && (
                            <div>
                              <label className="font-medium text-xl mb-2 block">{t[language].submissionDeadline}:</label>
                              <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].submissionDeadlineHelp}</div>
                              <Input
                                type="datetime-local"
                                placeholder="Submission Deadline"
                                value={formDataContent.submission_deadline}
                                onChange={(e) => setFormDataContent({ ...formDataContent, submission_deadline: e.target.value })}
                                className="w-full mb-4"
                              />
                              {getInlineError('content.submission_deadline') && (
                                <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('content.submission_deadline')}</p>
                              )}
                            </div>
                          )}
                          <div>
                            <label className="font-medium text-xl mb-2 block">{t[language].timezone}:</label>
                            <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].timezoneHelp}</div>
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
                            {getInlineError('latest.timezone') && (
                              <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('latest.timezone')}</p>
                            )}
                          </div>
                        </div>
                        <div>
                        <Accordion
                        type="single"
                        collapsible
                        className="w-full rounded-md border mt-6 px-4 py-2"
                        >
                          <AccordionItem value={'options'}>
                            <AccordionPrimitive.Header className="flex">
                              <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between gap-2 py-1 text-sm font-medium outline-none [&[data-state=open]_svg.chevron]:rotate-180">
                              <span>Advanced options</span>
                              <div className="flex items-center gap-2">
                              <ChevronDown className="chevron text-muted-foreground size-4 shrink-0 transition-transform duration-200" />
                              </div>
                              </AccordionPrimitive.Trigger>
                            </AccordionPrimitive.Header>

                            <AccordionContent>
                            <div className='pt-4'>
                              <label className="font-medium text-xl mb-2 block">{t[language].customLink}:</label>
                              <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].customLinkHelp}</div>
                              <Input
                                type="text"
                                name="custom_link"
                                placeholder="e.g., https://hackathon.custom..."
                                value={formDataLatest.custom_link ?? ''}
                                onChange={(e) => {
                                  setFormDataLatest(prev => ({ ...prev, custom_link: e.target.value }));
                                }}
                                className="w-full mb-4"
                              />
                              {getInlineError('latest.custom_link') && (
                                <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('latest.custom_link')}</p>
                              )}
                              <label className="font-medium text-xl mb-2 block">{t[language].joinCustomLink}:</label>
                              <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].joinCustomLinkHelp}</div>
                              <Input
                                type="text"
                                name="join_custom_link"
                                placeholder="e.g., https://hackathon.custom..."
                                value={formDataContent.join_custom_link ?? ''}
                                onChange={(e) => {
                                  setFormDataContent(prev => ({ ...prev, join_custom_link: e.target.value }));
                                }}
                                className="w-full mb-4"
                              />
                              {getInlineError('content.join_custom_link') && (
                                <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('content.join_custom_link')}</p>
                              )}
                              <label className="font-medium text-xl mb-2 block">{t[language].submissionCustomLink}:</label>
                              <div className="mb-2 text-zinc-700 dark:text-zinc-400 text-sm">{t[language].submissionCustomLinkHelp}</div>
                              <Input
                                type="text"
                                name="submission_custom_link"
                                placeholder="e.g., https://hackathon.custom..."
                                value={formDataContent.submission_custom_link ?? ''}
                                onChange={(e) => {
                                  setFormDataContent(prev => ({ ...prev, submission_custom_link: e.target.value }));
                                }}
                                className="w-full mb-4"
                              />
                              {getInlineError('content.submission_custom_link') && (
                                <p className="text-red-500 text-sm -mt-2 mb-3">{getInlineError('content.submission_custom_link')}</p>
                              )}
                            </div>
                            </AccordionContent>
                            </AccordionItem>
                          </Accordion>
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
                      <div className="text-zinc-600 dark:text-zinc-400 italic">{t[language].lastDetailsCompleted}</div>
                    )}
                    </div>
                    </form>
              </>
            )}
            {showForm && !hasEditPermission && (
              <div className="mt-8 p-6 rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-100 max-w-2xl mx-auto text-center">
                <h2 className="text-xl font-semibold mb-2">You don&apos;t have permission to edit this hackathon</h2>
                <p className="text-sm text-red-600 dark:text-red-200">
                  Only the creator, authorized roles, or configured cohosts can edit this hackathon. Please contact the hackathon owner if you believe this is a mistake.
                </p>
              </div>
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
                  <p className="mb-4">This action cannot be undone.<br />Hackathon: <span className="font-semibold">{selectedHackathon?.title}</span></p>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer">Cancel</button>
                    <button onClick={() => { setShowDeleteModal(false); handleDeleteClick(); }} className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 cursor-pointer">Delete</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={`w-1/2 min-h-0 ${activePreviewTab === 'stages-submit-form' ? 'overflow-y-auto' : 'overflow-hidden'} border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900`}>
          <div className="h-full">
            {renderHackathonPreviewTabs()}
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
