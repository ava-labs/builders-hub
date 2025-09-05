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
  'codebase-entrepreneur-foundations': 'CodebaseEntrepreneur_Foundations_Certificate.pdf',
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
    const requestData = await req.json();
    courseId = requestData.courseId;
    userName = requestData.userName;
    console.log('Certificate request:', { courseId, userName });

    if (!courseId || !userName) { return NextResponse.json({ error: 'Missing required fields' }, { status: 400 }); }
    const courseName = getCourseName(courseId);
    const templateFile = getCertificateTemplate(courseId);
    console.log('Template info:', { courseName, templateFile });

    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const serverUrl = `${protocol}://${host}`;
    const templateUrl = `${serverUrl}/certificates/${templateFile}`;
    console.log('Fetching template from:', templateUrl);

    const templateResponse = await fetch(templateUrl);
    console.log('Template response status:', templateResponse.status);

    if (!templateResponse.ok) {
      console.error('Failed to fetch template:', templateFile, 'Status:', templateResponse.status);
      throw new Error(`Failed to fetch template: ${templateFile} (Status: ${templateResponse.status})`);
    }

    const templateArrayBuffer = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateArrayBuffer);
    const form = pdfDoc.getForm();

    try {
      // fills the form fields in our certificate template
      console.log('Filling form fields for template:', templateFile);
      const fields = form.getFields();
      console.log('Available form fields:', fields.map(field => field.getName()));

      form.getTextField('FullName').setText(userName);
      form.getTextField('Class').setText(courseName);
      form.getTextField('Awarded').setText(new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }));
      form.getTextField('Id').setText(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    } catch (error) {
      console.error('Error filling form fields:', error);
      console.error('Available form fields:', form.getFields().map(field => field.getName()));
      throw new Error(`Failed to fill form fields: ${(error as Error).message}`);
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
    console.error('Certificate generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate certificate, contact the Avalanche team.',
        details: (error as Error).message,
        stack: (error as Error).stack,
        courseId,
        userName: userName || 'undefined'
      },
      { status: 500 }
    );
  }
}