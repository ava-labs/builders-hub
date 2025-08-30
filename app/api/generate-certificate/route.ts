import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const courseMapping: Record<string, string> = {
  'avalanche-fundamentals': 'Avalanche Fundamentals',
  'codebase-entrepreneur-foundations': 'Codebase Entrepreneur Foundations',
  'codebase-entrepreneur-go-to-market': 'Codebase Entrepreneur Go-to-Market',
  'codebase-entrepreneur-community': 'Codebase Entrepreneur Community',
  'codebase-entrepreneur-fundraising': 'Codebase Entrepreneur Fundraising',
};

const certificateTemplates: Record<string, string> = {
  'avalanche-fundamentals': 'AvalancheAcademy_Certificate.pdf',
  'codebase-entrepreneur-foundations': 'codebase-foundations.png',
  'codebase-entrepreneur-go-to-market': 'codebase-gtm.png',
  'codebase-entrepreneur-community': 'codebase-community.png',
  'codebase-entrepreneur-fundraising': 'codebase-fundraising.png',
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
    const currentDate = new Date().toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const certificateId = Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    // Handle PDF templates (with form fields)
    if (templateFile.endsWith('.pdf')) {
      const pdfDoc = await PDFDocument.load(templateArrayBuffer);
      const form = pdfDoc.getForm();

      try {
        form.getTextField('FullName').setText(userName);
        form.getTextField('Class').setText(courseName);
        form.getTextField('Awarded').setText(currentDate);
        form.getTextField('Id').setText(certificateId);
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
    }

    // Handle PNG templates (create PDF with image and text overlay)
    else if (templateFile.endsWith('.png')) {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([792, 612]); // Standard landscape size

      // Embed the PNG image
      const pngImage = await pdfDoc.embedPng(templateArrayBuffer);
      const pngDims = pngImage.scale(1);

      // Scale image to fit page
      const scale = Math.min(792 / pngDims.width, 612 / pngDims.height);
      const scaledWidth = pngDims.width * scale;
      const scaledHeight = pngDims.height * scale;
      const x = (792 - scaledWidth) / 2;
      const y = (612 - scaledHeight) / 2;

      page.drawImage(pngImage, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight,
      });

      // Add text overlay (you may need to adjust positions based on your certificate design)
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSize = 24;

      // Name (adjust coordinates as needed)
      page.drawText(userName, {
        x: 396 - (userName.length * fontSize * 0.3), // Center horizontally
        y: 350, // Adjust vertical position
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      // Course name
      page.drawText(courseName, {
        x: 396 - (courseName.length * 16 * 0.3), // Center horizontally
        y: 300, // Adjust vertical position
        size: 16,
        font,
        color: rgb(0, 0, 0),
      });

      // Date
      page.drawText(currentDate, {
        x: 100, // Left side
        y: 100, // Bottom area
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      // Certificate ID
      page.drawText(`ID: ${certificateId}`, {
        x: 600, // Right side
        y: 100, // Bottom area
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });

      const pdfBytes = await pdfDoc.save();
      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=${courseId}_certificate.pdf`,
        },
      });
    }

    throw new Error('Unsupported template format');

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate certificate, contact the Avalanche team.', details: (error as Error).message },
      { status: 500 }
    );
  }
}