import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { videoId } = await req.json();
  const results: Record<string, any> = {};

  // Test 1: Innertube IOS
  try {
    const res = await fetch(
      'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { clientName: 'IOS', clientVersion: '20.10.4', hl: 'pt', gl: 'BR' } },
          videoId,
        }),
        signal: AbortSignal.timeout(6000),
      },
    );
    const data = await res.json();
    const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    results.innertube = {
      http: res.status,
      playStatus: data?.playabilityStatus?.status,
      reason: data?.playabilityStatus?.reason || '',
      captionTracks: captions.length,
    };
  } catch (e: any) {
    results.innertube = { error: e?.message };
  }

  // Test 2: Watch page
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
    const html = await res.text();
    const hasPlayer = html.includes('ytInitialPlayerResponse');
    const hasConsent = html.includes('consent.youtube') || html.includes('CONSENT');
    const hasCaptcha = html.includes('captcha') || html.includes('recaptcha');

    let playerStatus = '';
    let captionCount = 0;
    if (hasPlayer) {
      const marker = 'ytInitialPlayerResponse = ';
      const startIdx = html.indexOf(marker);
      const jsonStart = startIdx + marker.length;
      let depth = 0;
      let jsonEnd = -1;
      for (let i = jsonStart; i < Math.min(jsonStart + 300000, html.length); i++) {
        if (html[i] === '{') depth++;
        else if (html[i] === '}') { depth--; if (depth === 0) { jsonEnd = i + 1; break; } }
      }
      if (jsonEnd > 0) {
        try {
          const data = JSON.parse(html.slice(jsonStart, jsonEnd));
          playerStatus = data?.playabilityStatus?.status || '';
          captionCount = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length || 0;
        } catch { playerStatus = 'PARSE_ERROR'; }
      }
    }

    results.watchPage = {
      http: res.status,
      htmlLength: html.length,
      hasPlayer,
      hasConsent,
      hasCaptcha,
      playerStatus,
      captionCount,
      first200: html.slice(0, 200),
    };
  } catch (e: any) {
    results.watchPage = { error: e?.message };
  }

  // Test 3: Direct timedtext (no signature)
  try {
    const res = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=pt&kind=asr`);
    const text = await res.text();
    results.timedtext = { http: res.status, length: text.length, hasContent: text.length > 50 };
  } catch (e: any) {
    results.timedtext = { error: e?.message };
  }

  return NextResponse.json(results);
}
