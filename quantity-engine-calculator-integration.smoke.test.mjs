import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateQuantityFromCalculator } from './quantity-engine-calculator-adapter.js';
import {
  buildMaterialsFromQuantityEngine,
  buildPriceFromQuantityEngine
} from './stair-configurator.js';

function baseConfig(overrides = {}) {
  return {
    base_condition: 'empty_opening',
    stair_type: 'straight',
    turn_type: 'landing',
    march_width: 1000,
    railing_option: 'metal',
    ...overrides
  };
}

function baseGeometry(overrides = {}) {
  return {
    valid: true,
    tread_count: 10,
    riser_count: 10,
    tread_depth: 300,
    riser_height: 170,
    walking_line_length: 3000,
    service_metrics: {},
    ...overrides
  };
}

function assertIntegratedResult(result) {
  const materials = buildMaterialsFromQuantityEngine(result);
  const price = buildPriceFromQuantityEngine(result);

  assert.equal(materials.valid, true);
  assert.equal(materials.type, 'quantity_engine');
  assert.equal(materials.metrics.quantityEngineResult, result.quantityEngineResult);
  assert.ok(materials.items.some((item) => item.label === 'Ступени'));
  assert.ok(materials.items.some((item) => item.label === 'MDF 36 листы'));
  assert.equal(materials.items.some((item) => item.label === 'Итог материалов и расходников'), false);
  assert.ok(materials.items.some((item) => item.label === 'Состав расчёта'));

  const consumablesRow = materials.items.find((item) => item.label === 'Расходники');
  assert.ok(consumablesRow);
  assert.equal(consumablesRow.value.includes('₽'), false);

  const railingRow = materials.items.find((item) => item.label === 'Ограждение');
  assert.ok(railingRow);
  assert.equal(railingRow.value.includes('₽'), false);

  assert.equal(price.pricingModel, 'quantity_engine_turnkey_coefficient');
  assert.equal(price.total, result.quantityEngineResult.pricing.clientPrice);
  assert.equal(price.min, price.total);
  assert.equal(price.max, price.total);
  assert.equal(price.subtotalBeforeRegion, result.quantityEngineResult.pricing.materialAndConsumablesSubtotal);
  assert.equal(price.regionalAdjustment, 0);
  assert.equal(price.regionalCoef, 1);
  assert.equal(price.pricingRegion.name, 'Без регионального коэффициента');
  assert.equal(price.baseLabor, 0);
  assert.equal(price.materialCost, result.quantityEngineResult.pricing.materialAndConsumablesSubtotal);
  assert.equal(price.turnkeyCoefficient, result.quantityEngineResult.pricing.turnkeyCoefficient);
}

const emptyOpeningMetal = calculateQuantityFromCalculator(baseConfig(), baseGeometry(), { turnkeyCoefficient: 2.5 });
assert.equal(emptyOpeningMetal.valid, true);
assert.equal(emptyOpeningMetal.quantityEngineInput.railingEnabled, true);
assertIntegratedResult(emptyOpeningMetal);

const emptyOpeningNoRailing = calculateQuantityFromCalculator(
  baseConfig({ railing_option: 'none' }),
  baseGeometry(),
  { turnkeyCoefficient: 2.5 }
);
assert.equal(emptyOpeningNoRailing.valid, true);
assert.equal(emptyOpeningNoRailing.quantityEngineInput.railingEnabled, false);
assert.equal(emptyOpeningNoRailing.quantityEngineResult.railing.enabled, false);
assert.equal(emptyOpeningNoRailing.quantityEngineResult.railing.materialSubtotal, 0);
assert.equal(
  buildMaterialsFromQuantityEngine(emptyOpeningNoRailing).items.find((item) => item.label === 'Ограждение').value,
  'Не требуется'
);
assertIntegratedResult(emptyOpeningNoRailing);

const existingMetalFrame = calculateQuantityFromCalculator(
  baseConfig({
    base_condition: 'existing_metal_frame',
    ready_frame_step_count: 12,
    ready_frame_march_width: 950,
    ready_frame_tread_depth: 280,
    ready_frame_riser_height: 175,
    ready_frame_straight_railing_length: 4.2
  }),
  baseGeometry({ service_metrics: { stepCount: 12, railingLengthM: 4.2 } })
);
assert.equal(existingMetalFrame.valid, true);
assert.equal(existingMetalFrame.quantityEngineInput.configurationType, 'metal_frame');
assertIntegratedResult(existingMetalFrame);

const existingConcreteBase = calculateQuantityFromCalculator(
  baseConfig({
    base_condition: 'existing_concrete_base',
    ready_frame_step_count: 9,
    ready_frame_march_width: 1000,
    ready_frame_tread_depth: 300,
    ready_frame_riser_height: 160,
    ready_frame_straight_railing_length: 3.6
  }),
  baseGeometry()
);
assert.equal(existingConcreteBase.valid, true);
assert.equal(existingConcreteBase.quantityEngineInput.configurationType, 'concrete');
assertIntegratedResult(existingConcreteBase);

const landingPlatform = calculateQuantityFromCalculator(
  baseConfig({ stair_type: 'l_turn', has_landing: true, landing_width: 1100, landing_length: 1200 }),
  baseGeometry()
);
assert.equal(landingPlatform.valid, true);
assert.equal(landingPlatform.quantityEngineInput.platformCount, 1);
assert.equal(landingPlatform.quantityEngineResult.quantities.platforms.count, 1);
assertIntegratedResult(landingPlatform);

const configuratorSource = readFileSync(new URL('./stair-configurator.js', import.meta.url), 'utf8');
assert.ok(configuratorSource.includes('Предварительная стоимость под ключ'));
assert.ok(configuratorSource.includes('Финальная смета уточняется после проверки размеров, основания и выбранной комплектации.'));
for (const forbiddenClientString of [
  'Коэффициент turnkey',
  'материалы и расходники × коэффициент',
  'Модель:',
  'Итог материалов и расходников'
]) {
  assert.equal(configuratorSource.includes(forbiddenClientString), false);
}

const invalidGeometry = calculateQuantityFromCalculator(baseConfig(), { valid: false });
const invalidMaterials = buildMaterialsFromQuantityEngine(invalidGeometry);
const invalidPrice = buildPriceFromQuantityEngine(invalidGeometry);
assert.equal(invalidGeometry.valid, false);
assert.equal(invalidMaterials.valid, false);
assert.equal(invalidMaterials.type, 'quantity_engine');
assert.ok(invalidMaterials.reason.includes('Quantity Engine'));
assert.equal(invalidPrice, null);
assert.ok(invalidGeometry.diagnostics.some((diagnostic) => diagnostic.code === 'MISSING_CALCULATOR_GEOMETRY'));

console.log('quantity-engine calculator integration smoke tests passed');
