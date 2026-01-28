"use client";

import { Container } from "@/components/toolbox/components/Container";
import Delegate from "@/components/toolbox/console/permissionless-l1s/delegate/Delegate";

export default function DelegatePage() {
    return (
        <Container
            title="Delegate to Validator"
            description="Delegate tokens to an existing validator on your L1 with native or ERC20 tokens"
        >
            <Delegate />
        </Container>
    );
}
