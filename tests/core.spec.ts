import { test, expect } from '@playwright/test';

test.describe('Atabul Driving Center - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  });

  test('Page loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Atabul/);
  });

  test('Hero section is visible with loaded poster', async ({ page }) => {
    await expect(page.locator('.hero')).toBeVisible();
    const poster = page.locator('.hero__picture img');
    await expect(poster).toBeVisible();
    const loaded = await poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBeTruthy();
  });

  test('Navigation links are present', async ({ page }) => {
    const navLinks = page.locator('.nav-desktop__link, .mobile-menu__link');
    await expect(navLinks.first()).toBeVisible();
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('About section reachable via scroll', async ({ page }) => {
    await page.evaluate(() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }));
    await page.waitForTimeout(1000);
    await expect(page.locator('#about')).toBeVisible();
  });

  test('Programmes section reachable', async ({ page }) => {
    await page.evaluate(() => document.getElementById('programmes')?.scrollIntoView({ behavior: 'smooth' }));
    await page.waitForTimeout(1000);
    await expect(page.locator('#programmes')).toBeVisible();
  });

  test.describe('Reviews Carousel', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' }));
      await page.waitForTimeout(1500);
    });

    test('Pagination dots are visible', async ({ page }) => {
      const dots = page.locator('.carousel-dot');
      await expect(dots.first()).toBeVisible();
      const count = await dots.count();
      expect(count).toBeGreaterThan(0);
    });

    test('Prev/Next buttons are visible', async ({ page }) => {
      await expect(page.locator('[data-carousel-prev]')).toBeVisible();
      await expect(page.locator('[data-carousel-next]')).toBeVisible();
    });

    test('Next button navigates carousel', async ({ page }) => {
      const track = page.locator('[data-carousel-track]');
      const initialTransform = await track.evaluate((el) => el.style.transform);
      await page.click('[data-carousel-next]');
      await page.waitForTimeout(500);
      const newTransform = await track.evaluate((el) => el.style.transform);
      expect(newTransform).not.toBe(initialTransform);
      expect(newTransform).not.toBe('translateX(0px)');
    });
  });

  test.describe('Booking Form', () => {
    test.beforeEach(async ({ page }) => {
      await page.evaluate(() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' }));
      await page.waitForTimeout(1500);
    });

    test('Form loads eagerly (visible immediately)', async ({ page }) => {
      await expect(page.locator('#booking-form')).toBeVisible();
    });

    test('Step 1 (Programme) radio options visible immediately', async ({ page }) => {
      const radios = page.locator('input[name="programme"]');
      await expect(radios.first()).toBeVisible();
      const count = await radios.count();
      expect(count).toBeGreaterThan(0);
    });

    test('Validation prevents advance without selection', async ({ page }) => {
      await page.click('[data-next]');
      await page.waitForTimeout(300);
      const errorMsg = page.locator('[data-error-for="programme"]');
      await expect(errorMsg).toContainText('Please choose an option');
    });

    test('Advances to Step 2 after selecting programme', async ({ page }) => {
      const firstRadio = page.locator('input[name="programme"]').first();
      await firstRadio.check();
      await page.click('[data-next]');
      await page.waitForTimeout(500);
      await expect(page.locator('[data-pane="1"]')).toBeVisible();
    });
  });

  test('Google Maps link points to Atabul Driving Center', async ({ page }) => {
    const link = page.locator('a[href*="google.com/maps/place/ATABUL"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toContain('ATABUL+DRIVING+CENTER');
  });

  test('No JavaScript console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test.describe('Responsive Viewports', () => {
    test('Mobile viewport (375px) - Hero, Carousel dots, Booking form visible', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await expect(page.locator('.hero')).toBeVisible();
      await expect(page.locator('.carousel-dot').first()).toBeVisible();
      await expect(page.locator('#booking-form')).toBeVisible();
    });

    test('Tablet viewport (768px) - Carousel dots visible', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await expect(page.locator('.carousel-dot').first()).toBeVisible();
    });
  });
});