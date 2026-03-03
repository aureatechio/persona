export type FollowerCategory =
  | 'politico'
  | 'religioso'
  | 'empresario'
  | 'influenciador'
  | 'jornalista'
  | 'ativista'
  | 'celebridade'
  | 'funcionario_publico'
  | 'educador'
  | 'saude'
  | 'juridico'
  | 'outro';

export interface InstagramAccount {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InstagramFollower {
  id: string;
  account_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  ai_summary: string | null;
  category: FollowerCategory;
  category_label: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GeneratedPost {
  id: string;
  category: FollowerCategory;
  title: string | null;
  description: string | null;
  image_url: string | null;
  media_type: 'image' | 'video' | 'carousel';
  tags: string[];
  is_active: boolean;
  created_at: string;
}

export interface FollowerWithPost extends InstagramFollower {
  generatedPost: GeneratedPost | null;
}

export interface CategoryMeta {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}
