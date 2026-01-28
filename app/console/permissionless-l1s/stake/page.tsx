"use client";

import { Container } from "@/components/toolbox/components/Container";
import Stake from "@/components/toolbox/console/permissionless-l1s/stake/Stake";

export default function StakePage() {
    return (
        <Container
            title="Stake Validator"
            description="Register and stake a new validator on your L1 with native or ERC20 tokens"
        >
            <Stake />
        </Container>
    );
}
