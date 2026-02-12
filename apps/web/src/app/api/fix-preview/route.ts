import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.BNBREW_API_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const response = await fetch(`${API_URL}/api/v1/chat/fix-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return NextResponse.json({ success: false, error: 'Fix API error' }, { status: 500 });
  }

  const data = await response.json();
  return NextResponse.json(data);
}
