import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";

type NewAreaFormProps = {
  onCreate: (name: string) => void;
  onClose: () => void;
};

/**
 * Naming a new area, in the same slot the card forms open in.
 *
 * An area used to be a by-product: the only way to make one was to file a card into "New area…"
 * from that card's own header, so areas got made by accident and named "Area 3". Making one on
 * purpose needs somewhere to type, and an empty area is drawn nowhere except as a tab — which is
 * not a place to type. So it is a form over the board, like a note or a link, and for the same
 * reason: this is the smallest thing on the page and it should take one decision and one sentence.
 *
 * The submit button waits for a name. An area called nothing is a tab nobody can aim at, and the
 * board has no way to tell one from another once there are two.
 */
export function NewAreaForm({ onCreate, onClose }: NewAreaFormProps) {
  const [name, setName] = useState("");
  const field = useRef<HTMLInputElement>(null);

  // The form only exists because somebody just asked for it, so it takes the caret rather than
  // making them click the one field it has.
  useEffect(() => field.current?.focus(), []);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onCreate(trimmed);
    setName("");
  };

  return (
    <form
      className="space-y-3 rounded-2xl border border-app-border bg-app-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Field
            label="Name this area"
            controlId="new-area-name"
            hint="A part of the board you can open on its own — Paperwork, Week two, Before my first release."
          >
            <Input
              ref={field}
              id="new-area-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                onClose();
              }}
              placeholder="Paperwork"
            />
          </Field>
        </div>

        <Button variant="ghost" size="sm" iconOnly onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="sm" disabled={name.trim().length === 0}>
          Create area
        </Button>
      </div>
    </form>
  );
}
