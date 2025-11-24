---
title: Publish your integration
description: README guide for adding yourself to the integrations page
category: "null"
---
# Contributing to Avalanche Integrations

Welcome! This guide will help you add your integration to the [Avalanche Integrations page](https://build.avax.network/integrations).

## Quick Start

1. Create a new `.mdx` file in this directory
2. Follow the template structure below
3. Add your logo to `/public/images/`
4. Submit a pull request

## File Structure

### Naming Convention
Use lowercase with hyphens for your filename:
- ✅ `your-integration.mdx`
- ✅ `awesome-protocol.mdx`
- ❌ `YourIntegration.mdx`
- ❌ `your_integration.mdx`

### Frontmatter (Required)

Every integration must include frontmatter with these fields:

```yaml
---
title: Your Integration Name
category: Category Name
available: ["C-Chain"]
description: "Brief one-sentence description of what your integration does."
logo: /images/your-logo.png
developer: Your Company Name
website: https://yourwebsite.com/
documentation: https://docs.yourwebsite.com/
---
```

#### Field Details

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | Display name of your integration | `"Chainlink"` |
| `category` | string | Category (see list below) | `"Oracles"` |
| `available` | array | Supported networks | `["C-Chain"]`, `["C-Chain", "All Avalanche L1s"]` |
| `description` | string | One-sentence overview | `"Decentralized oracle network providing reliable data feeds."` |
| `logo` | string | Path to logo in `/public/images/` | `/images/chainlink.png` |
| `developer` | string | Company or developer name | `"Chainlink Labs"` |
| `website` | string | Main website URL | `https://chain.link/` |
| `documentation` | string | Docs URL | `https://docs.chain.link/` |

### Optional Frontmatter Fields

```yaml
featured: true  # Set to true to appear in Featured section (requires approval)
```

## Categories

Choose the most appropriate category for your integration:

### Infrastructure & Development
- **RPC Providers** - Blockchain node infrastructure and API services
- **Indexers** - Blockchain data indexing and querying
- **Oracles** - External data feeds and price information
- **Developer Tools** - SDKs, frameworks, and development utilities

### DeFi & Trading
- **DEX Liquidity** - Decentralized exchanges and liquidity protocols
- **Lending Protocols** - Lending, borrowing, and money markets
- **DeFi** - Other DeFi protocols and financial primitives

### Identity & Compliance
- **KYC / Identity Verification** - KYC/KYB providers and identity solutions
- **Account Abstraction** - Smart account and wallet solutions

### Security & Auditing
- **Security Audits** - Smart contract auditing services
- **Security** - Security tools and monitoring

### Other Categories
- **Analytics** - On-chain analytics and dashboards
- **NFT** - NFT platforms and tooling
- **Wallets** - Cryptocurrency wallets
- **Bridges** - Cross-chain bridges
- **Payments** - Payment processing and fiat on/off ramps

*Don't see your category? New categories are automatically created when needed.*

## Content Structure

Your integration page should include these sections:

### 1. Overview (Required)
Explain what your integration does and why it's valuable for Avalanche developers.

```markdown
## Overview

[Your Integration] is a [type of service] that provides [main functionality]. 
Built on Avalanche's C-Chain, it enables developers to [key benefits].
```

### 2. Features (Required)
List key features using bullet points:

```markdown
## Features

- **Feature Name**: Brief description of the feature
- **Another Feature**: What it does and why it matters
- **Third Feature**: Benefits for Avalanche developers
```

### 3. Getting Started (Optional but Recommended)
*Note: For simple integrations without code examples, you can skip this section and just provide a Documentation link.*

If including Getting Started:
- Keep it simple and focused
- Show Avalanche-specific configuration
- Include working code examples

```markdown
## Getting Started

To begin using [Your Integration]:

1. **Sign Up**: Create an account at [your website]
2. **Get API Key**: Obtain your API credentials
3. **Configure**: Set up for Avalanche C-Chain
```

### 4. Documentation (Required)
Link to your full documentation:

```markdown
## Documentation

For detailed guides and API references, visit the [Your Integration Documentation](https://docs.yoursite.com/).
```

### 5. Use Cases (Recommended)
Show practical applications:

```markdown
## Use Cases

[Your Integration] serves various needs:

- **Use Case 1**: Description of how it's used
- **Use Case 2**: Another practical application
- **Use Case 3**: Additional scenarios
```

### 6. Conclusion (Recommended)
Brief closing statement:

```markdown
## Conclusion

[Your Integration] provides [summary of value] for blockchain applications on Avalanche, 
offering [key differentiators].
```

## Complete Example

```mdx
---
title: Example Protocol
category: DeFi
available: ["C-Chain", "All Avalanche L1s"]
description: "Example Protocol provides decentralized lending and borrowing on Avalanche with competitive rates."
logo: /images/example-protocol.png
developer: Example Labs
website: https://example.protocol/
documentation: https://docs.example.protocol/
---

## Overview

Example Protocol is a decentralized lending platform on Avalanche that enables users to lend 
and borrow crypto assets with competitive interest rates. Built specifically for Avalanche's 
high-performance infrastructure, it provides efficient DeFi services with low transaction costs.

## Features

- **Lending Markets**: Supply crypto assets to earn interest
- **Borrowing**: Borrow against collateral with flexible terms
- **Multi-Asset Support**: Support for major cryptocurrencies and stablecoins
- **Low Fees**: Benefit from Avalanche's low transaction costs
- **High Performance**: Fast transaction confirmation on Avalanche C-Chain

## Documentation

For integration guides and API documentation, visit the [Example Protocol Documentation](https://docs.example.protocol/).

## Use Cases

Example Protocol serves various DeFi needs:

- **Yield Generation**: Earn passive income by lending crypto assets
- **Liquidity Access**: Borrow without selling your holdings
- **Portfolio Management**: Efficient asset management with lending/borrowing

## Conclusion

Example Protocol brings efficient DeFi lending to Avalanche, offering users competitive rates 
and reliable service powered by Avalanche's fast, low-cost infrastructure.
```

## Logo Guidelines

### File Format
- **Preferred**: PNG or SVG
- **Size**: 200x200px recommended (will be displayed at 40x40px)
- **Background**: Transparent or solid color

### File Naming
- Use lowercase with hyphens: `your-integration.png`
- Match your MDX filename: `example-protocol.mdx` → `example-protocol.png`

### Location
Place your logo in `/public/images/` directory.

## Code Examples (When Applicable)

If your integration requires code, follow these guidelines:

### Use Avalanche-Specific Values

```typescript
// ✅ Good - Shows Avalanche configuration
const provider = new Provider({
  chainId: 43114, // Avalanche C-Chain
  rpcUrl: "https://api.avax.network/ext/bc/C/rpc"
});
```

```typescript
// ❌ Bad - Generic example
const provider = new Provider({
  chainId: 1, // Ethereum
});
```

### Keep It Simple

```typescript
// ✅ Good - Clear and focused
import { YourSDK } from 'your-sdk';

const client = new YourSDK({
  apiKey: process.env.API_KEY,
  network: 'avalanche'
});

const result = await client.query({ /* ... */ });
```

```typescript
// ❌ Bad - Too complex for getting started
// Multiple files, complex error handling, etc.
```

## Submission Process

### 1. Prepare Your Files
- [ ] Create `.mdx` file in `/content/integrations/`
- [ ] Add logo to `/public/images/`
- [ ] Test locally with `yarn dev`

### 2. Test Locally
```bash
yarn dev
```
Visit `http://localhost:3000/integrations` to preview your integration.

### 3. Submit Pull Request
- Fork the [builders-hub repository](https://github.com/ava-labs/builders-hub)
- Create a new branch: `git checkout -b add-your-integration`
- Commit your changes: `git commit -m "Add Your Integration"`
- Push to your fork: `git push origin add-your-integration`
- Open a Pull Request

### 4. PR Checklist
- [ ] MDX file follows the template structure
- [ ] All required frontmatter fields are filled
- [ ] Logo is added to `/public/images/`
- [ ] All links are tested and working
- [ ] Content is proofread and formatted
- [ ] No code examples include placeholder/dummy code

## Style Guidelines

### Writing Style
- **Concise**: Keep descriptions brief and scannable
- **Professional**: Maintain a professional, technical tone
- **Avalanche-Focused**: Emphasize Avalanche-specific benefits
- **Consistent**: Follow the style of existing integrations

### Formatting
- Use proper Markdown/MDX syntax
- Include line breaks between sections
- Use bullet points for lists
- Use bold for emphasis: `**Important**`
- Use code blocks for technical content

### Common Mistakes to Avoid

❌ **Don't**:
- Include sales/marketing language
- Use excessive superlatives ("best ever", "revolutionary")
- Include contact information in the content (only in frontmatter)
- Add instructions or code examples for simple reference integrations
- Use placeholder text like "coming soon"

✅ **Do**:
- Focus on technical capabilities
- Provide accurate, factual information
- Include working examples when applicable
- Link to official documentation
- Keep descriptions professional

## Need Help?

- **Questions?** Open an issue on [GitHub](https://github.com/ava-labs/builders-hub/issues)
- **Technical Issues?** Check existing integrations for reference
- **Style Questions?** Review [similar integrations](https://github.com/ava-labs/builders-hub/tree/master/content/integrations)

## Additional Resources

- [Builders Hub Repository](https://github.com/ava-labs/builders-hub)
- [Avalanche Documentation](https://docs.avax.network/)
- [MDX Documentation](https://mdxjs.com/)

---

**Thank you for contributing to the Avalanche ecosystem!** 🔺

