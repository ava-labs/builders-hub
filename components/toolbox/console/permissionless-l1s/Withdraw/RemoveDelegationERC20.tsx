"use client";

import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import RemoveDelegationBase from './RemoveDelegationBase';

const metadata: ConsoleToolMetadata = {
    title: "Remove Delegation (ERC20 Token)",
    description: "Remove your delegation from a validator with ERC20 token staking",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function RemoveDelegationERC20(props: BaseConsoleToolProps) {
    return <RemoveDelegationBase {...props} tokenType="erc20" />;
}

export default withConsoleToolMetadata(RemoveDelegationERC20, metadata);
