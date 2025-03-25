"use client";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import toast from "react-hot-toast";

const GoogleCallbackRedirectPage = () => {
  const { data, isLoading } = useFetchUserDataQuery();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !data) {
      toast.error("Error Authenticating");
      router.push("/ambassador-dao");
    } else if (!isLoading && data) {
      if (!data.role || !data.first_name || !data.username) {
        router.push("/ambassador-dao/onboard");
      } else {
        if (data.role === "SPONSOR") {
          router.push("/ambassador-dao/sponsor");
        } else {
          router.push("/ambassador-dao/jobs");
        }
      }
    }
  }, [data, isLoading, router]);

  if (isLoading) {
    return <FullScreenLoader />;
  }
  return <FullScreenLoader />;
};

export default GoogleCallbackRedirectPage;
