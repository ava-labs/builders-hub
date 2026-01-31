"use client";

import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import RemoveValidatorBase from './RemoveValidatorBase';

const metadata: ConsoleToolMetadata = {
    title: "Remove Validator (Native Token)",
    description: "Remove a validator from your L1 with native token staking",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function RemoveValidatorNative(props: BaseConsoleToolProps) {
    return <RemoveValidatorBase {...props} tokenType="native" />;
}

export default withConsoleToolMetadata(RemoveValidatorNative, metadata);
