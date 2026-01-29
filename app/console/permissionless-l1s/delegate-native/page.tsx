"use client";

import { Container } from "@/components/toolbox/components/Container";
import DelegateNative from "@/components/toolbox/console/permissionless-l1s/delegate/DelegateNative";

export default function DelegateNativePage() {
    return (
        <Container
            title="Delegate to Validator (Native Token)"
            description="Delegate native tokens to an existing validator on your L1"
        >
            <DelegateNative />
        </Container>
    );
}
