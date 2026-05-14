import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const MAX_CUSTOM_CHARS = 250;
const MAX_NAME_CHARS = 60;
const MAX_USER_ID_CHARS = 200;
const MAX_WEBHOOK_URL_CHARS = 500;
const MAX_METADATA_BYTES = 4000;

function isValidHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Optional shared-secret guard. When SUPIA_N8N_TOKEN is set, callers must
  // send it via Authorization: Bearer <token>. Leaving the env var unset
  // keeps the endpoint open (useful for local/dev), matching how the other
  // /api/supia/* routes behave today.
  const expectedToken = process.env.SUPIA_N8N_TOKEN;
  if (expectedToken) {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const supermarketName = ((body.supermarketName as string) || '').trim();
  const userId = ((body.userId as string) || '').trim();
  const webhookUrl = ((body.webhookUrl as string) || '').trim();
  const customPhraseRaw = (body.customPhrase as string | undefined) ?? null;
  const customPhrase =
    typeof customPhraseRaw === 'string' && customPhraseRaw.trim() ? customPhraseRaw.trim() : null;

  // Generic passthrough bag — whatever the caller wants echoed back in the
  // webhook callback (logo_url, banner_url, theme colors, etc.). The worker
  // never reads from this; it's just stored and returned.
  let metadata: Record<string, unknown> | null = null;
  const metadataRaw = body.metadata;
  if (metadataRaw !== undefined && metadataRaw !== null) {
    if (typeof metadataRaw !== 'object' || Array.isArray(metadataRaw)) {
      return NextResponse.json(
        { error: 'metadata deve ser um objeto JSON' },
        { status: 400 },
      );
    }
    const serialized = JSON.stringify(metadataRaw);
    if (serialized.length > MAX_METADATA_BYTES) {
      return NextResponse.json(
        { error: `metadata muito grande (máx ${MAX_METADATA_BYTES} bytes serializados)` },
        { status: 400 },
      );
    }
    metadata = metadataRaw as Record<string, unknown>;
  }

  if (!supermarketName) {
    return NextResponse.json({ error: 'supermarketName é obrigatório' }, { status: 400 });
  }
  if (supermarketName.length > MAX_NAME_CHARS) {
    return NextResponse.json(
      { error: `supermarketName muito longo (máx ${MAX_NAME_CHARS} caracteres)` },
      { status: 400 },
    );
  }
  if (!userId) {
    return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
  }
  if (userId.length > MAX_USER_ID_CHARS) {
    return NextResponse.json(
      { error: `userId muito longo (máx ${MAX_USER_ID_CHARS} caracteres)` },
      { status: 400 },
    );
  }
  if (!webhookUrl) {
    return NextResponse.json({ error: 'webhookUrl é obrigatório' }, { status: 400 });
  }
  if (webhookUrl.length > MAX_WEBHOOK_URL_CHARS || !isValidHttpsUrl(webhookUrl)) {
    return NextResponse.json({ error: 'webhookUrl inválido' }, { status: 400 });
  }
  if (customPhrase && customPhrase.length > MAX_CUSTOM_CHARS) {
    return NextResponse.json(
      { error: `customPhrase muito longo (máx ${MAX_CUSTOM_CHARS} caracteres)` },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('supia_videos')
    .insert({
      supermarket_name: supermarketName,
      custom_phrase: customPhrase,
      user_id: userId,
      webhook_url: webhookUrl,
      metadata,
      status: 'queued',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('supia/n8n insert error:', error);
    return NextResponse.json({ error: 'Falha ao enfileirar' }, { status: 500 });
  }

  return NextResponse.json({ requestId: data.id, status: 'queued' }, { status: 202 });
}
