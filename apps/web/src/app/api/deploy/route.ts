import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.BNBREW_API_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const response = await fetch(`${API_URL}/api/v1/pipeline/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appSpec: body.appSpec,
      ownerAddress: body.ownerAddress,
      contractSources: body.contractSources,
      previewFiles: body.previewFiles,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: text || 'Deploy API error' },
      { status: response.status },
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
