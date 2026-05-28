import assert from 'node:assert/strict';
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
assert.equal(existingFrameInput.railingLengthM, 4.8);
assert.equal(existingFrameInput.topBalustradeLengthM, 1.2);

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
