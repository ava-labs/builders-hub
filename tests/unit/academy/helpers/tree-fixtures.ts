import type { Folder, Item, Node, Root, Separator } from 'fumadocs-core/page-tree';

export const page = (url: string, name: string): Item => ({ type: 'page', name, url });
export const sep = (name?: string): Separator => ({ type: 'separator', name });
export const folder = (name: string, children: Node[], root = false): Folder => ({ type: 'folder', name, root, children });
export const tree = (...tracks: Folder[]): Root => ({ name: 'Academy', children: tracks });
export const track = (name: string, ...courses: Folder[]): Folder => folder(name, courses);

const L1 = '/academy/avalanche-l1';

/** Separators over extracted module folders, then "Course Completion" and get-certificate. */
export const fundamentals = folder('Avalanche Fundamentals', [
  page(`${L1}/avalanche-fundamentals`, 'Welcome to the Course'),
  sep('Primer on Avalanche Consensus'),
  page(`${L1}/avalanche-fundamentals/02-avalanche-consensus-intro/01-avalanche-consensus-intro`, 'Avalanche Consensus'),
  page(`${L1}/avalanche-fundamentals/02-avalanche-consensus-intro/02-consensus-mechanisms`, 'Consensus Mechanisms'),
  sep('Multi-Chain Architecture'),
  page(`${L1}/avalanche-fundamentals/03-multi-chain-architecture-intro/01-multi-chain-architecture`, 'Multi-Chain Architecture'),
  page(`${L1}/avalanche-fundamentals/03-multi-chain-architecture-intro/02-primary-network`, 'The Primary Network'),
  page(`${L1}/avalanche-fundamentals/03-multi-chain-architecture-intro/03-L1`, 'Avalanche L1s'),
  sep('Course Completion'),
  page(`${L1}/avalanche-fundamentals/get-certificate`, 'Course Completion Certificate'),
], true);

/** A plain folder module between separators, and a certificate with no completion heading. */
export const permissionless = folder('Permissionless L1s', [
  page(`${L1}/permissionless-l1s`, 'Welcome to the Course'),
  sep('Review'),
  page(`${L1}/permissionless-l1s/01-review/01-pchain-review`, 'P-Chain'),
  sep('Transformation Requirements'),
  page(`${L1}/permissionless-l1s/03-transformation-requirements/01-introduction`, 'Introduction'),
  folder('Permissioned L1 Setup', [
    page(`${L1}/permissionless-l1s/04-speedrun-base-l1/01-create-l1-speedrun`, 'Create Your L1'),
    page(`${L1}/permissionless-l1s/04-speedrun-base-l1/02-permissioned-l1-speedrun`, 'Permissioned L1 Speedrun'),
  ]),
  sep('Staking Manager Setup'),
  page(`${L1}/permissionless-l1s/05-staking-manager-setup/01-introduction`, 'Validator Manager Contract'),
  page(`${L1}/permissionless-l1s/certificate`, 'Course Completion Certificate'),
], true);

/** Nameless spacers, group headings without lessons and two certificate sections. */
export const accessRestriction = folder('Access Restriction', [
  page(`${L1}/access-restriction`, 'Welcome to the Course'),
  sep(),
  sep('📘 FUNDAMENTALS'),
  sep('Introduction'),
  page(`${L1}/access-restriction/01-introduction/01-introduction-to-precompiles`, 'Introduction to Precompiles'),
  sep('Fundamentals Certificate'),
  page(`${L1}/access-restriction/certificate-fundamentals`, 'Fundamentals Certificate'),
  sep(),
  sep('🔬 ADVANCED TOPICS'),
  sep('User Error'),
  page(`${L1}/access-restriction/04-user-error/01-remove-users-admin-wallet-from-precompiles`, 'Remove Users Admin Wallet'),
  page(`${L1}/access-restriction/04-user-error/02-test-for-error`, 'Test for Error'),
  sep('Advanced Certificate'),
  page(`${L1}/access-restriction/certificate-advanced`, 'Advanced Certificate'),
], true);

/** Two lessons before the first heading. */
export const tokenomics = folder('L1 Native Tokenomics', [
  page(`${L1}/l1-native-tokenomics`, 'Welcome to the Course'),
  page(`${L1}/l1-native-tokenomics/dappVsL1`, "Dapp's and L1's"),
  page(`${L1}/l1-native-tokenomics/token-ownership`, 'Token Ownership'),
  sep('Token Fundamentals'),
  page(`${L1}/l1-native-tokenomics/01-tokens-fundamentals/01-introduction`, 'Introduction'),
  sep('Course Completion'),
  page(`${L1}/l1-native-tokenomics/certificate`, 'Course Completion Certificate'),
], true);

/** A heading above the course index page. */
export const erc20 = folder('ERC20 Bridge', [
  sep('ERC20 Bridge'),
  page(`${L1}/erc20-bridge`, 'Welcome to the Course'),
  sep('Token Bridging'),
  page(`${L1}/erc20-bridge/01-token-bridging/01-bridge-intro`, 'Bridges'),
  sep('Course Completion'),
  page(`${L1}/erc20-bridge/certificate`, 'Course Completion Certificate'),
], true);

const ENT = '/academy/entrepreneur/foundations-web3-venture';

/** Entrepreneur modules numbered by their folders (X2). */
export const foundations = folder('Foundations', [
  page(ENT, 'Entrepreneur Academy'),
  sep('Legal Foundations'),
  page(`${ENT}/01-legal-foundations/01-module-1a`, 'Module 1A'),
  sep('Security Fundamentals'),
  page(`${ENT}/01b-security-fundamentals/01-module-1b`, 'Module 1B'),
  sep('Business Model Canvas'),
  page(`${ENT}/02-business-model-canvas/01-module-2`, 'Module 2'),
  sep('Level 1 Completion Certificate'),
  page(`${ENT}/certificate`, 'Course Completion Certificate'),
], true);

const T1 = '/academy/team1/team1-fundamentals';

/** Team1: no separators and no certificate. */
export const team1 = folder('Team1 Fundamentals', [
  page(T1, 'Welcome'),
  page(`${T1}/01-what-is-team1/01-what-is-team1`, 'What is Team1'),
  page(`${T1}/02-origins-from-ambassadors-to-team1/02-origins`, 'Origins'),
  page(`${T1}/quiz`, 'Quiz'),
], true);

/** What lib/page-tree-filter.ts leaves of another track's course: headings, no pages. */
export const skeleton = folder('Blockchain Fundamentals', [sep('What is a Blockchain?'), sep('Course Completion')], true);
