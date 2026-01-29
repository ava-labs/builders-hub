"use client";

import { Container } from "@/components/toolbox/components/Container";
import StakeNative from "@/components/toolbox/console/permissionless-l1s/stake/StakeNative";

export default function StakeNativePage() {
    return (
        <Container
            title="Stake Validator (Native Token)"
            description="Register and stake a new validator on your L1 with native tokens"
        >
            <StakeNative />
        </Container>
    );
}
