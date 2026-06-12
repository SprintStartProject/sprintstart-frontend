import { describe, it, expect } from 'vitest';
import { formatBytes, stripMarkdown } from '../../../src/lib/formatters';

describe('formatters', () => {
  describe('formatBytes', () => {
    it('formats 0 bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('formats KB correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
    });

    it('formats MB correctly', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('respects decimal parameter', () => {
      expect(formatBytes(1500, 3)).toBe('1.465 KB');
    });
  });

  describe('stripMarkdown', () => {
    it('removes headers', () => {
      expect(stripMarkdown('# Hello')).toBe('Hello');
    });

    it('removes bold and italic', () => {
      expect(stripMarkdown('**Bold** and *Italic*')).toBe('Bold and Italic');
    });

    it('removes links but keeps text', () => {
      expect(stripMarkdown('[Google](https://google.com)')).toBe('Google');
    });

    it('removes code blocks', () => {
      expect(stripMarkdown('```js\nconst x = 1;\n```')).toBe('');
    });
  });
});
