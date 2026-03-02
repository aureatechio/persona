import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('url');
  if (!source) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream image failed (${upstream.status})` }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = await upstream.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to proxy image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
