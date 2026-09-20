/**
 * Turns a step's title into a key, for the add form's default — the backend still requires a key,
 * but making somebody invent one by hand is a needless step when the title already says it.
 *
 * Never used to *change* an existing key: a key is fixed once saved because state is stored
 * against it, so this only ever seeds the field before the first save.
 */
export function slugifyStepKey(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug;
}
