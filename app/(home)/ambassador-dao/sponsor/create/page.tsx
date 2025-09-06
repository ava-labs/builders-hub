"use client";
import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import AmbasssadorDaoSponsorsCreateListing from "@/components/ambassador-dao/sections/create-listing";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import toast from "react-hot-toast";
import "@mdxeditor/editor/style.css";

function SearchParamsWrapper() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type");

  if (!type) {
    toast.error("Something went wrong, please try again.");
    router.push("/ambassador-dao/sponsor/listings");
    return null;
  }

  const { data: user, isLoading } = useFetchUserDataQuery();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/ambassador-dao");
    } else if (user && user.role !== "SPONSOR") {
      router.push("/ambassador-dao");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return (
    <>
      {user && (
        <AmbasssadorDaoSponsorsCreateListing type={type as "JOB" | "BOUNTY"} />
      )}
    </>
  );
}

export default function AmbasssadorDaoSponsorsCreateListingPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <SearchParamsWrapper />
    </Suspense>
  );
}
