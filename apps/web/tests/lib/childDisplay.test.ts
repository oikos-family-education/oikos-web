import { describe, it, expect } from 'vitest';
import { getChildDisplayName, getChildInitials } from '../../lib/childDisplay';

describe('getChildDisplayName', () => {
  it('returns the nickname when one is set', () => {
    expect(getChildDisplayName({ first_name: 'Alexandra', nickname: 'Alex' })).toBe('Alex');
  });

  it('falls back to first_name when nickname is null', () => {
    expect(getChildDisplayName({ first_name: 'Alexandra', nickname: null })).toBe('Alexandra');
  });

  it('falls back to first_name when nickname is undefined', () => {
    expect(getChildDisplayName({ first_name: 'Alexandra' })).toBe('Alexandra');
  });

  it('falls back to first_name when nickname is an empty string', () => {
    expect(getChildDisplayName({ first_name: 'Alexandra', nickname: '' })).toBe('Alexandra');
  });

  it('falls back to first_name when nickname is whitespace only', () => {
    expect(getChildDisplayName({ first_name: 'Alexandra', nickname: '   ' })).toBe('Alexandra');
  });

  it('returns an empty string for null/undefined input', () => {
    expect(getChildDisplayName(null)).toBe('');
    expect(getChildDisplayName(undefined)).toBe('');
  });
});

describe('getChildInitials', () => {
  it('takes the first letter of the nickname when present', () => {
    expect(getChildInitials({ first_name: 'Alexandra', nickname: 'Lexi' })).toBe('L');
  });

  it('takes the first letter of first_name when nickname is empty', () => {
    expect(getChildInitials({ first_name: 'Alexandra', nickname: null })).toBe('A');
  });

  it('uppercases the initial', () => {
    expect(getChildInitials({ first_name: 'alice', nickname: null })).toBe('A');
    expect(getChildInitials({ first_name: 'Bob', nickname: 'beans' })).toBe('B');
  });

  it("returns '?' when the child has no usable name", () => {
    expect(getChildInitials({ first_name: '', nickname: null })).toBe('?');
    expect(getChildInitials(null)).toBe('?');
    expect(getChildInitials(undefined)).toBe('?');
  });

  it('ignores avatar_initials passed via extra fields — uses the nickname rule', () => {
    const child = { first_name: 'Alexandra', nickname: 'Lexi', avatar_initials: 'AX' } as unknown as {
      first_name: string;
      nickname: string;
    };
    expect(getChildInitials(child)).toBe('L');
  });
});
