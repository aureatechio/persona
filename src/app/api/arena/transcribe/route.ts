/**
 * POST /api/arena/transcribe
 * Receives audio file (multipart FormData) and transcribes via OpenAI Whisper API.
 * Returns { text: string }
 */

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Send to OpenAI Whisper
    const whisperForm = new FormData();
    whisperForm.append('file', file, file.name || 'audio.m4a');
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'pt');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => 'Unknown error');
      console.error('[Transcribe] Whisper error:', res.status, err.slice(0, 300));
      return Response.json({ error: 'Transcription failed' }, { status: 502 });
    }

    const data = await res.json();
    return Response.json({ text: data.text || '' });
  } catch (err: any) {
    console.error('[Transcribe] Error:', err?.message || err);
    return Response.json({ error: 'Internal error', detail: err?.message }, { status: 500 });
  }
}
