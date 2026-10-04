/** One label and value line inside a details card's `<dl>`. */
export function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-t border-app-border py-2.5 first:border-t-0">
      <dt className="w-24 shrink-0 text-[12.5px] text-app-text-muted">{label}</dt>
      <dd
        className={`min-w-0 text-[13px] font-semibold wrap-break-word text-app-text ${
          mono ? "font-mono text-xs font-medium" : ""
        }`}
      >
        {value || "Not available"}
      </dd>
    </div>
  );
}

/** Like {@link InfoRow}, with the value as an external link. */
export function InfoLinkRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-app-border py-2.5 first:border-t-0">
      <dt className="w-24 shrink-0 text-[12.5px] text-app-text-muted">{label}</dt>
      <dd className="min-w-0 text-[13px] font-semibold wrap-break-word">
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-app-brand-text underline decoration-app-brand-border underline-offset-4 hover:text-app-brand"
          >
            {value}
          </a>
        ) : (
          <span className="text-app-text">Not available</span>
        )}
      </dd>
    </div>
  );
}
