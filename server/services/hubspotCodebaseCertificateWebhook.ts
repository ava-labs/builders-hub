import { prisma } from '@/prisma/prisma';
import { getCourseNameMapping } from '@/content/courses';

const CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK = process.env.CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK;

if (!CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK) {
  throw new Error('CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK environment variable is not set');
}

export async function triggerCertificateWebhook(
  userId: string, 
  email: string, 
  fullName: string,
  courseId: string
) {
  try {
    // Only send webhook for Codebase Entrepreneur courses
    const codebaseCourseIds = ['foundations-web3-venture', 'go-to-market', 'web3-community-architect', 'fundraising-finance'];
    if (!codebaseCourseIds.includes(courseId)) {
      console.log(`Skipping HubSpot webhook for non-Codebase course: ${courseId}`);
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
      firstName: firstName,
      lastName: lastName,
      email: email,
      courseName: courseName,
      courseCompletionDate: new Date().toISOString()
    };

    const response = await fetch(CODEBASE_CERTIFICATE_HUBSPOT_WEBHOOK!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData),
    });

    if (!response.ok) {
      console.error('HubSpot Codebase certificate webhook failed:', response.status, await response.text());
    } else {
      console.log('HubSpot Codebase certificate webhook triggered successfully for:', email, 'Course:', courseName);
    }
  } catch (error) {
    // Don't throw - we don't want webhook failures to break certificate generation
    console.error('Error triggering HubSpot certificate webhook:', error);
  }
}
