"use client";

import { Container } from "@/components/toolbox/components/Container";
import DelegateERC20 from "@/components/toolbox/console/permissionless-l1s/delegate/DelegateERC20";

export default function DelegateERC20Page() {
    return (
        <Container
            title="Delegate to Validator (ERC20 Token)"
            description="Delegate ERC20 tokens to an existing validator on your L1"
        >
            <DelegateERC20 />
        </Container>
    );
}
