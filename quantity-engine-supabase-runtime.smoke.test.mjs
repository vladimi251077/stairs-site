import assert from 'node:assert/strict';
import { materialsCatalog, railingTypes } from './quantity-engine.js';
import { calculateQuantityFromCalculator } from './quantity-engine-calculator-adapter.js';
import {
  buildQuantityEngineRuntimeOptions,
  normalizeQuantityEngineSettings,
  normalizeSupabaseMaterialsCatalog,
  normalizeSupabaseRailingTypes
} from './quantity-engine-supabase-runtime.js';

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

function supabaseMaterialsRows(overridesByCode = {}) {
  return materialsCatalog.map((material) => ({
    id: material.id,
    code: material.code,
    name: material.name,
    unit: material.unit,
    category: material.category,
    base_cost: overridesByCode[material.code]?.base_cost ?? material.baseCost,
    waste_percent: overridesByCode[material.code]?.waste_percent ?? material.wastePercent,
    active: overridesByCode[material.code]?.active ?? material.active,
    visible_to_client: overridesByCode[material.code]?.visible_to_client ?? material.visibleToClient,
    sort_order: material.sortOrder
  }));
}

function supabaseRailingRows(overridesByName = {}) {
  return railingTypes.map((railing) => ({
    id: `db-${railing.id}`,
    name: railing.name,
    price_per_meter: overridesByName[railing.name]?.price_per_meter ?? railing.pricePerMeter,
    description: railing.description,
    active: overridesByName[railing.name]?.active ?? railing.active,
    visible_to_client: overridesByName[railing.name]?.visible_to_client ?? railing.visibleToClient,
    sort_order: railing.sortOrder
  }));
}

function runtimeOptions({ materialOverrides = {}, railingOverrides = {}, turnkeyCoefficient = 2.35 } = {}) {
  return buildQuantityEngineRuntimeOptions({
    settings: normalizeQuantityEngineSettings({ turnkey_coefficient: turnkeyCoefficient }),
    materialsCatalog: normalizeSupabaseMaterialsCatalog(supabaseMaterialsRows(materialOverrides)),
    railingTypes: normalizeSupabaseRailingTypes(supabaseRailingRows(railingOverrides)),
    loadedFromSupabase: true
  });
}

const normalizedMaterials = normalizeSupabaseMaterialsCatalog([
  {
    code: 'MDF_36_SHEET',
    name: 'MDF 36 мм, лист',
    unit: 'sheet',
    category: 'MDF',
    base_cost: 7777,
    waste_percent: 12,
    active: true,
    visible_to_client: false,
    sort_order: 15
  },
  { code: 'SKIP_NO_NAME', active: true },
  { code: 'SKIP_INACTIVE', name: 'Inactive', active: false }
]);
assert.equal(normalizedMaterials.length, 1);
assert.equal(normalizedMaterials[0].code, 'MDF_36_SHEET');
assert.equal(normalizedMaterials[0].baseCost, 7777);
assert.equal(normalizedMaterials[0].visibleToClient, false);

const normalizedRailings = normalizeSupabaseRailingTypes([
  {
    id: 'db-metal',
    name: 'металл',
    price_per_meter: 22222,
    active: true,
    visible_to_client: true,
    sort_order: 50
  },
  { id: 'db-skip', active: true },
  { id: 'db-inactive', name: 'inactive', active: false }
]);
assert.equal(normalizedRailings.length, 1);
assert.equal(normalizedRailings[0].id, 'rail_metal');
assert.equal(normalizedRailings[0].databaseId, 'db-metal');
assert.equal(normalizedRailings[0].pricePerMeter, 22222);

const builtRuntimeOptions = buildQuantityEngineRuntimeOptions({
  settings: { turnkey_coefficient: 3.1 },
  materialsCatalog: normalizedMaterials,
  railingTypes: normalizedRailings,
  loadedFromSupabase: true
});
assert.equal(builtRuntimeOptions.turnkeyCoefficient, 3.1);
assert.equal(builtRuntimeOptions.quantityEngineOptions.materialsCatalog, normalizedMaterials);
assert.equal(builtRuntimeOptions.quantityEngineOptions.railingTypes, normalizedRailings);

const defaultRuntime = runtimeOptions({ turnkeyCoefficient: 2.35 });
const expensiveMdfRuntime = runtimeOptions({
  materialOverrides: { MDF_36_SHEET: { base_cost: 9000 } },
  turnkeyCoefficient: 2.35
});
const defaultCalculation = calculateQuantityFromCalculator(baseConfig(), baseGeometry(), defaultRuntime);
const expensiveMdfCalculation = calculateQuantityFromCalculator(baseConfig(), baseGeometry(), expensiveMdfRuntime);
assert.equal(defaultCalculation.valid, true);
assert.equal(expensiveMdfCalculation.valid, true);
assert.notEqual(
  expensiveMdfCalculation.quantityEngineResult.pricing.materialAndConsumablesSubtotal,
  defaultCalculation.quantityEngineResult.pricing.materialAndConsumablesSubtotal
);
assert.ok(
  expensiveMdfCalculation.quantityEngineResult.pricing.materialAndConsumablesSubtotal >
    defaultCalculation.quantityEngineResult.pricing.materialAndConsumablesSubtotal
);

const expensiveMetalRuntime = runtimeOptions({
  railingOverrides: { 'металл': { price_per_meter: 22222 } },
  turnkeyCoefficient: 2.35
});
const expensiveMetalCalculation = calculateQuantityFromCalculator(baseConfig({ railing_option: 'metal' }), baseGeometry(), expensiveMetalRuntime);
assert.equal(expensiveMetalCalculation.valid, true);
assert.equal(expensiveMetalCalculation.quantityEngineResult.railing.typeId, 'rail_metal');
assert.notEqual(
  expensiveMetalCalculation.quantityEngineResult.railing.materialSubtotal,
  defaultCalculation.quantityEngineResult.railing.materialSubtotal
);
assert.ok(
  expensiveMetalCalculation.quantityEngineResult.railing.materialSubtotal >
    defaultCalculation.quantityEngineResult.railing.materialSubtotal
);

const highCoefficientCalculation = calculateQuantityFromCalculator(
  baseConfig(),
  baseGeometry(),
  runtimeOptions({ turnkeyCoefficient: 3.1 })
);
assert.equal(highCoefficientCalculation.valid, true);
assert.equal(highCoefficientCalculation.quantityEngineResult.pricing.turnkeyCoefficient, 3.1);
assert.notEqual(
  highCoefficientCalculation.quantityEngineResult.pricing.clientPrice,
  defaultCalculation.quantityEngineResult.pricing.clientPrice
);
assert.ok(
  highCoefficientCalculation.quantityEngineResult.pricing.clientPrice >
    defaultCalculation.quantityEngineResult.pricing.clientPrice
);

const noRailingCalculation = calculateQuantityFromCalculator(
  baseConfig({ railing_option: 'none' }),
  baseGeometry(),
  expensiveMetalRuntime
);
assert.equal(noRailingCalculation.valid, true);
assert.equal(noRailingCalculation.quantityEngineResult.railing.enabled, false);
assert.equal(noRailingCalculation.quantityEngineResult.railing.materialSubtotal, 0);

console.log('quantity-engine supabase runtime smoke tests passed');
