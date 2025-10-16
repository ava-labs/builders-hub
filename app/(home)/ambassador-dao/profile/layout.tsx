"use client";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

const AmbasssadorDaoProfileLayout = ({
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
        // User doesn't exist in Ambassador DAO - redirect to onboarding
        router.push("/ambassador-dao/onboard");
      } else if (tokenError === "server_error") {
        // Server error - redirect to home to avoid loop
        router.push("/");
      } else {
        // Normal case: user not authenticated
        router.push("/ambassador-dao");
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <FullScreenLoader />;
  }
  return <main>{user && children}</main>;
};

export default AmbasssadorDaoProfileLayout;
