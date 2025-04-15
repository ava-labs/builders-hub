import { NextResponse } from 'next/server';

interface HubspotField {
  name: string;
  value: string | number | boolean;
}

interface HubspotSubmission {
  fields: HubspotField[];
  context: {
    pageUri: string;
    pageName: string;
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.json() as Record<string, string | number | boolean>;
    const hubspotData: HubspotSubmission = {
      fields: Object.entries(formData).map(([name, value]) => {
        const formattedValue = typeof value === 'boolean' 
          ? (value ? 'true' : 'false') 
          : value;
          
        return {
          name,
          value: formattedValue
        };
      }),
      context: {
        pageUri: request.headers.get('referer') || 'https://build.avax.network/grants/infrabuidl',
        pageName: "InfraBUIDL Grant Application"
      }
    };

    const PORTAL_ID = "7522520";
    const FORM_ID = "615368bb-3407-462c-bf81-dd8f5b72783c";

    const response = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(hubspotData)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit to HubSpot');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Form submitted successfully',
      data 
    });
  } catch (error) {
    console.error('HubSpot submission error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error submitting form to HubSpot' },
      { status: 500 }
    );
  }
}