// hooks/useNavigationWithLoading.ts
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export function useNavigationWithLoading() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  // Setup navigation event listeners
  useEffect(() => {
    // Define event handlers
    const handleStart = (): void => setIsNavigating(true);
    const handleComplete = (): void => setIsNavigating(false);
    const handleError = (): void => setIsNavigating(false);

    // Add event listeners
    window.addEventListener("beforeunload", handleStart);

    // Next App Router (app directory) events
    if ("events" in router) {
      const routerWithEvents = router as unknown as {
        events: {
          on: (event: string, handler: () => void) => void;
          off: (event: string, handler: () => void) => void;
        };
      };

      routerWithEvents.events.on("routeChangeStart", handleStart);
      routerWithEvents.events.on("routeChangeComplete", handleComplete);
      routerWithEvents.events.on("routeChangeError", handleError);
    }

    // Cleanup
    return () => {
      window.removeEventListener("beforeunload", handleStart);

      if ("events" in router) {
        const routerWithEvents = router as unknown as {
          events: { off: (event: string, handler: () => void) => void };
        };

        routerWithEvents.events.off("routeChangeStart", handleStart);
        routerWithEvents.events.off("routeChangeComplete", handleComplete);
        routerWithEvents.events.off("routeChangeError", handleError);
      }
    };
  }, [router]);

  // Safe navigation function that handles loading state
  const navigateWithLoading = useCallback(
    (url: string): Promise<boolean> => {
      setIsNavigating(true);

      // Start navigation
      router.push(url);

      // Return a promise that resolves when navigation is considered "done"
      return new Promise<boolean>((resolve) => {
        // Give it a reasonable timeout since we can't detect the actual completion
        const navigationTimeout = setTimeout(() => {
          resolve(true);
        }, 250); // Small buffer to ensure the router has started navigation

        // If we have events and can detect completion
        if ("events" in router) {
          const routerWithEvents = router as unknown as {
            events: {
              on: (event: string, handler: () => void) => void;
              off: (event: string, handler: () => void) => void;
            };
          };

          const handleComplete = () => {
            clearTimeout(navigationTimeout);
            resolve(true);
          };

          routerWithEvents.events.on("routeChangeComplete", handleComplete);
          setTimeout(() => {
            routerWithEvents.events.off("routeChangeComplete", handleComplete);
          }, 5000); // Safeguard: remove listener after 5s if never fires
        }
      });
    },
    [router]
  );

  return {
    isNavigating,
    navigateWithLoading,
  };
}
