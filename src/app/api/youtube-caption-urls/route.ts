import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

/**
 * Returns caption URLs + metadata for a YouTube video.
 * The client fetches the actual caption XML directly (residential IP, not blocked).
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

    const playerRes = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
          videoId,
        }),
      },
    );

    if (!playerRes.ok) {
      return NextResponse.json({ error: 'YouTube API failed' }, { status: 502 });
    }

    const playerData = await playerRes.json();
    const playStatus = playerData?.playabilityStatus?.status;

    if (playStatus === 'LOGIN_REQUIRED' || playStatus === 'ERROR') {
      return NextResponse.json({ error: 'Video unavailable' }, { status: 403 });
    }

    const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) {
      return NextResponse.json({ error: 'No captions' }, { status: 422 });
    }

    // Return all caption tracks so client can pick the best one
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
