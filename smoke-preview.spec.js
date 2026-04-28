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

test('calculator smoke: ready metal base payload includes finish details', async ({ page }) => {
  const issues = collectRuntimeIssues(page);

  await page.goto(`${baseUrl}/calculator.html`);
  await page.locator('#baseCondition').selectOption('ready_base');
  await expect(page.locator('#baseSubtypeField')).not.toHaveClass(/hidden/);
  await page.locator('#baseSubtype').selectOption('existing_metal_frame');
  await page.locator('#readyBaseShape').selectOption('l_turn_landing');

  await page.locator('[data-next-step="2"]').click();
  await expect(page.locator('#readyFrameGroup')).not.toHaveClass(/hidden/);
  await page.locator('#readyFrameStepCount').fill('16');
  await page.locator('#readyFrameMarchWidth').fill('1000');
  await page.locator('#readyFrameTreadDepth').fill('280');
  await page.locator('#readyFrameRiserHeight').fill('175');
  await page.locator('#finishScope').selectOption('full_cladding');
  await page.locator('#claddingSheetCount').fill('5');
  await page.locator('#claddingSheetWidth').fill('1035');
  await page.locator('#claddingSheetHeight').fill('2800');
  await page.locator('#hasLanding').check();
  await page.locator('#landingLength').fill('1000');
  await page.locator('#landingWidth').fill('1000');
  await page.locator('#hasWinders').check();
  await page.locator('#winderCount').fill('3');
  await page.locator('#readyFrameStraightRailingLength').fill('4.2');

  await page.locator('#toResultsBtn').click();
  await expect(page.locator('#geometryResult')).toContainText(/Площадка|Забежные|Обшивка каркаса/i);

  await page.locator('#calculateBtn').click();
  await expect(page.locator('#step4')).toHaveClass(/active/);
  await expect(page.locator('#priceResult')).toContainText('₽');

  const storedPayloadRaw = await page.evaluate(() => localStorage.getItem('tekstura_stair_calc_payload'));
  const storedPayload = JSON.parse(storedPayloadRaw);
  expect(storedPayload.project_scenario).toBe('ready_base');
  expect(storedPayload.base_subtype).toBe('existing_metal_frame');
  expect(storedPayload.scenario_details.finish_scope).toBe('full_cladding');
  expect(storedPayload.scenario_details.cladding_sheet_count).toBe(5);
  expect(storedPayload.scenario_details.full_cladding_area_m2).toBe(14.49);
  expect(storedPayload.price_relevant_selections.railing_option).toBeTruthy();
  expect(issues).toEqual([]);
});

test('calculator smoke: unrealistic railing length blocks pricing', async ({ page }) => {
  const issues = collectRuntimeIssues(page);
  await page.goto(`${baseUrl}/calculator.html`);
  await page.locator('#baseCondition').selectOption('ready_base');
  await page.locator('#baseSubtype').selectOption('existing_metal_frame');
  await page.locator('[data-next-step="2"]').click();
  await page.locator('#readyFrameStraightRailingLength').fill('1200');
  await page.locator('#toResultsBtn').click();

  await expect(page.locator('#geometryWarnings')).toContainText('Введите длину в метрах');
  await expect(page.locator('#calculateBtn')).toHaveClass(/hidden/);
  expect(issues).toEqual([]);
});

test('calculator smoke: ready concrete base keeps non-straight shape in payload', async ({ page }) => {
  const issues = collectRuntimeIssues(page);

  await page.goto(`${baseUrl}/calculator.html`);
  await page.locator('#baseCondition').selectOption('ready_base');
  await page.locator('#baseSubtype').selectOption('existing_concrete_base');
  await page.locator('#readyBaseShape').selectOption('u_turn_winders');

  await page.locator('[data-next-step="2"]').click();
  await page.locator('#readyFrameStepCount').fill('18');
  await page.locator('#readyFrameMarchWidth').fill('950');
  await page.locator('#readyFrameTreadDepth').fill('270');
  await page.locator('#readyFrameRiserHeight').fill('170');
  await page.locator('#finishScope').selectOption('treads_and_risers');
  await page.locator('#readyFrameStraightRailingLength').fill('5.5');
  await page.locator('#hasWinders').check();
  await page.locator('#winderCount').fill('6');
  await page.locator('#toResultsBtn').click();

  await expect(page.locator('#geometryResult')).toContainText(/П-образная|забежные/i);

  await page.locator('#calculateBtn').click();
  await expect(page.locator('#step4')).toHaveClass(/active/);

  const storedPayloadRaw = await page.evaluate(() => localStorage.getItem('tekstura_stair_calc_payload'));
  const storedPayload = JSON.parse(storedPayloadRaw);
  expect(storedPayload.base_subtype).toBe('existing_concrete_base');
  expect(storedPayload.selected_staircase_type).toBe('u_turn');
  expect(storedPayload.price_relevant_selections.turn_type).toBe('winders');
  expect(storedPayload.staircaseType).toContain('П-образная');
  expect(storedPayload.chosen_geometry_result.summary_rows.some((row) => row[0] === 'Конфигурация')).toBe(true);
  expect(issues).toEqual([]);
});

test('request smoke: reads calculator payload and keeps form usable', async ({ page }) => {
  const issues = collectRuntimeIssues(page);
  const payload = {
    base_condition: 'empty_opening',
    project_scenario: 'empty_opening',
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
    scenario_details: {
      finish_scope_label: 'Только ступени',
      ready_frame_step_count: 0,
      has_landing: false,
      has_winders: false,
    },
    price_relevant_selections: {
      finish_material: 'oak',
      coating_option: 'standard',
      railing_option: 'metal',
      lighting_option: 'none',
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
