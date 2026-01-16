"use client";

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Dialog, DialogOverlay, DialogContent, DialogTitle } from '../toolbox/components/ui/dialog';
import { LoginModal } from './LoginModal';
import { Terms } from './terms';
import { BasicProfileSetup } from './BasicProfileSetup';
import { useLoginModalState } from '@/hooks/useLoginModal';

export function LoginModalWrapper() {
  const { data: session, status } = useSession();
  const { isOpen, closeLoginModal } = useLoginModalState();
  const [showTerms, setShowTerms] = useState(false);
  const [showBasicProfile, setShowBasicProfile] = useState(false);
  const router = useRouter();

  // Initialize showTerms from localStorage to persist across page reloads
  // Only restore if user is still authenticated and new, and hasn't already been shown
  useEffect(() => {
    if (typeof window === "undefined" || status !== "authenticated" || !session?.user?.id) {
      return;
    }

    // If user is not new, clear localStorage (they already accepted terms)
    if (!session?.user?.is_new_user) {
      localStorage.removeItem("shouldShowTerms");
      // Also ensure showTerms is false
      if (showTerms) {
        setShowTerms(false);
      }
      return;
    }

    // If user is new and we're not already showing terms, check localStorage
    if (session?.user?.is_new_user && !showTerms) {
      const shouldShowTerms = localStorage.getItem("shouldShowTerms");
      // Only restore if explicitly set to "true", not if it's "false" or doesn't exist
      if (shouldShowTerms === "true") {
        setShowTerms(true);
      } else if (shouldShowTerms === "false") {
        // User already accepted terms, don't show again
      }
    }
  }, [status, session?.user?.id, session?.user?.is_new_user, showTerms]);


  // Check if user is authenticated and is a new user
  // Note: Terms modal is completely independent from login modal
  // It should show whenever a new user is authenticated, regardless of login modal state
  useEffect(() => {


    if (
      status === "authenticated" &&
      session?.user?.is_new_user &&
      session?.user?.id
    ) {
      // Only show terms if we haven't already closed them (user might have accepted)
      // Check localStorage to see if we should still show
      const shouldShow = typeof window !== "undefined" 
        ? localStorage.getItem("shouldShowTerms") !== "false"
        : true;
      
      if (shouldShow) {
        
        setShowTerms(true);
        // Persist state in localStorage to survive page reloads
        if (typeof window !== "undefined") {
          localStorage.setItem("shouldShowTerms", "true");
        }
      }
    } else {

      // Only set to false if we're authenticated and user is not new
      // (don't change state if still loading or unauthenticated)
      if (status === "authenticated") {
        setShowTerms(false);
        // Clear persisted state if user is authenticated but not new
        if (typeof window !== "undefined") {
          localStorage.removeItem("shouldShowTerms");
        }
      }
    }
  }, [status, session]);

  // Separate effect to close login modal when terms should be shown
  useEffect(() => {
    if (showTerms && isOpen) {
      closeLoginModal();
    }
  }, [showTerms, isOpen, closeLoginModal]);

  const handleTermsSuccess = () => {
    // Mark as completed in localStorage to prevent re-showing
    if (typeof window !== "undefined") {
      localStorage.setItem("shouldShowTerms", "false");
    }
    // Close terms modal and show basic profile setup
    setShowTerms(false);
    setShowBasicProfile(true);
  };

  const handleBasicProfileSuccess = () => {
    // Close basic profile modal
    setShowBasicProfile(false);
    closeLoginModal();
  };

  const handleCompleteProfile = () => {
    // Close basic profile modal and close login modal
    setShowBasicProfile(false);
    closeLoginModal();
  };

  const handleTermsDecline = () => {
    // Clean up localStorage before logout
    if (typeof window !== "undefined") {
      localStorage.removeItem("redirectAfterProfile");
      localStorage.removeItem("shouldShowTerms");
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("formData_")) {
          localStorage.removeItem(key);
        }
      });
    }
    
    setShowTerms(false);
    closeLoginModal();
    signOut({ redirect: false }).then(() => {
      // Redirect to home after logout to avoid staying on protected routes
      router.push('/');
    });
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      // Clean up localStorage before logout
      if (typeof window !== "undefined") {
        localStorage.removeItem("redirectAfterProfile");
        localStorage.removeItem("shouldShowTerms");
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith("formData_")) {
            localStorage.removeItem(key);
          }
        });
      }
      
      setShowTerms(false);
      closeLoginModal();
      signOut({ redirect: false }).then(() => {
        // Redirect to home after logout to avoid staying on protected routes
        router.push('/');
      });
    }
  };

  // Render all modals independently
  // Terms modal should show when user is new and hasn't accepted terms
  // Basic profile modal should show after accepting terms
  // Login modal should show when isOpen is true
  return (
    <>
      {/* Terms Modal - Independent from Login Modal */}
      {showTerms && session?.user?.id && (
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
                </VisuallyHidden>
                <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: '90vh' }}>
                  <Terms 
                    userId={session.user.id} 
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
      {showBasicProfile && session?.user?.id && (
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
                </VisuallyHidden>
                <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: '90vh' }}>
                  <BasicProfileSetup 
                    userId={session.user.id} 
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
