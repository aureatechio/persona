import { NextRequest, NextResponse } from 'next/server';
import { runSocialIntelligenceAnalysis } from '@/lib/social-intel/analyze';
import type { SocialIntelInput } from '@/lib/social-intel/types';

function parseActorList(value: string | undefined, fallback: string): string[] {
  const raw = (value || fallback).trim();
  if (!raw) return [fallback];
  const list = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : [fallback];
}

export async function POST(request: NextRequest) {
  const apifyToken = process.env.APIFY_API_TOKEN;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!apifyToken) {
    return NextResponse.json(
      { error: 'APIFY_API_TOKEN não configurada no servidor.' },
      { status: 500 },
    );
  }
  // Diagnostic logs (do not log secrets)
  try {
    console.log('social-intel: apify present?', !!apifyToken);
    console.log('social-intel: actors present?', {
      instagram: !!process.env.APIFY_INSTAGRAM_ACTOR_ID,
      twitter: !!process.env.APIFY_TWITTER_ACTOR_ID,
      tiktok: !!process.env.APIFY_TIKTOK_ACTOR_ID,
      facebook: !!process.env.APIFY_FACEBOOK_ACTOR_ID,
    });
  } catch {
    // ignore logging errors
  }

  let body: SocialIntelInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const hasInput = Boolean(body.instagram || body.twitter || body.tiktok || body.facebook);
  if (!hasInput) {
    return NextResponse.json(
      { error: 'Informe ao menos um perfil (instagram, twitter, tiktok ou facebook).' },
      { status: 400 },
    );
  }

  try {
    const report = await runSocialIntelligenceAnalysis(body, {
      apifyToken,
      openAiKey,
      actorIds: {
        instagram: parseActorList(process.env.APIFY_INSTAGRAM_ACTOR_IDS || process.env.APIFY_INSTAGRAM_ACTOR_ID, 'apify/instagram-profile-scraper'),
        twitter: parseActorList(process.env.APIFY_TWITTER_ACTOR_IDS || process.env.APIFY_TWITTER_ACTOR_ID, 'apidojo/tweet-scraper'),
        tiktok: parseActorList(process.env.APIFY_TIKTOK_ACTOR_IDS || process.env.APIFY_TIKTOK_ACTOR_ID, 'clockworks/tiktok-scraper'),
        facebook: parseActorList(process.env.APIFY_FACEBOOK_ACTOR_IDS || process.env.APIFY_FACEBOOK_ACTOR_ID, 'apify/facebook-posts-scraper'),
      },
    });

    return NextResponse.json(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha na análise social.';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
