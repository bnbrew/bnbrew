import { NextRequest } from 'next/server';

const API_URL = process.env.BNBREW_API_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const response = await fetch(`${API_URL}/api/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: body.sessionId,
      messages: body.messages,
      walletAddress: body.walletAddress,
    }),
  });

  if (!response.ok) {
    return new Response('Chat API error', { status: response.status });
  }

  // Stream the response through to the client
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const reader = response.body?.getReader();

  if (!reader) {
    return new Response('No response stream', { status: 500 });
  }

  // Pipe the upstream SSE stream to the client
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (error) {
      console.error('Stream error:', error);
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
