import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const duneApiKey = process.env.DUNE_API_KEY;
  if (!duneApiKey) {
    return NextResponse.json({ error: 'Dune API key not configured' }, { status: 500 });
  }

  try {
    const { executionId } = await params;

    if (!executionId) {
      return NextResponse.json({ error: 'Missing execution ID' }, { status: 400 });
    }

    const response = await fetch(
      `https://api.dune.com/api/v1/execution/${executionId}/status`,
      {
        headers: { 'X-Dune-API-Key': duneApiKey },
      }
    );

    if (!response.ok) {
      console.warn('[Dune] Status check failed:', response.status);
      return NextResponse.json({ error: 'Failed to check status' }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json({
      executionId: data.execution_id,
      queryId: data.query_id,
      state: data.state,
      isFinished: data.is_execution_finished,
      submittedAt: data.submitted_at,
      executionStartedAt: data.execution_started_at,
      executionEndedAt: data.execution_ended_at,
    });
  } catch (error) {
    console.error('[Dune] Status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

