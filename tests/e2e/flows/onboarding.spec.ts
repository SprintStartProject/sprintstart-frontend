import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login and use testuser bypass
    await page.goto('/');
    
    // Fill login form
    await page.getByLabel('Username').fill('testuser');
    await page.getByLabel('First Name').fill('Test');
    await page.getByLabel('Last Name').fill('User');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for navigation after login - should go to selection-wizard if it's the first time
    await page.waitForURL('**/selection-wizard');
  });

  test('should complete role selection and interact with onboarding path', async ({ page }) => {
    // 1. Role Selection Wizard
    await expect(page.getByRole('heading', { name: 'Setup your profile' })).toBeVisible();
    
    // Select a role (e.g., Frontend Developer)
    await page.getByText('Frontend Developer').click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // Select experience level (Step 2)
    await expect(page.locator('text=How experienced are you?')).toBeVisible();
    await page.getByText('Intermediate').click();
    await page.getByRole('button', { name: 'Get started' }).click();

    // 2. Onboarding Dashboard
    // The bypass will automatically initialize the onboarding path
    await page.waitForURL('**/onboarding');
    await expect(page.locator('text=Your Onboarding Journey')).toBeVisible();
    
    // Verify mocked phases are visible
    await expect(page.getByRole('heading', { name: 'Phase 1: Setup & Access' })).toBeVisible();

    // 3. Task Interaction
    // Navigate to a task detail view by clicking 'Configure' button (as seen in UI for IN_PROGRESS)
    await page.getByRole('button', { name: 'Configure' }).first().click();
    
    // 4. Task Detail Interaction (checklist)
    // We need to complete all tasks to enable the 'Mark as Completed' button
    // task-1 is already finished in the mock, task-2 is pending
    await page.click('text=2. Install Docker');
    
    // Verify task details and "Mark as Completed" button
    await expect(page.locator('text=Mark as Completed')).toBeVisible();
    
    // Click Mark as Completed
    await page.click('text=Mark as Completed');
    
    // Verify it changed to Finished!
    await expect(page.locator('text=Finished!')).toBeVisible();
  });
});