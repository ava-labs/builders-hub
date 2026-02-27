"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";

function CreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const blueprint = searchParams.get('blueprint');
  const useStore = useCreateChainStore();
  const setBlueprint = useStore((state) => state.setBlueprint);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (blueprint) {
      setBlueprint(blueprint);
      // Wait for Zustand persist to write to localStorage before redirecting
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setBlueprint(null);  // Clear any persisted blueprint so Testnet is default
      setIsReady(true);
    }
  }, [blueprint, setBlueprint]);

  useEffect(() => {
    if (isReady) {
      router.replace("/console/layer-1/create/create-subnet");
    }
  }, [isReady, router]);

  return null;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CreatePageContent />
    </Suspense>
  );
}
