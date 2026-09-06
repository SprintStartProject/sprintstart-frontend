/**
 * The keyboard chord for the control it sits in, shown while the pointer is on it.
 *
 * Hidden until hover or focus on purpose. A shortcut printed on a button all the time is
 * chrome everybody reads once and then reads past; revealed on approach it answers the
 * question at the moment somebody is asking it — "is there a faster way to do this".
 *
 * `aria-hidden`, because this is a second rendering of something the control's own `title`
 * already says. Announcing it twice is how a button ends up read out as "New chat Alt N New
 * chat Alt N". The caller is responsible for that `title`.
 *
 * Needs `group` on the control it lives in, and its own border colour from the caller — the
 * chip sits on a brand fill in one place and on a plain surface in another.
 */
export function ShortcutHint({ keys, className = "" }: { keys: string; className?: string }) {
  return (
    <kbd
      aria-hidden="true"
      className={`ml-1 hidden rounded border px-1 py-0.5 font-sans text-[10px] leading-none opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-block ${className}`}
    >
      {keys}
    </kbd>
  );
}
