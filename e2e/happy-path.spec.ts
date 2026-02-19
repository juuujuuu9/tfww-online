import { test, expect } from '@playwright/test';

test.describe('Happy path: load home and interact with controls', () => {
  test('home page loads with Thoughtform content and 3D area', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /modern solutions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /THOUGHTFORM\s+WORLDWIDE/i })).toBeVisible();
    await expect(page.getByText('Thoughtform Worldwide is a boutique')).toBeVisible();
    await expect(page.getByRole('link', { name: /build with us/i })).toBeVisible();

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeAttached({ timeout: 20000 });
  });

  test('controls panel can be expanded and collapsed', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('canvas').first()).toBeAttached({ timeout: 20000 });
    await expect(page.getByText('Controls').first()).toBeVisible({ timeout: 10000 });

    const collapseButton = page.getByRole('button', { name: /collapse controls/i });
    await expect(collapseButton).toBeVisible();
    await collapseButton.click();

    await expect(page.getByRole('button', { name: /expand controls/i })).toBeVisible();
  });
});
