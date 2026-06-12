import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Color Blindness Resilience', () => {
  
  const deficiencies = ['deuteranopia', 'protanopia', 'achromatopsia'] as const;

  for (const deficiency of deficiencies) {
    test.describe(`Deficiency: ${deficiency}`, () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      test.use({ colorVisionDeficiency: deficiency } as any);

      test(`Dashboard should be accessible with ${deficiency}`, async ({ page }) => {
        // Use testuser bypass
        await page.goto('/login');
        await page.fill('#username', 'testuser');
        await page.fill('#firstname', 'Test');
        await page.fill('#lastname', 'User');
        await page.click('button[type="submit"]');
        await page.waitForURL(url => !url.pathname.includes('/login'));
        
        await page.goto('/');
        
        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
      });
    });
  }
});
