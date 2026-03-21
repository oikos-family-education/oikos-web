export type LearningStyle =
  | "visual" | "auditory" | "kinesthetic" | "reading_writing" | "social";

export type GradeLevel =
  | "pre_k" | "k"
  | "grade_1" | "grade_2" | "grade_3" | "grade_4" | "grade_5" | "grade_6"
  | "grade_7" | "grade_8" | "grade_9" | "grade_10" | "grade_11" | "grade_12"
  | "stage_early" | "stage_middle" | "stage_upper" | "graduated";

export interface Child {
  id: string;
  family_id: string;
  first_name: string;
  nickname?: string;
  gender?: string;
  avatar_initials?: string;
  birthdate?: string;       // ISO date string
  birth_year?: number;
  birth_month?: number;
  grade_level?: GradeLevel;
  child_curriculum: string[];
  learning_styles: LearningStyle[];
  personality_description?: string;
  personality_tags: string[];
  interests: string[];
  motivators?: string;
  demotivators?: string;
  learning_differences: string[];
  accommodations_notes?: string;
  support_services: string[];
  is_active: boolean;
  created_at: string;
}

export type ChildCreate = Omit<Child, "id" | "family_id" | "is_active" | "created_at">;
