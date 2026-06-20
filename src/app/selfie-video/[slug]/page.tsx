import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import SelfieCapture, { type ModelConfig } from './SelfieCapture';

interface Props {
  params: Promise<{ slug: string }>;
}

// Lê sempre do banco a cada request — assim trocar o logo/dados do político
// no admin reflete imediatamente, sem cache estático servindo HTML antigo.
export const dynamic = 'force-dynamic';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';

function logoPublicUrl(path: string | null): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/voice-models/${path}`;
}

async function fetchModel(slug: string): Promise<ModelConfig | null> {
  const { data, error } = await supabaseAdmin
    .from('video_base_models')
    .select('id, slug, display_name, name, thank_you_message, is_active, video_storage_path, logo_storage_path')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return {
    slug: data.slug,
    displayName: data.display_name || data.name || data.slug,
    thankYouMessage: data.thank_you_message || null,
    hasVideoBase: !!data.video_storage_path,
    logoUrl: logoPublicUrl(data.logo_storage_path || null),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const model = await fetchModel(slug);
  if (!model) {
    return { title: 'Político não encontrado' };
  }
  return {
    title: `Grave seu depoimento | ${model.displayName}`,
    description: `Grave um vídeo curto e receba uma resposta personalizada de ${model.displayName} no WhatsApp.`,
  };
}

export default async function SelfieVideoDynamicPage({ params }: Props) {
  const { slug } = await params;
  const model = await fetchModel(slug);

  if (!model) notFound();
  if (!model.hasVideoBase) {
    // Modelo cadastrado mas ainda sem vídeo base — pipeline quebraria.
    notFound();
  }

  return <SelfieCapture model={model} />;
}
