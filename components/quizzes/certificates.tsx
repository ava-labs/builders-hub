"use client";
import React, { useState, useEffect } from 'react';
import { getQuizResponse } from '@/utils/quizzes/indexedDB';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import quizDataImport from '@/components/quizzes/quizData.json';
import Quiz from '@/components/quizzes/quiz';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Linkedin, Twitter, Award, Share2 } from 'lucide-react';

interface CertificatePageProps {
  courseId: string;
}

interface QuizInfo {
  id: string;
  chapter: string;
  question: string;
}

interface QuizData {
  question: string;
  options: string[];
  correctAnswers: number[];
  hint: string;
  explanation: string;
  chapter: string;
}

interface Course {
  title: string;
  quizzes: string[];
}

interface QuizDataStructure {
  courses: {
    [courseId: string]: Course;
  };
  quizzes: {
    [quizId: string]: QuizData;
  };
}

const quizData = quizDataImport as QuizDataStructure;

const CertificatePage: React.FC<CertificatePageProps> = ({ courseId }) => {
  const [completedQuizzes, setCompletedQuizzes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizzes, setQuizzes] = useState<QuizInfo[]>([]);

  useEffect(() => {
    const fetchQuizzes = () => {
      const courseQuizzes = quizData.courses[courseId]?.quizzes || [];
      const quizzesWithChapters = courseQuizzes.map(quizId => ({
        id: quizId,
        chapter: quizData.quizzes[quizId]?.chapter || 'Unknown Chapter',
        question: quizData.quizzes[quizId]?.question || ''
      }));
      setQuizzes(quizzesWithChapters);
    };

    fetchQuizzes();
  }, [courseId]);

  useEffect(() => {
    const checkQuizCompletion = async () => {
      const completed = await Promise.all(
        quizzes.map(async (quiz) => {
          const response = await getQuizResponse(quiz.id);
          return response && response.isCorrect ? quiz.id : null;
        })
      );
      setCompletedQuizzes(completed.filter((id): id is string => id !== null));
      setIsLoading(false);
    };

    if (quizzes.length > 0) {
      checkQuizCompletion();
    }
  }, [quizzes]);

  const allQuizzesCompleted = completedQuizzes.length === quizzes.length;

  const generateCertificate = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          userName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate certificate');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${courseId}_certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating certificate:', error);
      alert('Failed to generate certificate. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const chapters = [...new Set(quizzes.map(quiz => quiz.chapter))];

  const quizzesByChapter = chapters.reduce((acc, chapter) => {
    acc[chapter] = quizzes.filter(quiz => quiz.chapter === chapter);
    return acc;
  }, {} as Record<string, QuizInfo[]>);

  const shareOnLinkedIn = () => {
    const organizationName = 'Avalanche';
    const organizationId = 19104188;
    const certificationName = encodeURIComponent(quizData.courses[courseId].title);
    const issuedMonth = new Date().getMonth() + 1;
    const issuedYear = new Date().getFullYear();

    return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${certificationName}&organizationId=${organizationId}&issueMonth=${issuedMonth}&issueYear=${issuedYear}&organizationName=${organizationName}`;
  };

  const shareOnTwitter = () => {
    const text = `I just completed the ${quizData.courses[courseId].title} course on Avalanche Academy!`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {chapters.map((chapter) => {
        const chapterQuizzes = quizzesByChapter[chapter];
        const incompleteQuizzes = chapterQuizzes.filter(quiz => !completedQuizzes.includes(quiz.id));

        if (incompleteQuizzes.length === 0) return null;

        return (
          <div key={chapter} className="mb-8">
            <h3 className="text-xl font-medium mb-4">{chapter}</h3>
            <Accordions type="single" collapsible>
              {incompleteQuizzes.map((quiz) => (
                <Accordion key={quiz.id} title={`${quiz.question}`}>
                  <Quiz quizId={quiz.id} />
                </Accordion>
              ))}
            </Accordions>
          </div>
        );
      })}
      
      {allQuizzesCompleted && (
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-center mb-6">
            <Award className="w-16 h-16 text-green-500 mr-4" />
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white" style={{ fontSize: '2rem', marginTop: '1em'}}>Congratulations!</h2>
          </div>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
            You've completed all quizzes for the {quizData.courses[courseId].title} course. Claim your certificate now!
          </p>
          <div className="mb-6">
            <label htmlFor="userName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter your full name for the certificate:
            </label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="John Doe"
            />
          </div>
          <button
            className={cn(
              buttonVariants({ variant: 'default' }),
              'w-full mb-6 py-3 text-lg'
            )}
            onClick={generateCertificate}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating Certificate...' : 'Generate My Certificate'}
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
              Share your achievement:
            </p>
            <div className="flex justify-center space-x-4">
              <a href={shareOnLinkedIn()} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
                className={cn(
                  buttonVariants({ variant: 'secondary' }),
                  'flex items-center px-4 py-2'
                )}
              >
                <Linkedin className="mr-2 h-5 w-5" />
                Add to LinkedIn
              </a>
              <button
                className={cn(
                  buttonVariants({ variant: 'secondary' }),
                  'flex items-center px-4 py-2'
                )}
                onClick={shareOnTwitter}
              >
                <Twitter className="mr-2 h-5 w-5" />
                Twitter
              </button>
            </div>
          </div>
        </div>
      )}
      {!allQuizzesCompleted && (
        <div className="mt-12 bg-muted rounded-lg shadow-lg p-8">
          <Share2 className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
          Complete all quizzes to unlock your certificate and share your achievement!
        </div>
      )}
    </div>
  );
};

export default CertificatePage;