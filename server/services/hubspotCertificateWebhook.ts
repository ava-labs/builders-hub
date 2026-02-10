import { getCourseNameMapping } from '@/content/courses';

type Academy = 'entrepreneur' | 'blockchain' | 'avalanche-l1';

// Maps each course slug to its academy for webhook routing
const courseToAcademy: Record<string, Academy> = {
  // Entrepreneur Academy
  'foundations-web3-venture': 'entrepreneur',
  'go-to-market': 'entrepreneur',
  'web3-community-architect': 'entrepreneur',
  'fundraising-finance': 'entrepreneur',

  // Blockchain Academy
  'blockchain-fundamentals': 'blockchain',
  'solidity-foundry': 'blockchain',
  'nft-deployment': 'blockchain',
  'encrypted-erc': 'blockchain',
  'x402-payment-infrastructure': 'blockchain',

  // Avalanche L1 Academy
  'avalanche-fundamentals': 'avalanche-l1',
  'permissioned-l1s': 'avalanche-l1',
  'l1-native-tokenomics': 'avalanche-l1',
  'permissionless-l1s': 'avalanche-l1',
  'interchain-messaging': 'avalanche-l1',
  'erc20-bridge': 'avalanche-l1',
  'interchain-token-transfer': 'avalanche-l1',
  'native-token-bridge': 'avalanche-l1',
  'customizing-evm': 'avalanche-l1',
  'access-restriction': 'avalanche-l1',
  'avacloudapis': 'avalanche-l1',
  'icm-chainlink': 'avalanche-l1',
  'hypersdk': 'avalanche-l1',
};

// Each academy has its own HubSpot webhook URL to trigger its specific email flow
const academyWebhookUrls: Record<Academy, string | undefined> = {
  'entrepreneur': process.env.ENTREPRENEUR_ACADEMY_HUBSPOT_WEBHOOK || process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK,
  'blockchain': process.env.BLOCKCHAIN_ACADEMY_HUBSPOT_WEBHOOK,
  'avalanche-l1': process.env.AVALANCHE_L1_ACADEMY_HUBSPOT_WEBHOOK,
};

export async function triggerCertificateWebhook(
  userId: string,
  email: string,
  fullName: string,
  courseId: string
) {
  try {
    const academy = courseToAcademy[courseId];
    if (!academy) {
      console.log(`No academy mapping found for course: ${courseId}, skipping HubSpot webhook`);
      return;
    }

    const webhookUrl = academyWebhookUrls[academy];
    if (!webhookUrl) {
      console.log(`HubSpot webhook URL not configured for ${academy} academy, skipping webhook for course: ${courseId}`);
      return;
    }

    // Parse the full name into first and last name
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Get the proper course name from centralized mapping
    const courseNameMapping = getCourseNameMapping();
    const courseName = courseNameMapping[courseId] || courseId;

    const webhookData = {
      firstName,
      lastName,
      email,
      courseName,
      courseCompletionDate: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData),
    });

    if (!response.ok) {
      console.error(`HubSpot ${academy} academy certificate webhook failed:`, response.status, await response.text());
    } else {
      console.log(`HubSpot ${academy} academy certificate webhook triggered successfully for:`, email, 'Course:', courseName);
    }
  } catch (error) {
    // Don't throw - we don't want webhook failures to break certificate generation
    console.error('Error triggering HubSpot certificate webhook:', error);
  }
}
