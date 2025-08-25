"use client";
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { saveQuizResponse, getQuizResponse, resetQuizResponse } from '@/utils/quizzes/indexedDB';
import Image from 'next/image';
import { cn } from '@/utils/cn';
import { buttonVariants } from '@/components/ui/button';
import quizData from './quizData.json';

interface QuizProps {
  quizId: string;
  onQuizCompleted?: (quizId: string) => void;
}

interface QuizData {
  question: string;
  options: string[];
  correctAnswers: number[];
  hint: string;
  explanation: string;
}

const Quiz: React.FC<QuizProps> = ({ quizId, onQuizCompleted }) => {
  const [quizInfo, setQuizInfo] = useState<QuizData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isAnswerChecked, setIsAnswerChecked] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const all = {
      ...quizData.quizzes,
    };
    const fetchedQuizInfo = all[quizId as keyof typeof quizData.quizzes];
    if (fetchedQuizInfo) {
      setQuizInfo(fetchedQuizInfo);
    }
    loadSavedResponse();
  }, [quizId]);

  const loadSavedResponse = async () => {
    const savedResponse = await getQuizResponse(quizId);
    if (savedResponse) {
      setSelectedAnswers(savedResponse.selectedAnswers || []);
      setIsAnswerChecked(savedResponse.isAnswerChecked || false);
      setIsCorrect(savedResponse.isCorrect || false);
    } else {
      resetQuizState();
    }
  };

  const resetQuizState = () => {
    setSelectedAnswers([]);
    setIsAnswerChecked(false);
    setIsCorrect(false);
  };

  const handleAnswerSelect = (index: number) => {
    if (!isAnswerChecked) {
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
      setIsCorrect(correct);
      setIsAnswerChecked(true);

      await saveQuizResponse(quizId, {
        selectedAnswers,
        isAnswerChecked: true,
        isCorrect: correct,
      });

      // Llamar a onQuizCompleted si la respuesta es correcta
      if (correct && onQuizCompleted) {
        onQuizCompleted(quizId);
      }
    }
  };

  const handleTryAgain = async () => {
    await resetQuizResponse(quizId);
    resetQuizState();
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
            <p className="text-sm text-gray-600 dark:text-gray-300 m-0">{quizInfo.explanation}</p>
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
            <p className="text-sm text-gray-600 dark:text-gray-300 m-0"><b>Hint:</b> {quizInfo.hint}</p>
          </div>
        );
      }
    }
    return null;
  };

  if (!isClient || !quizInfo) {
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
          <h2 className="text-lg font-medium text-gray-800 dark:text-white" style={{marginTop: '0'}}>{quizInfo.question}</h2>
        </div>
        <div className="space-y-3">
          {quizInfo.options.map((option, index) => (
            <div 
              key={uuidv4()}
              className={`flex items-center p-3 rounded-lg border transition-colors cursor-pointer ${
                isAnswerChecked
                  ? selectedAnswers.includes(index)
                    ? quizInfo.correctAnswers.includes(index)
                      ? 'border-avax-green bg-green-50 dark:bg-green-900/30 dark:border-green-700'
                      : 'border-avax-red bg-red-50 dark:bg-red-900/30 dark:border-red-700'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-black'
                  : selectedAnswers.includes(index)
                    ? 'border-[#3752ac] bg-[#3752ac] bg-opacity-10 dark:bg-opacity-30'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
              }`}
              onClick={() => handleAnswerSelect(index)}
            >
              <span className={`w-6 h-6 shrink-0 flex items-center justify-center ${quizInfo.correctAnswers.length === 1 ? 'rounded-full' : 'rounded-md'} mr-3 text-sm ${
                isAnswerChecked
                  ? selectedAnswers.includes(index)
                    ? quizInfo.correctAnswers.includes(index)
                      ? 'bg-avax-green text-white'
                      : 'bg-avax-red text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  : selectedAnswers.includes(index)
                    ? 'bg-[#3752ac] text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {quizInfo.correctAnswers.length === 1 
                  ? String.fromCharCode(65 + index)
                  : (selectedAnswers.includes(index) ? '✓' : '')}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-300">{option}</span>
            </div>
          ))}
        </div>
        {renderAnswerFeedback()}
      </div>
      <div className="px-6 py-4 flex justify-center">
        {!isAnswerChecked ? (
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
            <button
              className={cn(
                buttonVariants({ variant: 'secondary' }),
              )}
              onClick={handleTryAgain}
            >
              Try Again!
            </button>
          )
        )}
      </div>
    </div>
    </div>
  );
};

export default Quiz;