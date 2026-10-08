// The mount signals of a Console tool: the tool chrome (components/toolbox/components/Container.tsx),
// the requirements gate a tool shows without a wallet (CheckRequirements.tsx), or a step flow
// (components/console/step-flow.tsx). A page that embeds a tool shows at least one.
export const CONSOLE_TOOL_MOUNTED = '[data-console-tool], [data-console-tool-gate], [data-console-flow]';
