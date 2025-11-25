"use client"
import type React from "react"
import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, RotateCw, EyeOff, HelpCircle, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { saveFlashcardProgress, getFlashcardProgress, resetFlashcardProgress } from "@/utils/quizzes/indexedDB"
import { parseTextWithLinks } from "../../utils/safeHtml"
import flashcardData from './flashcardData.json'

interface FlashcardProps {
    flashcardSetId: string
    quizUrl?: string
}

interface FlashcardDataItem {
    term: string
    definition: string
    example?: string
}

const CleanFlashcard: React.FC<FlashcardProps> = ({ flashcardSetId, quizUrl }) => {
    const [flashcards] = useState<FlashcardDataItem[]>(flashcardData.flashcardSets[flashcardSetId as keyof typeof flashcardData.flashcardSets] || [])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isRevealed, setIsRevealed] = useState(false)
    const [viewedCards, setViewedCards] = useState<Set<number>>(new Set())
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const loadProgress = async () => {
            try {
                const savedProgress = await getFlashcardProgress(flashcardSetId)
                if (savedProgress) {
                    setCurrentIndex(savedProgress.currentIndex)
                    setViewedCards(new Set(savedProgress.viewedCards))
                }
            } catch (error) {
                console.error("Failed to load flashcard progress:", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadProgress()
    }, [flashcardSetId])

    useEffect(() => {
        if (!isLoading && flashcards.length > 0) {
            const saveProgress = async () => {
                try {
                    await saveFlashcardProgress(flashcardSetId, {
                        currentIndex,
                        viewedCards: Array.from(viewedCards),
                        totalCards: flashcards.length,
                    })
                } catch (error) {
                    console.error("Failed to save flashcard progress:", error)
                }
            }
            saveProgress()
        }
    }, [currentIndex, viewedCards, flashcardSetId, flashcards.length, isLoading])

    const currentCard = flashcards[currentIndex]
    const progress = (viewedCards.size / flashcards.length) * 100

    const handleReveal = () => {
        if (!isRevealed) {
            setViewedCards((prev) => new Set([...prev, currentIndex]))
        }
        setIsRevealed(!isRevealed)
    }

    const handleNext = () => {
        if (currentIndex < flashcards.length - 1) {
            setCurrentIndex(currentIndex + 1)
            setIsRevealed(false)
        }
    }

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1)
            setIsRevealed(false)
        }
    }

    const handleReset = async () => {
        try {
            await resetFlashcardProgress(flashcardSetId)
            setCurrentIndex(0)
            setIsRevealed(false)
            setViewedCards(new Set())
        } catch (error) {
            console.error("Failed to reset flashcard progress:", error)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="w-full max-w-2xl bg-card shadow-lg rounded-lg p-8">
                    <div className="text-center text-muted-foreground">Loading flashcards...</div>
                </div>
            </div>
        )
    }

    if (flashcards.length === 0) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="w-full max-w-2xl bg-card shadow-lg rounded-lg p-8">
                    <div className="text-center text-muted-foreground">No flashcards found for this set.</div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-card shadow-lg rounded-lg overflow-hidden border">
                {/* Header */}
                <div className="text-center p-6 border-b">
                    <h2 className="text-xl font-semibold mb-2">Study Flashcards</h2>
                    <p className="text-sm text-muted-foreground">Click reveal to see the answer and track your progress</p>
                </div>

                {/* Progress */}
                <div className="p-4 bg-muted/30">
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                        <span>
                            Progress: {viewedCards.size} / {flashcards.length} cards
                        </span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                        <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Card Content */}
                <div className="p-8">
                    <div className="text-center mb-6">
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                            Card {currentIndex + 1} of {flashcards.length}
                        </span>
                    </div>

                    {/* Term */}
                    <div className="text-center mb-8">
                        <h3 className="text-2xl font-bold mb-2">{currentCard.term}</h3>
                    </div>

                    {/* Answer Section */}
                    <div
                        className={cn(
                            "min-h-[120px] p-6 rounded-lg border-2 transition-all duration-300",
                            isRevealed ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30",
                        )}
                    >
                        {!isRevealed ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <HelpCircle className="h-8 w-8 text-muted-foreground mb-3" />
                                <p className="text-muted-foreground">Click "Reveal Answer" to see the definition</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-primary mb-2 uppercase tracking-wide">Definition</h4>
                                    <p className="leading-relaxed">{currentCard.definition}</p>
                                </div>
                                {currentCard.example && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-primary mb-2 uppercase tracking-wide">Example</h4>
                                        {parseTextWithLinks(currentCard.example, "text-muted-foreground italic leading-relaxed")}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Reveal Button */}
                    <div className="text-center mt-6">
                        <Button
                            onClick={handleReveal}
                            variant={isRevealed ? "outline" : "default"}
                            className={cn(
                                "px-6",
                                !isRevealed && "bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
                            )}
                        >
                            {isRevealed ? (
                                <>
                                    <EyeOff className="h-4 w-4 mr-2" />
                                    Hide Answer
                                </>
                            ) : (
                                <>
                                    <HelpCircle className="h-4 w-4 mr-2" />
                                    Reveal Answer
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Navigation */}
                <div className="p-6 bg-muted/30 border-t">
                    <div className="flex justify-between items-center">
                        <Button
                            variant="outline"
                            onClick={handlePrevious}
                            disabled={currentIndex === 0}
                            className="flex items-center gap-2 bg-transparent"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>

                        {currentIndex === flashcards.length - 1 ? (
                            <div className="flex flex-col items-end gap-2">
                                <p className="text-sm text-muted-foreground mr-2">Ready to test your knowledge?</p>
                                {quizUrl ? (
                                    <a href={quizUrl} className="inline-flex">
                                        <Button
                                            variant="default"
                                            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                                        >
                                            Continue to Quiz
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </a>
                                ) : (
                                    <Button
                                        variant="default"
                                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                                        onClick={() => {
                                            // Scroll to the bottom to encourage moving to next section
                                            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                        }}
                                    >
                                        Continue to Quiz
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                onClick={handleNext}
                                className="flex items-center gap-2 bg-transparent"
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Completion Message */}
                    {viewedCards.size === flashcards.length && (
                        <div className="mt-6 text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                            <p className="text-primary font-medium mb-3">🎉 Excellent! You've studied all flashcards!</p>
                            <Button variant="secondary" onClick={handleReset} className="flex items-center gap-2 mx-auto">
                                <RotateCw className="h-4 w-4" />
                                Study Again
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default CleanFlashcard
