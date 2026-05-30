import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { getServerSession } from 'next-auth';
import { AuthOptions } from '@/lib/auth/authOptions';
import { triggerCertificateWebhook } from '@/server/services/hubspotCertificateWebhook';
import { getCompletedCourseSlugs } from '@/server/services/userBadge';
import { getCourseConfig } from '@/content/courses';

/**
 * Sanitize text for WinAnsi (Windows-1252) encoding used by pdf-lib.
 * Characters outside WinAnsi (e.g. Turkish İ U+0130) are decomposed
 * to their closest ASCII base form via NFKD normalization.
 * WinAnsi-safe accented characters (é, ñ, ü, etc.) are preserved.
 */
function sanitizeForWinAnsi(text: string): string {
  const WIN_1252_EXTRAS = new Set([
    0x152, 0x153, 0x160, 0x161, 0x178, 0x17D, 0x17E, 0x192,
    0x2C6, 0x2DC, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A,
    0x201C, 0x201D, 0x201E, 0x2020, 0x2021, 0x2022, 0x2026,
    0x2030, 0x2039, 0x203A, 0x20AC, 0x2122,
  ]);

  return text
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code <= 0xFF || WIN_1252_EXTRAS.has(code)) return char;
      const base = char.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      return base || '?';
    })
    .join('');
}

async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  delayMs = 500
): Promise<Response> {
  let lastResponse: Response | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    lastResponse = await fetch(url);
    if (lastResponse.ok || lastResponse.status < 500) return lastResponse;
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  return lastResponse!;
}

export async function POST(req: NextRequest) {
  try {
    // Require auth and derive the user's name from the connected BuilderHub account
    const session = await getServerSession(AuthOptions);
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'Unauthorized. Please sign in to BuilderHub to generate certificates.' 
      }, { status: 401 });
    }
    
    // Email is mandatory for certificate generation
    if (!session.user.email) {
      return NextResponse.json({ 
        error: 'Email address required. Please ensure your BuilderHub account has a valid email address.' 
      }, { status: 400 });
    }

    const { courseId } = await req.json();
    if (!courseId) {
      return NextResponse.json({ error: 'Missing course ID' }, { status: 400 });
    }

    // Get course configuration from centralized source
    const courseConfig = getCourseConfig();
    console.log('Certificate generation - courseId:', courseId);
    console.log('Available courses:', Object.keys(courseConfig));
    
    const course = courseConfig[courseId];
    if (!course) {
      return NextResponse.json({ 
        error: `No certificate template found for course: ${courseId}` 
      }, { status: 404 });
    }

    const userName = sanitizeForWinAnsi(
      session.user.name || session.user.email || 'BuilderHub User'
    );
    const { name: courseName, template: templateUrl } = course;

    const templateResponse = await fetchWithRetry(templateUrl);
    if (!templateResponse.ok) {
      throw new Error(`Failed to fetch template: ${templateUrl}`);
    }

    const templateArrayBuffer = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateArrayBuffer);
    const form = pdfDoc.getForm();

    const isAvalancheTemplate = templateUrl.includes('AvalancheAcademy_Certificate.pdf');

    try {
      if (isAvalancheTemplate) {
        // Original 4-field flow for Avalanche certificates
        form.getTextField('FullName').setText(userName);
        form.getTextField('Class').setText(courseName);
        form
          .getTextField('Awarded')
          .setText(
            new Date().toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          );
        form
          .getTextField('Id')
          .setText(
            Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15)
          );
      } else {
        // Codebase Entrepreneur certificates: only Name and Date
        form.getTextField('Enter Name').setText(userName);
        form
          .getTextField('Enter Date')
          .setText(
            new Date().toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          );
      }
    } catch (error) {
      throw new Error('Failed to fill form fields');
    }

    form.flatten();
    const pdfBytes = await pdfDoc.save();
    
    // Trigger HubSpot webhook for certificate completion
    // At this point we know email exists due to the check above
    // Include the current courseId since badge assignment may not have persisted yet
    const completedBefore = await getCompletedCourseSlugs(session.user.id);
    const isNewCompletion = !completedBefore.includes(courseId);
    const completedCourses = [...completedBefore];
    if (isNewCompletion) {
      completedCourses.push(courseId);
    }

    // Fire-and-forget: don't block PDF delivery on webhook
    // Only pass completedCourses for graduation check on new completions
    triggerCertificateWebhook(
      session.user.id,
      session.user.email!,
      userName,
      courseId,
      isNewCompletion ? completedCourses : undefined
    ).catch((err) =>
      console.error('HubSpot webhook failed (non-blocking):', err)
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${courseId}_certificate.pdf`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to generate certificate, contact the Avalanche team.',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}