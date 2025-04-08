import { BookOpen, Terminal, Flag, Settings, Server } from 'lucide-react'
import { StepGroupListType, StepListType } from '../components/Steps'
import { lazy } from 'react'


export const stepGroups: StepGroupListType = {
    "welcome": {
        title: "Welcome",
        icon: BookOpen
    },
    "configure": {
        title: "Configure",
        icon: Settings
    },
    "launch-l1": {
        title: "Launch your L1",
        icon: Server
    },
    "initialize": {
        title: "Initialize",
        icon: Terminal
    },
    "whats-next": {
        title: "What's next?",
        icon: Flag
    },
}

export const stepList: StepListType = {
    "welcome": {
        title: "Welcome",
        component: lazy(() => import('./01_Welcome/Welcome')),
        group: "welcome",
    },
    "chain-parameters": {
        title: "Chain Parameters",
        component: lazy(() => import('./02_Configure/ChainParameters')),
        group: "configure",
    },
    "tokenomics": {
        title: "Tokenomics",
        component: lazy(() => import('./02_Configure/Tokenomics')),
        group: "configure",
    },
    "permissions": {
        title: "Permissions",
        component: lazy(() => import('./02_Configure/Permissions')),
        group: "configure",
    },
    "genesis": {
        title: "Create genesis",
        component: lazy(() => import('./02_Configure/Genesis')),
        group: "configure",
    },
    "prepare-validators": {
        title: "Prepare Validators",
        component: lazy(() => import('./03_Launch/PrepareValidators')),
        group: "launch-l1",
    },
    "fund-p-chain-wallet": {
        title: "Fund P-chain wallet",
        component: lazy(() => import('./03_Launch/FundPChainWallet')),
        group: "launch-l1",
    },
    "create-chain": {
        title: "Create chain",
        component: lazy(() => import('./03_Launch/CreateChain')),
        group: "launch-l1",
    },
    "launch-validators": {
        title: "Launch validators",
        component: lazy(() => import('./03_Launch/LaunchValidators')),
        group: "launch-l1",
    },
    "convert-to-l1": {
        title: "Convert to L1",
        component: lazy(() => import('./03_Launch/ConvertToL1')),
        group: "launch-l1",
    },
    "launch-rpc-node": {
        title: "Launch an RPC node",
        component: lazy(() => import('./03_Launch/LaunchRpcNode')),
        group: "launch-l1",
    },
    "open-rpc-port": {
        title: "Open RPC port",
        component: lazy(() => import('./03_Launch/OpenRPCPort')),
        group: "launch-l1",
    },
    "deploy-contracts": {
        title: "Deploy contracts",
        component: lazy(() => import('./04_Initialize/DeployContracts/DeployContracts')),
        group: "initialize",
    },
    "initialize-validator-manager": {
        title: "Initialize validator manager",
        component: lazy(() => import('./04_Initialize/InitializeValidatorManager/InitializeValidatorManager')),
        group: "initialize",
    },
    "whats-next": {
        title: "What's next?",
        component: lazy(() => import('./05_WhatsNext/WhatsNext')),
        group: "whats-next",
    }
}

