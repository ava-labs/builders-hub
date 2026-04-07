'use client'

import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CardComponent } from '@/types/hackathon-stage'

type StageCardsFormProps = {
  component: CardComponent
  index: number
  onChange: (index: number, component: CardComponent) => void
}

type StageCardItem = CardComponent['cards'][number]

export default function StageCardsForm({
  component,
  index,
  onChange,
}: StageCardsFormProps): React.JSX.Element {
  const addCard = (): void => {
    const newCard: StageCardItem = {
      icon: '',
      title: '',
      description: '',
    }

    const updatedComponent: CardComponent = {
      ...component,
      cards: [...component.cards, newCard],
    }

    onChange(index, updatedComponent)
  }

  const removeCard = (cardIndex: number): void => {
    const updatedComponent: CardComponent = {
      ...component,
      cards: component.cards.filter(
        (_card: StageCardItem, currentIndex: number) => currentIndex !== cardIndex
      ),
    }

    onChange(index, updatedComponent)
  }

  const updateCardField = (
    cardIndex: number,
    field: keyof StageCardItem,
    value: string
  ): void => {
    const updatedComponent: CardComponent = {
      ...component,
      cards: component.cards.map(
        (card: StageCardItem, currentIndex: number): StageCardItem => {
          if (currentIndex !== cardIndex) {
            return card
          }

          return {
            ...card,
            [field]: value,
          }
        }
      ),
    }

    onChange(index, updatedComponent)
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        className="bg-green-600 hover:bg-green-700 text-white"
        onClick={addCard}
      >
        Add card
      </Button>

      {component.cards.map((card: StageCardItem, cardIndex: number) => (
        <Accordion
          key={`stage-${index}-card-${cardIndex}`}
          type="single"
          collapsible
          className="w-full rounded-md border px-4"
        >
          <AccordionItem value={`card-item-${cardIndex}`}>
            <AccordionTrigger>
              {card.title?.trim() ? card.title : `Card ${cardIndex + 1}`}
            </AccordionTrigger>

            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor={`card-icon-${index}-${cardIndex}`}>Icon</Label>
                  <Input
                    id={`card-icon-${index}-${cardIndex}`}
                    type="text"
                    value={card.icon}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateCardField(cardIndex, 'icon', event.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`card-title-${index}-${cardIndex}`}>Title</Label>
                  <Input
                    id={`card-title-${index}-${cardIndex}`}
                    type="text"
                    value={card.title}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateCardField(cardIndex, 'title', event.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`card-description-${index}-${cardIndex}`}>
                    Description
                  </Label>
                  <Input
                    id={`card-description-${index}-${cardIndex}`}
                    type="text"
                    value={card.description}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                      updateCardField(cardIndex, 'description', event.target.value)
                    }
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => removeCard(cardIndex)}
                  >
                    Remove card
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}
    </div>
  )
}