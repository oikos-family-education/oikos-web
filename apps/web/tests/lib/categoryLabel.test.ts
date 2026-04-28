import { describe, it, expect } from 'vitest';
import { categoryKey } from '../../lib/categoryLabel';

describe('categoryKey', () => {
  it('maps every known category to its i18n key', () => {
    const KNOWN: Record<string, string> = {
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
    for (const [cat, key] of Object.entries(KNOWN)) {
      expect(categoryKey(cat)).toBe(key);
    }
  });

  it('falls back to categoryOther for unknown values', () => {
    expect(categoryKey('does_not_exist')).toBe('categoryOther');
    expect(categoryKey('')).toBe('categoryOther');
    expect(categoryKey('CORE_ACADEMIC')).toBe('categoryOther'); // case-sensitive
  });
});
