import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import SelfieCapture, { type ModelConfig } from './SelfieCapture';

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchModel(slug: string): Promise<ModelConfig | null> {
  const { data, error } = await supabaseAdmin
    .from('video_base_models')
    .select('id, slug, display_name, name, thank_you_message, is_active, video_storage_path, whatsapp_number')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return {
    slug: data.slug,
    displayName: data.display_name || data.name || data.slug,
    thankYouMessage: data.thank_you_message || null,
    hasVideoBase: !!data.video_storage_path,
    whatsappNumber: data.whatsapp_number || null,
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
