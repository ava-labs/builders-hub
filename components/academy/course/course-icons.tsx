import {
  Anvil,
  ArrowLeftRight,
  Binary,
  Coins,
  Cpu,
  HandCoins,
  SendHorizontal,
  Shield,
  Snowflake,
  UserPen,
  type LucideIcon,
} from 'lucide-react';

/**
 * Each of the 13 courses' own icon, by course id: the `icon` its folder's meta.json names
 * (content/academy/<slug>/meta.json), which the course dropdown showed before the part sub-nav (lib/source.ts resolves
 * it by Lucide name). Imported one by one, since the `icons` namespace pulls every Lucide icon into the client bundle.
 * tests/unit/academy/course-icons.test.ts pins the map to the files.
 */
export const COURSE_ICONS: Readonly<Record<string, LucideIcon>> = {
  'blockchain-fundamentals': Binary,
  'avalanche-fundamentals': Snowflake,
  'permissioned-l1s': UserPen,
  'l1-native-tokenomics': HandCoins,
  'permissionless-l1s': UserPen,
  'interchain-messaging': SendHorizontal,
  'erc20-bridge': ArrowLeftRight,
  'native-token-bridge': ArrowLeftRight,
  'customizing-evm': Cpu,
  'access-restriction': Shield,
  'intro-to-solidity': Anvil,
  'x402-payment-infrastructure': Coins,
  'encrypted-erc': SendHorizontal,
};
