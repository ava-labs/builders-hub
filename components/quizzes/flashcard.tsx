"use client";
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { saveFlashcardProgress, getFlashcardProgress } from '@/utils/quizzes/indexedDB';
import Image from 'next/image';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';
import flashcardData from './flashcardData.json';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';

interface FlashcardProps {
    flashcardSetId: string;
}

interface FlashcardDataItem {
    term: string;
    definition: string;
    example?: string;
}

const Flashcard: React.FC<FlashcardProps> = ({ flashcardSetId }) => {
    const [flashcards, setFlashcards] = useState<FlashcardDataItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [viewedCards, setViewedCards] = useState<Set<number>>(new Set());
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const all = {
            ...flashcardData.flashcardSets,
        };
        const fetchedFlashcards = all[flashcardSetId as keyof typeof flashcardData.flashcardSets];
        if (fetchedFlashcards) {
            setFlashcards(fetchedFlashcards);
        }
        loadSavedProgress();
    }, [flashcardSetId]);

    const loadSavedProgress = async () => {
        const savedProgress = await getFlashcardProgress(flashcardSetId);
        if (savedProgress) {
            setCurrentIndex(savedProgress.currentIndex || 0);
            setViewedCards(new Set(savedProgress.viewedCards || []));
        }
    };

    const saveProgress = async () => {
        await saveFlashcardProgress(flashcardSetId, {
            currentIndex,
            viewedCards: Array.from(viewedCards),
            totalCards: flashcards.length,
        });
    };

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
        if (!isFlipped) {
            const newViewedCards = new Set(viewedCards);
            newViewedCards.add(currentIndex);
            setViewedCards(newViewedCards);
            saveProgress();
        }
    };

    const handleNext = () => {
        if (currentIndex < flashcards.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsFlipped(false);
            saveProgress();
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setIsFlipped(false);
            saveProgress();
        }
    };

    const handleReset = () => {
        setCurrentIndex(0);
        setIsFlipped(false);
        setViewedCards(new Set());
        saveProgress();
    };

    if (!isClient || flashcards.length === 0) {
        return <div>Loading flashcards...</div>;
    }

    const currentCard = flashcards[currentIndex];
    const progress = (viewedCards.size / flashcards.length) * 100;

    return (
        <div className="dark:bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="bg-white dark:bg-neutral-950 shadow-lg rounded-lg overflow-hidden mb-4">
                    <div className="text-center p-4">
                        <div className="mx-auto flex items-center justify-center mb-4 overflow-hidden">
                            <Image
                                src="/wolfie-check.png"
                                alt="Flashcard topic"
                                width={60}
                                height={60}
                                className="object-cover"
                                style={{ margin: '0em' }}
                            />
                        </div>
                        <h4 className="font-normal" style={{ marginTop: '0' }}>Study with Flashcards</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Click the card to reveal the answer. Track your progress as you learn!
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-white dark:bg-neutral-950 shadow-lg rounded-lg overflow-hidden mb-4 p-4">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span>Progress: {viewedCards.size} / {flashcards.length} cards viewed</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                            className="bg-[#3752ac] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Flashcard */}
                <div className="mb-4" style={{ perspective: '1000px' }}>
                    <div
                        className={`relative w-full h-64 transition-transform duration-600 transform-style-preserve-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''
                            }`}
                        onClick={handleFlip}
                        style={{
                            transformStyle: 'preserve-3d',
                            transition: 'transform 0.6s',
                            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        }}
                    >
                        {/* Front of card */}
                        <div
                            className="absolute w-full h-full bg-white dark:bg-neutral-950 shadow-lg rounded-lg p-8 flex flex-col items-center justify-center backface-hidden"
                            style={{ backfaceVisibility: 'hidden' }}
                        >
                            <h3 className="text-xl font-semibold text-center text-gray-800 dark:text-white">
                                {currentCard.term}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                                Click to reveal answer
                            </p>
                        </div>

                        {/* Back of card */}
                        <div
                            className="absolute w-full h-full bg-[#3752ac] bg-opacity-10 dark:bg-opacity-30 shadow-lg rounded-lg p-8 flex flex-col justify-center backface-hidden"
                            style={{
                                backfaceVisibility: 'hidden',
                                transform: 'rotateY(180deg)'
                            }}
                        >
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Definition:</h4>
                                    <p className="text-gray-800 dark:text-white">{currentCard.definition}</p>
                                </div>
                                {currentCard.example && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Example:</h4>
                                        <p className="text-gray-700 dark:text-gray-300 italic">{currentCard.example}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Controls */}
                <div className="bg-white dark:bg-neutral-950 shadow-lg rounded-lg overflow-hidden p-4">
                    <div className="flex justify-between items-center">
                        <button
                            className={cn(
                                buttonVariants({ variant: 'outline' }),
                                'flex items-center gap-2'
                            )}
                            onClick={handlePrevious}
                            disabled={currentIndex === 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </button>

                        <div className="text-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                Card {currentIndex + 1} of {flashcards.length}
                            </span>
                        </div>

                        <button
                            className={cn(
                                buttonVariants({ variant: 'outline' }),
                                'flex items-center gap-2'
                            )}
                            onClick={handleNext}
                            disabled={currentIndex === flashcards.length - 1}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    {viewedCards.size === flashcards.length && (
                        <div className="mt-4 text-center">
                            <p className="text-green-600 dark:text-green-400 mb-3">
                                🎉 Great job! You've viewed all flashcards!
                            </p>
                            <button
                                className={cn(
                                    buttonVariants({ variant: 'secondary' }),
                                    'flex items-center gap-2 mx-auto'
                                )}
                                onClick={handleReset}
                            >
                                <RotateCw className="h-4 w-4" />
                                Start Over
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Add custom styles for the flip animation
const flipStyles = `
  .rotate-y-180 {
    transform: rotateY(180deg);
  }
  .transform-style-preserve-3d {
    transform-style: preserve-3d;
  }
  .backface-hidden {
    backface-visibility: hidden;
  }
  .duration-600 {
    transition-duration: 0.6s;
  }
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = flipStyles;
    document.head.appendChild(styleSheet);
}

export default Flashcard;
