import assert from 'node:assert/strict';
import { calculateQuantityEngine } from './quantity-engine.js';

function warningCodes(result) {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

const mdfResult = calculateQuantityEngine({
  configurationType: 'straight',
  stepCount: 18,
  riserCount: 18,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  openSideCount: 1,
  railingLengthM: 0
});
assert.equal(mdfResult.quantities.treadAreaM2, 5.4);
assert.equal(mdfResult.quantities.riserAreaM2, 3.06);
assert.equal(mdfResult.quantities.mdfSheets.treads.sheets, 2);
assert.equal(mdfResult.quantities.mdfSheets.risers.sheets, 1);
assert.equal(mdfResult.quantities.mdfSheets.total.sheets, 3);

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
assert.equal(railingResult.railing.totalLengthM, 5);
assert.equal(railingResult.railing.topBalustradeLengthM, 2);
assert.equal(railingResult.railing.upperBalustradeIsSeparateType, false);

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

console.log('quantity-engine smoke tests passed');
