"use client";

import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import RemoveDelegationBase from './RemoveDelegationBase';

const metadata: ConsoleToolMetadata = {
    title: "Remove Delegation (Native Token)",
    description: "Remove your delegation from a validator with native token staking",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function RemoveDelegationNative(props: BaseConsoleToolProps) {
    return <RemoveDelegationBase {...props} tokenType="native" />;
}

export default withConsoleToolMetadata(RemoveDelegationNative, metadata);
