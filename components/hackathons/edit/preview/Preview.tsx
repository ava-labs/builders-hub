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
                {stages.map((stage: HackathonStage, index: number) => (
                  <AccordionItem
                    key={`stage-form-${index}`}
                    value={String(index)}
                    data-stage-index={index}
                    className="my-2 border rounded-lg px-4 bg-white dark:bg-zinc-800"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <span className="font-semibold">{stage.label || `Stage ${index + 1}`}</span>
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
                ))}
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
