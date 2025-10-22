"use client"

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import Link from "next/link";
import axios from "axios";

interface TermsProps {
  userId: string;
  onSuccess?: () => void;
  onDecline?: () => void;
}

export const Terms = ({
  userId,
  onSuccess,
  onDecline
}: TermsProps) => {
  const [isAccepted, setIsAccepted] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { update } = useSession();

  const handleAccept = async () => {
    setIsAccepted(true);
    setIsSaving(true);
    
    try {
      // Save only the notifications field
      const dataToSave = {
        notifications: true
      };

      // Save to API
      await axios.put(`/api/profile/${userId}`, dataToSave);
      
      // Update session
      await update();
      
      // Show success message
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });

      // Execute success callback if provided
      onSuccess?.();

      // Navigate to home or redirect URL
      const redirectUrl = typeof window !== "undefined" 
        ? localStorage.getItem("redirectAfterProfile") 
        : null;
      
      if (redirectUrl) {
        localStorage.removeItem("redirectAfterProfile");
        router.push(redirectUrl);
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: "An error occurred while saving the profile.",
        variant: "destructive",
      });
      // Reset state on error
      setIsAccepted(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDecline = () => {
    setIsAccepted(false);
    // Call the parent callback to handle decline (e.g., close modal)
    onDecline?.();
  };
  return (
    <Card
      className="
        w-full max-w-2xl mx-auto
        rounded-md
        text-black dark:bg-zinc-800 dark:text-white
        border
      "
    >
      <CardHeader className="text-center">
       
        <p className="text-sm text-muted-foreground">
          Review and agree to the terms to complete your registration. Please review our{" "}
          <Link
            href="https://www.avax.network/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 dark:text-primary/90 dark:hover:text-primary/70 underline"
          >
            Avalanche Privacy Policy.
          </Link>
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Separator */}
        <div className="border-t border-border"></div>

        {/* Terms Content */}
        <div className="space-y-4">
          {/* First checkbox - Event Participation */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="event-terms"
              required
              // checked={isAccepted === true}
              // onCheckedChange={() => setIsAccepted(true)}
            />
            <div className="flex-1">
              <label htmlFor="event-terms" className="text-sm text-foreground cursor-pointer">
                I have read and agree to the Avalanche Privacy Policy{" "}
                <Link
                  href="https://www.avax.network/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 dark:text-primary/90 dark:hover:text-primary/70 underline"
                >
                  Terms and Conditions,
                </Link>
              </label>
            
            </div>
          </div>

          {/* Second checkbox - Email Notifications */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="email-notifications"
              // checked={isAccepted === true}
              // onCheckedChange={() => setIsAccepted(true)}
            />
            <div className="flex-1">
              <label htmlFor="email-notifications" className="text-sm text-foreground cursor-pointer">
                I wish to stay informed about Avalanche news and events.
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Subscribe to newsletters and promotional materials. You can opt out anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Separator */}
        <div className="border-t border-border"></div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-2">
        <div className="flex justify-between w-full gap-2">
        
          <Button 
            variant="default" 
            className="flex-1" 
            onClick={handleAccept}
            disabled={isAccepted === true || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Accept
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={handleDecline}
            disabled={isAccepted === false}
          >
            <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Decline
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};