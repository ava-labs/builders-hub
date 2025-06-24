# Contributing to Integrations

This guide explains how to add new integrations to the Avalanche documentation.

## Quick Start

To add a new integration, create a new `.mdx` file in the `content/integrations/` directory following the structure outlined below.

## File Structure

### 1. File Naming
- Use lowercase with hyphens: `your-integration-name.mdx`
- Example: `openfort.mdx`, `chainlink.mdx`, `metamask.mdx`

### 2. Frontmatter Requirements

Every integration file must start with frontmatter containing the following fields:

```yaml
---
title: "Your Integration Name"
category: ["Category Name"]
available: ["C-Chain", "All EVM L1s"]
description: "Brief description of what your integration does"
logo: /images/your-logo.png
developer: "Developer/Company Name"
website: https://your-website.com
documentation: https://your-docs.com
---
```

#### Field Descriptions:

- **title**: The display name of your integration
- **category**: Array of categories (e.g., `["DeFi"]`, `["Account Abstraction"]`, `["Oracles"]`)
  - If your category doesn't exist, it will be automatically created
- **available**: Which Avalanche networks support this integration
  - Options: `"C-Chain"`, `"Subnet"`, `"All EVM L1s"`, `"Fuji Testnet"`
- **description**: A concise description of the integration's purpose
- **logo**: Path to your logo image (place in `/public/images/`)
- **developer**: Name of the company or developer
- **website**: Main website URL
- **documentation**: Link to technical documentation

## Content Structure

### 1. Overview Section
Start with an `## Overview` section that explains:
- What your integration does
- Key features and benefits
- Any sub-products or components

### 2. Getting Started Section
Include a `## Getting Started` section with:
- Installation instructions
- Basic configuration
- Simple implementation example

### 3. Code Examples
- Use proper syntax highlighting for code blocks
- Include both client-side and server-side examples where applicable
- Show Avalanche-specific configurations (Chain ID: 43114 for C-Chain)

### 4. Documentation Link
End with a link to your full documentation.

## Categories

Common categories include:
- **DeFi**: Decentralized Finance protocols
- **Account Abstraction**: Wallet and account management
- **Oracles**: Data feeds and external data
- **Infrastructure**: Development tools and services  
- **NFT**: Non-fungible token platforms
- **Analytics**: Data analysis and monitoring
- **Security**: Auditing and security tools

Don't worry if your category doesn't exist - the system will automatically create new categories as needed.

## Example Template

```mdx
---
title: "Your Integration"
category: ["Your Category"]
available: ["C-Chain"]
description: "What your integration does in one sentence."
logo: /images/your-logo.png
developer: "Your Company"
website: https://your-site.com
documentation: https://docs.your-site.com
---

## Overview
[Your Integration](https://your-site.com) provides [brief description of what it does and why it's useful for Avalanche developers].

Key features include:
- **Feature 1**: Description
- **Feature 2**: Description
- **Feature 3**: Description

## Getting Started

### 1. Installation

```bash
npm install your-package
```

### 2. Configuration

```typescript
// Basic setup example
const client = new YourClient({
  apiKey: "YOUR_API_KEY",
  chainId: 43114 // Avalanche C-Chain
});
```

### 3. Basic Usage

```typescript
// Show how to use with Avalanche
const result = await client.someMethod({
  // Avalanche-specific parameters
});
```

## Documentation
For detailed guides and API references, visit [Your Documentation](https://docs.your-site.com)
```

## Submission Process

1. Create your `.mdx` file following the structure above
2. Add your logo to `/public/images/`
3. Test locally to ensure proper formatting
4. Submit a pull request with your integration

## Tips

- Keep descriptions concise but informative
- Include working code examples
- Make sure your logo is optimized for web (PNG/SVG preferred)
- Test all links before submitting
- Follow the existing style and tone of other integrations

## Need Help?

If you have questions about contributing an integration, feel free to reach out to the Avalanche documentation team.
