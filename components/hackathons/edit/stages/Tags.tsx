'use client'

import React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDownIcon } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HackathonStage, TagItem, TagsComponent } from '@/types/hackathon-stage'
import IconPicker from './IconPicker'
import RemoveButton from './RemoveButton'

type StageTagsFormProps = {
  component: TagsComponent
  index: number
  onChange: (
    index: number,
    component: HackathonStage['component']
  ) => void
}

export default function StageTagsForm({
  component,
  index,
  onChange,
}: StageTagsFormProps): React.JSX.Element {
  const addTag = (): void => {
    const newTag: TagItem = {
      icon: '',
      title: '',
      description: '',
    }

    const updatedComponent: TagsComponent = {
      ...component,
      tags: [...component.tags, newTag],
    }

    onChange(index, updatedComponent)
  }

  const removeTag = (tagIndex: number): void => {
    const updatedComponent: TagsComponent = {
      ...component,
      tags: component.tags.filter(
        (_tag: TagItem, currentIndex: number) => currentIndex !== tagIndex
      ),
    }

    onChange(index, updatedComponent)
  }

  const updateRootField = (
    field: 'title' | 'description',
    value: string
  ): void => {
    const updatedComponent: TagsComponent = {
      ...component,
      [field]: value,
    }

    onChange(index, updatedComponent)
  }

  const updateTagField = (
    tagIndex: number,
    field: keyof TagItem,
    value: string
  ): void => {
    const updatedComponent: TagsComponent = {
      ...component,
      tags: component.tags.map(
        (tag: TagItem, currentIndex: number): TagItem => {
          if (currentIndex !== tagIndex) {
            return tag
          }

          return {
            ...tag,
            [field]: value,
          }
        }
      ),
    }

    onChange(index, updatedComponent)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`tags-title-${index}`}>Title of detailed list</Label>
        <Input
          id={`tags-title-${index}`}
          type="text"
          value={component.title}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            updateRootField('title', event.target.value)
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`tags-description-${index}`}>Description of detailed list</Label>
        <Input
          id={`tags-description-${index}`}
          type="text"
          value={component.description}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            updateRootField('description', event.target.value)
          }
        />
      </div>

      <Button
        type="button"
        className="bg-green-600 hover:bg-green-700 text-white"
        onClick={addTag}
      >
        Add item
      </Button>

      {component.tags.map((tag: TagItem, tagIndex: number) => (
        <Accordion
          key={`stage-${index}-tag-${tagIndex}`}
          type="single"
          collapsible
          className="w-full rounded-md border px-4"
        >
          <AccordionItem value={`tag-item-${tagIndex}`}>
            <AccordionPrimitive.Header className="flex">
              <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between gap-2 py-1 text-sm font-medium outline-none [&[data-state=open]_svg.chevron]:rotate-180">
                <span>{tag.title?.trim() ? tag.title : `Item ${tagIndex + 1}`}</span>
                <div className="flex items-center gap-2">
                  <ChevronDownIcon className="chevron text-muted-foreground size-4 shrink-0 transition-transform duration-200" />
                  <RemoveButton
                    onRemove={() => removeTag(tagIndex)}
                    tooltipLabel="Delete item"
                    size={18}
                  />
                </div>
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>

            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <IconPicker
                    label="Icon"
                    value={tag.icon}
                    onChange={(key) => updateTagField(tagIndex, 'icon', key)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`tag-title-${index}-${tagIndex}`}>Title</Label>
                  <Input
                    id={`tag-title-${index}-${tagIndex}`}
                    type="text"
                    value={tag.title}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateTagField(tagIndex, 'title', event.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`tag-description-${index}-${tagIndex}`}>
                    Description
                  </Label>
                  <Input
                    id={`tag-description-${index}-${tagIndex}`}
                    type="text"
                    value={tag.description}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateTagField(tagIndex, 'description', event.target.value)
                    }
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}
    </div>
  )
}