import { test, expect } from '@playwright/test';

const GLB_PATH = '/3d/masTer_hand.glb';

test.describe('GLB fails → fallback geometry', () => {
  test('when GLB request fails, page still renders with model container and controls', async ({
    page,
  }) => {
    await page.route(GLB_PATH, (route) => route.abort('failed'));
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /modern solutions/i })).toBeVisible();
    await expect(page.locator('canvas').first()).toBeAttached({ timeout: 20000 });
    await expect(page.getByText('Controls').first()).toBeVisible({ timeout: 10000 });
  });
});
