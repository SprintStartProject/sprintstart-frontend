/**
 * The monogram tile a project is shown with — its initials on a tint picked
 * from its id.
 *
 * Shared by the sidebar switcher and the switcher modal so the same project
 * looks the same in both: a single generic folder icon everywhere told the
 * user nothing about which project they were looking at.
 */

/** Tint pairs for the tile. Each token carries its own light and dark value. */
const MONOGRAM_TINTS = [
  "bg-app-indigo-bg text-app-indigo-text",
  "bg-app-cyan-bg text-app-cyan-text",
  "bg-app-purple-bg text-app-purple-text",
  "bg-app-orange-bg text-app-orange-text",
  "bg-app-pink-bg text-app-pink-text",
  "bg-app-brand-soft text-app-brand",
];

/** Picks a tint from the project id, so a project keeps its colour across sessions. */
export function monogramTint(projectId: string): string {
  let hash = 0;
  for (const char of projectId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return MONOGRAM_TINTS[Math.abs(hash) % MONOGRAM_TINTS.length];
}

/** First letters of the first two words, or the first two letters of a single word. */
export function monogramLetters(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  // Split into code points first: indexing a string walks UTF-16 code units, so
  // a name starting with an emoji would yield half a surrogate pair.
  const letters =
    words.length > 1 ? [...words[0]][0] + [...words[1]][0] : [...words[0]].slice(0, 2).join("");
  return letters.toUpperCase();
}
