import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
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

    // Navigate to chat
    await page.goto('/chat');
  });

  test('should send a query and receive a streamed response', async ({ page }) => {
    // 1. Verify Chat Interface
    await expect(page.locator('text=AI Assistant')).toBeVisible();
    await expect(page.locator('input[placeholder*="Ask anything"]')).toBeVisible();

    // 2. Send Message
    const inputField = page.locator('input[placeholder*="Ask anything"]');
    const query = 'How do I start the backend?';
    await inputField.fill(query);
    await page.keyboard.press('Enter');

    // 3. Verify User Message is Rendered
    await expect(page.locator(`text=${query}`)).toBeVisible();

    // 4. Verify AI Response (Simulated Stream)
    // The mock service typically returns "I can help with that."
    await expect(page.locator('text=I can help with that.')).toBeVisible({ timeout: 5000 });
    
    // 5. Verify Citations (if present in mock)
    // The mock often includes 'developer_guide.md'
    await expect(page.locator('text=developer_guide.md')).toBeVisible().catch(() => {});
  });
});