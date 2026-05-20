// Formats a date according to the user's preferred pattern.
// Accepts the same pattern values rendered by the Settings page:
// MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD. Falls back to MM/DD/YYYY.
export function formatDate(
  input: string | Date | null | undefined,
  pattern: string = 'MM/DD/YYYY',
): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';

  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  switch (pattern) {
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`;
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'MM/DD/YYYY':
    default:
      return `${mm}/${dd}/${yyyy}`;
  }
}
