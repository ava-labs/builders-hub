// Base requirement action types
type ActionType = 'redirect' | 'connect' | 'faucet' | 'network' | 'conditional' | 'login';

export interface BaseAction {
    type: ActionType;
    label: string;
    title: string;
    description: string;
}

export interface RedirectAction extends BaseAction {
    type: 'redirect';
    link: string;
    target?: string;
}

export interface ConnectAction extends BaseAction {
    type: 'connect';
}

export interface NetworkAction extends BaseAction {
    type: 'network';
}

export interface LoginAction extends BaseAction {
    type: 'login';
}

export interface ConditionalAction extends BaseAction {
    type: 'conditional';
    conditions: {
        condition: (state: any) => boolean;
        action: RedirectAction | ConnectAction | NetworkAction | LoginAction;
    }[];
    fallback?: RedirectAction | ConnectAction | NetworkAction | LoginAction;
}

export type RequirementAction = RedirectAction | ConnectAction | NetworkAction | ConditionalAction | LoginAction;

// Requirement output interface (generic, used by both wallet and account requirements)
export interface Requirement {
    id: string;
    title: string;
    description: string;
    icon: any;
    met: boolean;
    waiting: boolean;
    prerequisiteNotMet?: string; // Generic string to support both wallet and account requirement keys
    action: RequirementAction | null;
    alternativeActions?: RequirementAction[];
}

