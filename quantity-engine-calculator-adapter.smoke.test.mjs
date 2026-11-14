import assert from 'node:assert/strict';
import { getStepwisePricingRegion } from './calculator-preview-pricing.js';
import {
  buildQuantityEngineInput,
  calculateQuantityFromCalculator,
  mapCalculatorConfigurationType,
  mapCalculatorRailingToQuantityEngine
} from './quantity-engine-calculator-adapter.js';

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
    tread_count: 10,
    riser_count: 10,
    tread_depth: 300,
    riser_height: 170,
    walking_line_length: 3000,
    service_metrics: {},
    ...overrides
  };
}

const straightInput = buildQuantityEngineInput(baseConfig(), baseGeometry());
assert.equal(straightInput.configurationType, 'straight');
assert.equal(mapCalculatorConfigurationType(baseConfig({ stair_type: 'l_turn', has_landing: true }), baseGeometry()), 'L');
assert.equal(mapCalculatorConfigurationType(baseConfig({ stair_type: 'u_turn', turn_type: 'winders' }), baseGeometry()), 'winder');
assert.equal(mapCalculatorConfigurationType(baseConfig({ base_condition: 'existing_metal_frame' }), baseGeometry()), 'metal_frame');
assert.equal(mapCalculatorConfigurationType(baseConfig({ base_condition: 'existing_concrete_base' }), baseGeometry()), 'concrete');

const lTurnLandingInput = buildQuantityEngineInput(
  baseConfig({ stair_type: 'l_turn', has_landing: true, landing_width: 1100, landing_length: 1200 }),
  baseGeometry()
);
assert.equal(lTurnLandingInput.configurationType, 'L');
assert.equal(lTurnLandingInput.platformCount, 1);
assert.equal(lTurnLandingInput.platformWidth, 1100);
assert.equal(lTurnLandingInput.platformDepth, 1200);

const noRailingResult = calculateQuantityFromCalculator(
  baseConfig({ railing_option: 'none' }),
  baseGeometry(),
  { turnkeyCoefficient: 2.5 }
);
assert.equal(noRailingResult.valid, true);
assert.equal(noRailingResult.quantityEngineInput.railingEnabled, false);
assert.equal(noRailingResult.quantityEngineInput.railingTypeId, 'none');
assert.equal(noRailingResult.quantityEngineResult.railing.enabled, false);
assert.equal(noRailingResult.quantityEngineResult.railing.materialSubtotal, 0);

assert.deepEqual(mapCalculatorRailingToQuantityEngine('metal'), {
  railingEnabled: true,
  railingTypeId: 'rail_metal'
});
const metalRailingResult = calculateQuantityFromCalculator(baseConfig({ railing_option: 'metal' }), baseGeometry());
assert.equal(metalRailingResult.valid, true);
assert.equal(metalRailingResult.quantityEngineInput.railingTypeId, 'rail_metal');
assert.equal(metalRailingResult.quantityEngineResult.railing.typeId, 'rail_metal');

const existingFrameInput = buildQuantityEngineInput(
  baseConfig({
    base_condition: 'existing_metal_frame',
    ready_frame_step_count: 12,
    ready_frame_march_width: 950,
    ready_frame_tread_depth: 280,
    ready_frame_riser_height: 175,
    ready_frame_straight_railing_length: 4.2
  }),
  baseGeometry({
    service_metrics: {
      stepCount: 13,
      railingLengthM: 4.8,
      additionalRailingLengthM: 1.2
    }
  })
);
assert.equal(existingFrameInput.configurationType, 'metal_frame');
assert.equal(existingFrameInput.stepCount, 13);
assert.equal(existingFrameInput.riserCount, 13);
assert.equal(existingFrameInput.marchWidth, 950);
assert.equal(existingFrameInput.treadDepth, 280);
assert.equal(existingFrameInput.riserHeight, 175);
assert.ok(Math.abs(existingFrameInput.railingLengthM - 3.6) < 1e-9);
assert.equal(existingFrameInput.topBalustradeLengthM, 1.2);

for (const baseCondition of ['existing_metal_frame', 'existing_concrete_base']) {
  const project = calculateQuantityFromCalculator(
    baseConfig({
      base_condition: baseCondition,
      ready_frame_step_count: 15,
      ready_frame_march_width: 900,
      ready_frame_tread_depth: 265,
      ready_frame_riser_height: 180
    }),
    baseGeometry({ service_metrics: { railingLengthM: 7, additionalRailingLengthM: 1 } })
  );
  assert.equal(project.valid, true);
  assert.equal(project.quantityEngineInput.railingLengthM, 6);
  assert.equal(project.quantityEngineResult.railing.topBalustradeLengthM, 1);
  assert.equal(project.quantityEngineResult.railing.totalLengthM, 7);
}

const concreteInput = buildQuantityEngineInput(
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
assert.equal(concreteInput.configurationType, 'concrete');
assert.equal(concreteInput.stepCount, 9);
assert.equal(concreteInput.riserCount, 9);
assert.equal(concreteInput.railingLengthM, 3.6);

const claddingConfig = baseConfig({
  base_condition: 'existing_metal_frame',
  ready_frame_step_count: 15,
  ready_frame_march_width: 900,
  ready_frame_tread_depth: 265,
  ready_frame_riser_height: 180,
  finish_scope: 'full_cladding',
  cladding_sheet_count: 5,
  cladding_sheet_width: 1035,
  cladding_sheet_height: 2800
});
const withCladding = calculateQuantityFromCalculator(claddingConfig, baseGeometry());
const withoutCladding = calculateQuantityFromCalculator(
  { ...claddingConfig, finish_scope: 'treads_and_risers' }, baseGeometry()
);
const claddingResult = withCladding.quantityEngineResult;
const tenMmRows = claddingResult.materials.filter((row) => row.code === 'MDF_10_SHEET');
assert.equal(tenMmRows.length, 1);
assert.equal(tenMmRows[0].quantity, 5);
assert.equal(tenMmRows[0].quantityWithWaste, 5);
assert.equal(claddingResult.quantities.mdfSheets.risers.sheets, 0);
assert.equal(claddingResult.quantities.mdfSheets.cladding.purchasedAreaM2, 14.49);
assert.equal(withoutCladding.quantityEngineResult.quantities.mdfSheets.risers.sheets, 1);
assert.equal(withoutCladding.quantityEngineInput.claddingSheets, undefined);

const previewGeometry = baseGeometry({ service_metrics: { railingLengthM: 7, additionalRailingLengthM: 1 } });
const previewConfig = { ...claddingConfig, preview_pricing: true };
const tat = calculateQuantityFromCalculator(previewConfig, previewGeometry, getStepwisePricingRegion('tatarstan')).quantityEngineResult;
const msk = calculateQuantityFromCalculator(previewConfig, previewGeometry, getStepwisePricingRegion('moscow')).quantityEngineResult;
assert.equal(tat.pricing.turnkeyCoefficient, 2.7);
assert.equal(msk.pricing.turnkeyCoefficient, 3);
assert.equal(tat.pricing.materialAndConsumablesSubtotal, msk.pricing.materialAndConsumablesSubtotal);
assert.equal(tat.pricing.clientPrice, Math.round(tat.pricing.materialAndConsumablesSubtotal * 270) / 100);
assert.equal(msk.pricing.clientPrice, Math.round(msk.pricing.materialAndConsumablesSubtotal * 300) / 100);
assert.equal(tat.railing.totalLengthM, 7);
assert.equal(tat.materials.find(({ code }) => code === 'MDF_10_WHITE_LAMINATED_SHEET').subtotal, 5187.5);
assert.equal(tat.materials.find(({ code }) => code === 'MDF_38_SHEET').unitCost, 12171);
assert.equal(tat.quantities.lacquer.liters, 0);
assert.equal(tat.quantities.enamel.finishAreaM2, tat.quantities.treadAreaM2);
const workshop = calculateQuantityFromCalculator(
  { ...previewConfig, preview_workshop_budget: true }, previewGeometry, getStepwisePricingRegion('tatarstan')
).quantityEngineResult;
assert.equal(workshop.materials.find(({ code }) => code === 'MDF_16_SHOE_HALF_SHEET').subtotal, 1640);
assert.equal(workshop.materials.find(({ code }) => code === 'WORKSHOP_PAINT_BUDGET').subtotal, 17500);
assert.ok(workshop.materials.every(({ quantityKind }) => !['primer', 'enamel', 'lacquer'].includes(quantityKind)));
assert.equal(workshop.pricing.clientPriceMax - workshop.pricing.clientPriceMin, 13500);

const pricedResult = calculateQuantityFromCalculator(
  baseConfig({ turnkeyCoefficient: 2.8 }),
  baseGeometry()
);
assert.equal(pricedResult.valid, true);
assert.equal(
  pricedResult.quantityEngineResult.pricing.clientPrice,
  Math.round(pricedResult.quantityEngineResult.pricing.materialAndConsumablesSubtotal * pricedResult.quantityEngineResult.pricing.turnkeyCoefficient * 100) / 100
);
assert.deepEqual(Object.keys(pricedResult.quantityEngineResult.pricing), [
  'materialAndConsumablesSubtotal',
  'turnkeyCoefficient',
  'clientPrice'
]);

const missingGeometryResult = calculateQuantityFromCalculator(baseConfig(), {});
assert.equal(missingGeometryResult.valid, false);
assert.equal(missingGeometryResult.quantityEngineResult, null);
assert.ok(missingGeometryResult.diagnostics.some((diagnostic) => diagnostic.code === 'MISSING_CALCULATOR_GEOMETRY'));

console.log('quantity-engine-calculator-adapter smoke tests passed');
