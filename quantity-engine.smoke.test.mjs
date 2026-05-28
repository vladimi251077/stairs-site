import assert from 'node:assert/strict';
import { calculateQuantityEngine } from './quantity-engine.js';

function warningCodes(result) {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

const mdfResult = calculateQuantityEngine({
  configurationType: 'straight',
  stepCount: 10,
  riserCount: 1,
  platformCount: 1,
  marchWidth: 1000,
  treadDepth: 250,
  riserHeight: 170,
  platformWidth: 1000,
  platformDepth: 2500,
  openSideCount: 1,
  railingLengthM: 0
});
const mdf36Row = mdfResult.materials.find((row) => row.code === 'MDF_36_SHEET');
const mdf10Row = mdfResult.materials.find((row) => row.code === 'MDF_10_SHEET');
assert.equal(mdfResult.quantities.treadAreaM2, 2.5);
assert.equal(mdfResult.quantities.platformAreaM2, 2.5);
assert.equal(mdfResult.quantities.riserAreaM2, 0.17);
assert.equal(mdfResult.quantities.mdfSheets.treads.materialCode, 'MDF_36_SHEET');
assert.equal(mdfResult.quantities.mdfSheets.platforms.materialCode, 'MDF_36_SHEET');
assert.equal(mdfResult.quantities.mdfSheets.risers.materialCode, 'MDF_10_SHEET');
assert.equal(mdfResult.quantities.mdfSheets.treadsAndPlatforms.sheets, 1);
assert.equal(mdfResult.quantities.mdfSheets.risers.sheets, 1);
assert.equal(mdfResult.quantities.mdfSheets.total.sheets, 2);
assert.equal(mdf36Row.name, 'MDF 36 мм, лист — ступени и площадки');
assert.equal(mdf36Row.quantity, 1);
assert.equal(mdf10Row.name, 'MDF 10 мм, лист — подступенки');
assert.equal(mdf10Row.quantity, 1);
assert.equal(mdfResult.materials.filter((row) => row.code === 'MDF_18_SHEET').length, 0);

const coatingResult = calculateQuantityEngine({
  configurationType: 'straight',
  stepCount: 10,
  riserCount: 10,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  railingLengthM: 0
});
assert.equal(coatingResult.quantities.finishAreaM2, 4.7);
assert.equal(coatingResult.quantities.primer.liters, 0.51);
assert.equal(coatingResult.quantities.enamel.liters, 1.22);
assert.equal(coatingResult.quantities.lacquer.liters, 0.91);

const railingResult = calculateQuantityEngine({
  configurationType: 'straight',
  stepCount: 1,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  railingLengthM: 3,
  topBalustradeLengthM: 2
});
assert.equal(railingResult.railing.enabled, true);
assert.equal(railingResult.railing.totalLengthM, 5);
assert.equal(railingResult.railing.topBalustradeLengthM, 2);
assert.equal(railingResult.railing.upperBalustradeIsSeparateType, false);
assert.equal(railingResult.railing.materialSubtotal, 47500);

const fallbackRailingResult = calculateQuantityEngine({
  configurationType: 'straight',
  stepCount: 10,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  topBalustradeLengthM: 0
});
assert.equal(fallbackRailingResult.railing.enabled, true);
assert.equal(fallbackRailingResult.railing.totalLengthM, 3);
assert.equal(fallbackRailingResult.railing.materialSubtotal, 28500);

const disabledRailingFlagResult = calculateQuantityEngine({
  configurationType: 'straight',
  stepCount: 10,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  railingEnabled: false,
  topBalustradeLengthM: 2
});
assert.equal(disabledRailingFlagResult.railing.enabled, false);
assert.equal(disabledRailingFlagResult.railing.name, 'без ограждения');
assert.equal(disabledRailingFlagResult.railing.totalLengthM, 0);
assert.equal(disabledRailingFlagResult.railing.topBalustradeLengthM, 0);
assert.equal(disabledRailingFlagResult.railing.materialSubtotal, 0);
assert.equal(disabledRailingFlagResult.railing.upperBalustradeIsSeparateType, false);

const disabledRailingTypeResult = calculateQuantityEngine({
  configurationType: 'straight',
  stepCount: 10,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  railingTypeId: 'none',
  topBalustradeLengthM: 2
});
assert.equal(disabledRailingTypeResult.railing.enabled, false);
assert.equal(disabledRailingTypeResult.railing.totalLengthM, 0);
assert.equal(disabledRailingTypeResult.railing.materialSubtotal, 0);
assert.ok(!warningCodes(disabledRailingTypeResult).includes('UNKNOWN_RAILING_TYPE'));

const clampedCoefficientResult = calculateQuantityEngine({
  stepCount: 1,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  turnkeyCoefficient: 0.5
});
assert.equal(clampedCoefficientResult.pricing.turnkeyCoefficient, 1);

const unknownPresetResult = calculateQuantityEngine({
  configurationType: 'spiral_reference_only',
  stepCount: 1,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170
});
assert.ok(warningCodes(unknownPresetResult).includes('UNKNOWN_CONFIGURATION_PRESET'));

const unknownRailingResult = calculateQuantityEngine({
  stepCount: 1,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  railingTypeId: 'unknown-railing'
});
assert.ok(warningCodes(unknownRailingResult).includes('UNKNOWN_RAILING_TYPE'));

const zeroSubtotalResult = calculateQuantityEngine(
  {
    stepCount: 0,
    riserCount: 0,
    platformCount: 0,
    marchWidth: 1000,
    treadDepth: 300,
    riserHeight: 170,
    railingLengthM: 0
  },
  {
    materialsCatalog: [],
    railingTypes: [{ id: 'rail_tubes_16', name: 'free railing', pricePerMeter: 0 }]
  }
);
assert.ok(warningCodes(zeroSubtotalResult).includes('ZERO_MATERIAL_SUBTOTAL'));

const suspiciousCoefficientResult = calculateQuantityEngine({
  stepCount: 1,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  turnkeyCoefficient: 6
});
assert.ok(warningCodes(suspiciousCoefficientResult).includes('SUSPICIOUS_TURNKEY_COEFFICIENT'));
assert.deepEqual(Object.keys(suspiciousCoefficientResult.pricing), [
  'materialAndConsumablesSubtotal',
  'turnkeyCoefficient',
  'clientPrice'
]);
assert.equal(
  suspiciousCoefficientResult.pricing.clientPrice,
  Math.round(suspiciousCoefficientResult.pricing.materialAndConsumablesSubtotal * suspiciousCoefficientResult.pricing.turnkeyCoefficient * 100) / 100
);

console.log('quantity-engine smoke tests passed');
