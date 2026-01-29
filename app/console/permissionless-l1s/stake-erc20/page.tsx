"use client";

import { Container } from "@/components/toolbox/components/Container";
import StakeERC20 from "@/components/toolbox/console/permissionless-l1s/stake/StakeERC20";

export default function StakeERC20Page() {
    return (
        <Container
            title="Stake Validator (ERC20 Token)"
            description="Register and stake a new validator on your L1 with ERC20 tokens"
        >
            <StakeERC20 />
        </Container>
    );
}
