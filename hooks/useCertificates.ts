import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { apiFetch, ApiClientError } from '@/lib/api/client';

interface UseCertificatesReturn {
  isGenerating: boolean;
  certificatePdfUrl: string | null;
  generateCertificate: (courseId: string) => Promise<void>;
}

export function useCertificates(): UseCertificatesReturn {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [certificatePdfUrl, setCertificatePdfUrl] = useState<string | null>(null);

  const generateCertificate = async (courseId: string) => {
    setIsGenerating(true);

    try {
      const response = await apiFetch<Response>('/api/generate-certificate', {
        method: 'POST',
        body: { courseId },
        raw: true,
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Store the PDF URL for sharing
      setCertificatePdfUrl(url);

      // Download the PDF
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${courseId}_certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      // Don't revoke the URL immediately as we need it for sharing

      // Show success message
      toast({
        title: "Certificate Downloaded!",
        description: "Your certificate has been successfully generated and downloaded.",
      });

      // Redirect after success
      setTimeout(() => {
        // Redirect to the appropriate academy page
        if (
          courseId.startsWith('codebase-entrepreneur-') ||
          courseId.startsWith('avalanche-entrepreneur-') ||
          courseId.startsWith('entrepreneur-')
        ) {
          router.push('/academy/entrepreneur');
        } else {
          router.push('/academy');
        }
      }, 3000);
    } catch (error: unknown) {
      console.error('Error generating certificate:', error);

      // Handle authentication error specifically
      if (error instanceof ApiClientError && error.status === 401) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to your BuilderHub account to generate certificates.",
          variant: "destructive",
        });
        setIsGenerating(false);
        setTimeout(() => {
          const currentPath = window.location.pathname;
          router.push(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
        }, 2000);
        return;
      }

      // Check for specific error types
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Email address required')) {
        toast({
          title: "Email Required",
          description: "Please ensure your BuilderHub account has a valid email address.",
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }

      // Generic error handling for unexpected errors
      toast({
        title: "Certificate Generation Failed",
        description: message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    certificatePdfUrl,
    generateCertificate,
  };
}
