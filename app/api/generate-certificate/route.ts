import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PDFDocument } from 'pdf-lib';
import { withApi } from '@/lib/api/with-api';
import { BadRequestError, InternalError, NotFoundError } from '@/lib/api/errors';
import { triggerCertificateWebhook } from '@/server/services/hubspotCertificateWebhook';
import { getCompletedCourseSlugs } from '@/server/services/userBadge';
import { getCourseConfig } from '@/content/courses';

/**
 * Sanitize text for WinAnsi (Windows-1252) encoding used by pdf-lib.
 * Characters outside WinAnsi (e.g. Turkish I U+0130) are decomposed
 * to their closest ASCII base form via NFKD normalization.
 * WinAnsi-safe accented characters (e, n, u, etc.) are preserved.
 */
function sanitizeForWinAnsi(text: string): string {
  const WIN_1252_EXTRAS = new Set([
    0x152, 0x153, 0x160, 0x161, 0x178, 0x17d, 0x17e, 0x192, 0x2c6, 0x2dc, 0x2013, 0x2014, 0x2018, 0x2019, 0x201a,
    0x201c, 0x201d, 0x201e, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122,
  ]);

  return text
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code <= 0xff || WIN_1252_EXTRAS.has(code)) return char;
      const base = char.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      return base || '?';
    })
    .join('');
}

async function fetchWithRetry(url: string, maxRetries = 3, delayMs = 500): Promise<Response> {
  let lastResponse: Response | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      lastResponse = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (lastResponse.ok || lastResponse.status < 500) return lastResponse;
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  return lastResponse!;
}

const certSchema = z.object({
  courseId: z.string().min(1, 'Missing course ID'),
});

export const POST = withApi<z.infer<typeof certSchema>>(
  async (_req: NextRequest, { session, body }) => {
    if (!session.user.email) {
      throw new BadRequestError(
        'Email address required. Please ensure your BuilderHub account has a valid email address.',
      );
    }

    const { courseId } = body;

    const courseConfig = getCourseConfig();
    const course = courseConfig[courseId];
    if (!course) {
      throw new NotFoundError(`Certificate template for course: ${courseId}`);
    }

    const userName = sanitizeForWinAnsi(session.user.name || session.user.email || 'BuilderHub User');
    const { name: courseName, template: templateUrl } = course;

    const templateResponse = await fetchWithRetry(templateUrl);
    if (!templateResponse.ok) {
      throw new InternalError(`Failed to fetch template: ${templateUrl}`);
    }

    const templateArrayBuffer = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateArrayBuffer);
    const form = pdfDoc.getForm();

    const isAvalancheTemplate = templateUrl.includes('AvalancheAcademy_Certificate.pdf');

    try {
      if (isAvalancheTemplate) {
        form.getTextField('FullName').setText(userName);
        form.getTextField('Class').setText(courseName);
        form.getTextField('Awarded').setText(
          new Date().toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        );
        form
          .getTextField('Id')
          .setText(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
      } else {
        form.getTextField('Enter Name').setText(userName);
        form.getTextField('Enter Date').setText(
          new Date().toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
        );
      }
    } catch {
      throw new InternalError('Failed to fill form fields');
    }

    form.flatten();
    const pdfBytes = await pdfDoc.save();

    // Trigger HubSpot webhook (fire-and-forget)
    const completedBefore = await getCompletedCourseSlugs(session.user.id);
    const isNewCompletion = !completedBefore.includes(courseId);
    const completedCourses = [...completedBefore];
    if (isNewCompletion) {
      completedCourses.push(courseId);
    }

    triggerCertificateWebhook(
      session.user.id,
      session.user.email!,
      userName,
      courseId,
      isNewCompletion ? completedCourses : undefined,
    ).catch(() => {
      // Non-blocking -- webhook failure should not affect PDF delivery
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${courseId}_certificate.pdf`,
      },
    });
  },
  { auth: true, schema: certSchema },
);
