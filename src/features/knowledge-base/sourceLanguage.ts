const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  kt: "kotlin",
  kts: "kotlin",
  java: "java",
  md: "markdown",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  sh: "bash",
  html: "markup",
  css: "css",
  sql: "sql",
  xml: "xml",
  csv: "csv",
};

/**
 * The syntax-highlighting language for a file name. Plain text beats guessing
 * TypeScript: extension-less titles (LICENSE, Makefile, dotfiles) and unknown
 * extensions rendered as TS produce nonsense highlighting; unstyled plain text
 * stays honest.
 */
export const languageForFilename = (filename?: string | null): string => {
  if (!filename) return "text";
  if (filename.toLowerCase() === "dockerfile") return "docker";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return Object.hasOwn(LANGUAGE_BY_EXTENSION, ext) ? LANGUAGE_BY_EXTENSION[ext] : "text";
};
