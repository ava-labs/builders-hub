import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { getServerSession } from 'next-auth';
import { AuthOptions } from '@/lib/auth/authOptions';

const courseMapping: Record<string, string> = {
  'avalanche-fundamentals': 'Avalanche Fundamentals',
  'codebase-entrepreneur-foundations': 'Foundations of a Web3 Venture',
  'codebase-entrepreneur-go-to-market': 'Go-to-Market Strategist',
  'codebase-entrepreneur-community': 'Web3 Community Architect',
  'codebase-entrepreneur-fundraising': 'Fundraising & Finance Pro',
};

const certificateTemplates: Record<string, string> = {
  'avalanche-fundamentals': 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/AvalancheAcademy_Certificate.pdf',
  'codebase-entrepreneur-foundations': 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Codebase_EntrepreneurAcademy_Certificate_Foundations.pdf',
  'codebase-entrepreneur-go-to-market': 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Codebase_EntrepreneurAcademy_Certificate_GTM.pdf',
  'codebase-entrepreneur-community': 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Codebase_EntrepreneurAcademy_Certificate_Community.pdf',
  'codebase-entrepreneur-fundraising': 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/Codebase_EntrepreneurAcademy_Certificate_Fundraising.pdf',
};

function getCourseName(courseId: string): string {
  return courseMapping[courseId] || courseId;
}

function getCertificateTemplate(courseId: string): string {
  // Check if we have a specific template for this course
  if (certificateTemplates[courseId]) {
    return certificateTemplates[courseId];
  }

  // No fallback - throw error for unknown courses
  throw new Error(`No certificate template found for course: ${courseId}`);
}

export async function POST(req: NextRequest) {
  let courseId: string = '';

  try {
    // Require auth and derive the user's name from the connected BuilderHub account
    const session = await getServerSession(AuthOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    ({ courseId } = await req.json());
    if (!courseId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userName = session.user.name || session.user.email || 'BuilderHub User';

    const courseName = getCourseName(courseId);
    const templateUrl = getCertificateTemplate(courseId);

    const templateResponse = await fetch(templateUrl);
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
        courseId,
        // Name now comes from the authenticated session
      },
      { status: 500 }
    );
  }
}