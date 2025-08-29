import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export function useUTMPreservation() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Store UTM parameters in sessionStorage when they're present
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm'];
    const currentUTMs: Record<string, string> = {};
    
    utmParams.forEach(param => {
      const value = searchParams.get(param);
      if (value) {
        currentUTMs[param] = value;
        sessionStorage.setItem(`preserved_${param}`, value);
      }
    });

    // If we have stored UTMs but current URL doesn't have them, restore them
    if (Object.keys(currentUTMs).length === 0) {
      const storedUTMs: Record<string, string> = {};
      let hasStoredUTMs = false;

      utmParams.forEach(param => {
        const stored = sessionStorage.getItem(`preserved_${param}`);
        if (stored) {
          storedUTMs[param] = stored;
          hasStoredUTMs = true;
        }
      });

      // Only restore UTMs on specific pages where they matter
      const currentPath = window.location.pathname;
      const utmImportantPaths = [
        '/hackathons/registration-form',
        '/hackathons/project-submission',
        '/profile'
      ];

      if (hasStoredUTMs && utmImportantPaths.some(path => currentPath.startsWith(path))) {
        const currentUrl = new URL(window.location.href);
        Object.entries(storedUTMs).forEach(([key, value]) => {
          if (!currentUrl.searchParams.has(key)) {
            currentUrl.searchParams.set(key, value);
          }
        });

        // Only update if we actually added UTM parameters
        if (currentUrl.searchParams.toString() !== searchParams.toString()) {
          router.replace(currentUrl.pathname + '?' + currentUrl.searchParams.toString());
        }
      }
    }
  }, [searchParams, router]);

  // Function to get preserved UTM parameters
  const getPreservedUTMs = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm'];
    const preservedUTMs: Record<string, string> = {};
    
    utmParams.forEach(param => {
      const current = searchParams.get(param);
      const stored = sessionStorage.getItem(`preserved_${param}`);
      
      if (current) {
        preservedUTMs[param] = current;
      } else if (stored) {
        preservedUTMs[param] = stored;
      }
    });
    
    return preservedUTMs;
  };

  // Function to clear stored UTM parameters
  const clearPreservedUTMs = () => {
    if (typeof window === 'undefined') return;
    
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm'];
    utmParams.forEach(param => {
      sessionStorage.removeItem(`preserved_${param}`);
    });
  };

  return {
    getPreservedUTMs,
    clearPreservedUTMs
  };
} 