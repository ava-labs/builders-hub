"use client";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import toast from "react-hot-toast";

const AmbasssadorDaoOnboardLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const { data: user, isLoading } = useFetchUserDataQuery();

  useEffect(() => {
    if (!isLoading && !user) {
      // Check if the error is due to token acquisition failure
      const tokenError = typeof window !== "undefined" 
        ? localStorage.getItem("t1_token_error") 
        : null;
      
      if (tokenError === "user_not_found") {
        // User doesn't exist in Ambassador DAO - stay on onboard page to create profile
        console.log("User not found in Ambassador DAO, staying on onboard page");
        return;
      } else if (tokenError === "server_error") {
        // Server error - redirect to home to avoid loop
        toast.error("Cannot connect to Ambassador DAO. Please try again later.");
        router.push("/");
      } else {
        // Normal case: user not authenticated, redirect to main ambassador-dao page
        router.push("/ambassador-dao");
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <FullScreenLoader />;
  }
  
  // Allow rendering even without user if error is user_not_found (to show onboarding form)
  const tokenError = typeof window !== "undefined" 
    ? localStorage.getItem("t1_token_error") 
    : null;
  
  return <main>{(user || tokenError === "user_not_found") && children}</main>;
};

export default AmbasssadorDaoOnboardLayout;
