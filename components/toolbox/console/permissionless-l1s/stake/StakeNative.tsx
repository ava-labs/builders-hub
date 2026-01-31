"use client";

import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import StakeValidator from './StakeValidator';

const metadata: ConsoleToolMetadata = {
    title: "Stake Validator (Native Token)",
    description: "Register and stake a new validator on your L1 with native tokens",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function StakeNative(props: BaseConsoleToolProps) {
    return <StakeValidator {...props} tokenType="native" />;
}

export default withConsoleToolMetadata(StakeNative, metadata);
