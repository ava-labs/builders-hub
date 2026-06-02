'use client';

import React, { useEffect, useRef } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import HackathonPreview from '../../HackathonPreview';
import StageSubmitPageContent from '../../project-submission/stages/submit-form/page-content';
import type { HackathonHeader } from '@/types/hackathons';
import { HackathonStage } from '@/types/hackathon-stage';

type StageStatus = 'active' | 'upcoming' | 'ended';

function getStageStatus(stage: HackathonStage): StageStatus {
  const now = new Date();
  const start = stage.date ? new Date(stage.date) : null;
  const end = stage.deadline ? new Date(stage.deadline) : null;
  if (start && now < start) return 'upcoming';
  if (end && now > end) return 'ended';
  return 'active';
}

function formatStageDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const STATUS_CONFIG: Record<StageStatus, { label: string; badgeClass: string; borderClass: string }> = {
  active: {
    label: 'Active',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    borderClass: 'border-l-2 border-l-green-500',
  },
  upcoming: {
    label: 'Upcoming',
    badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    borderClass: 'border-l-2 border-l-sky-400',
  },
  ended: {
    label: 'Ended',
    badgeClass: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
    borderClass: 'border-l-2 border-l-zinc-400 dark:border-l-zinc-600',
  },
};

function StageBadge({ status }: { status: StageStatus }): React.JSX.Element {
  const { label, badgeClass } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
      {label}
    </span>
  );
}

type PreviewTabValue = 'hackathon-preview' | 'stages-submit-form';

type HackathonPreviewTabsProps = {
  previewHackathon: HackathonHeader;
  isRegistered?: boolean;
  scrollTarget?: string;
  activeTab: PreviewTabValue;
  onActiveTabChange: (value: PreviewTabValue) => void;
  selectedStageForm: string;
};

export default function HackathonPreviewTabs({
  previewHackathon,
  isRegistered = false,
  scrollTarget,
  activeTab,
  onActiveTabChange,
  selectedStageForm,
}: HackathonPreviewTabsProps): React.JSX.Element {
  const stages: HackathonStage[] = (previewHackathon.content?.stages ?? [])
    .filter((s) => s.submitForm?.fields && s.submitForm.fields.length > 0);
  const accordionRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);
  const [openStage, setOpenStage] = React.useState<string>('');

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    setOpenStage(selectedStageForm);
  }, [selectedStageForm]);

  return (
    <div className="h-full p-4">
      <Tabs
        value={activeTab}
        onValueChange={(value: string): void => onActiveTabChange(value as PreviewTabValue)}
        className="h-full"
      >
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="hackathon-preview">Event Preview</TabsTrigger>
          <TabsTrigger value="stages-submit-form">Stages Submit Form</TabsTrigger>
        </TabsList>

        <TabsContent value="hackathon-preview" className="h-[calc(100%-56px)]">
          <div className="h-full">
            <HackathonPreview
              hackathon={previewHackathon}
              isRegistered={isRegistered}
              scrollTarget={scrollTarget}
            />
          </div>
        </TabsContent>

        <TabsContent value="stages-submit-form">
          {previewHackathon && stages.length > 0 ? (
            <div className="space-y-4" ref={accordionRef}>
              <Accordion
                type="single"
                value={openStage}
                onValueChange={setOpenStage}
                collapsible
              >
                {stages.map((stage: HackathonStage, index: number) => {
                  const status = getStageStatus(stage);
                  const { borderClass } = STATUS_CONFIG[status];
                  const hasDate = stage.date || stage.deadline;
                  return (
                    <AccordionItem
                      key={`stage-form-${index}`}
                      value={String(index)}
                      data-stage-index={index}
                      className={`my-2 overflow-hidden rounded-lg border bg-white px-4 dark:bg-zinc-900 ${borderClass}`}
                    >
                      <AccordionTrigger className="py-4 hover:no-underline">
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-4 pr-2">
                          <span className="truncate font-semibold text-zinc-900 dark:text-white">
                            {stage.label || `Stage ${index + 1}`}
                          </span>
                          <div className="flex shrink-0 items-center gap-3">
                            {hasDate && (
                              <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">
                                {stage.date ? formatStageDate(stage.date) : ''}
                                {stage.date && stage.deadline ? ' – ' : ''}
                                {stage.deadline ? formatStageDate(stage.deadline) : ''}
                              </span>
                            )}
                            <StageBadge status={status} />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <StageSubmitPageContent
                          hackathon={previewHackathon}
                          hackathonCreator={''}
                          stage={stage}
                          stageIndex={index}
                          renderInPreview={true}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-zinc-600 dark:text-zinc-400 mb-4">Live Preview</h2>
                <p className="text-zinc-500 dark:text-zinc-500">
                  Start editing a hackathon to see the live preview here
                </p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
