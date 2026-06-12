/**
 * Formats a byte value into a human-readable string (e.g., "1.2 MB").
 * 
 * @param bytes - The number of bytes.
 * @param decimals - Number of decimal places to include (default 2).
 * @returns A formatted string.
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Strips basic Markdown syntax from a string to get plain text.
 * 
 * @param markdown - The markdown string.
 * @returns The plain text string.
 */
export function stripMarkdown(markdown: string): string {
    return markdown
        .replace(/#+\s/g, '') // Headers
        .replace(/\*\*|__/g, '') // Bold
        .replace(/\*|_/g, '') // Italic
        .replace(/!\[.*?\]\(.*?\)/g, '') // Images
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
        .replace(/`{3}[\s\S]*?`{3}/g, '') // Code blocks
        .replace(/`(.+?)`/g, '$1') // Inline code
        .trim();
}
