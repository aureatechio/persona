import { NextResponse } from 'next/server';

/**
 * Transcribe video/audio using OpenAI Whisper API.
 * Accepts base64-encoded video, extracts audio, sends to Whisper.
 * Supports videos up to ~2 minutes.
 */
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured' },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const { data, name, mimeType } = body as {
      data: string; // base64 data URI or raw base64
      name: string;
      mimeType?: string;
    };

    if (!data) {
      return NextResponse.json({ error: 'No video data provided' }, { status: 400 });
    }

    // Extract raw base64 from data URI if needed
    let rawBase64 = data;
    let detectedMime = mimeType || 'video/mp4';

    if (data.startsWith('data:')) {
      const match = data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        detectedMime = match[1];
        rawBase64 = match[2];
      }
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(rawBase64, 'base64');

    // Check size (25MB Whisper limit)
    if (buffer.length > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Maximo 25MB.' },
        { status: 413 },
      );
    }

    // Determine file extension for Whisper
    const ext = detectedMime.includes('webm') ? 'webm'
      : detectedMime.includes('mp4') ? 'mp4'
      : detectedMime.includes('mov') ? 'mov'
      : detectedMime.includes('mpeg') ? 'mp3'
      : detectedMime.includes('wav') ? 'wav'
      : detectedMime.includes('ogg') ? 'ogg'
      : 'mp4';

    // Use correct extension for the file name (Whisper needs it)
    const baseName = (name || 'recording').replace(/\.[^.]+$/, '');
    const fileName = `${baseName}.${ext}`;

    // Build form data for Whisper API
    const formData = new FormData();
    const blob = new Blob([buffer], { type: detectedMime });
    formData.append('file', blob, fileName);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'text');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('[Transcribe] Whisper error:', errText);
      return NextResponse.json(
        { error: 'Falha na transcricao', detail: errText },
        { status: 500 },
      );
    }

    const transcript = await whisperRes.text();

    return NextResponse.json({
      transcript: transcript.trim(),
      duration_hint: `~${Math.round(buffer.length / 16000)}s`, // rough estimate
    });
  } catch (err: any) {
    console.error('[Transcribe] Error:', err?.message || err);
    return NextResponse.json(
      { error: 'Falha ao transcrever video', detail: err?.message },
      { status: 500 },
    );
  }
}
