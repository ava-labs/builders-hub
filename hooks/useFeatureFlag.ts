"use client";

import { usePostHog } from "posthog-js/react";
import { useEffect, useState, useMemo } from "react";

/**
 * Hook to manage feature flags using PostHog with fallback to environment variables
 * 
 * IMPORTANT: If PostHog is blocked (e.g., Brave with ad blocker), it uses the
 * environment variable directly. PostHog is only used if it's available AND working.
 * 
 * @param flagName - Name of the feature flag
 * @param defaultValue - Default value if the flag is not available (default: false)
 * @returns boolean - Feature flag state
 * 
 * @example
 * const isNewProfileEnabled = useFeatureFlag('new-profile-ui', false);
 */
export function useFeatureFlag(flagName: string, defaultValue: boolean = false): boolean {
  const posthog = usePostHog();
  
  // Helper function to get the value from environment variable
  // This function does NOT depend on PostHog, it always works
  const getEnvFlagValue = useMemo((): boolean | null => {
    if (typeof window === 'undefined') return null;
    
    const envFlagName = `NEXT_PUBLIC_FEATURE_FLAG_${flagName.toUpperCase().replace(/-/g, '_')}`;
    const envValue = process.env[envFlagName];
    
    if (envValue !== undefined && envValue !== null) {
      const boolValue = envValue === 'true' || envValue === '1';
      return boolValue;
    }
    return null;
  }, [flagName]);

  // ALWAYS initialize with environment variable first
  // This ensures it works immediately, even if PostHog is blocked
  const initialValue = getEnvFlagValue !== null ? getEnvFlagValue : defaultValue;
  
  const [flagValue, setFlagValue] = useState<boolean>(initialValue);

  useEffect(() => {
    // ALWAYS set env value first (works without PostHog)
    if (getEnvFlagValue !== null) {
      setFlagValue(getEnvFlagValue);
    }
    
    // Only try to use PostHog if it's available AND not blocked
    // If PostHog is blocked, we simply ignore its values and use env
    if (posthog && typeof posthog.isFeatureEnabled === 'function') {
      const checkFlag = () => {
        try {
          const posthogValue = posthog.isFeatureEnabled(flagName);
          
          // If PostHog returns a valid value (true/false), use it
          if (posthogValue === true || posthogValue === false) {
            setFlagValue(posthogValue);
          }
          // If PostHog returns null/undefined (blocked or not loaded),
          // keep the env value we already set at the beginning
        } catch (error) {
          console.warn(`Error checking feature flag ${flagName}:`, error);
          // On error, use environment variable (should already be set)
          if (getEnvFlagValue !== null) {
            setFlagValue(getEnvFlagValue);
          } else {
            setFlagValue(defaultValue);
          }
        }
      };

      // Check immediately (but we already have the initial env value)
      checkFlag();

      // Wait for feature flags to load (PostHog may take time)
      // Try multiple times to give PostHog time to load the flags
      const timeouts: ReturnType<typeof setTimeout>[] = [];
      
      // Check after 500ms, 1s, 2s and 3s
      // If PostHog is blocked, it will continue using the env value we already set
      [500, 1000, 2000, 3000].forEach((delay) => {
        const timeout = setTimeout(() => {
          checkFlag();
        }, delay);
        timeouts.push(timeout);
      });

      // Listen for changes in PostHog feature flags (this fires when flags are loaded)
      const unsubscribe = posthog.onFeatureFlags(() => {
        checkFlag();
      });

      return () => {
        // Clean up all timeouts
        timeouts.forEach(timeout => clearTimeout(timeout));
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    } else {
      // PostHog is not available (not initialized or blocked)
      // Use environment variable directly
      if (getEnvFlagValue !== null) {
        setFlagValue(getEnvFlagValue);
      } else {
        setFlagValue(defaultValue);
      }
    }
  }, [posthog, flagName, defaultValue, getEnvFlagValue]);

  return flagValue;
}

