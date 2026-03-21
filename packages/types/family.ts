export type FaithTradition =
  | "christian" | "jewish" | "muslim"
  | "secular" | "other" | "none";

export type ScreenPolicy = "screen_free" | "minimal" | "moderate" | "open";

export type FamilyVisibility = "private" | "local" | "public";

export type EducationMethod =
  | "classical" | "charlotte_mason" | "montessori" | "unschooling"
  | "structured" | "eclectic" | "waldorf" | "unit_study" | "online" | "other";

export type ShieldShape = "heater" | "rounded" | "angular" | "split";
export type ShieldPattern = "none" | "horizontal" | "diagonal" | "quarterly";
export type ShieldFontStyle = "serif" | "sans" | "script";

export interface ShieldConfig {
  initials: string;
  shape: ShieldShape;
  background_color: string;
  accent_color: string;
  dividing_pattern: ShieldPattern;
  font_style: ShieldFontStyle;
}

export interface Family {
  id: string;
  family_name: string;
  family_name_slug: string;
  shield_config: ShieldConfig;
  location_city?: string;
  location_region?: string;
  location_country?: string;
  location_country_code?: string;
  faith_tradition?: FaithTradition;
  faith_denomination?: string;
  faith_community_name?: string;
  worldview_notes?: string;
  education_methods: EducationMethod[];
  current_curriculum: string[];
  diet?: string;
  screen_policy?: ScreenPolicy;
  outdoor_orientation?: string;
  home_languages: string[];
  lifestyle_tags: string[];
  family_culture?: string;
  visibility: FamilyVisibility;
  created_at: string;
  updated_at: string;
}

export type FamilyCreate = Omit<Family, "id" | "family_name_slug" | "created_at" | "updated_at">;
