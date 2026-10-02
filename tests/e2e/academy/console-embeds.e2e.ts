import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { CONSOLE_TOOL_MOUNTED as MOUNTED } from '../lib/console-tool';

// The heading of the requirements gate (components/toolbox/components/CheckRequirements.tsx).
const GATE_HEADING = 'To use this tool you need:';

interface LessonTool {
  route: string;
  lesson: string;
  /** The heading the user sees in the tool: the gate heading, or the tool title of a tool that needs no wallet. */
  tool: string;
}

// One page for each kind of tool.
const PAGES: LessonTool[] = [
  {
    // Faucet and CrossChainTransfer
    route: '/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/02a-claim-testnet-tokens',
    lesson: 'Claim Testnet Tokens',
    tool: GATE_HEADING,
  },
  {
    // DeployTokenHome
    route: '/academy/avalanche-l1/erc20-bridge/03-erc-20-to-erc-20-bridge/03-deploy-home',
    lesson: 'Deploy a Home Contract',
    tool: GATE_HEADING,
  },
  {
    // ICMRelayer and CreateManagedTestnetRelayer
    route: '/academy/avalanche-l1/interchain-messaging/04-icm-setup/04-relayer-setup',
    lesson: 'Relayer Setup',
    tool: GATE_HEADING,
  },
  {
    // QueryL1Details
    route: '/academy/avalanche-l1/permissioned-l1s/03-create-an-L1/05-query-l1-details',
    lesson: 'Query L1 Details',
    tool: 'Subnet Details',
  },
  {
    // AvalancheGoDocker and CreateManagedTestnetNode
    route: '/academy/avalanche-l1/avalanche-fundamentals/04-creating-an-l1/06-run-a-node',
    lesson: 'Set up Validator Nodes',
    tool: 'L1 Node Setup with Docker',
  },
];

describe('embedded console tools render without a wallet', () => {
  for (const page of PAGES) {
    test(`${page.lesson} lesson renders its tool`, async ({ app, screen, browser }) => {
      await app.open(page.route);
      await expect(screen.getByRole('heading', page.lesson, { level: 1 })).toBeVisible();

      await expect(browser.locator(MOUNTED).first()).toBeVisible();
      // A page can embed two gated tools, so the gate heading can show twice.
      await expect(screen.getByRole('heading', page.tool).first()).toBeVisible();
    });
  }
});
