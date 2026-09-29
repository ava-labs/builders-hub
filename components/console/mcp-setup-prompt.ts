// Markdown prompt that the Console home copies. The user pastes it into any
// AI agent, and the agent installs the Avalanche MCP server itself. Keep the
// client configs in sync with content/docs/tooling/ai-llm/mcp-server.mdx.
export const MCP_SETUP_PROMPT = `# Install the Avalanche MCP server

The Avalanche MCP server gives you read-only tools for Avalanche docs, RPC methods, and public network data.

## Server

- Name: \`avalanche-mcp\`
- Transport: Streamable HTTP
- URL: \`https://build.avax.network/api/mcp\`
- Docs: https://build.avax.network/docs/tooling/ai-llm/mcp-server

## Instructions

1. Find out which AI client you run in.
2. Add the server to that client. Use the config for your client below.
3. If the client must restart to load the server, tell the user.
4. Check the install. Call the \`docs_search\` tool with the query \`create an L1\`. Report the result to the user.

### Claude Code

Run this command:

\`\`\`bash
claude mcp add avalanche-mcp --transport http https://build.avax.network/api/mcp
\`\`\`

### Claude Desktop

Add this to \`~/Library/Application Support/Claude/claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "avalanche-mcp": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://build.avax.network/api/mcp"]
    }
  }
}
\`\`\`

Claude Desktop does not support HTTP MCP servers natively. \`mcp-remote\` connects stdio to the HTTP endpoint. Node.js must be installed. Tell the user to restart Claude Desktop.

### Other clients

Add a remote MCP server with the name and URL above. Use the MCP config format of your client. If you do not know the format, read the client's own documentation. Do not guess a config path.
`;
