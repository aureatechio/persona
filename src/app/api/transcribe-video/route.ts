/**
 * Proxy video transcription to Python backend on Digital Ocean.
 * Receives multipart FormData from browser, streams it to DO backend
 * which extracts audio (FFmpeg) and transcribes (Whisper).
 */

const BACKEND = process.env.ARENA_BACKEND_URL || 'http://localhost:3002';

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return Response.json(
        { error: 'Expected multipart/form-data' },
        { status: 400 },
      );
    }

    const upstream = await fetch(`${BACKEND}/api/transcribe-upload`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: request.body,
      // @ts-expect-error - duplex required for streaming request body in Node.js fetch
      duplex: 'half',
    });

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => 'Unknown error');
      console.error('[Transcribe Proxy] Upstream error:', upstream.status, errBody.slice(0, 500));
      return new Response(errBody, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await upstream.json();
    return Response.json(data);
  } catch (err: any) {
    console.error('[Transcribe Proxy] Error:', err?.message || err);
    return Response.json(
      { error: 'Servico de transcricao indisponivel', detail: err?.message },
      { status: 502 },
    );
  }
}
