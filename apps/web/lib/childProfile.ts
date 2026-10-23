// Shared labels and helpers for showing a child's profile (child page, child report).

export const GRADE_LABELS: Record<string, string> = {
  pre_k: 'Pre-K', k: 'Kindergarten',
  grade_1: 'Grade 1', grade_2: 'Grade 2', grade_3: 'Grade 3',
  grade_4: 'Grade 4', grade_5: 'Grade 5', grade_6: 'Grade 6',
  grade_7: 'Grade 7', grade_8: 'Grade 8', grade_9: 'Grade 9',
  grade_10: 'Grade 10', grade_11: 'Grade 11', grade_12: 'Grade 12',
  stage_early: 'Early Stage', stage_middle: 'Middle Stage',
  stage_upper: 'Upper Stage', graduated: 'Graduated',
};

export const LEARNING_STYLE_LABELS: Record<string, string> = {
  visual: 'Visual', auditory: 'Auditory', kinesthetic: 'Kinesthetic',
  reading_writing: 'Reading-Writing', social: 'Social',
};

export function computeAge(birthdate?: string | null, birthYear?: number | null): number | null {
  const now = new Date();
  if (birthdate) {
    const bd = new Date(birthdate);
    let age = now.getFullYear() - bd.getFullYear();
    const monthDiff = now.getMonth() - bd.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < bd.getDate())) age--;
    return age;
  }
  if (birthYear) return now.getFullYear() - birthYear;
  return null;
}
