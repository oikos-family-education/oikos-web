/**
 * Maps a subject_category enum value (e.g. "core_academic")
 * to the flat i18n key (e.g. "categoryCoreAcademic") in the Subjects namespace.
 */
const CATEGORY_KEY_MAP: Record<string, string> = {
  core_academic: 'categoryCoreAcademic',
  language: 'categoryLanguage',
  scripture_theology: 'categoryScriptureTheology',
  arts: 'categoryArts',
  physical: 'categoryPhysical',
  practical_life: 'categoryPracticalLife',
  logic_rhetoric: 'categoryLogicRhetoric',
  technology: 'categoryTechnology',
  elective: 'categoryElective',
  co_op: 'categoryCoOp',
  other: 'categoryOther',
};

export function categoryKey(category: string): string {
  return CATEGORY_KEY_MAP[category] || 'categoryOther';
}
