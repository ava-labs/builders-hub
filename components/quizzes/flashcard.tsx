"use client"
import type React from "react"
import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, RotateCw, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { saveFlashcardProgress, getFlashcardProgress, resetFlashcardProgress } from "@/utils/quizzes/indexedDB"

interface FlashcardProps {
    flashcardSetId: string
}

interface FlashcardDataItem {
    term: string
    definition: string
    example?: string
}

const flashcardData: Record<string, FlashcardDataItem[]> = {
    "grants-process": [
        {
            term: "Foundation Grants vs. VC Funding",
            definition: "Unlike VCs seeking ROI, foundation grants prioritize ecosystem impact",
            example: "A project creating open-source infrastructure that many can build upon",
        },
        {
            term: "Ecosystem Fit",
            definition: "How well your project addresses a specific gap or need in the Avalanche ecosystem",
            example: "Building privacy solutions that enable real-world business transactions on Avalanche",
        },
        {
            term: "Proof of Shipping",
            definition: "Evidence that demonstrates your ability to execute and deliver on your roadmap",
            example: "A working prototype on Fuji testnet that shows core functionality",
        },
        {
            term: "Grant Hunting",
            definition: "Applying for grants across multiple ecosystems without customization or commitment",
            example:
                "Submitting identical proposals to Avalanche, Solana, and Ethereum without blockchain-specific considerations",
        },
        {
            term: "Business Development Support",
            definition: "Connections and introductions provided by the foundation to help your project grow",
            example: "Getting introduced to institutional custodians that would be difficult to reach independently",
        },
    ],
}

const CleanFlashcard: React.FC<FlashcardProps> = ({ flashcardSetId }) => {
    const [flashcards] = useState<FlashcardDataItem[]>(flashcardData[flashcardSetId] || [])
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
                                <EyeOff className="h-8 w-8 text-muted-foreground mb-3" />
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
                                        <p className="text-muted-foreground italic leading-relaxed">{currentCard.example}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Reveal Button */}
                    <div className="text-center mt-6">
                        <Button onClick={handleReveal} variant={isRevealed ? "outline" : "default"} className="px-6">
                            {isRevealed ? (
                                <>
                                    <EyeOff className="h-4 w-4 mr-2" />
                                    Hide Answer
                                </>
                            ) : (
                                <>
                                    <Eye className="h-4 w-4 mr-2" />
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

                        <Button
                            variant="outline"
                            onClick={handleNext}
                            disabled={currentIndex === flashcards.length - 1}
                            className="flex items-center gap-2 bg-transparent"
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
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
