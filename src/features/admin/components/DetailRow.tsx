type DetailRowProps = {
  label: string;
  value: string;
  mono?: boolean;
};

export function DetailRow({ label, value, mono = false }: DetailRowProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-1 py-2 sm:grid-cols-[7.5rem_1fr] sm:gap-4 sm:py-2.5">
      <dt className="text-sm text-app-text-muted">{label}</dt>
      <dd
        className={`text-sm font-medium wrap-break-word text-app-text ${
          // Long mono values (e.g. a UUID) break cleanly on narrow screens
          // instead of overflowing; desktop wrapping stays untouched via
          // sm:break-normal.
          mono ? "font-mono text-xs break-all sm:break-normal" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
