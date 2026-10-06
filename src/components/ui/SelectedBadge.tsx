import { Check } from "lucide-react";

/**
 * A small tick in the corner of a card or tile that is the current choice.
 *
 * "Selected" used to be a tint and a slightly different border, which is a colour and nothing else
 * (WCAG 1.4.1). The tick is a shape, so the chosen card is the one with the tick on any screen and
 * for anybody. Decorative: the state itself is carried by `aria-pressed` / `aria-checked` on the
 * card, where assistive tech reads it. Put it inside the card, which has to be `relative` and must
 * not clip its overflow (the tick sits half outside the corner).
 */
export function SelectedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-app-brand text-white ring-2 ring-app-surface ${className}`.trim()}
    >
      <Check className="h-3 w-3" />
    </span>
  );
}
