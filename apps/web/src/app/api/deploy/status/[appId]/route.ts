import { NextRequest } from 'next/server';

const API_URL = process.env.BNBREW_API_URL || 'http://localhost:3001';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;

  const response = await fetch(`${API_URL}/api/v1/pipeline/status/${appId}`, {
    headers: { Accept: 'text/event-stream' },
  });

  if (!response.ok || !response.body) {
    return new Response('No active deployment', { status: 404 });
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const reader = response.body.getReader();

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch {
      // Connection closed
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
