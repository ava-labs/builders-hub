"use client";

import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import StakeValidator from './StakeValidator';

const metadata: ConsoleToolMetadata = {
    title: "Stake Validator (ERC20 Token)",
    description: "Register and stake a new validator on your L1 with ERC20 tokens",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function StakeERC20(props: BaseConsoleToolProps) {
    return <StakeValidator {...props} tokenType="erc20" />;
}

export default withConsoleToolMetadata(StakeERC20, metadata);
