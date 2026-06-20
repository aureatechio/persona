import { supabaseAdmin } from '@/lib/supabase-admin';
import SelfieCaptureV2 from './SelfieCaptureV2';

// Lê sempre do banco a cada request — trocar o logo no admin reflete na hora.
export const dynamic = 'force-dynamic';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';

async function fetchLogoUrl(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('video_base_models')
    .select('logo_storage_path')
    .eq('slug', 'ricardomarques')
    .eq('is_active', true)
    .maybeSingle();

  const path = data?.logo_storage_path;
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/voice-models/${path}`;
}

export default async function RicardoMarquesPage() {
  const logoUrl = await fetchLogoUrl();
  return <SelfieCaptureV2 logoUrl={logoUrl} />;
}
