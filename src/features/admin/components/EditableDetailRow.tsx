import { useId } from "react";
import { Input } from "../../../components/ui/Input";

type EditableDetailRowProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
  autoComplete?: string;
};

export function EditableDetailRow({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: EditableDetailRowProps) {
  const id = useId();
  return (
    <div className="grid grid-cols-1 items-center gap-1.5 py-2.5 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
      {/* The label sits beside the control rather than above it, so this
                row lays itself out instead of using `Field`. */}
      <label htmlFor={id} className="text-sm text-app-text-muted">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
      />
    </div>
  );
}
