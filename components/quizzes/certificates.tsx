"use client";
import React, { useState, useEffect } from 'react';
import { getQuizResponse } from '@/utils/quizzes/indexedDB';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import quizDataImport from '@/components/quizzes/quizData.json';
import Quiz from '@/components/quizzes/quiz';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Linkedin, Twitter, Award, Share2 } from 'lucide-react';
import { AwardBadgeWrapper } from '@/components/quizzes/components/awardBadgeWrapper';
import { useRouter } from 'next/navigation';
import { useCertificates } from '@/hooks/useCertificates';
import { toast } from '@/hooks/use-toast';
import { BadgePopup } from '@/components/quizzes/BadgePopup';

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
  const router = useRouter();
  const { isGenerating, certificatePdfUrl, earnedBadges, generateCertificate } = useCertificates();
  const [completedQuizzes, setCompletedQuizzes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<QuizInfo[]>([]);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [correctlyAnsweredQuizzes, setCorrectlyAnsweredQuizzes] = useState(0);
  const [shouldShowCertificate, setShouldShowCertificate] = useState(false);
  const [showBadgePopup, setShowBadgePopup] = useState(false);

  useEffect(() => {
    const fetchQuizzes = () => {
      const courseQuizzes = quizData.courses[courseId]?.quizzes || [];
      const quizzesWithChapters = courseQuizzes.map(quizId => ({
        id: quizId,
        chapter: quizData.quizzes[quizId]?.chapter || 'Unknown Chapter',
        question: quizData.quizzes[quizId]?.question || ''
      }));
      setQuizzes(quizzesWithChapters);
      setTotalQuizzes(courseQuizzes.length);

      // If no quizzes found, set loading to false to prevent infinite loading
      if (courseQuizzes.length === 0) {
        setIsLoading(false);
      }
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

      const completedIds = completed.filter((id): id is string => id !== null);
      setCompletedQuizzes(completedIds);
      setCorrectlyAnsweredQuizzes(completedIds.length);
      setIsLoading(false);
    };

    if (quizzes.length > 0) {
      checkQuizCompletion();
    }
  }, [quizzes]);

  useEffect(() => {
    if (totalQuizzes > 0 && correctlyAnsweredQuizzes === totalQuizzes) {
      setShouldShowCertificate(true);

      setTimeout(() => {

      }, 3000);
    }
  }, [correctlyAnsweredQuizzes, totalQuizzes]);

  const handleQuizCompleted = (quizId: string) => {
    if (!completedQuizzes.includes(quizId)) {
      setCompletedQuizzes(prev => [...prev, quizId]);
      setCorrectlyAnsweredQuizzes(prev => prev + 1);
    }
  };

  const allQuizzesCompleted = shouldShowCertificate;

  const handleGenerateCertificate = async () => {
    toast({
      title: "Generating Certificate",
      description: "Please wait while we create your certificate...",
    });
    await generateCertificate(courseId);
    
    // Show badge popup if badges were earned
    if (earnedBadges.length > 0) {
      setTimeout(() => {
        setShowBadgePopup(true);
      }, 1000); // Small delay to let the success toast show first
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
    const text = `I just completed the ${quizData.courses[courseId].title} course on Avalanche Academy! 🎉`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };
  
  const viewCertificate = () => {
    if (certificatePdfUrl) {
      window.open(certificatePdfUrl, '_blank');
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!quizData.courses[courseId]) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">Course Not Found</h2>
          <p className="text-red-600 dark:text-red-300">
            The course "{courseId}" could not be found. Please check the course ID and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {!shouldShowCertificate && chapters.map((chapter) => {
        const chapterQuizzes = quizzesByChapter[chapter];

        return (
          <div key={chapter} className="mb-8">
            <h3 className="text-xl font-medium mb-4">{chapter}</h3>
            <Accordions type="single" collapsible>
              {chapterQuizzes.map((quiz) => (
                <Accordion key={quiz.id} title={`${quiz.question}`}>
                  <Quiz quizId={quiz.id} onQuizCompleted={handleQuizCompleted} />
                </Accordion>
              ))}
            </Accordions>
          </div>
        );
      })}


      {allQuizzesCompleted && (
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <AwardBadgeWrapper courseId={courseId} isCompleted={allQuizzesCompleted} />
          <div className="flex items-center justify-center mb-6">
            <Award className="w-16 h-16 text-green-500 mr-4" />
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white" style={{ fontSize: '2rem', marginTop: '1em' }}>Congratulations!</h2>
          </div>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
            You've completed all quizzes for the {quizData.courses[courseId].title} course. Claim your certificate now!
          </p>
          
          {/* Display earned badges */}
          {earnedBadges.length > 0 && (
            <div className="mb-8 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-4 text-center">
                🎉 New Badge Earned!
              </h3>
              <div className="flex flex-wrap justify-center gap-4">
                {earnedBadges.map((badge, index) => (
                  <div key={index} className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-yellow-200 dark:border-yellow-700">
                    <img 
                      src={badge.image_path} 
                      alt={badge.name}
                      className="w-16 h-16 object-contain mb-2"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <h4 className="font-semibold text-gray-800 dark:text-white text-sm text-center">
                      {badge.name}
                    </h4>
                    {badge.completed_requirement && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 text-center mt-1">
                        {badge.completed_requirement.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            className={cn(
              buttonVariants({ variant: 'default' }),
              'w-full mb-6 py-3 text-lg relative overflow-hidden'
            )}
            onClick={handleGenerateCertificate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Generating Certificate...
              </span>
            ) : (
              'Generate My Certificate'
            )}
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <p className="text-center text-gray-600 dark:text-gray-300 mb-2">
              Share your achievement:
            </p>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
              Your certificate PDF has been downloaded. You can attach it when sharing on social media.
            </p>
            <div className="flex justify-center space-x-4">
              {certificatePdfUrl && (
                <button
                  onClick={viewCertificate}
                  className={cn(
                    buttonVariants({ variant: 'secondary' }),
                    'flex items-center px-4 py-2'
                  )}
                >
                  <Award className="mr-2 h-5 w-5" />
                  View Certificate
                </button>
              )}
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
                Share on X
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
      
      {/* Badge Popup */}
      <BadgePopup
        isOpen={showBadgePopup}
        onClose={() => setShowBadgePopup(false)}
        badges={earnedBadges}
        courseName={quizData.courses[courseId]?.title || courseId}
      />
    </div>
  );
};

export default CertificatePage;