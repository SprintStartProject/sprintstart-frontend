import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('form');
  });

  test('should allow navigating the login page via keyboard', async ({ page }) => {
    // Start from the very beginning of the document
    // We click the top-left corner or just use focus on body to reset
    await page.evaluate(() => document.body.focus());
    
    interface FocusInfo {
        tagName: string;
        id: string;
        ariaLabel: string | null;
        text: string;
    }
    const focusSequence: FocusInfo[] = [];
    // Tab up to 15 times to find all interactive elements
    for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return null;
            return {
                tagName: el.tagName,
                id: el.id,
                ariaLabel: el.getAttribute('aria-label'),
                text: el.textContent?.trim() || (el as HTMLInputElement).placeholder || '',
            };
        });
        
        // If we wrapped around or hit something we already saw, we might be looping
        if (info) {
            const isDuplicate = focusSequence.some(f => f.id === info.id && f.ariaLabel === info.ariaLabel && f.text === info.text && info.id !== "");
            if (isDuplicate) break;
            focusSequence.push(info);
        } else {
            break;
        }

        // Stop if we've gone past the submit button
        if (info?.text === 'Sign In' || info?.text === 'Signing in...') {
            // Keep going a bit more to see if anything follows
            continue;
        }
    }

    // eslint-disable-next-line no-console
    console.log('Focus Sequence:', JSON.stringify(focusSequence, null, 2));

    expect(focusSequence.length).toBeGreaterThan(0);
    
    // Check if the Theme Toggle is in the sequence
    const themeToggle = focusSequence.find(f => f.ariaLabel === 'Toggle light and dark mode');
    expect(themeToggle, 'Theme toggle should be reachable via keyboard').toBeDefined();
    
    // Check if form inputs are reachable
    const usernameInput = focusSequence.find(f => f.id === 'username');
    expect(usernameInput, 'Username input should be reachable via keyboard').toBeDefined();
  });

  test('should have visible focus indicators on interactive elements', async ({ page }) => {
    await page.evaluate(() => document.body.focus());
    await page.keyboard.press('Tab');
    
    const hasFocusIndicator = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el || el.tagName === 'BODY') return false;
      
      const style = window.getComputedStyle(el);
      const hasOutline = style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
      const hasRing = style.boxShadow !== 'none' && style.boxShadow !== '' && !style.boxShadow.includes('none');
      
      return hasOutline || hasRing;
    });
    
    expect(hasFocusIndicator, 'Focused element should have a visible focus indicator (outline or ring)').toBe(true);
  });
});
