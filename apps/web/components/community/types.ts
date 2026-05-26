// Shared types for the community feature

export interface DiscoverFamilyCard {
  id: string;
  family_name: string;
  family_name_slug: string;
  shield_config?: Record<string, string> | null;
  location_country?: string | null;
  location_country_code?: string | null;
  location_region?: string | null;
  faith_tradition?: string | null;
  faith_denomination?: string | null;
  education_purpose?: string | null;
  education_methods: string[];
  home_languages: string[];
  family_culture_excerpt?: string | null;
  children_count: number;
  children_age_min?: number | null;
  children_age_max?: number | null;
}

export interface FamilyDiscoverProfile extends DiscoverFamilyCard {
  family_culture?: string | null;
  worldview_notes?: string | null;
  current_curriculum: string[];
  diet?: string | null;
  screen_policy?: string | null;
  outdoor_orientation?: string | null;
  visible_communities: CommunityCard[];
}

export interface CommunityCard {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  region_scope: 'online' | 'country' | 'country_region';
  country_code?: string | null;
  region?: string | null;
  join_mode: 'request_to_join' | 'invite_only';
  cover_image_url?: string | null;
  member_count: number;
  principle_tags: PrincipleTags;
  child_age_min?: number | null;
  child_age_max?: number | null;
}

export interface CommunityDetail extends CommunityCard {
  description: string;
  principles_text: string;
  created_at: string;
  updated_at: string;
  viewer_role: 'admin' | 'co_admin' | 'member' | null;
  viewer_status: 'pending' | 'active' | 'removed' | null;
}

export interface PrincipleTags {
  faith?: string | null;
  education_methods?: string[];
  home_languages?: string[];
}

export interface MemberCard {
  family_id: string;
  family_name: string;
  family_name_slug: string;
  shield_config?: Record<string, string> | null;
  location_country_code?: string | null;
  location_region?: string | null;
  role: 'admin' | 'co_admin' | 'member';
  status: 'pending' | 'active' | 'removed';
  joined_at?: string | null;
}

export interface MembersList {
  active: MemberCard[];
  pending: MemberCard[];
}

export interface TopicCard {
  id: string;
  community_id: string;
  author_family_id: string;
  author_family_name: string;
  title: string;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  last_reply_at?: string | null;
  created_at: string;
}

export interface ReplyCard {
  id: string;
  topic_id: string;
  author_family_id: string;
  author_family_name: string;
  body: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  edited_at?: string | null;
  created_at: string;
}

export interface TopicDetail {
  id: string;
  community_id: string;
  author_family_id: string;
  author_family_name: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_locked: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  edited_at?: string | null;
  created_at: string;
  replies: ReplyCard[];
}
