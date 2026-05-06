"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Dialog, DialogOverlay, DialogContent, DialogTitle } from '../toolbox/components/ui/dialog';
import { LoginModal } from './LoginModal';
import { Terms } from './terms';
import { BasicProfileSetup } from './BasicProfileSetup';
import {
  type NewUserLoginPayload,
  useLoginModalState,
  useNewUserLoginListener,
  triggerLoginComplete,
} from '@/hooks/useLoginModal';

export function LoginModalWrapper() {
  const { data: session, status, update } = useSession();
  const { isOpen, callbackUrl, closeLoginModal } = useLoginModalState();
  const pathname = usePathname();

  const protectedPaths = [
    "/events/registration-form",
    "/events/project-submission",
    "/showcase",
    "/send-notifications",
    "/profile",
    "/student-launchpad",
    "/grants/",
  ];
  const [showTerms, setShowTerms] = useState(false);
  const [showBasicProfile, setShowBasicProfile] = useState(false);
  // Store user ID separately so we can show modal even before useSession updates
  const [termsUserId, setTermsUserId] = useState<string | null>(null);
  // Store callback URL in state so it persists through the flow
  const [storedCallbackUrl, setStoredCallbackUrl] = useState<string | null>(null);

  // Store callback URL when modal opens
  useEffect(() => {
    if (isOpen && callbackUrl) {
      setStoredCallbackUrl(callbackUrl);
    }
  }, [isOpen, callbackUrl]);

  const showTermsForUser = useCallback((user: { id?: string | null; is_new_user?: boolean | null }) => {
    if (!user.id) return;

    const termsKey = `shouldShowTerms_${user.id}`;
    const termsKeyValue = localStorage.getItem(termsKey);

    if (user.is_new_user && termsKeyValue !== "false") {
      // Store the user ID from session so we can render the modal
      setTermsUserId(user.id);
      setShowTerms(true);
      localStorage.setItem(termsKey, "true");
    }
  }, []);

  // Function to check and show terms modal
  const checkAndShowTerms = useCallback(async (payload?: NewUserLoginPayload) => {
    if (payload?.isNewUser && payload.userId) {
      showTermsForUser({ id: payload.userId, is_new_user: true });
      return;
    }

    let currentUser = session?.user;

    if (!currentUser?.id) {
      const updatedSession = await update();
      currentUser = updatedSession?.user;
    }

    if (currentUser?.id) {
      showTermsForUser(currentUser);
    }
  }, [session?.user, update, showTermsForUser]);

  // Listen for new user login events from VerifyEmail
  useNewUserLoginListener(checkAndShowTerms);

  // Also check on session changes (for page reload scenarios)
  useEffect(() => {
    // Skip if not on client or session not ready
    if (typeof window === "undefined") return;
    if (status === "loading") return;

    // If not authenticated, do nothing
    if (status !== "authenticated" || !session?.user?.id) {
      return;
    }

    const termsKey = `shouldShowTerms_${session.user.id}`;

    // If user is a new user, show terms
    if (session.user.is_new_user) {
      // Only show if not explicitly set to "false" (user already accepted)
      showTermsForUser(session.user);
    } else {
      // User is not new, hide terms and clean up
      setShowTerms(false);
      localStorage.removeItem(termsKey);
    }
  }, [status, session, session?.user?.id, session?.user?.is_new_user, showTermsForUser]);

  // Separate effect to close login modal when terms should be shown
  useEffect(() => {
    if (showTerms && isOpen) {
      closeLoginModal();
    }
  }, [showTerms, isOpen, closeLoginModal]);

  useEffect(() => {
    if (
      isOpen &&
      status === "authenticated" &&
      session?.user?.id &&
      !session.user.is_new_user &&
      !showTerms &&
      !showBasicProfile
    ) {
      closeLoginModal();
    }
  }, [isOpen, status, session?.user?.id, session?.user?.is_new_user, showTerms, showBasicProfile, closeLoginModal]);

  const handleTermsSuccess = async () => {
    // Update session to get latest data
    await update();

    // Use session from context instead of fetching directly
    let realUserId = session?.user?.id;

    // If still pending, update again after a delay
    if (realUserId?.startsWith("pending_")) {
      await new Promise(resolve => setTimeout(resolve, 300));
      await update();
      realUserId = session?.user?.id;
    }

    // Mark as completed in localStorage to prevent re-showing
    // Use the real user ID if available, otherwise use the pending one
    const userIdForStorage = realUserId || termsUserId || session?.user?.id;
    if (typeof window !== "undefined" && userIdForStorage) {
      const termsKey = `shouldShowTerms_${userIdForStorage}`;
      localStorage.setItem(termsKey, "false");
      // Also clean up the pending user key if it exists
      if (termsUserId?.startsWith("pending_")) {
        localStorage.removeItem(`shouldShowTerms_${termsUserId}`);
      }
    }

    // Update termsUserId with the real user ID for BasicProfileSetup
    if (realUserId && !realUserId.startsWith("pending_")) {
      setTermsUserId(realUserId);
    }

    // Close terms modal and show basic profile setup
    setShowTerms(false);
    setShowBasicProfile(true);
  };

  const handleBasicProfileSuccess = async () => {
    // Capture the callback URL before clearing state
    const redirectUrl = storedCallbackUrl;

    // Close basic profile modal
    setShowBasicProfile(false);
    setStoredCallbackUrl(null);
    closeLoginModal();

    // Force multiple session updates to ensure all components see the new auth state
    await update();
    await new Promise(resolve => setTimeout(resolve, 200));
    await update();

    // Trigger login complete event to notify all listening components
    triggerLoginComplete();

    // Redirect to callback URL if one was set when opening the modal
    if (redirectUrl) {
      // Small delay to ensure session has propagated
      await new Promise(resolve => setTimeout(resolve, 300));
      window.location.href = redirectUrl;
    }
  };

  const handleCompleteProfile = async () => {
    // Close basic profile modal and close login modal
    setShowBasicProfile(false);
    setStoredCallbackUrl(null);
    closeLoginModal();

    // Force multiple session updates to ensure all components see the new auth state
    await update();
    await new Promise(resolve => setTimeout(resolve, 200));
    await update();

    // Trigger login complete event to notify all listening components
    triggerLoginComplete();

    // Navigate to profile page so user can complete their full profile
    // Use window.location.href for a full page reload to ensure server gets fresh session
    // Don't redirect to callback URL - user explicitly chose to complete profile
    await new Promise(resolve => setTimeout(resolve, 300));
    window.location.href = "/profile";
  };

  const handleTermsDecline = () => {
    // Clean up localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("redirectAfterProfile");
      // Clean up user-specific terms keys
      if (session?.user?.id) {
        localStorage.removeItem(`shouldShowTerms_${session.user.id}`);
      }
      if (termsUserId) {
        localStorage.removeItem(`shouldShowTerms_${termsUserId}`);
      }
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("formData_") || key.startsWith("shouldShowTerms_")) {
          localStorage.removeItem(key);
        }
      });
    }

    setShowTerms(false);
    setTermsUserId(null);
    setStoredCallbackUrl(null);
    closeLoginModal();

    // Sign out the session (this clears the JWT even for pending users)
    // Stay on the current page - user can click Apply again to restart the flow
    signOut({ redirect: false });
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      // Clean up localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("redirectAfterProfile");
        // Clean up user-specific terms keys
        if (session?.user?.id) {
          localStorage.removeItem(`shouldShowTerms_${session.user.id}`);
        }
        if (termsUserId) {
          localStorage.removeItem(`shouldShowTerms_${termsUserId}`);
        }
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith("formData_") || key.startsWith("shouldShowTerms_")) {
            localStorage.removeItem(key);
          }
        });
      }

      setShowTerms(false);
      setTermsUserId(null);
      setStoredCallbackUrl(null);
      closeLoginModal();

      // Sign out only if user is not fully authenticated (clears pending/incomplete sessions).
      // Never sign out a user who was already authenticated before opening the modal.
      if (status !== "authenticated") {
        const isOnProtectedPath = protectedPaths.some(path => pathname?.startsWith(path));
        signOut({ redirect: isOnProtectedPath, callbackUrl: "/" });
      }
    }
  };

  // Render all modals independently
  // Terms modal should show when user is new and hasn't accepted terms
  // Basic profile modal should show after accepting terms
  // Login modal should show when isOpen is true
  return (
    <>
      {/* Terms Modal - Independent from Login Modal */}
      {showTerms && termsUserId && (
        <>
          <Dialog.Root open={true} onOpenChange={handleClose}>
            <Dialog.Portal>
              <DialogOverlay />
              <DialogContent
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl focus:outline-none w-[90vw] max-w-[400px] max-h-[90vh] overflow-hidden z-[10000] p-0"
                showCloseButton={false}
              >
                <VisuallyHidden>
                  <DialogTitle>Terms and Conditions</DialogTitle>
                  <Dialog.Description>Review and accept the Builder Hub terms.</Dialog.Description>
                </VisuallyHidden>
                <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: '90vh' }}>
                  <Terms
                    userId={termsUserId}
                    onSuccess={handleTermsSuccess}
                    onDecline={handleTermsDecline}
                    skipRedirect={true}
                    compact={true}
                  />
                </div>
              </DialogContent>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      )}

      {/* Basic Profile Modal - Shows after accepting terms */}
      {showBasicProfile && (termsUserId || session?.user?.id) && (
        <>
          <Dialog.Root open={true} onOpenChange={(open) => {
            if (!open) {
              setShowBasicProfile(false);
              closeLoginModal();
            }
          }}>
            <Dialog.Portal>
              <DialogOverlay />
              <DialogContent
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl focus:outline-none w-[90vw] max-w-[500px] max-h-[90vh] overflow-hidden z-[10000] p-0"
                showCloseButton={false}
              >
                <VisuallyHidden>
                  <DialogTitle>Basic Profile Setup</DialogTitle>
                  <Dialog.Description>Complete basic profile information for your Builder Hub account.</Dialog.Description>
                </VisuallyHidden>
                <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: '90vh' }}>
                  <BasicProfileSetup
                    userId={(termsUserId || session?.user?.id)!}
                    onSuccess={handleBasicProfileSuccess}
                    onCompleteProfile={handleCompleteProfile}
                  />
                </div>
              </DialogContent>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      )}

      {/* Login Modal - Independent from other modals */}
      <LoginModal />
    </>
  );
}
