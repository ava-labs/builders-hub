import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

const courseMapping: Record<string, string> = {
  'avalanche-fundamentals': 'Avalanche Fundamentals',
  'codebase-entrepreneur-foundations': 'Foundations of a Web3 Venture',
  'codebase-entrepreneur-go-to-market': 'Go-to-Market Strategist',
  'codebase-entrepreneur-community': 'Web3 Community Architect',
  'codebase-entrepreneur-fundraising': 'Fundraising & Finance Pro',
};

const certificateTemplates: Record<string, string> = {
  'avalanche-fundamentals': 'AvalancheAcademy_Certificate.pdf',
  'codebase-entrepreneur-foundations': 'CodebaseEntrepreneur_Foundations_Certificate_interactive_fields.pdf',
  'codebase-entrepreneur-go-to-market': 'CodebaseEntrepreneur_GTM_Certificate.pdf',
  'codebase-entrepreneur-community': 'CodebaseEntrepreneur_Community_Certificate.pdf',
  'codebase-entrepreneur-fundraising': 'CodebaseEntrepreneur_Fundraising_Certificate.pdf',
};

function getCourseName(courseId: string): string {
  return courseMapping[courseId] || courseId;
}

function getCertificateTemplate(courseId: string): string {
  // Check if we have a specific template for this course
  if (certificateTemplates[courseId]) {
    return certificateTemplates[courseId];
  }

  // Fallback for codebase entrepreneur courses
  if (courseId.startsWith('codebase-entrepreneur')) {
    return 'CodebaseEntrepreneur_Certificate.pdf';
  }

  // Default fallback
  return 'AvalancheAcademy_Certificate.pdf';
}

export async function POST(req: NextRequest) {
  let courseId: string = '';
  let userName: string = '';

  try {
    ({ courseId, userName } = await req.json());
    if (!courseId || !userName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const courseName = getCourseName(courseId);
    const templateFile = getCertificateTemplate(courseId);

    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const serverUrl = `${protocol}://${host}`;
    const templateUrl = `${serverUrl}/certificates/${templateFile}`;

    const templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok) {
      throw new Error(`Failed to fetch template: ${templateFile}`);
    }

    const templateArrayBuffer = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateArrayBuffer);
    const form = pdfDoc.getForm();

    const isAvalancheTemplate = templateFile === 'AvalancheAcademy_Certificate.pdf';

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
        form.getTextField('Name').setText(userName);
        form
          .getTextField('Date')
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
        userName: userName || 'undefined',
      },
      { status: 500 }
    );
  }
}