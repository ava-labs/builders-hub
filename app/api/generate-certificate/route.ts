import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, PDFName } from 'pdf-lib';

const courseMapping: Record<string, string> = {
  'avalanche-fundamentals': 'Avalanche Fundamentals',
  'codebase-entrepreneur-foundations': 'Foundations of a Web3 Venture',
  'codebase-entrepreneur-go-to-market': 'Go-to-Market Strategist',
  'codebase-entrepreneur-community': 'Web3 Community Architect',
  'codebase-entrepreneur-fundraising': 'Fundraising & Finance Pro',
};

const certificateTemplates: Record<string, string> = {
  'avalanche-fundamentals': 'AvalancheAcademy_Certificate.pdf',
  'codebase-entrepreneur-foundations': 'Codebase_EntrepreneurAcademy_Certificate_Foundations.pdf',
  'codebase-entrepreneur-go-to-market': 'Codebase_EntrepreneurAcademy_Certificate_GTM.pdf',
  'codebase-entrepreneur-community': 'Codebase_EntrepreneurAcademy_Certificate_Community.pdf',
  'codebase-entrepreneur-fundraising': 'Codebase_EntrepreneurAcademy_Certificate_Fundraising.pdf',
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
    return 'Codebase_EntrepreneurAcademy_Certificate.pdf';
  }

  // Default fallback
  return 'AvalancheAcademy_Certificate.pdf';
}

export async function POST(req: NextRequest) {
  let courseId: string = '';
  let userName: string = '';

  try {
    ({ courseId, userName } = await req.json());
    console.log('=== CERTIFICATE GENERATION START ===');
    console.log('Course ID:', courseId);
    console.log('User Name:', userName);

    if (!courseId || !userName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const courseName = getCourseName(courseId);
    const templateFile = getCertificateTemplate(courseId);
    console.log('Course Name:', courseName);
    console.log('Template File:', templateFile);

    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const serverUrl = `${protocol}://${host}`;
    const templateUrl = `${serverUrl}/certificates/${templateFile}`;
    console.log('Template URL:', templateUrl);

    const templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok) {
      throw new Error(`Failed to fetch template: ${templateFile}`);
    }

    const templateArrayBuffer = await templateResponse.arrayBuffer();
    console.log('PDF loaded, size:', templateArrayBuffer.byteLength, 'bytes');

    const pdfDoc = await PDFDocument.load(templateArrayBuffer);

    // Check if PDF has a form
    console.log('Checking for AcroForm in PDF...');
    const hasAcroForm = pdfDoc.catalog.has(PDFName.of('AcroForm'));
    console.log('PDF has AcroForm:', hasAcroForm);

    const form = pdfDoc.getForm();
    console.log('PDF form loaded successfully');
    console.log('Form:', form);

    const isAvalancheTemplate = templateFile === 'AvalancheAcademy_Certificate.pdf';
    console.log('Is Avalanche Template:', isAvalancheTemplate);

    // Log all available form fields
    console.log('=== FORM FIELD ANALYSIS ===');
    const fields = form.getFields();
    console.log('Total form fields found:', fields.length);

    // If no fields found, this might be the issue
    if (fields.length === 0) {
      console.error('WARNING: No form fields found in the PDF!');
      console.error('This PDF might not have interactive form fields.');
    }

    fields.forEach(field => {
      const fieldName = field.getName();
      console.log(`Field found: "${fieldName}" (Type: ${field.constructor.name})`);
    });

    try {
      if (isAvalancheTemplate) {
        console.log('=== FILLING AVALANCHE CERTIFICATE ===');
        // Original 4-field flow for Avalanche certificates
        console.log('Setting FullName field...');
        form.getTextField('FullName').setText(userName);
        console.log('FullName set successfully');

        console.log('Setting Class field...');
        form.getTextField('Class').setText(courseName);
        console.log('Class set successfully');

        const dateString = new Date().toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        console.log('Setting Awarded field with date:', dateString);
        form.getTextField('Awarded').setText(dateString);
        console.log('Awarded set successfully');

        const certId = Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15);
        console.log('Setting Id field with:', certId);
        form.getTextField('Id').setText(certId);
        console.log('Id set successfully');
      } else {
        console.log('=== FILLING CODEBASE ENTREPRENEUR CERTIFICATE ===');
        // Codebase Entrepreneur certificates: only Name and Date
        console.log('Attempting to get Name field...');
        const nameField = form.getTextField('Name');
        console.log('Name field retrieved:', !!nameField);

        console.log('Setting Name field with:', userName);
        nameField.setText(userName);
        console.log('Name set successfully');

        console.log('Attempting to get Date field...');
        const dateField = form.getTextField('Date');
        console.log('Date field retrieved:', !!dateField);

        const dateString = new Date().toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        console.log('Setting Date field with:', dateString);
        dateField.setText(dateString);
        console.log('Date set successfully');
      }
      console.log('=== FORM FILLING COMPLETE ===');
    } catch (error) {
      console.error('=== FORM FILLING ERROR ===');
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`Failed to fill form fields: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('Flattening form...');
    form.flatten();
    console.log('Form flattened successfully');

    console.log('Saving PDF...');
    const pdfBytes = await pdfDoc.save();
    console.log('PDF saved successfully, size:', pdfBytes.length, 'bytes');

    console.log('=== CERTIFICATE GENERATION SUCCESS ===');
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=${courseId}_certificate.pdf`,
      },
    });
  } catch (error) {
    console.error('=== CERTIFICATE GENERATION FAILED ===');
    console.error('Full error:', error);

    // More detailed error response
    const errorDetails = {
      error: 'Failed to generate certificate, contact the Avalanche team.',
      details: (error as Error).message,
      courseId,
      userName: userName || 'undefined',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
      templateFile: getCertificateTemplate(courseId),
    };

    console.error('Error response:', errorDetails);

    return NextResponse.json(errorDetails, { status: 500 });
  }
}