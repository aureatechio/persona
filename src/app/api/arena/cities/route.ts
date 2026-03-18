import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  if (!state) return Response.json({ error: 'state required' }, { status: 400 });

  try {
    // Query distinct cities directly from Supabase — much faster than loading all personas
    const { data, error } = await supabase
      .from('personas')
      .select('city')
      .eq('state', state)
      .not('city', 'is', null);

    if (error) {
      console.error('[Cities] Supabase error:', error);
      return Response.json({ error: 'Query failed' }, { status: 500 });
    }

    // Count personas per city
    const counts: Record<string, number> = {};
    for (const row of data || []) {
      if (row.city) {
        counts[row.city] = (counts[row.city] || 0) + 1;
      }
    }

    const result = Object.entries(counts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => a.city.localeCompare(b.city));

    return Response.json(result, {
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    });
  } catch (err) {
    console.error('[Cities] Error:', err);
    return Response.json({ error: 'Failed to fetch cities' }, { status: 500 });
  }
}
