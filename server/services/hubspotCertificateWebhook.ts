import { getCourseNameMapping } from '@/content/courses';

const HUBSPOT_PORTAL_ID = '7522520';
const HUBSPOT_WEBHOOK_BASE = `https://api-na1.hubapi.com/automation/v4/webhook-triggers/${HUBSPOT_PORTAL_ID}`;

// Each course has its own HubSpot webhook trigger for its specific email notification.
// Entrepreneur academy uses a single env var (legacy setup).
// Blockchain and Avalanche L1 academies have per-course triggers configured in HubSpot.
const courseWebhookTriggers: Record<string, string | (() => string | undefined)> = {
  // ============ ENTREPRENEUR ACADEMY ============
  // Uses a single webhook URL from env var (existing setup)
  'foundations-web3-venture': () => process.env.ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK || process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK,
  'go-to-market': () => process.env.ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK || process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK,
  'web3-community-architect': () => process.env.ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK || process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK,
  'fundraising-finance': () => process.env.ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK || process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK,

  // ============ AVALANCHE L1 ACADEMY ============
  'avalanche-fundamentals': `${HUBSPOT_WEBHOOK_BASE}/TuyFFUJ`,
  'permissioned-l1s': `${HUBSPOT_WEBHOOK_BASE}/sKDDMBB`,
  'l1-native-tokenomics': `${HUBSPOT_WEBHOOK_BASE}/GuYqenD`,
  'permissionless-l1s': `${HUBSPOT_WEBHOOK_BASE}/QPJMz91`,
  'interchain-messaging': `${HUBSPOT_WEBHOOK_BASE}/mGseHO6`,
  'erc20-bridge': `${HUBSPOT_WEBHOOK_BASE}/N89Q354`,
  'native-token-bridge': `${HUBSPOT_WEBHOOK_BASE}/I3LlRdL`,
  'customizing-evm': `${HUBSPOT_WEBHOOK_BASE}/W40ZomG`,
  'access-restriction-fundamentals': `${HUBSPOT_WEBHOOK_BASE}/QqKjSIN`,
  'access-restriction-advanced': `${HUBSPOT_WEBHOOK_BASE}/K7nyUjr`,

  // ============ BLOCKCHAIN ACADEMY ============
  'blockchain-fundamentals': `${HUBSPOT_WEBHOOK_BASE}/uGqmSUS`,
  'solidity-foundry': `${HUBSPOT_WEBHOOK_BASE}/DM95DwX`,
  'nft-deployment': `${HUBSPOT_WEBHOOK_BASE}/EGFz4c0`,
  'encrypted-erc': `${HUBSPOT_WEBHOOK_BASE}/iK7ZVk4`,
  'x402-payment-infrastructure': `${HUBSPOT_WEBHOOK_BASE}/qbSaOMv`,
};

// Academy completion webhooks — triggered when a student completes ALL courses in an academy
type Academy = 'avalanche-l1' | 'blockchain';

const academyCompletionWebhooks: Record<Academy, string> = {
  'avalanche-l1': `${HUBSPOT_WEBHOOK_BASE}/fuZ0WyV`,
  'blockchain': `${HUBSPOT_WEBHOOK_BASE}/QZXbYnP`,
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
  if (typeof entry === 'function') return entry();
  return entry;
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
          const graduationUrl = academyCompletionWebhooks[academy];
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
