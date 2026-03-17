// Test different innertube clients to find one that works from cloud IPs
// We simulate a cloud IP by checking which clients return captions

const VIDEO_ID = '0KOVHPyJ8FA';
const API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const clients = [
  { clientName: 'ANDROID', clientVersion: '20.10.38' },
  { clientName: 'IOS', clientVersion: '20.10.38' },
  { clientName: 'TVHTML5', clientVersion: '7.20240101' },
  { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0' },
  { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20240101' },
  { clientName: 'WEB_CREATOR', clientVersion: '1.20240101' },
  { clientName: 'ANDROID_MUSIC', clientVersion: '7.27.52' },
  { clientName: 'ANDROID_EMBEDDED_PLAYER', clientVersion: '20.10.38' },
  { clientName: 'MEDIA_CONNECT_FRONTEND', clientVersion: '0.1' },
];

for (const client of clients) {
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client },
        videoId: VIDEO_ID,
      }),
    });

    const data = await res.json();
    const status = data?.playabilityStatus?.status;
    const reason = data?.playabilityStatus?.reason || '';
    const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    const hasCaptions = captions && captions.length > 0;
    const hasXpe = hasCaptions && captions[0]?.baseUrl?.includes('exp=xpe');

    console.log(`${client.clientName}: status=${status} captions=${hasCaptions ? captions.length : 0} xpe=${hasXpe} reason="${reason.slice(0, 50)}"`);

    if (hasCaptions && !hasXpe) {
      // Try fetching the actual caption content
      const captionUrl = captions[0].baseUrl.replace('&fmt=srv3', '');
      const capRes = await fetch(captionUrl);
      const xml = await capRes.text();
      const hasContent = xml.length > 0 && xml.includes('<text');
      console.log(`  → Caption fetch: ${xml.length} bytes, hasContent=${hasContent}`);
    }
  } catch (e) {
    console.log(`${client.clientName}: ERROR ${e.message}`);
  }
}
