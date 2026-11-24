import type { ReactNode } from "react";

import { Field } from "../../../components/ui/Field";
import { InfoHint } from "../../../components/ui/InfoHint";

/**
 * A field whose explanation sits behind a small info icon at the end of its label row, instead of
 * as grey text under it. The icon is beside the label, not inside it, so the field keeps a short
 * accessible name.
 */
export function HintedField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <Field label={label}>{children}</Field>
      {hint && (
        <span className="absolute top-0 right-0">
          <InfoHint text={hint} label={`About ${label}`} placement="top-end" />
        </span>
      )}
    </div>
  );
}
