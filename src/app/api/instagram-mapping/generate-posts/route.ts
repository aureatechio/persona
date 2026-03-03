import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { InstagramFollower, GeneratedPost, FollowerWithPost } from '@/lib/instagram-mapping/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sobfplitrzgggzqsycew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { accountId } = body as { accountId: string };

    if (!accountId) {
      return NextResponse.json({ error: 'accountId obrigatorio' }, { status: 400 });
    }

    // Fetch all followers for the account
    const { data: followers, error: followersError } = await supabase
      .from('instagram_followers')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (followersError) {
      return NextResponse.json({ error: followersError.message }, { status: 500 });
    }

    if (!followers || followers.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Get distinct categories
    const categories = [...new Set((followers as InstagramFollower[]).map((f) => f.category))];

    // Fetch all active posts for those categories
    const { data: posts, error: postsError } = await supabase
      .from('generated_posts')
      .select('*')
      .in('category', categories)
      .eq('is_active', true);

    if (postsError) {
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    // Group posts by category
    const postsByCategory: Record<string, GeneratedPost[]> = {};
    for (const post of (posts || []) as GeneratedPost[]) {
      if (!postsByCategory[post.category]) {
        postsByCategory[post.category] = [];
      }
      postsByCategory[post.category].push(post);
    }

    // Match each follower to a random post of their category
    const results: FollowerWithPost[] = (followers as InstagramFollower[]).map((follower) => {
      const categoryPosts = postsByCategory[follower.category] || [];
      const randomPost = categoryPosts.length > 0
        ? categoryPosts[Math.floor(Math.random() * categoryPosts.length)]
        : null;

      return {
        ...follower,
        generatedPost: randomPost,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
