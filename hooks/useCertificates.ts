import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

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
      const response = await fetch('/api/generate-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
        }),
      });

      if (!response.ok) {
        // Handle authentication error specifically
        if (response.status === 401) {
          toast({
            title: "Authentication Required",
            description: "Please sign in to your BuilderHub account to generate certificates.",
            variant: "destructive",
          });
          setIsGenerating(false);
          // Redirect to login after a short delay with callback URL
          setTimeout(() => {
            const currentPath = window.location.pathname;
            router.push(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
          }, 2000);
          return;
        }
        
        // Try to get error details from response
        try {
          const errorData = await response.json();
          console.error('Server error details:', errorData);
          
          // Check for specific error types
          if (errorData.error?.includes('Email address required')) {
            toast({
              title: "Email Required",
              description: "Please ensure your BuilderHub account has a valid email address.",
              variant: "destructive",
            });
            setIsGenerating(false);
            return;
          }
          
          throw new Error(errorData.error || errorData.details || 'Failed to generate certificate');
        } catch (jsonError) {
          throw new Error(`Failed to generate certificate (${response.status})`);
        }
      }

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
        if (courseId.startsWith('codebase-entrepreneur-')) {
          router.push('/codebase-entrepreneur-academy');
        } else {
          router.push('/academy');
        }
      }, 3000);
    } catch (error: any) {
      console.error('Error generating certificate:', error);
      
      // Generic error handling for unexpected errors
      toast({
        title: "Certificate Generation Failed",
        description: error.message || "An unexpected error occurred. Please try again.",
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
