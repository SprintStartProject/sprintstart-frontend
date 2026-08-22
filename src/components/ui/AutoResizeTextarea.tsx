import { useEffect, useRef, type KeyboardEvent } from "react";

export type AutoResizeTextareaProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  className?: string;
  /**
   * Send on Enter, newline on Shift+Enter — the chat convention.
   *
   * Off by default, and it has to be. Three of this component's callers are
   * long-form answer boxes (answering a flagged question, editing a canonical answer),
   * where Enter is how somebody writes a second paragraph. Turning it on globally would
   * submit half an answer every time they pressed it.
   */
  submitOnEnter?: boolean;
};

/**
 * Textarea that grows in height as the user types, instead of scrolling
 * internally. Height is recalculated on every value change based on the
 * element's scrollHeight, and clamped between minRows and maxRows.
 */
export function AutoResizeTextarea({
  id,
  value,
  onChange,
  placeholder,
  minRows = 2,
  maxRows = 10,
  className = "",
  submitOnEnter = false,
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const computed = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computed.lineHeight) || 20;
    const borderTop = parseFloat(computed.borderTopWidth) || 0;
    const borderBottom = parseFloat(computed.borderBottomWidth) || 0;
    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const paddingBottom = parseFloat(computed.paddingBottom) || 0;
    const border = borderTop + borderBottom;
    const padding = paddingTop + paddingBottom;

    const minHeight = minRows * lineHeight + padding + border;
    const maxHeight = maxRows * lineHeight + padding + border;

    // Reset height first so scrollHeight reflects the actual content.
    textarea.style.height = "auto";
    const contentHeight = textarea.scrollHeight;
    const nextHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);

    textarea.style.height = `${nextHeight}px`;
  };

  useEffect(() => {
    resize();
    // Re-run on window resize too, since line-wrapping can change.
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!submitOnEnter) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    // Enter also *commits* an IME candidate — typing 'ü' via a compose key, or any
    // Chinese/Japanese/Korean input. Sending there would submit a half-written word and
    // there is no way to get it back.
    if (event.nativeEvent.isComposing) return;
    // Same condition as the send button being enabled, so the two cannot disagree about
    // whether there is anything to send.
    if (!value.trim()) return;

    event.preventDefault();
    // Goes through the form rather than a callback of its own: the form's onSubmit stays
    // the single place a message is sent from, however it was triggered.
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <textarea
      id={id}
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={minRows}
      className={`w-full resize-none overflow-hidden rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none focus:border-app-brand ${className}`.trim()}
    />
  );
}
