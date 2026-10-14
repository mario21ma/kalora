/** Validate the text the user sees, rather than retaining a previous quantity. */
export function parseQuantityDraft(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value > 0 && value <= 5000 ? value : null;
}
