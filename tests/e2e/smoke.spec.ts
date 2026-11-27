import { expect, test } from '@playwright/test';

test.describe('Vintage Aesthetics Gym — Smoke E2E', () => {
  test('renders landing page and Dhaka branch network', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Vintage Aesthetics Gym/i }),
    ).toBeVisible();
    await expect(page.getByText('DHK-01')).toBeVisible();
    await expect(page.getByText('DHK-02')).toBeVisible();
    await expect(page.getByText('DHK-03')).toBeVisible();
  });

  test('renders floating AI Concierge orb and opens glassmorphic drawer', async ({
    page,
  }) => {
    await page.goto('/');
    const orb = page.getByTestId('ai-concierge-orb');
    await expect(orb).toBeVisible();
    await orb.click();

    const drawer = page.getByTestId('ai-concierge-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/Iron Concierge AI/i)).toBeVisible();
    await expect(
      drawer.getByLabel('AI Concierge prompt'),
    ).toBeVisible();
  });

  test('renders /simulator with offline toggle, RFID buttons, lockers, and QR fallback', async ({
    page,
  }) => {
    await page.goto('/simulator');
    await expect(
      page.getByRole('heading', {
        name: /Turnstile, Lockers & QR Console/i,
      }),
    ).toBeVisible();

    await expect(page.getByTestId('virtual-turnstile-gate')).toBeVisible();
    await expect(page.getByText('VA-RFID-4092')).toBeVisible();
    await expect(page.getByText('VA-RFID-8841')).toBeVisible();
    await expect(page.getByText('G-01')).toBeVisible();
    await expect(page.getByText('VA-EQ-DHK01-TM04')).toBeVisible();

    // Toggle offline mode and queue a local tap
    await page.getByTestId('toggle-offline-btn').click();
    await expect(page.getByTestId('offline-mode-banner')).toBeVisible();
    await page.getByText('VA-RFID-4092').click();
    await expect(page.getByText(/1 event\(s\) buffered/i)).toBeVisible();
  });

  test('renders /dev-inbox with channel and trigger filters', async ({
    page,
  }) => {
    await page.goto('/dev-inbox');
    await expect(
      page.getByRole('heading', { name: /Free Dev Notification Inbox/i }),
    ).toBeVisible();
    await expect(page.getByLabel('Filter by channel')).toBeVisible();
    await expect(page.getByLabel('Filter by trigger type')).toBeVisible();
    await expect(page.getByLabel('Search notifications')).toBeVisible();
  });
});
