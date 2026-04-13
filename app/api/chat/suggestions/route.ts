import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';

const suggestionsSchema = z.object({
  message: z.string().min(1),
});

async function loadLLMsContent() {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

    const url = new URL('/llms-full.txt', baseUrl);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch documentation: ${response.status} ${response.statusText}`);
    }

    const llmsContent = await response.text();

    const sections = llmsContent.split('\n\n').filter((section) => section.trim());

    const contentSections = sections
      .map((section) => {
        const lines = section.split('\n');
        const titleLine = lines.find((line) => line.startsWith('# '));
        const urlLine = lines.find((line) => line.startsWith('URL: '));

        return {
          title: titleLine ? titleLine.replace('# ', '') : '',
          url: urlLine ? urlLine.replace('URL: ', '') : '',
          content: section,
        };
      })
      .filter((s) => s.title && s.url);

    return contentSections;
  } catch {
    return [];
  }
}

function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();

  const technicalTerms = [
    'deploy',
    'create',
    'build',
    'install',
    'setup',
    'configure',
    'avalanche',
    'subnet',
    'l1',
    'chain',
    'contract',
    'token',
    'wallet',
    'node',
    'validator',
    'stake',
    'delegate',
    'teleporter',
    'icm',
    'ictt',
    'evm',
    'rpc',
    'api',
    'endpoint',
    'network',
    'testnet',
    'mainnet',
    'bridge',
    'cross-chain',
    'interchain',
    'message',
    'transfer',
    'precompile',
    'native',
    'minter',
    'fee',
    'reward',
    'warp',
  ];

  const textLower = text.toLowerCase();

  technicalTerms.forEach((term) => {
    if (textLower.includes(term)) {
      keywords.add(term);
    }
  });

  const urlMatches = text.match(/https:\/\/build\.avax\.network\/([^)\s]+)/g);
  if (urlMatches) {
    urlMatches.forEach((url) => {
      const pathParts = url.split('/').slice(3);
      pathParts.forEach((part) => {
        if (part && part.length > 3) {
          keywords.add(part.replace(/-/g, ' '));
        }
      });
    });
  }

  return Array.from(keywords);
}

function generateSuggestionsFromContent(
  keywords: string[],
  sections: Array<{ title: string; url: string; content: string }>,
): string[] {
  const suggestions: string[] = [];
  const usedTopics = new Set<string>();

  const relatedSections = sections
    .filter((section) => {
      const contentLower = section.content.toLowerCase();
      const titleLower = section.title.toLowerCase();

      return keywords.some(
        (keyword) => contentLower.includes(keyword.toLowerCase()) || titleLower.includes(keyword.toLowerCase()),
      );
    })
    .slice(0, 10);

  relatedSections.forEach((section) => {
    const title = section.title;

    const topicKey = title.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    if (usedTopics.has(topicKey)) return;
    usedTopics.add(topicKey);

    if (title.includes('Deploy') || title.includes('Create')) {
      suggestions.push(`How do I ${title.toLowerCase()}?`);
    } else if (title.includes('Configure') || title.includes('Setup')) {
      suggestions.push(`What are the steps to ${title.toLowerCase()}?`);
    } else if (title.includes('Understand') || title.includes('Learn')) {
      suggestions.push(`Can you explain ${title.toLowerCase().replace('understand', '').replace('learn', '').trim()}?`);
    } else {
      suggestions.push(`Tell me more about ${title.toLowerCase()}`);
    }
  });

  const contextualQuestions: { [key: string]: { [subkey: string]: string[] } } = {
    node: {
      local: [
        'What are the hardware requirements for running a local node?',
        'How do I connect my local node to testnet?',
        "How can I monitor my local node's performance?",
        'What ports need to be open for my node?',
      ],
      run: [
        'How long does it take to sync a node?',
        "What's the difference between archival and pruned nodes?",
        'How do I update my node to the latest version?',
        'Can I run multiple nodes on the same machine?',
      ],
      setup: [
        'What configuration options should I use?',
        'How do I backup my node data?',
        'What are common node setup errors?',
        'How do I enable API endpoints on my node?',
      ],
    },
    deploy: {
      contract: [
        'How do I verify my deployed contract?',
        'What are gas optimization techniques for deployment?',
        'How can I upgrade my deployed contract?',
        'What tools can I use to test before deployment?',
      ],
      smart: [
        'What are the deployment costs on Avalanche?',
        'How do I interact with my deployed contract?',
        'What security checks should I do before deployment?',
        'Can I deploy the same contract to multiple chains?',
      ],
    },
    validator: {
      become: [
        "What's the minimum stake required?",
        'How long is the validation period?',
        'What are the rewards for validation?',
        'What happens if my validator goes offline?',
      ],
      stake: [
        'How do I calculate staking rewards?',
        'Can I unstake before the validation period ends?',
        "What's the difference between validation and delegation?",
        'How do I choose a good validator to delegate to?',
      ],
    },
    subnet: {
      create: [
        'What are the costs of creating a subnet?',
        'How do I add validators to my subnet?',
        'What VM options are available for subnets?',
        'How do I configure subnet parameters?',
      ],
      l1: [
        "What's the difference between Subnet and L1?",
        'How do I convert my Subnet to an L1?',
        'What are the benefits of L1s over Subnets?',
        'Can L1s communicate with each other?',
      ],
    },
    token: {
      bridge: [
        'Which bridges support Avalanche?',
        'How long do bridge transfers take?',
        'What are bridge fees?',
        'Is bridging safe?',
      ],
      create: [
        'What token standards does Avalanche support?',
        'How do I add liquidity for my token?',
        'How can I list my token on exchanges?',
        'What are tokenomics best practices?',
      ],
    },
  };

  const keywordList = Array.from(keywords);

  for (const mainKeyword of keywordList) {
    if (contextualQuestions[mainKeyword]) {
      for (const subKeyword of keywordList) {
        if (contextualQuestions[mainKeyword][subKeyword]) {
          contextualQuestions[mainKeyword][subKeyword].forEach((question) => {
            if (!suggestions.some((s) => s.toLowerCase() === question.toLowerCase())) {
              suggestions.push(question);
            }
          });
        }
      }
    }
  }

  if (suggestions.length < 3) {
    const generalFollowUps = [
      'Can you show me a code example?',
      'What are common mistakes to avoid?',
      'Are there any best practices I should follow?',
      'What tools or resources would help with this?',
      'Can you explain this in simpler terms?',
    ];

    generalFollowUps.forEach((question) => {
      if (suggestions.length < 6 && !suggestions.includes(question)) {
        suggestions.push(question);
      }
    });
  }

  return suggestions.slice(0, 6);
}

// withApi: auth intentionally omitted — public anonymous access supported
export const POST = withApi<{ message: string }>(
  async (_req: NextRequest, { body }) => {
    const { message } = body;

    const keywords = extractKeywords(message);

    if (keywords.length === 0) {
      return successResponse({ suggestions: [] });
    }

    const sections = await loadLLMsContent();
    const suggestions = generateSuggestionsFromContent(keywords, sections);

    return successResponse({ suggestions });
  },
  {
    schema: suggestionsSchema,
    rateLimit: { windowMs: 60_000, maxRequests: 60, identifier: 'ip' },
  },
);
