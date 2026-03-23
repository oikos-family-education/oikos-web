export type FaithTradition =
  | "christian" | "jewish" | "muslim"
  | "secular" | "other" | "none";

export type ScreenPolicy = "screen_free" | "minimal" | "moderate" | "open";

export type FamilyVisibility = "private" | "local" | "public";

export type EducationPurpose = "full_homeschool" | "school_supplement" | "family_routine";

export type EducationMethod =
  | "classical" | "charlotte_mason" | "montessori" | "unschooling"
  | "structured" | "eclectic" | "waldorf" | "unit_study" | "online" | "other";

export type ShieldShape = "heater" | "rounded" | "kite" | "swiss" | "french" | "polish" | "lozenge" | "oval";
export type ShieldDivision = "none" | "chess" | "stripes_h" | "stripes_v" | "stripes_d" | "dots" | "diamonds" | "stars" | "crosses" | "leaves" | "scales" | "waves" | "fleur";
export type ShieldFontStyle = "serif" | "sans" | "script" | "gothic" | "classic";

export interface ShieldConfig {
  initials: string;
  shape: ShieldShape;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  symbol_color: string;
  division: ShieldDivision;
  crest_animal: string;
  flourish: string;
  center_symbol: string;
  motto: string;
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
  education_purpose?: EducationPurpose;
  education_methods: EducationMethod[];
  current_curriculum: string[];
  diet?: string;
  screen_policy?: ScreenPolicy;
  outdoor_orientation?: string;
  home_languages: string[];
  family_culture?: string;
  visibility: FamilyVisibility;
  created_at: string;
  updated_at: string;
}

export type FamilyCreate = Omit<Family, "id" | "family_name_slug" | "created_at" | "updated_at">;
