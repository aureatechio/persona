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

function pickBestTrack(captions: any[]): any | null {
  return (
    captions.find((c: any) => c.languageCode === 'pt') ||
    captions.find((c: any) => c.languageCode === 'pt-BR') ||
    captions.find((c: any) => c.languageCode === 'en') ||
    captions[0] || null
  );
}

function parseTranscriptXml(xml: string): string[] {
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
  return texts;
}

/**
 * Try to get player data via innertube IOS client.
 * Returns null if blocked by YouTube.
 */
async function getPlayerViaInnertube(videoId: string) {
  try {
    const res = await fetch(
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
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const status = data?.playabilityStatus?.status;
    if (status === 'LOGIN_REQUIRED' || status === 'ERROR' || status === 'UNPLAYABLE') {
      console.log(`[youtube-transcript] Innertube blocked: ${status}`);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Fallback: scrape the YouTube watch page HTML for ytInitialPlayerResponse.
 * YouTube is less aggressive about blocking page loads vs. API calls.
 */
async function getPlayerViaWatchPage(videoId: string) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=pt&bpctr=9999999999&has_verified=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': 'SOCS=CAISNQgDEitib3FfaWRlbnRpdHlfZnJvbnRlbmRfdWlzZXJ2ZXJfMjAyMzA4MjkuMDdfcDAGEA; CONSENT=YES+cb.20210328-17-p0.en+FX+987',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.log(`[youtube-transcript] Watch page HTTP ${res.status}`);
      return null;
    }
    const html = await res.text();

    // Find the JSON by brace counting (regex .+? stops at first }; which truncates the 60K+ JSON)
    const marker = 'ytInitialPlayerResponse = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) {
      console.log(`[youtube-transcript] Watch page: ytInitialPlayerResponse not found (HTML ${html.length} chars)`);
      return null;
    }

    const jsonStart = startIdx + marker.length;
    let depth = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') {
        depth--;
        if (depth === 0) { jsonEnd = i + 1; break; }
      }
    }
    if (jsonEnd === -1) return null;

    const data = JSON.parse(html.slice(jsonStart, jsonEnd));
    const status = data?.playabilityStatus?.status;
    if (status !== 'OK') {
      console.log(`[youtube-transcript] Watch page status: ${status}`);
      return null;
    }
    console.log(`[youtube-transcript] Watch page scrape succeeded`);
    return data;
  } catch (e: any) {
    console.log(`[youtube-transcript] Watch page scrape failed: ${e?.message}`);
    return null;
  }
}

/**
 * Last resort: try fetching timedtext directly with common languages.
 * Doesn't need innertube at all — just guesses the caption URL format.
 */
async function getTranscriptViaTimedtext(videoId: string): Promise<{ transcript: string; title: string; author: string } | null> {
  const langs = ['pt', 'pt-BR', 'en'];

  for (const lang of langs) {
    for (const kind of ['asr', '']) {
      try {
        const params = new URLSearchParams({ v: videoId, lang, fmt: 'srv1' });
        if (kind) params.set('kind', kind);

        const res = await fetch(`https://www.youtube.com/api/timedtext?${params}`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;

        const xml = await res.text();
        if (!xml || xml.length < 50) continue;

        const texts = parseTranscriptXml(xml);
        if (texts.length === 0) continue;

        let transcript = texts.join(' ');
        if (transcript.length > MAX_TRANSCRIPT_CHARS) {
          transcript = transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '... [transcricao truncada]';
        }

        console.log(`[youtube-transcript] Timedtext direct succeeded (lang=${lang}, kind=${kind})`);
        return { transcript, title: '', author: '' };
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Fetch YouTube transcript with fallback chain:
 * 1. Innertube IOS client (fast, but may be blocked on cloud IPs)
 * 2. Watch page HTML scrape (slower, but rarely blocked)
 * 3. Direct timedtext API (no innertube, brute-force langs)
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

    // Try innertube first, fall back to watch page scraping
    let playerData = await getPlayerViaInnertube(videoId);
    let source = 'innertube';

    if (!playerData) {
      playerData = await getPlayerViaWatchPage(videoId);
      source = 'watch-page';
    }

    if (!playerData) {
      // Last resort: try timedtext directly (no innertube needed)
      const directResult = await getTranscriptViaTimedtext(videoId);
      if (directResult) {
        return NextResponse.json(directResult);
      }
      return NextResponse.json({ error: 'YouTube bloqueou o IP do servidor' }, { status: 429 });
    }

    // Extract caption tracks
    const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) {
      return NextResponse.json({ error: 'Legendas nao disponiveis para este video' }, { status: 422 });
    }

    const track = pickBestTrack(captions);
    if (!track) {
      return NextResponse.json({ error: 'Legendas nao disponiveis para este video' }, { status: 422 });
    }

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

    const texts = parseTranscriptXml(xml);
    if (texts.length === 0) {
      return NextResponse.json({ error: 'Nenhum texto nas legendas' }, { status: 422 });
    }

    let transcript = texts.join(' ');
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      transcript = transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '... [transcricao truncada]';
    }

    const title = playerData?.videoDetails?.title || '';
    const author = playerData?.videoDetails?.author || '';

    console.log(`[youtube-transcript] OK via ${source}: "${title}" (${transcript.length} chars)`);
    return NextResponse.json({ transcript, title, author });
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Timeout ao buscar legendas' }, { status: 504 });
    }
    console.error('[youtube-transcript] Error:', err?.message);
    return NextResponse.json({ error: 'Falha ao buscar transcricao' }, { status: 500 });
  }
}
