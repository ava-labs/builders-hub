import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

const courseMapping: Record<string, string> = {
  'avalanche-fundamentals': 'Avalanche Fundamentals',
  'codebase-entrepreneur-foundations': 'Codebase Entrepreneur Foundations',
  'codebase-entrepreneur-go-to-market': 'Codebase Entrepreneur Go-to-Market',
  'codebase-entrepreneur-community': 'Codebase Entrepreneur Community',
  'codebase-entrepreneur-fundraising': 'Codebase Entrepreneur Fundraising',
};

const certificateTemplates: Record<string, string> = {
  'avalanche-fundamentals': 'AvalancheAcademy_Certificate.pdf',
  'codebase-entrepreneur-foundations': 'EntrepreneurAcademy_Foundations_Certificate.pdf',
  'codebase-entrepreneur-go-to-market': 'EntrepreneurAcademy_GTM_Certificate.pdf',
  'codebase-entrepreneur-community': 'EntrepreneurAcademy_Community_Certificate.pdf',
  'codebase-entrepreneur-fundraising': 'EntrepreneurAcademy_Fundraising_Certificate.pdf',
};

function getCourseName(courseId: string): string {
  return courseMapping[courseId] || courseId;
}

function getCertificateTemplate(courseId: string): string {
  return certificateTemplates[courseId] || 'AvalancheAcademy_Certificate.pdf';
}

export async function POST(req: NextRequest) {
  try {
    const { courseId, userName } = await req.json();
    if (!courseId || !userName) { return NextResponse.json({ error: 'Missing required fields' }, { status: 400 }); }
    const courseName = getCourseName(courseId);
    const templateFile = getCertificateTemplate(courseId);
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const serverUrl = `${protocol}://${host}`;
    const templateUrl = `${serverUrl}/certificates/${templateFile}`;
    const templateResponse = await fetch(templateUrl);

    if (!templateResponse.ok) { throw new Error(`Failed to fetch template: ${templateFile}`); }

    const templateArrayBuffer = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateArrayBuffer);
    const form = pdfDoc.getForm();

    try {
      // fills the form fields in our certificate template
      form.getTextField('FullName').setText(userName);
      form.getTextField('Class').setText(courseName);
      form.getTextField('Awarded').setText(new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }));
      form.getTextField('Id').setText(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    } catch (error) {
      throw new Error('Failed to fill form fields');
    }

    form.flatten();
    const pdfBytes = await pdfDoc.save();
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${courseId}_certificate.pdf`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate certificate, contact the Avalanche team.', details: (error as Error).message },
      { status: 500 }
    );
  }
}