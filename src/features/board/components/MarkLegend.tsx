import { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { HIGHLIGHT_CLASS, HIGHLIGHT_COLORS, type HighlightColor } from "../marks/highlightColors";
import { labelFor } from "../marks/markLabels";
import { useCardMarks } from "../marks/useCardMarks";

/**
 * What this hire's highlight colours mean, in their words.
 *
 * The four colours mean nothing on their own, and that is a rule the design system holds: colour is
 * never the message. It is also why a hire who marks three things green and two blue has, after a
 * week, no idea which was which. This is the way out that keeps the rule — nothing here assigns a
 * meaning, the person does, and then the board can show it back to them.
 *
 * Only drawn once something is highlighted. On a board with no marks it would be a legend for a
 * language nobody is speaking, and a control that appears before there is anything to control is a
 * control people learn to skip.
 *
 * Renaming is in place, one colour at a time. There is no "save": a name is one word, and a form
 * around one word is more ceremony than the word.
 */
export function MarkLegend() {
  const { canMark, hasAnyMarks, labels, nameColor } = useCardMarks();
  const [editing, setEditing] = useState<HighlightColor | null>(null);
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLInputElement>(null);

  // The field only exists because somebody just asked for it, so it takes the caret rather than
  // making them click the one input it has. A ref rather than `autoFocus`, which moves focus on
  // *mount* — including the mount of a page that happens to contain one.
  useEffect(() => field.current?.focus(), [editing]);

  if (!canMark || !hasAnyMarks) return null;

  const open = (color: HighlightColor) => {
    setEditing(color);
    // Seeded with the hire's own word only. Starting from "Yellow" would make clearing a name mean
    // typing over a word the app suggested, and the colour's own word is a fallback, not a value.
    setDraft(labels[color] ?? "");
  };

  const commit = () => {
    if (editing) nameColor(editing, draft);
    setEditing(null);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-app-text-muted"
      aria-label="What your highlight colours mean"
    >
      {HIGHLIGHT_COLORS.map((color) =>
        editing === color ? (
          <span key={color} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-full border border-app-border ${HIGHLIGHT_CLASS[color]}`}
            />
            <Input
              ref={field}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") setEditing(null);
              }}
              aria-label={`What ${labelFor(labels, color).toLowerCase()} means`}
              placeholder="ask about"
              className="h-7 w-36 text-xs"
            />
            <Button variant="ghost" size="sm" iconOnly onClick={commit} aria-label="Save this name">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => setEditing(null)}
              aria-label="Leave it as it was"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </span>
        ) : (
          <button
            key={color}
            type="button"
            onClick={() => open(color)}
            title={`Rename ${labelFor(labels, color)}`}
            className="group/legend flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-full border border-app-border ${HIGHLIGHT_CLASS[color]}`}
            />
            {labelFor(labels, color)}
            <Pencil
              className="h-3 w-3 opacity-0 transition-opacity group-hover/legend:opacity-70"
              aria-hidden="true"
            />
          </button>
        ),
      )}
    </div>
  );
}
