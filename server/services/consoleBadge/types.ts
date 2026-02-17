export type ConsoleOperationType = 'console_log' | 'faucet_claim' | 'node_registration';

export interface BadgeEvaluationContext {
  timezone?: string;
}

export interface ConsoleBadgeDefinition {
  name: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  description: string;
  imagePath: string;
  triggeredBy: ConsoleOperationType[];
  evaluate: (userId: string, context?: BadgeEvaluationContext) => Promise<boolean>;
  requirementDescription: string;
}

export interface AwardedConsoleBadge {
  name: string;
  tier: string;
  description: string;
  imagePath: string;
  requirementDescription: string;
}

export const CONSOLE_BADGE_NAMES = {
  FIRST_BLOOD: 'First Blood',
  RECRUIT: 'Recruit',
  FUNDED: 'Funded',
  SERIAL_DEPLOYER: 'Serial Deployer',
  RASCAL: 'Rascal',
  CONTRACT_FACTORY: 'Contract Factory',
  NODE_RUNNER: 'Node Runner',
  VALIDATOR_WRANGLER: 'Validator Wrangler',
  CHAIN_LORD: 'Chain Lord',
  WHALE: 'Whale',
  FULL_STACK: 'Full Stack',
  NUKE: 'Nuke',
  SPEED_DEMON: 'Speed Demon',
  NIGHT_OWL: 'Night Owl',
  OOPS: 'Oops',
} as const;

export const FULL_STACK_REQUIRED_PATTERNS = [
  'chain_created',
  '/deploy/',
  'validator_registered',
] as const;
