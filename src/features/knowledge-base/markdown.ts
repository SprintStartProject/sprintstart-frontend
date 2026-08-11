/**
 * Preprocesses markdown to auto-heal common syntax issues.
 * Specifically handles cases where a block-math closing `$$` is incorrectly
 * followed by text on the same line, which causes remark-math to fail closing
 * the block, subsequently swallowing the rest of the file into KaTeX.
 */
export const preprocessMarkdown = (text: string): string => {
  // Regex looks for `$$` that is preceded by some math-like content on the same line
  // or previous lines, and followed immediately by space and non-whitespace characters
  // (like a blockquote `>`). We inject a newline to properly fence the math block.
  // The negative lookbehind `(?<!^\s*)` ensures we don't accidentally match an opening `$$`
  // that just happens to have text after it (though that would also be invalid block math,
  // usually users put the opening `$$` on its own line).
  // Using a simpler, safer approach: find `$$` followed by space and non-whitespace,
  // where the `$$` is not at the very start of a line (to avoid opening tags).
  return text.replace(/(?<!^)[ \t]*\$\$[ \t]+(?=\S)/gm, "$$$$\n");
};
