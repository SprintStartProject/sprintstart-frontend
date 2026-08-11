type DetailRowProps = {
  label: string;
  value: string;
  mono?: boolean;
};

export function DetailRow({ label, value, mono = false }: DetailRowProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-1 py-2.5 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
      <dt className="text-sm text-app-text-muted">{label}</dt>
      <dd
        className={`text-sm font-medium wrap-break-word text-app-text ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
