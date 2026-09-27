"use client";
import React, { useState, useEffect } from 'react';
import { getQuizResponse } from '@/utils/quizzes/indexedDB';
import { cn } from '@/utils/cn';
import quizData from '@/components/quizzes/data';
import { AwardBadgeWrapper } from '@/components/quizzes/components/awardBadgeWrapper';
import { CertificateChapters, CertificateProgress } from '@/components/quizzes/certificate-progress';
import {
  CertificateCredential,
  credentialAcademy,
  credentialFacts,
  credentialTitle,
} from '@/components/quizzes/certificate-credential';
import { useCourseOutline } from '@/components/academy/course/course-outline-context';
import { usePathname, useRouter } from 'next/navigation';
import { useCertificates } from '@/hooks/useCertificates';
import { toast } from '@/hooks/use-toast';

interface CertificatePageProps {
  courseId: string;
}

interface QuizInfo {
  id: string;
  chapter: string;
  question: string;
}

const CertificatePage: React.FC<CertificatePageProps> = ({ courseId }) => {
  const router = useRouter();
  const { isGenerating, certificatePdfUrl, generateCertificate } = useCertificates();
  const outline = useCourseOutline();
  const pathname = usePathname();
  const [completedQuizzes, setCompletedQuizzes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<QuizInfo[]>([]);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [correctlyAnsweredQuizzes, setCorrectlyAnsweredQuizzes] = useState(0);
  const [shouldShowCertificate, setShouldShowCertificate] = useState(false);

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
    <div
      className={cn('max-w-4xl mx-auto', allQuizzesCompleted && 'p-4')}
      data-certificate-page=""
      data-certificate={allQuizzesCompleted ? 'complete' : 'progress'}
    >
      {!shouldShowCertificate && (
        <CertificateProgress completed={correctlyAnsweredQuizzes} total={totalQuizzes} />
      )}
      {!shouldShowCertificate && (
        <CertificateChapters
          chapters={chapters}
          quizzesByChapter={quizzesByChapter}
          completedQuizzes={completedQuizzes}
          onQuizCompleted={handleQuizCompleted}
        />
      )}


      {allQuizzesCompleted && (
        <>
          <AwardBadgeWrapper courseId={courseId} isCompleted={allQuizzesCompleted} />
          <CertificateCredential
            academy={credentialAcademy(pathname)}
            courseTitle={credentialTitle(courseId, outline)}
            facts={credentialFacts(outline)}
            isGenerating={isGenerating}
            certificatePdfUrl={certificatePdfUrl}
            linkedInUrl={shareOnLinkedIn()}
            onGenerate={handleGenerateCertificate}
            onShareOnX={shareOnTwitter}
            onViewCertificate={viewCertificate}
          />
        </>
      )}
    </div>
  );
};

export default CertificatePage;