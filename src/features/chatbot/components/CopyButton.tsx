import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";

type CopyButtonProps = {
  /** Text to copy to the clipboard when the button is clicked. */
  text: string;
};

/**
 * A compact icon button that copies the given text to the clipboard and shows a
 * transient "Copied" check state. Used on assistant chat messages so users can
 * grab the raw markdown response without selecting it manually.
 */
export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard API can be unavailable (e.g. non-secure context); nothing to do.
      });
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy response"}
      className="flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] text-app-text-subtle transition-colors hover:text-app-text-muted focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied && <span>Copied</span>}
    </button>
  );
}
