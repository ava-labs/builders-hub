import { getCourseNameMapping } from '@/content/courses';

// Each course has its own HubSpot webhook trigger for its specific email notification.
// All webhook URLs are configured via environment variables.
const courseWebhookTriggers: Record<string, () => string | undefined> = {
  // ============ ENTREPRENEUR ACADEMY ============
  'foundations-web3-venture': () => process.env.ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK || process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK,
  'go-to-market': () => process.env.ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK || process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK,
  'web3-community-architect': () => process.env.ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK || process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK,
  'fundraising-finance': () => process.env.ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK || process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK,

  // ============ AVALANCHE L1 ACADEMY ============
  'avalanche-fundamentals': () => process.env.HUBSPOT_WEBHOOK_AVALANCHE_FUNDAMENTALS,
  'permissioned-l1s': () => process.env.HUBSPOT_WEBHOOK_PERMISSIONED_L1S,
  'l1-native-tokenomics': () => process.env.HUBSPOT_WEBHOOK_L1_NATIVE_TOKENOMICS,
  'permissionless-l1s': () => process.env.HUBSPOT_WEBHOOK_PERMISSIONLESS_L1S,
  'interchain-messaging': () => process.env.HUBSPOT_WEBHOOK_INTERCHAIN_MESSAGING,
  'erc20-bridge': () => process.env.HUBSPOT_WEBHOOK_ERC20_BRIDGE,
  'native-token-bridge': () => process.env.HUBSPOT_WEBHOOK_NATIVE_TOKEN_BRIDGE,
  'customizing-evm': () => process.env.HUBSPOT_WEBHOOK_CUSTOMIZING_EVM,
  'access-restriction-fundamentals': () => process.env.HUBSPOT_WEBHOOK_ACCESS_RESTRICTION_FUNDAMENTALS,
  'access-restriction-advanced': () => process.env.HUBSPOT_WEBHOOK_ACCESS_RESTRICTION_ADVANCED,

  // ============ BLOCKCHAIN ACADEMY ============
  'blockchain-fundamentals': () => process.env.HUBSPOT_WEBHOOK_BLOCKCHAIN_FUNDAMENTALS,
  'solidity-foundry': () => process.env.HUBSPOT_WEBHOOK_SOLIDITY_FOUNDRY,
  'nft-deployment': () => process.env.HUBSPOT_WEBHOOK_NFT_DEPLOYMENT,
  'encrypted-erc': () => process.env.HUBSPOT_WEBHOOK_ENCRYPTED_ERC,
  'x402-payment-infrastructure': () => process.env.HUBSPOT_WEBHOOK_X402_PAYMENT_INFRASTRUCTURE,
};

// Academy completion webhooks — triggered when a student completes ALL courses in an academy
type Academy = 'avalanche-l1' | 'blockchain';

const academyCompletionWebhookEnvVars: Record<Academy, string> = {
  'avalanche-l1': 'HUBSPOT_WEBHOOK_AVALANCHE_L1_GRADUATION',
  'blockchain': 'HUBSPOT_WEBHOOK_BLOCKCHAIN_GRADUATION',
};

// Maps course slugs to their academy for graduation tracking
const courseToAcademy: Record<string, Academy> = {
  'blockchain-fundamentals': 'blockchain',
  'solidity-foundry': 'blockchain',
  'nft-deployment': 'blockchain',
  'encrypted-erc': 'blockchain',
  'x402-payment-infrastructure': 'blockchain',

  'avalanche-fundamentals': 'avalanche-l1',
  'permissioned-l1s': 'avalanche-l1',
  'l1-native-tokenomics': 'avalanche-l1',
  'permissionless-l1s': 'avalanche-l1',
  'interchain-messaging': 'avalanche-l1',
  'erc20-bridge': 'avalanche-l1',
  'native-token-bridge': 'avalanche-l1',
  'customizing-evm': 'avalanche-l1',
  'access-restriction-fundamentals': 'avalanche-l1',
  'access-restriction-advanced': 'avalanche-l1',
};

// Required courses per academy for graduation
const academyRequiredCourses: Record<Academy, string[]> = {
  'blockchain': [
    'blockchain-fundamentals',
    'solidity-foundry',
    'nft-deployment',
    'encrypted-erc',
    'x402-payment-infrastructure',
  ],
  'avalanche-l1': [
    'avalanche-fundamentals',
    'permissioned-l1s',
    'l1-native-tokenomics',
    'permissionless-l1s',
    'interchain-messaging',
    'erc20-bridge',
    'native-token-bridge',
    'customizing-evm',
    'access-restriction-fundamentals',
    'access-restriction-advanced',
  ],
};

function getWebhookUrl(courseId: string): string | undefined {
  const entry = courseWebhookTriggers[courseId];
  if (!entry) return undefined;
  return entry();
}

async function sendWebhook(url: string, data: Record<string, string>, label: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    console.error(`HubSpot webhook failed [${label}]:`, response.status, await response.text());
  } else {
    console.log(`HubSpot webhook triggered [${label}]:`, data.email, data.courseName);
  }
}

export async function triggerCertificateWebhook(
  userId: string,
  email: string,
  fullName: string,
  courseId: string,
  completedCourses?: string[]
) {
  try {
    const webhookUrl = getWebhookUrl(courseId);
    if (!webhookUrl) {
      console.log(`No HubSpot webhook configured for course: ${courseId}, skipping`);
      return;
    }

    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || '';

    const courseNameMapping = getCourseNameMapping();
    const courseName = courseNameMapping[courseId] || courseId;

    const webhookData = {
      firstName,
      lastName,
      email,
      courseName,
      courseCompletionDate: new Date().toISOString(),
    };

    // 1. Send the per-course webhook
    await sendWebhook(webhookUrl, webhookData, `course: ${courseName}`);

    // 2. Check if the student has now completed all courses in their academy
    if (completedCourses) {
      const academy = courseToAcademy[courseId];
      if (academy) {
        const required = academyRequiredCourses[academy];
        const allCompleted = required.every(slug => completedCourses.includes(slug));

        if (allCompleted) {
          const envVar = academyCompletionWebhookEnvVars[academy];
          const graduationUrl = process.env[envVar];
          if (!graduationUrl) {
            console.log(`No HubSpot graduation webhook configured (${envVar}), skipping`);
            return;
          }
          await sendWebhook(graduationUrl, {
            ...webhookData,
            courseName: `${academy === 'blockchain' ? 'Blockchain' : 'Avalanche L1'} Academy Graduate`,
          }, `graduation: ${academy}`);
        }
      }
    }
  } catch (error) {
    // Don't throw - we don't want webhook failures to break certificate generation
    console.error('Error triggering HubSpot certificate webhook:', error);
  }
}
