"use client";

import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import DelegateValidator from './DelegateValidator';

const metadata: ConsoleToolMetadata = {
    title: "Delegate to Validator (Native Token)",
    description: "Delegate native tokens to an existing validator on your L1",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DelegateNative(props: BaseConsoleToolProps) {
    return <DelegateValidator {...props} tokenType="native" />;
}

export default withConsoleToolMetadata(DelegateNative, metadata);
