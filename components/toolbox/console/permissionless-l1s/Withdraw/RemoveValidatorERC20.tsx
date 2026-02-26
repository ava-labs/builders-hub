"use client";

import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import RemoveValidatorBase from './RemoveValidatorBase';

const metadata: ConsoleToolMetadata = {
    title: "Remove Validator (ERC20 Token)",
    description: "Remove a validator from your L1 with ERC20 token staking",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function RemoveValidatorERC20(props: BaseConsoleToolProps) {
    return <RemoveValidatorBase {...props} tokenType="erc20" />;
}

export default withConsoleToolMetadata(RemoveValidatorERC20, metadata);
