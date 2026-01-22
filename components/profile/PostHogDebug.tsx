"use client";

import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

/**
 * Componente de debug temporal para verificar la conexión de PostHog
 * Puedes eliminar este componente después de verificar que todo funciona
 */
export function PostHogDebug() {
  const posthog = usePostHog();
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    const updateDebugInfo = () => {
      if (posthog) {
        const flagValue = posthog.isFeatureEnabled('new-profile-ui');
        const envFlagName = 'NEXT_PUBLIC_FEATURE_FLAG_NEW_PROFILE_UI';
        const envValue = process.env[envFlagName];
        
        // Determinar qué fuente se está usando
        const usingPostHog = flagValue !== null && flagValue !== undefined;
        const usingEnv = !usingPostHog && (envValue === 'true' || envValue === '1');
        
        const info = {
          isLoaded: posthog.__loaded || false,
          apiHost: (posthog as any).config?.api_host,
          hasKey: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
          keyLength: process.env.NEXT_PUBLIC_POSTHOG_KEY?.length || 0,
          host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
          featureFlag: {
            name: 'new-profile-ui',
            posthogValue: flagValue,
            envValue: envValue,
            envVarName: envFlagName,
            finalValue: usingPostHog ? flagValue : (usingEnv ? true : false),
            source: usingPostHog ? 'PostHog' : (usingEnv ? 'Environment Variable' : 'Default Value')
          },
          isFeatureEnabled: typeof posthog.isFeatureEnabled === 'function',
        };
        setDebugInfo(info);
        
        console.log('[PostHog Debug]', info);
      } else {
        const envFlagName = 'NEXT_PUBLIC_FEATURE_FLAG_NEW_PROFILE_UI';
        const envValue = process.env[envFlagName];
        setDebugInfo({ 
          error: 'PostHog not available',
          envFallback: {
            envVarName: envFlagName,
            envValue: envValue,
            willUse: envValue === 'true' || envValue === '1',
            source: 'Environment Variable (PostHog unavailable)'
          }
        });
        console.warn('[PostHog Debug] PostHog client not found');
      }
    };

    // Actualizar inmediatamente
    updateDebugInfo();

    // Actualizar cuando PostHog carga los flags
    if (posthog) {
      const unsubscribe = posthog.onFeatureFlags(() => {
        updateDebugInfo();
      });

      // También actualizar después de un tiempo para ver si los flags se cargaron
      const timeout = setTimeout(() => {
        updateDebugInfo();
      }, 2000);

      return () => {
        clearTimeout(timeout);
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [posthog]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono z-50 max-w-sm">
      <div className="font-bold mb-2">PostHog Debug</div>
      <pre className="whitespace-pre-wrap overflow-auto">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  );
}

