import assert from 'node:assert/strict';
import { calculateQuantityEngine, calculateTotalRailingLength } from './quantity-engine.js';

const baseInput = {
  configurationType: 'straight',
  stepCount: 20,
  riserCount: 20,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  openSideCount: 1,
  railingTypeId: 'rail_tubes_16',
  railingLengthM: 4,
  topBalustradeLengthM: 1.5,
  turnkeyCoefficient: 0.3
};

const result = calculateQuantityEngine(baseInput);

assert.equal(result.quantities.mdfSheets.treadSheets, 2, 'MDF tread sheets should round up after preset waste');
assert.equal(result.quantities.mdfSheets.riserSheets, 1, 'MDF riser sheets should round up after preset waste');
assert.equal(result.quantities.mdfSheets.count, 3, 'total MDF sheets should sum tread/riser/platform sheet counts');
assert.equal(result.quantities.enamel.liters, 2.07, 'enamel liters should include coating norm, layers, and preset waste');
assert.equal(result.quantities.primer.liters, 1.24, 'primer liters should include coating norm, layers, and preset waste');
assert.equal(result.railing.topBalustradeLengthM, 1.5, 'top balustrade length should be retained on selected railing type');
assert.equal(result.railing.totalLengthM, 5.5, 'top balustrade length should be included in selected railing type total length');
assert.equal(result.railing.upperBalustradeIsSeparateType, false, 'top balustrade must not become a separate railing type');
assert.equal(calculateTotalRailingLength({ marchLengthM: 4, topBalustradeLengthM: 1.5 }), 5.5);
assert.equal(result.pricing.turnkeyCoefficient, 1, 'suspicious coefficient should clamp to minimum');
assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'SUSPICIOUS_TURNKEY_COEFFICIENT'));

const platformResult = calculateQuantityEngine({
  configurationType: 'platform',
  stepCount: 10,
  riserCount: 10,
  marchWidth: 1000,
  treadDepth: 300,
  riserHeight: 170,
  platformCount: 1,
  platformLength: 1200,
  platformWidth: 1000
});

assert.equal(platformResult.quantities.platformCount, 1);
assert.equal(platformResult.quantities.platformAreaM2, 1.2);
assert.equal(platformResult.quantities.mdfSheets.platformSheets, 1, 'platform MDF sheets should round up after preset waste');

const diagnosticsResult = calculateQuantityEngine({
  configurationType: 'unknown_preset',
  railingTypeId: 'unknown_railing',
  turnkeyCoefficient: 9
}, { materialsCatalog: [] });

assert.ok(diagnosticsResult.diagnostics.some((diagnostic) => diagnostic.code === 'MISSING_GEOMETRY_INPUTS'));
assert.ok(diagnosticsResult.diagnostics.some((diagnostic) => diagnostic.code === 'UNKNOWN_CONFIGURATION_PRESET'));
assert.ok(diagnosticsResult.diagnostics.some((diagnostic) => diagnostic.code === 'UNKNOWN_RAILING_TYPE'));
assert.ok(diagnosticsResult.diagnostics.some((diagnostic) => diagnostic.code === 'ZERO_MATERIAL_SUBTOTAL'));
assert.ok(diagnosticsResult.diagnostics.some((diagnostic) => diagnostic.code === 'SUSPICIOUS_TURNKEY_COEFFICIENT'));
assert.equal(diagnosticsResult.pricing.turnkeyCoefficient, 6, 'suspicious coefficient should clamp to maximum');

console.log('quantity-engine smoke test passed');
