import { calculateQuantityEngine } from './quantity-engine.js';

const READY_BASE_CONDITIONS = new Set(['existing_metal_frame', 'ready_frame']);
const CONCRETE_BASE_CONDITIONS = new Set(['existing_concrete_base']);
const DEFAULT_RAILING_TYPE_ID = 'rail_tubes_16';

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

  const railingLengthM = resolveRailingLengthM({ config, geometry, serviceMetrics, isExistingBase });
  if (railingLengthM !== undefined) {
    input.railingLengthM = railingLengthM;
  }

  const turnkeyCoefficient = firstPresent(options.turnkeyCoefficient, config.turnkeyCoefficient);
  if (turnkeyCoefficient !== undefined) {
    input.turnkeyCoefficient = turnkeyCoefficient;
  }

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

function resolveRailingLengthM({ config, geometry, serviceMetrics, isExistingBase }) {
  if (config.railing_option === 'none') return 0;

  if (isExistingBase) {
    return firstPresent(serviceMetrics.railingLengthM, config.ready_frame_straight_railing_length);
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
