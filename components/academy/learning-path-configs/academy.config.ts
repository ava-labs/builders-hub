import type { DisciplineHue } from '@/lib/academy/discipline';

/**
 * The Academy programme on the single landing (/academy, FDE-155): the five parts, the three stages and the 13
 * courses of the former Avalanche L1 and Blockchain trees. Names, descriptions, slugs and dependencies are the two
 * old configs'; parts, stages and tree places are the design round's. No icons: the course overview's tile takes
 * its icon from lib/academy/course-discipline.ts. Team1 keeps team1.config.ts.
 */

export type AcademyPartId = 'fundamentals' | 'l1-development' | 'interoperability' | 'vm-customization' | 'applications';
export type AcademyStageId = 'foundations' | 'core' | 'advanced';

export interface AcademyPart {
  id: AcademyPartId;
  name: string;
  /** The part's hue on the tree and stage dots and on the course overview tile; null draws ink. */
  hue: DisciplineHue | null;
}

export interface AcademyStage {
  id: AcademyStageId;
  name: string;
}

export interface AcademyCourse {
  id: string;
  name: string;
  description: string;
  /** "<track>/<course folder>": the course url stays /academy/<slug>. */
  slug: string;
  part: AcademyPartId;
  stage: AcademyStageId;
  /** The courses to take first, by id; two make a join ("After ... and ..."). */
  dependencies: readonly string[];
  /** Its card on the merged tree: the centre in % of the width (six columns), and the row from the top. */
  tree: { x: number; row: number };
}

export const ACADEMY_PARTS: readonly AcademyPart[] = [
  { id: 'fundamentals', name: 'Fundamentals', hue: null },
  { id: 'l1-development', name: 'L1 Development', hue: 'emerald' },
  { id: 'interoperability', name: 'Interoperability', hue: 'purple' },
  { id: 'vm-customization', name: 'VM Customization', hue: 'blue' },
  { id: 'applications', name: 'Applications', hue: 'gold' },
];

export const ACADEMY_STAGES: readonly AcademyStage[] = [
  { id: 'foundations', name: 'Foundations' },
  { id: 'core', name: 'Core' },
  { id: 'advanced', name: 'Advanced' },
];

/** The spotlight's course, and the course offered to newcomers before it. */
export const START_COURSE_ID = 'avalanche-fundamentals';
export const NEWCOMER_COURSE_ID = 'blockchain-fundamentals';

/** The 13 courses in reading order: the parts in order, then each part's own order. The numbers follow it. */
export const ACADEMY_COURSES: readonly AcademyCourse[] = [
  {
    id: 'avalanche-fundamentals',
    name: 'Avalanche Fundamentals',
    description: 'Learn about Avalanche Consensus, Multi-Chain Architecture, and VMs',
    slug: 'avalanche-l1/avalanche-fundamentals',
    part: 'fundamentals',
    stage: 'foundations',
    dependencies: [],
    tree: { x: 33.333, row: 0 },
  },
  {
    id: 'blockchain-fundamentals',
    name: 'Blockchain Fundamentals',
    description: 'Start here to learn about blockchain and solidity basics',
    slug: 'blockchain/blockchain-fundamentals',
    part: 'fundamentals',
    stage: 'foundations',
    dependencies: [],
    tree: { x: 83.333, row: 0 },
  },
  {
    id: 'permissioned-l1s',
    name: 'Permissioned L1s',
    description: 'Create and manage permissioned blockchains with Proof of Authority',
    slug: 'avalanche-l1/permissioned-l1s',
    part: 'l1-development',
    stage: 'core',
    dependencies: ['avalanche-fundamentals'],
    tree: { x: 8.333, row: 1 },
  },
  {
    id: 'l1-native-tokenomics',
    name: 'L1 Native Tokenomics',
    description: 'Design L1 economics with custom token, native minting rights and transaction fees',
    slug: 'avalanche-l1/l1-native-tokenomics',
    part: 'l1-development',
    stage: 'core',
    dependencies: ['avalanche-fundamentals'],
    tree: { x: 25, row: 1 },
  },
  {
    id: 'permissionless-l1s',
    name: 'Permissionless L1s',
    description: 'Create and manage permissionless blockchains with Proof of Stake',
    slug: 'avalanche-l1/permissionless-l1s',
    part: 'l1-development',
    stage: 'advanced',
    dependencies: ['permissioned-l1s', 'l1-native-tokenomics'],
    tree: { x: 16.667, row: 2 },
  },
  {
    id: 'interchain-messaging',
    name: 'Interchain Messaging',
    description: "Build apps leveraging Avalanche's Interchain Messaging",
    slug: 'avalanche-l1/interchain-messaging',
    part: 'interoperability',
    stage: 'core',
    dependencies: ['avalanche-fundamentals'],
    tree: { x: 41.667, row: 1 },
  },
  {
    id: 'erc20-bridge',
    name: 'ERC20 Bridge',
    description: 'Bridge ERC20 tokens between chains using Interchain Token Transfer',
    slug: 'avalanche-l1/erc20-bridge',
    part: 'interoperability',
    stage: 'advanced',
    dependencies: ['interchain-messaging'],
    tree: { x: 41.667, row: 2 },
  },
  {
    id: 'native-token-bridge',
    name: 'Native Token Bridge',
    description: 'Build a cross-chain L1 with native tokenomics and token bridging',
    slug: 'avalanche-l1/native-token-bridge',
    part: 'interoperability',
    stage: 'advanced',
    dependencies: ['l1-native-tokenomics', 'erc20-bridge'],
    tree: { x: 33.333, row: 3 },
  },
  {
    id: 'customizing-evm',
    name: 'Customizing the EVM',
    description: 'Add custom precompiles and configure the EVM',
    slug: 'avalanche-l1/customizing-evm',
    part: 'vm-customization',
    stage: 'core',
    dependencies: ['avalanche-fundamentals'],
    tree: { x: 58.333, row: 1 },
  },
  {
    id: 'access-restriction',
    name: 'Access Restriction',
    description: 'Master access control patterns using transaction and contract deployer allowlists with hands-on precompile implementation',
    slug: 'avalanche-l1/access-restriction',
    part: 'vm-customization',
    stage: 'advanced',
    dependencies: ['customizing-evm'],
    tree: { x: 58.333, row: 2 },
  },
  {
    id: 'intro-to-solidity',
    name: 'Intro to Solidity',
    description: 'Start here to learn about Solidity basics with Foundry',
    slug: 'blockchain/solidity-foundry',
    part: 'applications',
    stage: 'foundations',
    dependencies: ['blockchain-fundamentals'],
    tree: { x: 83.333, row: 1 },
  },
  {
    id: 'x402-payment-infrastructure',
    name: 'x402 Payments',
    description: 'Instant & permissionless HTTP-native payments on Avalanche',
    slug: 'blockchain/x402-payment-infrastructure',
    part: 'applications',
    stage: 'core',
    dependencies: ['intro-to-solidity'],
    tree: { x: 75, row: 2 },
  },
  {
    id: 'encrypted-erc',
    name: 'Encrypted ERC',
    description: 'Learn about eERC tokens to add privacy to your applications',
    slug: 'blockchain/encrypted-erc',
    part: 'applications',
    stage: 'core',
    dependencies: ['intro-to-solidity'],
    tree: { x: 91.667, row: 2 },
  },
];
