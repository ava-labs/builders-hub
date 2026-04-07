'use client'

import React, { useEffect } from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import HackathonPreview, { HackathonPreviewProps } from '../../HackathonPreview'
import StageSubmitPageContent from '../../project-submission/stages/submit-form/page-content'
import { HackathonHeader } from '@/types/hackathons'
import { HackathonStage } from '@/types/hackathon-stage'

type PreviewTabValue = 'hackathon-preview' | 'stages-submit-form'

type StageOption = {
  id?: string
  label?: string
}

type HackathonPreviewTabsProps = {
  tabsProps: HackathonPreviewProps
  hackathon: HackathonHeader
  activeTab: PreviewTabValue
  onActiveTabChange: (value: PreviewTabValue) => void
  selectedStageForm: string
}

export default function HackathonPreviewTabs({
  tabsProps,
  hackathon,
  activeTab,
  onActiveTabChange,
  selectedStageForm,
}: HackathonPreviewTabsProps): React.JSX.Element {
  const [selectedStage, setSelectedStage] = React.useState<string>(selectedStageForm)
  const stages: HackathonStage[] = tabsProps.hackathonData.content?.stages ?? []


  useEffect(() => {
    setSelectedStage(selectedStageForm)
  }, [selectedStageForm])

  return (
    <div className="h-full p-4">
      <Tabs
        value={activeTab}
        onValueChange={(value: string): void =>
          onActiveTabChange(value as PreviewTabValue)
        }
        className="h-full"
      >
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="hackathon-preview">
            Hackathon Preview
          </TabsTrigger>
          <TabsTrigger value="stages-submit-form">
            Stages Submit Form
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="hackathon-preview"
          className="h-[calc(100%-56px)]"
        >
          <div className="h-full">
            <HackathonPreview
              hackathonData={tabsProps.hackathonData}
              isRegistered={tabsProps.isRegistered}
              scrollTarget={tabsProps.scrollTarget}
            />
          </div>
        </TabsContent>

        <TabsContent value="stages-submit-form">
          {
            hackathon && stages[Number(selectedStage)] ? (
              <div className="space-y-2 rounded-lg auto border border-zinc-200 p-4 dark:border-zinc-800">
                <Label htmlFor="stage-form-select">Stage form</Label>

                <Select
                  value={selectedStage}
                  onValueChange={(value: string) => setSelectedStage(value)}
                >
                  <SelectTrigger id="stage-form-select" className="w-full">
                    <SelectValue placeholder="Select a stage form" />
                  </SelectTrigger>

                  <SelectContent>
                    {stages.map(
                      (stage: StageOption, index: number): React.JSX.Element => (
                        <SelectItem
                          key={stage.id ?? `${stage.label ?? 'stage'}-${index}`}
                          value={String(index)}
                        >
                          {stage.label || `Stage ${index + 1}`}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <StageSubmitPageContent
                  hackathon={hackathon}
                  hackathonCreator={''}
                  stage={stages[Number(selectedStage)]}
                  stageIndex={stages.findIndex((s) => s.label === stages[Number(selectedStage)].label)}
                  renderInPreview={true}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-zinc-600 dark:text-zinc-400 mb-4">
                    Live Preview
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-500">
                    Start editing a hackathon to see the live preview here
                  </p>
                </div>
              </div>
            )
          }
        </TabsContent>
      </Tabs>
    </div>
  )
}