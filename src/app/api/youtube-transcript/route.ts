import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const MAX_TRANSCRIPT_CHARS = 10_000;

function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_REGEX);
  return match ? match[1] : null;
}

/**
 * Fetch YouTube transcript using the ANDROID innertube client.
 *
 * The key insight (from youtube-transcript-api Python package):
 * - The WEB client returns caption URLs with `&exp=xpe` that require PoToken
 * - The ANDROID client returns caption URLs WITHOUT that restriction
 * - Caption XML from ANDROID URLs works from any IP (server or browser)
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Step 1: Fetch the watch page to get the API key
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'Accept-Language': 'en-US',
        'Cookie': 'CONSENT=YES+1',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!pageRes.ok) {
      return NextResponse.json({ error: 'Falha ao acessar YouTube' }, { status: 502 });
    }

    const html = await pageRes.text();

    // Check for IP block
    if (html.includes('class="g-recaptcha"')) {
      return NextResponse.json({ error: 'YouTube bloqueou o IP do servidor' }, { status: 429 });
    }

    // Extract API key
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
    if (!apiKeyMatch) {
      return NextResponse.json({ error: 'Falha ao extrair API key do YouTube' }, { status: 500 });
    }
    const apiKey = apiKeyMatch[1];

    // Step 2: Use ANDROID client to get player data with caption URLs
    // (ANDROID client returns URLs that work without PoToken)
    const playerRes = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '20.10.38',
            },
          },
          videoId,
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!playerRes.ok) {
      return NextResponse.json({ error: 'Falha na API do YouTube' }, { status: 502 });
    }

    const playerData = await playerRes.json();

    // Check playability
    const playStatus = playerData?.playabilityStatus?.status;
    if (playStatus === 'LOGIN_REQUIRED') {
      const reason = playerData?.playabilityStatus?.reason || '';
      if (reason.includes('bot')) {
        return NextResponse.json({ error: 'YouTube bloqueou o IP do servidor' }, { status: 429 });
      }
      return NextResponse.json({ error: 'Video requer login' }, { status: 403 });
    }
    if (playStatus === 'ERROR') {
      return NextResponse.json({ error: 'Video indisponivel' }, { status: 404 });
    }

    // Extract caption tracks
    const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) {
      return NextResponse.json({ error: 'Legendas nao disponiveis para este video' }, { status: 422 });
    }

    // Pick best track (prefer pt, then en, then any)
    const track =
      captions.find((c: any) => c.languageCode === 'pt') ||
      captions.find((c: any) => c.languageCode === 'pt-BR') ||
      captions.find((c: any) => c.languageCode === 'en') ||
      captions[0];

    let captionUrl: string = track.baseUrl;

    // Remove srv3 format if present (we want default XML)
    captionUrl = captionUrl.replace('&fmt=srv3', '');

    // Check for PoToken requirement
    if (captionUrl.includes('&exp=xpe')) {
      return NextResponse.json({ error: 'Legendas requerem PoToken (nao suportado)' }, { status: 422 });
    }

    // Step 3: Fetch the caption XML
    const captionRes = await fetch(captionUrl, {
      signal: AbortSignal.timeout(8_000),
    });

    if (!captionRes.ok) {
      return NextResponse.json({ error: 'Falha ao buscar legendas' }, { status: 502 });
    }

    const xml = await captionRes.text();

    if (!xml || xml.length === 0) {
      return NextResponse.json({ error: 'Legendas vazias' }, { status: 422 });
    }

    // Step 4: Parse XML text segments
    const textRegex = /<text[^>]*>(.*?)<\/text>/gs;
    const texts: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = textRegex.exec(xml)) !== null) {
      const decoded = match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, '');
      if (decoded.trim()) texts.push(decoded.trim());
    }

    if (texts.length === 0) {
      return NextResponse.json({ error: 'Nenhum texto nas legendas' }, { status: 422 });
    }

    let transcript = texts.join(' ');

    // Truncate long transcripts
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      transcript = transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '... [transcricao truncada]';
    }

    // Extract metadata
    const title = playerData?.videoDetails?.title || '';
    const author = playerData?.videoDetails?.author || '';

    console.log(`[youtube-transcript] OK — ${videoId} | ${texts.length} segments | ${transcript.length} chars`);
    return NextResponse.json({ transcript, title, author });
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Timeout ao buscar legendas' }, { status: 504 });
    }
    console.error('[youtube-transcript] Error:', err?.message);
    return NextResponse.json({ error: 'Falha ao buscar transcricao' }, { status: 500 });
  }
}
