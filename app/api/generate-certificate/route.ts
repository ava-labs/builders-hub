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

    // Debug: Check if form has any fields
    const fields = form.getFields();
    const fieldCount = fields.length;

    console.log('=== PDF FORM ANALYSIS ===');
    console.log('Template file:', templateFile);
    console.log('Total field count:', fieldCount);
    // console.log('Has AcroForm:', pdfDoc.catalog.has('PDFName'));

    if (fieldCount > 0) {
      console.log('Form fields found:');
      fields.forEach((field, index) => {
        console.log(`  Field ${index + 1}:`);
        console.log(`    Name: "${field.getName()}"`);
        console.log(`    Type: ${field.constructor.name}`);
        console.log(`    Required: ${field.isRequired ? field.isRequired() : 'unknown'}`);
        console.log(`    ReadOnly: ${field.isReadOnly ? field.isReadOnly() : 'unknown'}`);

        // Try to get more details if it's a text field
        try {
          if (field.constructor.name === 'PDFTextField') {
            const textField = field as any;
            console.log(`    Max Length: ${textField.getMaxLength ? textField.getMaxLength() : 'unlimited'}`);
            console.log(`    Default Value: "${textField.getText ? textField.getText() : 'none'}"`);
          }
        } catch (e) {
          console.log(`    Additional info unavailable: ${e}`);
        }
      });
    } else {
      console.log('No form fields detected in PDF');
    }
    console.log('========================');

    if (fieldCount > 0) {
      // PDF has form fields - use form filling approach
      try {
        console.log('=== ATTEMPTING TO FILL FORM FIELDS ===');
        const fieldNames = fields.map(field => field.getName());
        console.log('Available field names:', fieldNames);

        const dateString = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        console.log('Values to fill:', { userName, dateString });

        // Try to fill name field (try multiple possible names)
        const nameVariations = ['Name', 'name', 'FullName', 'fullname', 'StudentName', 'studentname'];
        let nameFieldFound = false;

        for (const nameField of nameVariations) {
          if (fieldNames.includes(nameField)) {
            try {
              form.getTextField(nameField).setText(userName);
              console.log(`✅ Successfully filled name field '${nameField}' with: "${userName}"`);
              nameFieldFound = true;
              break;
            } catch (error) {
              console.log(`❌ Failed to fill name field '${nameField}':`, error);
            }
          }
        }

        if (!nameFieldFound) {
          console.log('❌ No name field found. Tried:', nameVariations);
          console.log('Available fields:', fieldNames);
        }

        // Try to fill date field (try multiple possible names)
        const dateVariations = ['Date', 'date', 'Awarded', 'awarded', 'CompletionDate', 'completiondate'];
        let dateFieldFound = false;

        for (const dateField of dateVariations) {
          if (fieldNames.includes(dateField)) {
            try {
              form.getTextField(dateField).setText(dateString);
              console.log(`✅ Successfully filled date field '${dateField}' with: "${dateString}"`);
              dateFieldFound = true;
              break;
            } catch (error) {
              console.log(`❌ Failed to fill date field '${dateField}':`, error);
            }
          }
        }

        if (!dateFieldFound) {
          console.log('❌ No date field found. Tried:', dateVariations);
          console.log('Available fields:', fieldNames);
        }

        console.log('=== FORM FILLING COMPLETE ===');

      } catch (error) {
        console.error('Error filling form fields:', error);
        throw new Error(`Failed to fill form fields: ${(error as Error).message}`);
      }
    } else {
      // PDF has no form fields - add text directly (for image-based certificates)
      console.log('No form fields found. Adding text directly to PDF for template:', templateFile);

      try {
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();

        // Placeholder coordinates - you'll need to adjust these based on your certificate layout
        const nameX = width * 0.5; // Center horizontally
        const nameY = height * 0.4; // Adjust for name position
        const dateX = width * 0.5; // Center horizontally  
        const dateY = height * 0.3; // Adjust for date position

        const dateString = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

        // Import rgb function from pdf-lib for colors
        const { rgb } = await import('pdf-lib');

        firstPage.drawText(userName, {
          x: nameX,
          y: nameY,
          size: 24,
          color: rgb(0, 0, 0), // Black
        });

        firstPage.drawText(dateString, {
          x: dateX,
          y: dateY,
          size: 16,
          color: rgb(0, 0, 0), // Black
        });

        console.log(`Added text directly: Name="${userName}" at (${nameX}, ${nameY}), Date="${dateString}" at (${dateX}, ${dateY})`);

      } catch (error) {
        console.error('Error adding text to PDF:', error);
        throw new Error(`Failed to add text to PDF: ${(error as Error).message}`);
      }
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