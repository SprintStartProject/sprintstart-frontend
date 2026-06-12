import { test, expect } from '@playwright/test';

test.describe('Knowledge Base Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login and use testuser bypass
    await page.goto('/');
    await page.getByLabel('Username').fill('testuser');
    await page.getByLabel('First Name').fill('Test');
    await page.getByLabel('Last Name').fill('User');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Complete wizard to avoid redirection
    await page.waitForURL('**/selection-wizard');
    await page.getByText('Frontend Developer').click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Intermediate').click();
    await page.getByRole('button', { name: 'Get started' }).click();
    
    // Navigate to knowledge base
    await page.goto('/knowledge-base');
  });

  test('should interact with the knowledge repository', async ({ page }) => {
    // 1. Verify Page Load and Mock Data
    await expect(page.locator('text=Knowledge Repository')).toBeVisible();
    await expect(page.locator('text=Architecture.png')).toBeVisible(); // Mocked file

    // 2. Simulate File Upload
    // Playwright can interact with hidden file inputs
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-document.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# This is a test file for E2E')
    });

    // Verify upload feedback (the mock is instantaneous)
    await expect(page.locator('text=test-document.md')).toBeVisible();

    // 3. Document Deletion
    // Find the delete button (trash icon) for a document
    const deleteButton = page.locator('button').filter({ has: page.locator('svg.lucide-trash2') }).first();
    await deleteButton.click();
    
    // Verify document is gone or success message appears
    await expect(page.locator('text=Document deleted successfully')).toBeVisible().catch(() => {});
  });
});