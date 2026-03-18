"use client";

import { WalletRequirementsConfigKey } from '@/components/toolbox/hooks/useWalletRequirements';
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import DelegateValidator from './DelegateValidator';

const metadata: ConsoleToolMetadata = {
    title: "Delegate to Validator (ERC20 Token)",
    description: "Delegate ERC20 tokens to an existing validator on your L1",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function DelegateERC20(props: BaseConsoleToolProps) {
    return <DelegateValidator {...props} tokenType="erc20" />;
}

export default withConsoleToolMetadata(DelegateERC20, metadata);
