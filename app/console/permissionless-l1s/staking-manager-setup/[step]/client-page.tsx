"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StakingManagerSetupClientPage({ currentStepKey }: { currentStepKey: string }) {
    const router = useRouter();

    useEffect(() => {
        router.replace("/console/permissionless-l1s/native-staking-manager-setup");
    }, [router]);

    return null;
}
