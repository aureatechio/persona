import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

/**
 * Try innertube IOS client first.
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
    if (status === 'LOGIN_REQUIRED' || status === 'ERROR' || status === 'UNPLAYABLE') return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Fallback: scrape watch page HTML for ytInitialPlayerResponse.
 */
async function getPlayerViaWatchPage(videoId: string) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const marker = 'ytInitialPlayerResponse = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return null;

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
    if (data?.playabilityStatus?.status !== 'OK') return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Returns caption URLs + metadata for a YouTube video.
 * Tries innertube IOS first, falls back to watch page scraping.
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    const match = url.match(YOUTUBE_ID_REGEX);
    if (!match) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }
    const videoId = match[1];

    let playerData = await getPlayerViaInnertube(videoId);
    if (!playerData) {
      playerData = await getPlayerViaWatchPage(videoId);
    }

    if (!playerData) {
      return NextResponse.json({ error: 'Video unavailable' }, { status: 403 });
    }

    const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) {
      return NextResponse.json({ error: 'No captions' }, { status: 422 });
    }

    const tracks = captions.map((c: any) => ({
      lang: c.languageCode,
      url: c.baseUrl.replace('&fmt=srv3', ''),
      kind: c.kind || 'standard',
    }));

    return NextResponse.json({
      tracks,
      title: playerData?.videoDetails?.title || '',
      author: playerData?.videoDetails?.author || '',
    });
  } catch (err: any) {
    console.error('[youtube-caption-urls] Error:', err?.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
