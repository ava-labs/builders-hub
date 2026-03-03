"use client";
import React, { useState, useEffect } from 'react';
import { saveQuizResponse, getQuizResponse } from '@/utils/quizzes/indexedDB';
import { parseTextWithLinks } from '../../utils/safeHtml';
import Image from 'next/image';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';
import quizData from './data';
import type { QuizData, FullQuizData } from './data';

const MAX_ATTEMPTS = 3;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

interface QuizProps {
  quizId: string;
  onQuizCompleted?: (quizId: string) => void;
}

function getVariant(quizId: string, variantIndex: number): QuizData | null {
  const baseQuiz = quizData.quizzes[quizId];
  if (!baseQuiz) return null;
  if (variantIndex === 0 || !baseQuiz.alternates) return baseQuiz;
  if (variantIndex - 1 < baseQuiz.alternates.length) {
    return baseQuiz.alternates[variantIndex - 1];
  }
  return baseQuiz;
}

function shuffleArray(arr: number[]): number[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const Quiz: React.FC<QuizProps> = ({ quizId, onQuizCompleted }) => {
  const [quizInfo, setQuizInfo] = useState<QuizData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);
  const [attemptCount, setAttemptCount] = useState<number>(0);
  const [lastAttemptAt, setLastAttemptAt] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);

  const isLocked = attemptCount >= MAX_ATTEMPTS && !isCorrect;
  const isCoolingDown = cooldownRemaining > 0;

  // Cooldown countdown timer — only active after all attempts exhausted
  useEffect(() => {
    if (!lastAttemptAt || isCorrect || !isLocked) return;

    const updateCooldown = () => {
      const elapsed = Date.now() - lastAttemptAt;
      const remaining = Math.max(0, COOLDOWN_MS - elapsed);
      setCooldownRemaining(remaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [lastAttemptAt, isCorrect, isAnswerChecked]);

  // Shuffle option display order whenever the quiz variant changes
  useEffect(() => {
    if (quizInfo) {
      setShuffledIndices(shuffleArray(quizInfo.options.map((_, i) => i)));
    }
  }, [quizInfo]);

  useEffect(() => {
    setIsClient(true);
    setQuizInfo(getVariant(quizId, 0));
    loadSavedResponse();
  }, [quizId]);

  const loadSavedResponse = async () => {
    const savedResponse = await getQuizResponse(quizId);
    if (savedResponse) {
      const ac = savedResponse.attemptCount ?? 0;
      const lat = savedResponse.lastAttemptAt ?? 0;

      // Auto-reset if 24hr cooldown has expired
      if (ac >= MAX_ATTEMPTS && lat && Date.now() - lat >= COOLDOWN_MS) {
        await saveQuizResponse(quizId, {
          selectedAnswers: [],
          isAnswerChecked: false,
          isCorrect: false,
          attemptCount: 0,
          lastAttemptAt: 0,
        });
        resetQuizState();
        setAttemptCount(0);
        setLastAttemptAt(0);
        setQuizInfo(getVariant(quizId, 0));
        return;
      }

      setSelectedAnswers(savedResponse.selectedAnswers || []);
      setIsAnswerChecked(savedResponse.isAnswerChecked || false);
      setIsCorrect(savedResponse.isCorrect || false);
      setAttemptCount(ac);
      setLastAttemptAt(lat);

      // Load the correct question variant
      if (savedResponse.isAnswerChecked && !savedResponse.isCorrect) {
        // Showing feedback for the variant that was just answered
        setQuizInfo(getVariant(quizId, Math.max(0, ac - 1)));
      } else {
        setQuizInfo(getVariant(quizId, ac));
      }
    } else {
      resetQuizState();
      setQuizInfo(getVariant(quizId, 0));
    }
  };

  const resetQuizState = () => {
    setSelectedAnswers([]);
    setIsAnswerChecked(false);
    setIsCorrect(false);
  };

  const handleAnswerSelect = (index: number) => {
    if (!isAnswerChecked && !isLocked) {
      if (quizInfo && quizInfo.correctAnswers.length === 1) {
        setSelectedAnswers([index]);
      } else {
        setSelectedAnswers(prev =>
          prev.includes(index)
            ? prev.filter(a => a !== index)
            : [...prev, index]
        );
      }
    }
  };

  const checkAnswer = async () => {
    if (quizInfo && selectedAnswers.length > 0 && quizInfo.correctAnswers.length > 0) {
      const correct = quizInfo.correctAnswers.length === 1
        ? selectedAnswers[0] === quizInfo.correctAnswers[0]
        : selectedAnswers.length === quizInfo.correctAnswers.length &&
          selectedAnswers.every(answer => quizInfo.correctAnswers.includes(answer));

      const newAttemptCount = correct ? attemptCount : attemptCount + 1;
      // Only start the 24hr cooldown on the final failed attempt
      const newLastAttemptAt = !correct && newAttemptCount >= MAX_ATTEMPTS ? Date.now() : lastAttemptAt;

      setIsCorrect(correct);
      setIsAnswerChecked(true);
      setAttemptCount(newAttemptCount);
      setLastAttemptAt(newLastAttemptAt);

      await saveQuizResponse(quizId, {
        selectedAnswers,
        isAnswerChecked: true,
        isCorrect: correct,
        attemptCount: newAttemptCount,
        lastAttemptAt: newLastAttemptAt,
      });

      if (correct && onQuizCompleted) {
        onQuizCompleted(quizId);
      }
    }
  };

  const handleTryAgain = async () => {
    if (isLocked) return;

    // Reset answer state but preserve attempt tracking
    resetQuizState();
    // Load the next question variant based on attemptCount
    setQuizInfo(getVariant(quizId, attemptCount));
    await saveQuizResponse(quizId, {
      selectedAnswers: [],
      isAnswerChecked: false,
      isCorrect: false,
      attemptCount,
      lastAttemptAt,
    });
  };

  const formatCooldown = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderAnswerFeedback = () => {
    if (isAnswerChecked && quizInfo) {
      if (isCorrect) {
        return (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <div className="flex items-center text-green-800 dark:text-green-300 mb-2">
              <svg className="mr-2" style={{width: '1rem', height: '1rem'}} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-sm">Correct</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 m-0">
              {parseTextWithLinks(quizInfo.explanation)}
            </p>
          </div>
        );
      } else {
        return (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
            <div className="flex items-center text-amber-800 dark:text-amber-300 mb-2">
              <svg className="mr-2" style={{width: '1rem', height: '1rem'}} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-sm">Not Quite</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 m-0">
              <b>Hint:</b> {parseTextWithLinks(quizInfo.hint)}
            </p>
          </div>
        );
      }
    }
    return null;
  };

  if (!isClient || !quizInfo || shuffledIndices.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dark:bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-950 shadow-lg rounded-lg overflow-hidden">
        <div className="text-center p-4">
        <div className="mx-auto flex items-center justify-center mb-4 overflow-hidden">
          <Image
            src="/wolfie-check.png"
            alt="Quiz topic"
            width={60}
            height={60}
            className="object-cover"
            style={{margin: '0em'}}
          />
        </div>
        <h4 className="font-normal" style={{marginTop: '0'}}>Time for a Quiz!</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Wolfie wants to test your knowledge. {quizInfo.correctAnswers.length === 1 ? "Select the correct answer." : "Select all correct answers."}
        </p>
      </div>
      <div className="px-6 py-4">
        <div className="text-center mb-4">
          <h2 className="text-lg font-medium text-gray-800 dark:text-white" style={{marginTop: '0'}}>
            {parseTextWithLinks(quizInfo.question)}
          </h2>
          {attemptCount > 0 && !isCorrect && !isLocked && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Attempt {isAnswerChecked ? attemptCount : attemptCount + 1} of {MAX_ATTEMPTS}
            </p>
          )}
        </div>
        <div className="space-y-3">
          {shuffledIndices.map((originalIndex, displayIndex) => (
            <div
              key={`option-${originalIndex}`}
              className={`flex items-center p-3 rounded-lg border transition-colors cursor-pointer ${
                isAnswerChecked
                  ? selectedAnswers.includes(originalIndex)
                    ? quizInfo.correctAnswers.includes(originalIndex)
                      ? 'border-avax-green bg-green-50 dark:bg-green-900/30 dark:border-green-700'
                      : 'border-avax-red bg-red-50 dark:bg-red-900/30 dark:border-red-700'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-black'
                  : selectedAnswers.includes(originalIndex)
                    ? 'border-avax-red bg-avax-red/10'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleAnswerSelect(originalIndex)}
            >
              <span className={`w-6 h-6 shrink-0 flex items-center justify-center ${quizInfo.correctAnswers.length === 1 ? 'rounded-full' : 'rounded-md'} mr-3 text-sm ${
                isAnswerChecked
                  ? selectedAnswers.includes(originalIndex)
                    ? quizInfo.correctAnswers.includes(originalIndex)
                      ? 'bg-avax-green text-white'
                      : 'bg-avax-red text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  : selectedAnswers.includes(originalIndex)
                    ? 'bg-avax-red text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {quizInfo.correctAnswers.length === 1
                  ? String.fromCharCode(65 + displayIndex)
                  : (selectedAnswers.includes(originalIndex) ? '✓' : '')}
              </span>
              <span className={`text-sm ${
                !isAnswerChecked && selectedAnswers.includes(originalIndex)
                  ? 'text-avax-red font-medium'
                  : 'text-gray-600 dark:text-gray-300'
              }`}>
                {parseTextWithLinks(quizInfo.options[originalIndex])}
              </span>
            </div>
          ))}
        </div>
        {renderAnswerFeedback()}
      </div>
      <div className="px-6 py-4 flex flex-col items-center gap-2">
        {isLocked ? (
          <div className="text-center space-y-2">
            <p className="text-sm text-red-600 dark:text-red-400">
              This quiz is locked{isCoolingDown ? ` for ${formatCooldown(cooldownRemaining)}` : ''}.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              In the meantime, you can continue working on other courses and quizzes across the Academy. Review the course material for this topic before trying again.
            </p>
          </div>
        ) : !isAnswerChecked ? (
          <button
            className={cn(
              buttonVariants({ variant: 'default' }),
            )}
            onClick={checkAnswer}
            disabled={selectedAnswers.length === 0}
          >
            Check Answer
          </button>
        ) : (
          !isCorrect && (
            <div className="flex flex-col items-center gap-2">
              {attemptCount === MAX_ATTEMPTS - 1 && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg mb-1">
                  <p className="text-xs text-orange-700 dark:text-orange-300 text-center">
                    <b>Warning:</b> This is your last attempt. If you answer incorrectly, this quiz will be locked for 24 hours.
                  </p>
                </div>
              )}
              <button
                className={cn(
                  buttonVariants({ variant: 'secondary' }),
                )}
                onClick={handleTryAgain}
              >
                Try Again
              </button>
            </div>
          )
        )}
      </div>
    </div>
    </div>
  );
};

export default Quiz;
