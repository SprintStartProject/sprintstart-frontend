import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Scans (WCAG AA)', () => {
  
  async function loginAsTestUser(page: Page) {
    await page.goto('/login');
    await page.fill('#username', 'testuser');
    await page.fill('#firstname', 'Test');
    await page.fill('#lastname', 'User');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.pathname.includes('/login'));
  }

  test('Login Page should have no violations', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('Selection Wizard should have no violations', async ({ page }) => {
    await loginAsTestUser(page);
    // If we just logged in as testuser for the first time, we should be at selection-wizard
    await page.waitForURL('**/selection-wizard');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('Dashboard should have no violations', async ({ page }) => {
    await loginAsTestUser(page);
    // Complete wizard if needed or just go to /
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('Knowledge Base should have no violations', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/knowledge-base');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('Onboarding should have no violations', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/onboarding');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
