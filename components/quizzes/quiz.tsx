"use client";
import React, { useState, useEffect, useRef } from 'react';
import { saveQuizResponse, getQuizResponse } from '@/utils/quizzes/indexedDB';
import { parseTextWithLinks } from '../../utils/safeHtml';
import quizData from './data';
import type { QuizData, FullQuizData } from './data';
import { QuizHeader } from './quiz-header';
import { QUIZ_ROOT_SELECTOR, quizPosition, type QuizPosition } from './quiz-position';
import { QUIZ_BUTTON_CLASS, QuizFeedback, QuizOption, optionState } from './quiz-question';

const MAX_ATTEMPTS = 3;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

interface QuizProps {
  quizId: string;
  onQuizCompleted?: (quizId: string) => void;
  /** "Question N of M" when the page has several quizzes (default). The certificate page turns it off: each of its questions sits in its own accordion row. */
  showPosition?: boolean;
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

/** The quiz's position among the page's quiz roots, read from the DOM after mount, so the server markup never carries a count. */
function useQuizPosition(
  rootRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  quizId: string,
): QuizPosition | null {
  const [position, setPosition] = useState<QuizPosition | null>(null);

  useEffect(() => {
    if (!enabled || !rootRef.current) return;
    const roots = Array.from(document.querySelectorAll(QUIZ_ROOT_SELECTOR));
    setPosition(quizPosition(roots, rootRef.current));
  }, [rootRef, enabled, quizId]);

  return position;
}

const Quiz: React.FC<QuizProps> = ({ quizId, onQuizCompleted, showPosition = true }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const position = useQuizPosition(rootRef, showPosition, quizId);
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
    if (!isAnswerChecked || !quizInfo) return null;
    return (
      <QuizFeedback correct={isCorrect}>
        {isCorrect ? (
          parseTextWithLinks(quizInfo.explanation)
        ) : (
          <>
            <b>Hint:</b> {parseTextWithLinks(quizInfo.hint)}
          </>
        )}
      </QuizFeedback>
    );
  };

  if (!isClient || !quizInfo || shuffledIndices.length === 0) {
    return <div ref={rootRef} data-quiz-root="">Loading...</div>;
  }

  const multiple = quizInfo.correctAnswers.length !== 1;

  return (
    <div ref={rootRef} data-quiz-root="" className="flex items-center justify-center py-2">
      <div className="w-full overflow-hidden rounded-xl border border-ac-rule bg-ac-paper">
        <QuizHeader position={position} />
        <div className="px-[18px] pb-1.5 pt-[22px]">
          <div className="mb-4 text-left">
            <h2 className="mb-[18px] mt-0 text-[18px] font-semibold leading-[1.4] tracking-[-0.01em] text-ac-ink">
              {parseTextWithLinks(quizInfo.question)}
            </h2>
            {attemptCount > 0 && !isCorrect && !isLocked && (
              <p className="mt-1 text-xs text-ac-ink-3">
                Attempt {isAnswerChecked ? attemptCount : attemptCount + 1} of {MAX_ATTEMPTS}
              </p>
            )}
          </div>
          <div className="space-y-3">
            {shuffledIndices.filter(idx => idx < quizInfo.options.length).map((originalIndex, displayIndex) => (
              <QuizOption
                key={`option-${originalIndex}`}
                state={optionState({
                  selected: selectedAnswers.includes(originalIndex),
                  correct: quizInfo.correctAnswers.includes(originalIndex),
                  checked: isAnswerChecked,
                  locked: isLocked,
                })}
                marker={multiple
                  ? (selectedAnswers.includes(originalIndex) ? '✓' : '')
                  : String.fromCharCode(65 + displayIndex)}
                multiple={multiple}
                locked={isLocked}
                onSelect={() => handleAnswerSelect(originalIndex)}
              >
                {parseTextWithLinks(quizInfo.options[originalIndex])}
              </QuizOption>
            ))}
          </div>
          {renderAnswerFeedback()}
        </div>
        <div className="flex flex-col items-start gap-2 px-[18px] pb-5 pt-4 empty:px-0 empty:pb-[18px] empty:pt-0">
          {isLocked ? (
            <div className="space-y-2">
              <p className="text-sm text-ac-ink">
                This quiz is locked{isCoolingDown ? ` for ${formatCooldown(cooldownRemaining)}` : ''}.
              </p>
              <p className="text-xs text-ac-ink-3">
                In the meantime, you can continue working on other courses and quizzes across the Academy. Review the course material for this topic before trying again.
              </p>
            </div>
          ) : !isAnswerChecked ? (
            <button
              className={QUIZ_BUTTON_CLASS}
              onClick={checkAnswer}
              disabled={selectedAnswers.length === 0}
            >
              Check Answer
            </button>
          ) : (
            !isCorrect && (
              <div className="flex flex-col items-start gap-2">
                {attemptCount === MAX_ATTEMPTS - 1 && (
                  <div className="mb-1 rounded-[10px] border border-ac-rule bg-ac-panel p-3">
                    <p className="text-xs text-ac-ink-2">
                      <b className="text-ac-ink">Warning:</b> This is your last attempt. If you answer incorrectly, this quiz will be locked for 24 hours.
                    </p>
                  </div>
                )}
                <button
                  className={QUIZ_BUTTON_CLASS}
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
