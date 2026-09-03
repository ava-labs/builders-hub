'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLoginCompleteListener } from '@/hooks/useLoginModal';
import { resyncQuizProgress } from '@/utils/quizzes/indexedDB';

/**
 * Signing in through the login modal closes it in place — there is no
 * navigation, so the quiz sync layer's page-load cache never sees the new
 * session (#4357: answers stay invisible and saves stop reaching the API
 * until a manual refresh). This hook re-runs the account sync on login and
 * returns a version number; consumers add it to their load effect's deps to
 * re-read IndexedDB once the pull has landed.
 *
 * Two triggers, same as AlertDashboard's post-login refetch:
 * - login-complete event: the full modal flow finished in this tab
 * - unauthenticated → authenticated: logins that never fire that event
 *   (e.g. the session broadcast from another tab of this browser)
 */
export function useQuizProgressSync(): number {
  const [version, setVersion] = useState(0);

  const resync = useCallback(() => {
    resyncQuizProgress().then(() => setVersion((v) => v + 1));
  }, []);

  useLoginCompleteListener(resync);

  const { status } = useSession();
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === 'unauthenticated' && status === 'authenticated') {
      resync();
    }
    prevStatus.current = status;
  }, [status, resync]);

  return version;
}
