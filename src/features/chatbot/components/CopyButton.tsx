import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../../../components/ui/Button";

type CopyButtonProps = {
  /** Text to copy to the clipboard when the button is clicked. */
  text: string;
};

/**
 * A compact icon button that copies the given text to the clipboard and shows a
 * transient "Copied" check state. Used on assistant chat messages and buddy replies so users
 * can grab the raw markdown response without selecting it manually.
 *
 * An `xs` ghost `Button`, like "Keep on my board" beside it. It was a hand-styled 11px link, so
 * the two actions under one answer were a speck and a toolbar button of different heights.
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
    <Button
      variant="ghost"
      size="xs"
      iconOnly
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy response"}
      title={copied ? "Copied" : "Copy"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-app-success-solid" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </Button>
  );
}
