/**
 * The link on an arrival step, if it is safe to hand a hire a clickable anchor for it.
 *
 * A step's `href` is free text typed by whoever authors the list, and it is rendered as an
 * `<a href>` on every hire's board. `javascript:` and `data:` URLs run in the reader's session
 * when clicked, so an author-supplied string has to be checked before it becomes a link rather
 * than trusted because the author is privileged: a PM is not an attacker, but a PM who pastes
 * something they were sent is exactly how this reaches a hire.
 *
 * Allowed: `http`, `https`, `mailto`, and a same-origin path (`/settings`). Everything else —
 * including a scheme-relative `//host` and anything with a scheme we did not name — comes back
 * null, and the caller renders the step without a link rather than with a dead one.
 *
 * The parse is done against a base so a relative path is a valid URL rather than a throw, and
 * the *result's* protocol is what is judged. Matching on the raw string instead is what lets
 * `java\nscript:` through, because the URL parser strips control characters and the regex does
 * not.
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function safeStepHref(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // A scheme-relative URL parses as `https://host` against an https base, so it would pass the
  // protocol check while pointing somewhere the author did not obviously name.
  if (trimmed.startsWith("//")) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed, window.location.origin);
  } catch {
    return null;
  }

  return ALLOWED_PROTOCOLS.has(parsed.protocol) ? trimmed : null;
}
