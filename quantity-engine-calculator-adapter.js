import { calculateQuantityEngine } from './quantity-engine.js';
import { enamelTreadMdfSheetCost, estimateStepwiseCladding, getStepwiseCladdingSheetCost, referenceTubeRailingCostPerMeter,
  shoeMdfHalfSheetCost, trimMdfCost, underStairDoorMaterials } from './calculator-preview-pricing.js';

const READY_BASE_CONDITIONS = new Set(['existing_metal_frame', 'ready_frame']);
const CONCRETE_BASE_CONDITIONS = new Set(['existing_concrete_base']);
const DEFAULT_RAILING_TYPE_ID = 'rail_tubes_16';

export function requiresRailingQuote(config) {
  return config.preview_pricing && config.finish_scope === 'full_cladding'
    && (READY_BASE_CONDITIONS.has(config.base_condition) || CONCRETE_BASE_CONDITIONS.has(config.base_condition))
    && !['none', 'metal'].includes(config.railing_option);
}

export function mapCalculatorConfigurationType(config = {}, geometry = {}) {
  if (READY_BASE_CONDITIONS.has(config.base_condition)) return 'metal_frame';
  if (CONCRETE_BASE_CONDITIONS.has(config.base_condition)) return 'concrete';
  if (config.stair_type === 'straight') return 'straight';
  if (config.turn_type === 'winders') return 'winder';
  if (config.stair_type === 'l_turn') return 'L';
  if (config.stair_type === 'u_turn') return 'U';

  return geometry.configurationType || 'straight';
}

export function mapCalculatorRailingToQuantityEngine(railingOption) {
  const mapping = {
    metal: { railingEnabled: true, railingTypeId: 'rail_metal' },
    glass: { railingEnabled: true, railingTypeId: 'rail_glass' },
    wood: { railingEnabled: true, railingTypeId: 'rail_wood' },
    none: { railingEnabled: false, railingTypeId: 'none' }
  };

  return mapping[railingOption] || { railingEnabled: true, railingTypeId: DEFAULT_RAILING_TYPE_ID };
}

export function buildQuantityEngineInput(config = {}, geometry = {}, options = {}) {
  const serviceMetrics = geometry?.service_metrics || {};
  const isExistingBase = READY_BASE_CONDITIONS.has(config.base_condition)
    || CONCRETE_BASE_CONDITIONS.has(config.base_condition);
  const configurationType = mapCalculatorConfigurationType(config, geometry);
  const platformCount = config.has_landing || serviceMetrics.hasLanding ? 1 : undefined;
  const railing = mapCalculatorRailingToQuantityEngine(config.railing_option);
  const input = {
    configurationType,
    ...buildGeometryInput({ config, geometry, serviceMetrics, isExistingBase }),
    ...railing,
    topBalustradeLengthM: numberOrZero(serviceMetrics.additionalRailingLengthM)
  };

  if (platformCount !== undefined) {
    input.platformCount = platformCount;
    input.platformWidth = firstPresent(config.landing_width, config.ready_frame_march_width, config.march_width);
    input.platformDepth = firstPresent(config.landing_length, config.ready_frame_march_width, config.march_width);
  }

  if (isExistingBase && config.finish_scope === 'full_cladding') {
    if (config.preview_pricing && config.preview_under_stair_door) {
      input.additionalMaterials = underStairDoorMaterials;
    }
    const [sheets, widthMm, heightMm] = [
      config.cladding_sheet_count, config.cladding_sheet_width, config.cladding_sheet_height
    ].map(Number);
    const explicitSheets = [sheets, widthMm, heightMm].every((value) => Number.isSafeInteger(value) && value > 0)
      ? { sheets, widthMm, heightMm } : null;
    const estimatedSheets = config.preview_pricing && estimateStepwiseCladding(
      Number(input.stepCount), Number(input.marchWidth), Number(input.treadDepth), Number(input.riserHeight)
    );
    const cladding = explicitSheets || estimatedSheets;
    if (cladding) {
      input.claddingSheets = cladding;
      if (config.preview_pricing) {
        input.claddingSheets.laminatedWhite = true;
        input.claddingSheets.estimatedUnitCost = getStepwiseCladdingSheetCost(cladding.widthMm, cladding.heightMm);
        input.claddingSheets.enamelTreadSheetCost = enamelTreadMdfSheetCost;
        if (config.preview_workshop_budget || !explicitSheets) {
          const scale = Number(input.stepCount) / 15;
          input.workshopBudget = {
            shoeSheetCost: shoeMdfHalfSheetCost * scale, trimMdfCost: trimMdfCost * scale,
            paintMin: 15000 * scale, paintMax: 20000 * scale, fastenerCost: 20000 * scale
          };
        }
      }
    }
    if (config.preview_pricing && config.railing_option === 'metal') {
      input.railingMaterialCostPerMeter = referenceTubeRailingCostPerMeter;
    }
  }

  const railingLengthM = resolveRailingLengthM({
    config, geometry, serviceMetrics, isExistingBase, topBalustradeLengthM: input.topBalustradeLengthM
  });
  if (railingLengthM !== undefined) {
    input.railingLengthM = railingLengthM;
  }

  const turnkeyCoefficient = firstPresent(options.turnkeyCoefficient, config.turnkeyCoefficient);
  if (turnkeyCoefficient !== undefined) {
    input.turnkeyCoefficient = turnkeyCoefficient;
  }
  if (config.preview_pricing) input.otherExpensesPercent = options.otherExpensesPercent;

  return input;
}

export function calculateQuantityFromCalculator(config = {}, geometry = {}, options = {}) {
  const diagnostics = [];
  const quantityEngineInput = buildQuantityEngineInput(config, geometry, options);
  const missingGeometryFields = collectMissingGeometryFields(quantityEngineInput);

  if (missingGeometryFields.length > 0) {
    diagnostics.push({
      level: 'warning',
      code: 'MISSING_CALCULATOR_GEOMETRY',
      message: 'Not enough calculator geometry to build a reliable Quantity Engine input.',
      fields: missingGeometryFields
    });

    return {
      valid: false,
      quantityEngineInput,
      quantityEngineResult: null,
      diagnostics
    };
  }

  try {
    const quantityEngineResult = calculateQuantityEngine(quantityEngineInput, options.quantityEngineOptions || {});

    return {
      valid: true,
      quantityEngineInput,
      quantityEngineResult,
      diagnostics: [...diagnostics, ...quantityEngineResult.diagnostics]
    };
  } catch (error) {
    diagnostics.push({
      level: 'error',
      code: 'QUANTITY_ENGINE_CALCULATION_FAILED',
      message: error instanceof Error ? error.message : 'Quantity Engine calculation failed.'
    });

    return {
      valid: false,
      quantityEngineInput,
      quantityEngineResult: null,
      diagnostics
    };
  }
}

function buildGeometryInput({ config, geometry, serviceMetrics, isExistingBase }) {
  if (isExistingBase) {
    const stepCount = firstPresent(serviceMetrics.stepCount, config.ready_frame_step_count);

    return {
      stepCount,
      riserCount: stepCount,
      marchWidth: config.ready_frame_march_width,
      treadDepth: config.ready_frame_tread_depth,
      riserHeight: config.ready_frame_riser_height
    };
  }

  return {
    stepCount: geometry.tread_count,
    riserCount: geometry.riser_count,
    marchWidth: config.march_width,
    treadDepth: geometry.tread_depth,
    riserHeight: geometry.riser_height
  };
}

function resolveRailingLengthM({ config, geometry, serviceMetrics, isExistingBase, topBalustradeLengthM }) {
  if (config.railing_option === 'none') return 0;

  if (isExistingBase) {
    const totalLengthM = firstPresent(serviceMetrics.railingLengthM);
    if (totalLengthM !== undefined) {
      // The service total already includes the straight landing section.
      // The engine adds that section separately to the march length.
      return Math.max(0, Number(totalLengthM) - topBalustradeLengthM);
    }
    return firstPresent(config.ready_frame_straight_railing_length);
  }

  if (geometry.walking_line_length !== undefined && geometry.walking_line_length !== null && geometry.walking_line_length !== '') {
    return Number(geometry.walking_line_length) / 1000;
  }

  return undefined;
}

function collectMissingGeometryFields(quantityEngineInput) {
  return [
    'stepCount',
    'marchWidth',
    'treadDepth',
    'riserHeight'
  ].filter((field) => !hasUsableNumber(quantityEngineInput[field]));
}

function hasUsableNumber(value) {
  return value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function numberOrZero(value) {
  if (value === undefined || value === null || value === '') return 0;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}
