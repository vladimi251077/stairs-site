const { test, expect } = require('@playwright/test');

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173';

function collectRuntimeIssues(page) {
  const issues = [];
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push(`console: ${message.text()}`);
    }
  });
  return issues;
}

test('calculator smoke: empty opening flow reaches request payload', async ({ page }) => {
  const issues = collectRuntimeIssues(page);

  await page.goto(`${baseUrl}/calculator.html`);
  await expect(page.locator('h1')).toContainText('конфигуратор', { ignoreCase: true });
  await expect(page.locator('#baseCondition')).toBeVisible();

  await page.locator('[data-next-step="2"]').click();
  await expect(page.locator('#step2')).toHaveClass(/active/);
  await page.locator('#floorHeight').fill('3000');
  await page.locator('#openingLength').fill('4200');
  await page.locator('#openingWidth').fill('2200');
  await page.locator('#marchWidth').fill('1000');

  await page.locator('#toResultsBtn').click();
  await expect(page.locator('#step3')).toHaveClass(/active/);
  await expect(page.locator('#geometryResult')).toContainText(/подступен|проступ|статус/i);

  await page.locator('#calculateBtn').click();
  await expect(page.locator('#step4')).toHaveClass(/active/);
  await expect(page.locator('#materialsResult')).not.toBeEmpty();
  await expect(page.locator('#priceResult')).toContainText('₽');

  const href = await page.locator('#requestLink').getAttribute('href');
  expect(href).toContain('/request.html?calc=');

  const storedPayload = await page.evaluate(() => localStorage.getItem('tekstura_stair_calc_payload'));
  expect(storedPayload).toContain('pricing_region');
  expect(issues).toEqual([]);
});

test('request smoke: reads calculator payload and keeps form usable', async ({ page }) => {
  const issues = collectRuntimeIssues(page);
  const payload = {
    base_condition: 'empty_opening',
    baseCondition: 'Пустой проём',
    selected_staircase_type: 'Прямая',
    status: 'recommended',
    input_dimensions: {
      floor_to_floor_height: 3000,
      opening_length: 4200,
      opening_width: 2200,
    },
    chosen_geometry_result: {
      riser_height: 176,
      tread_depth: 280,
      headroom_min: 2050,
    },
    pricing_region: {
      code: 'primary_region',
      name: 'Основной регион',
      price_coef: 1,
    },
    pricing_breakdown: {
      subtotal_before_region: 350000,
    },
    total: 350000,
  };

  await page.goto(`${baseUrl}/request.html?calc=${encodeURIComponent(JSON.stringify(payload))}`);
  await expect(page.locator('h1')).toContainText('Заявка');
  await expect(page.locator('#calcData')).toContainText('Основной регион');
  await expect(page.locator('#calcData')).toContainText('350');
  await expect(page.locator('#phone')).toBeVisible();
  await expect(page.locator('#sendBtn')).toBeEnabled();

  const storedPayload = await page.evaluate(() => localStorage.getItem('tekstura_stair_calc_payload'));
  expect(storedPayload).toContain('primary_region');
  expect(issues).toEqual([]);
});

test('admin smoke: auth screen and pricing controls render without login', async ({ page }) => {
  const issues = collectRuntimeIssues(page);

  await page.goto(`${baseUrl}/admin/index.html`);
  await expect(page.locator('h1')).toContainText('Tekstura');
  await expect(page.locator('#authBox')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('#loginBtn')).toBeEnabled();
  await expect(page.locator('#adminApp')).toHaveClass(/hidden/);

  expect(issues).toEqual([]);
});
