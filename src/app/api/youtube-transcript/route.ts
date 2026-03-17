import { NextRequest, NextResponse } from 'next/server';

// Force Edge Runtime — runs on Vercel's edge network (Cloudflare-like PoPs)
// instead of AWS Lambda. Edge IPs are less likely to be blocked by YouTube.
export const runtime = 'edge';

const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const MAX_TRANSCRIPT_CHARS = 10_000;
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

function extractVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_REGEX);
  return match ? match[1] : null;
}

/**
 * Fetch YouTube transcript using the IOS innertube client.
 * Runs on Vercel Edge Runtime to avoid AWS IP blocks.
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

    // Call innertube /player API with IOS client (reliable for captions)
    const playerRes = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'IOS',
              clientVersion: '20.10.4',
              hl: 'pt',
              gl: 'BR',
            },
          },
          videoId,
        }),
      },
    );

    if (!playerRes.ok) {
      return NextResponse.json({ error: 'Falha na API do YouTube' }, { status: 502 });
    }

    const playerData = await playerRes.json();

    // Check playability
    const playStatus = playerData?.playabilityStatus?.status;
    const playReason = playerData?.playabilityStatus?.reason || '';

    if (playStatus === 'LOGIN_REQUIRED') {
      return NextResponse.json(
        { error: playReason.includes('bot') ? 'YouTube bloqueou o IP do servidor' : 'Video requer login' },
        { status: playReason.includes('bot') ? 429 : 403 },
      );
    }
    if (playStatus === 'ERROR') {
      return NextResponse.json({ error: 'Video indisponivel' }, { status: 404 });
    }

    // Extract caption tracks
    const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) {
      return NextResponse.json({ error: 'Legendas nao disponiveis para este video' }, { status: 422 });
    }

    // Pick best track
    const track =
      captions.find((c: any) => c.languageCode === 'pt') ||
      captions.find((c: any) => c.languageCode === 'pt-BR') ||
      captions.find((c: any) => c.languageCode === 'en') ||
      captions[0];

    let captionUrl: string = track.baseUrl;
    captionUrl = captionUrl.replace('&fmt=srv3', '');

    if (captionUrl.includes('&exp=xpe')) {
      return NextResponse.json({ error: 'Legendas requerem PoToken' }, { status: 422 });
    }

    // Fetch caption XML
    const captionRes = await fetch(captionUrl);

    if (!captionRes.ok) {
      return NextResponse.json({ error: 'Falha ao buscar legendas' }, { status: 502 });
    }

    const xml = await captionRes.text();

    if (!xml || xml.length === 0) {
      return NextResponse.json({ error: 'Legendas vazias' }, { status: 422 });
    }

    // Parse XML text segments
    const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
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
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      transcript = transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '... [transcricao truncada]';
    }

    const title = playerData?.videoDetails?.title || '';
    const author = playerData?.videoDetails?.author || '';

    return NextResponse.json({ transcript, title, author });
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Timeout ao buscar legendas' }, { status: 504 });
    }
    console.error('[youtube-transcript] Error:', err?.message);
    return NextResponse.json({ error: 'Falha ao buscar transcricao' }, { status: 500 });
  }
}
