import FullScreenLoader from "@/components/ambassador-dao/full-screen-loader";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

const AmbasssadorDaoSponsorsLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const { data: user, isLoading } = useFetchUserDataQuery();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/ambassador-dao");
    } else if (user && user.role !== "SPONSOR") {
      router.push("/ambassador-dao/jobs");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <FullScreenLoader />;
  }
  return <main>{user && children}</main>;
};

export default AmbasssadorDaoSponsorsLayout;
