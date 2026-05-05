import { calculateReadyFrameGeometry, calculateStairGeometry } from './stair-geometry-engine.js';
import {
  calculateMetalMaterials,
  calculateWoodMaterials,
  calculateConcreteMaterials
} from './stair-materials.js';

const STORAGE_KEY = 'tekstura_stair_calc_payload';

function createDefaultPricingDefaults() {
  return {
    labor_rate_per_step: 2500,
    metal_rate_per_meter: 1800,
    wood_rate_per_m2: 16000,
    concrete_rate_per_m3: 14000,
    install_coef: 1.12,
    markup_coef: 1.08
  };
}

function createDefaultPricingRegions() {
  return [
    {
      code: 'primary_region',
      name: 'Основной регион',
      price_coef: 1,
      sort_order: 1,
      notes: 'Базовый коэффициент без надбавки.',
      active: true
    },
    {
      code: 'secondary_region',
      name: 'Второй регион',
      price_coef: 1,
      sort_order: 2,
      notes: 'Скорректируйте коэффициент под второй регион.',
      active: true
    }
  ];
}

function createDefaultScenarioRateRows() {
  return [
    { rate_group: 'finishMaterialPerM2', rate_key: 'oak', label: 'Дуб / шпон', rate: 22000, sort_order: 1, active: true },
    { rate_group: 'finishMaterialPerM2', rate_key: 'ash', label: 'Ясень', rate: 19000, sort_order: 2, active: true },
    { rate_group: 'finishMaterialPerM2', rate_key: 'stone', label: 'Камень', rate: 34000, sort_order: 3, active: true },
    { rate_group: 'finishMaterialPerM2', rate_key: 'porcelain', label: 'Керамогранит', rate: 17500, sort_order: 4, active: true },
    { rate_group: 'finishMaterialPerM2', rate_key: 'microcement', label: 'Микроцемент', rate: 15500, sort_order: 5, active: true },
    { rate_group: 'railingPerM', rate_key: 'metal', label: 'Ограждение: металл', rate: 9500, sort_order: 10, active: true },
    { rate_group: 'railingPerM', rate_key: 'glass', label: 'Ограждение: стекло', rate: 18000, sort_order: 11, active: true },
    { rate_group: 'railingPerM', rate_key: 'wood', label: 'Ограждение: дерево', rate: 12500, sort_order: 12, active: true },
    { rate_group: 'railingPerM', rate_key: 'none', label: 'Ограждение: не нужно', rate: 0, sort_order: 13, active: true },
    { rate_group: 'lightingPerStep', rate_key: 'none', label: 'Подсветка: нет', rate: 0, sort_order: 20, active: true },
    { rate_group: 'lightingPerStep', rate_key: 'step', label: 'Подсветка: точечная', rate: 1400, sort_order: 21, active: true },
    { rate_group: 'lightingPerStep', rate_key: 'linear', label: 'Подсветка: линейная', rate: 2100, sort_order: 22, active: true },
    { rate_group: 'coatingPerM2', rate_key: 'none', label: 'Покрытие: нет', rate: 0, sort_order: 30, active: true },
    { rate_group: 'coatingPerM2', rate_key: 'standard', label: 'Покрытие: стандарт', rate: 2200, sort_order: 31, active: true },
    { rate_group: 'coatingPerM2', rate_key: 'premium', label: 'Покрытие: премиум', rate: 3600, sort_order: 32, active: true },
    { rate_group: 'service', rate_key: 'fitCheck', label: 'Проверка посадки каркаса', rate: 15000, sort_order: 40, active: true },
    { rate_group: 'service', rate_key: 'prepPerM2', label: 'Подготовка основания за м²', rate: 4200, sort_order: 41, active: true },
    { rate_group: 'service', rate_key: 'installPerM2', label: 'Монтаж отделки за м²', rate: 5200, sort_order: 42, active: true },
    { rate_group: 'service', rate_key: 'fullCladdingPerM2', label: 'Полная обшивка каркаса за м²', rate: 6500, sort_order: 43, active: true }
  ];
}

const state = {
  config: null,
  geometry: null,
  materials: null,
  price: null,
  payload: null,
  dictionaries: {
    defaults: createDefaultPricingDefaults(),
    materialRules: [],
    regions: createDefaultPricingRegions(),
    scenarioRateRows: createDefaultScenarioRateRows()
  }
};

const STATUS_META = {
  recommended: {
    label: 'Рекомендуемая',
    badge: 'recommended',
    title: 'Геометрия выглядит уверенно',
    text: 'Подбор находится в комфортных пределах, можно переходить к материалам и ориентиру стоимости.'
  },
  warning: {
    label: 'Нужна проверка',
    badge: 'warning',
    title: 'Предварительно подходит, но требует ручной проверки',
    text: 'Геометрия может быть реализуемой, однако один или несколько параметров находятся рядом с инженерной границей.'
  },
  invalid: {
    label: 'Инженерная проверка',
    badge: 'invalid',
    title: 'Онлайн-подбор не нашёл безопасное решение',
    text: 'Для текущего проёма калькулятор не нашёл достаточно удобную и безопасную геометрию.'
  }
};

const STAIR_LABELS = {
  straight: 'Прямая',
  l_turn: 'Г-образная',
  u_turn: 'П-образная'
};

const TURN_LABELS = {
  landing: 'площадка',
  winders: 'забежные ступени'
};

const BASE_CONDITION_LABELS = {
  empty_opening: 'Пустой проём',
  existing_metal_frame: 'Готовый каркас',
  ready_frame: 'Готовый каркас',
  ready_base: 'Готовое основание',
  existing_concrete_base: 'Бетонная лестница'
};

const FINISH_SCOPE_LABELS = {
  treads_only: 'Только ступени',
  treads_and_risers: 'Ступени + подступенки',
  full_cladding: 'Полная обшивка каркаса'
};

const OPTION_LABELS = {
  finish_material: {
    oak: 'Дуб / шпон',
    ash: 'Ясень',
    stone: 'Камень',
    porcelain: 'Керамогранит',
    microcement: 'Микроцемент'
  },
  railing: {
    metal: 'Металл',
    glass: 'Стекло',
    wood: 'Дерево',
    none: 'Не нужно'
  },
  coating: {
    standard: 'Стандартное',
    premium: 'Премиальное',
    none: 'Не требуется'
  },
  lighting: {
    none: 'Не нужна',
    step: 'Точечная по ступеням',
    linear: 'Линейная'
  }
};

const SCENARIO_RATE_SELECTS = {
  finishMaterialPerM2: {
    id: 'finishMaterial',
    fallback: 'oak',
    labelTarget: 'finish_material'
  },
  railingPerM: {
    id: 'railingOption',
    fallback: 'metal',
    labelTarget: 'railing'
  },
  coatingPerM2: {
    id: 'coatingOption',
    fallback: 'standard',
    labelTarget: 'coating'
  },
  lightingPerStep: {
    id: 'lightingOption',
    fallback: 'none',
    labelTarget: 'lighting'
  }
};

const $ = (id) => document.getElementById(id);
const formatMm = (value) => `${new Intl.NumberFormat('ru-RU').format(Math.round(value || 0))} мм`;
const round = (value, digits = 2) => Number((value || 0).toFixed(digits));

function normalizeBaseConditionValue(value, fallback = 'empty_opening') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ready_frame') return 'existing_metal_frame';
  if (normalized === 'ready_base') return $('baseSubtype')?.value || 'existing_metal_frame';
  return normalized || fallback;
}

function isReadyFrameCondition(value) {
  return normalizeBaseConditionValue(value, 'existing_metal_frame') === 'existing_metal_frame';
}

function isInspectionScenario(baseCondition) {
  const normalized = normalizeBaseConditionValue(baseCondition, 'empty_opening');
  return normalized !== 'empty_opening';
}

function normalizeOpeningTypeValue(value, fallback = 'straight') {
  const normalized = String(value || '').trim().toLowerCase();

  if (['straight', 'l_turn', 'u_turn'].includes(normalized)) return normalized;
  if (['none', 'empty', 'no_opening', 'without_opening', 'not_selected'].includes(normalized)) return 'none';
  return fallback;
}

function normalizePricingDefaults(row = {}) {
  const fallback = createDefaultPricingDefaults();
  return {
    id: row.id || null,
    labor_rate_per_step: Number(row.labor_rate_per_step ?? fallback.labor_rate_per_step),
    metal_rate_per_meter: Number(row.metal_rate_per_meter ?? fallback.metal_rate_per_meter),
    wood_rate_per_m2: Number(row.wood_rate_per_m2 ?? fallback.wood_rate_per_m2),
    concrete_rate_per_m3: Number(row.concrete_rate_per_m3 ?? fallback.concrete_rate_per_m3),
    install_coef: Number(row.install_coef ?? fallback.install_coef),
    markup_coef: Number(row.markup_coef ?? fallback.markup_coef)
  };
}

function normalizePricingRegion(row = {}, index = 0) {
  const fallback = createDefaultPricingRegions()[index] || createDefaultPricingRegions()[0];
  return {
    id: row.id || null,
    code: row.code || fallback.code || `region_${index + 1}`,
    name: row.name || fallback.name || `Регион ${index + 1}`,
    price_coef: Number(row.price_coef ?? fallback.price_coef ?? 1),
    sort_order: Number(row.sort_order ?? fallback.sort_order ?? index + 1),
    notes: row.notes || fallback.notes || '',
    active: row.active !== false
  };
}

function normalizeScenarioRateRow(row = {}, index = 0) {
  const fallback = createDefaultScenarioRateRows()[index] || createDefaultScenarioRateRows()[0];
  return {
    id: row.id || null,
    rate_group: row.rate_group || fallback.rate_group,
    rate_key: row.rate_key || fallback.rate_key,
    label: row.label || fallback.label,
    rate: Number(row.rate ?? fallback.rate ?? 0),
    sort_order: Number(row.sort_order ?? fallback.sort_order ?? index + 1),
    active: row.active !== false
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getActivePricingRegions() {
  const regions = (state.dictionaries.regions || [])
    .map((region, index) => normalizePricingRegion(region, index))
    .filter((region) => region.active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);

  return regions.length ? regions : createDefaultPricingRegions().map(normalizePricingRegion);
}

function getPricingRegion(regionCode) {
  const regions = getActivePricingRegions();
  return regions.find((region) => region.code === regionCode) || regions[0];
}

function renderPricingRegionOptions(preferredCode = null) {
  const select = $('pricingRegion');
  if (!select) return;

  const regions = getActivePricingRegions();
  const safePreferred = preferredCode || select.value;

  select.innerHTML = regions
    .map(
      (region) =>
        `<option value="${escapeHtml(region.code)}">${escapeHtml(region.name)}</option>`
    )
    .join('');

  const nextCode = regions.some((region) => region.code === safePreferred)
    ? safePreferred
    : regions[0]?.code;

  if (nextCode) select.value = nextCode;
}

function getActiveScenarioRateRows() {
  const rows = (state.dictionaries.scenarioRateRows || [])
    .map((row, index) => normalizeScenarioRateRow(row, index))
    .filter((row) => row.active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);

  return rows.length ? rows : createDefaultScenarioRateRows().map(normalizeScenarioRateRow);
}

function buildScenarioRatesMap(rows = getActiveScenarioRateRows()) {
  const map = {
    finishMaterialPerM2: {},
    railingPerM: {},
    lightingPerStep: {},
    coatingPerM2: {},
    service: {}
  };

  rows.forEach((row) => {
    if (!map[row.rate_group]) map[row.rate_group] = {};
    map[row.rate_group][row.rate_key] = Number(row.rate || 0);
  });

  return map;
}

function getScenarioRates() {
  return buildScenarioRatesMap(getActiveScenarioRateRows());
}

function getScenarioRowsByGroup(group) {
  return getActiveScenarioRateRows().filter((row) => row.rate_group === group);
}

function getScenarioOptionLabel(group, key) {
  const row = getScenarioRowsByGroup(group).find((item) => item.rate_key === key);
  return row?.label || key || 'Уточняется';
}

function getOptionLabel(kind, key) {
  if (kind === 'finish_material') return getScenarioOptionLabel('finishMaterialPerM2', key);
  if (kind === 'railing') return getScenarioOptionLabel('railingPerM', key);
  if (kind === 'coating') return getScenarioOptionLabel('coatingPerM2', key);
  if (kind === 'lighting') return getScenarioOptionLabel('lightingPerStep', key);
  return key || 'Уточняется';
}

function renderScenarioRateOptions(group, preferredValue = null) {
  const config = SCENARIO_RATE_SELECTS[group];
  const select = config ? $(config.id) : null;
  if (!select) return;

  const rows = getScenarioRowsByGroup(group);
  const fallbackRows = createDefaultScenarioRateRows()
    .map((row, index) => normalizeScenarioRateRow(row, index))
    .filter((row) => row.rate_group === group && row.active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);
  const options = rows.length ? rows : fallbackRows;
  const currentValue = preferredValue || select.value || config.fallback;

  select.innerHTML = options
    .map((row) => `<option value="${escapeHtml(row.rate_key)}">${escapeHtml(row.label)}</option>`)
    .join('');

  const nextValue = options.some((row) => row.rate_key === currentValue)
    ? currentValue
    : options[0]?.rate_key || config.fallback;

  if (nextValue) select.value = nextValue;

  if (config.labelTarget) {
    OPTION_LABELS[config.labelTarget] = options.reduce((labels, row) => {
      labels[row.rate_key] = row.label;
      return labels;
    }, {});
  }
}

function renderScenarioRateSelects(preferredConfig = null) {
  renderScenarioRateOptions('finishMaterialPerM2', preferredConfig?.finish_material);
  renderScenarioRateOptions('railingPerM', preferredConfig?.railing_option);
  renderScenarioRateOptions('coatingPerM2', preferredConfig?.coating_option);
  renderScenarioRateOptions('lightingPerStep', preferredConfig?.lighting_option);
}

function showStep(step) {
  document.querySelectorAll('.step').forEach((node) => node.classList.remove('active'));
  $(`step${step}`)?.classList.add('active');
}

window.nextStep = showStep;
window.prevStep = showStep;
globalThis.nextStep = showStep;
globalThis.prevStep = showStep;

function setStatus(message = '') {
  const statusNode = $('pageStatus');
  if (statusNode) statusNode.textContent = message;
}

function getStairLabel(config, geometry = null) {
  const base = STAIR_LABELS[config?.stair_type] || STAIR_LABELS.straight;
  if (!config || config.stair_type === 'straight') return base;
  const turnLabel = geometry?.turn_node?.label || TURN_LABELS[config.turn_type] || '';
  return `${base}, ${turnLabel}`;
}

function toggleTurnFields() {
  const stairTypeNode = $('stairType');
  const turnDirection = $('turnDirectionField');
  const turnType = $('turnTypeField');
  const baseCondition = normalizeBaseConditionValue($('baseCondition')?.value || 'empty_opening');

  if (!stairTypeNode || !turnDirection || !turnType) return;

  const usesStructuralShape = baseCondition === 'empty_opening' || isReadyFrameCondition(baseCondition);
  const isStraight = stairTypeNode.value === 'straight' || !usesStructuralShape;
  turnDirection.classList.toggle('hidden', isStraight);
  turnType.classList.toggle('hidden', isStraight);
}

function setHidden(id, hidden) {
  $(id)?.classList.toggle('hidden', hidden);
}

function normalizeFinishScope(value) {
  const normalized = String(value || '').trim();
  if (['treads_only', 'treads_and_risers', 'full_cladding'].includes(normalized)) return normalized;
  return 'treads_and_risers';
}

function sanitizeConfigByScenario(config) {
  const baseCondition = normalizeBaseConditionValue(config.base_condition || 'empty_opening');
  const sanitized = {
    ...config,
    base_condition: baseCondition,
    project_scenario: baseCondition === 'empty_opening' ? 'empty_opening' : 'ready_base',
    base_subtype: baseCondition === 'empty_opening' ? '' : baseCondition,
    finish_scope: normalizeFinishScope(config.finish_scope),
    opening_type: normalizeOpeningTypeValue(config.opening_type || 'straight', 'straight')
  };

  if (baseCondition !== 'empty_opening') {
    sanitized.floor_to_floor_height = 0;
    sanitized.slab_thickness = 0;
    sanitized.finish_thickness_top = 0;
    sanitized.finish_thickness_bottom = 0;
    sanitized.opening_length = 0;
    sanitized.opening_width = 0;
    sanitized.march_width = 0;
    sanitized.opening_type = 'none';
  }

  if (baseCondition === 'empty_opening') {
    sanitized.ready_frame_step_count = 0;
    sanitized.ready_frame_march_width = 0;
    sanitized.ready_frame_tread_depth = 0;
    sanitized.ready_frame_riser_height = 0;
    sanitized.ready_frame_straight_railing_length = 0;
    sanitized.finish_scope = 'treads_only';
    sanitized.clad_risers = false;
    sanitized.has_landing = false;
    sanitized.landing_length = 0;
    sanitized.landing_width = 0;
    sanitized.landing_area = 0;
    sanitized.has_winders = false;
    sanitized.winder_count = 0;
    sanitized.metal_frame_condition = 'good';
    sanitized.concrete_base_condition = 'ready';
    sanitized.existing_frame_notes = '';
  } else if (isReadyFrameCondition(baseCondition)) {
    sanitized.frame_material = 'metal';
    sanitized.concrete_base_condition = 'ready';
    sanitized.clad_risers = sanitized.finish_scope !== 'treads_only';
  } else if (baseCondition === 'existing_concrete_base') {
    sanitized.frame_material = 'concrete';
    sanitized.metal_frame_condition = 'good';
    sanitized.clad_risers = sanitized.finish_scope !== 'treads_only';
  }

  if (sanitized.stair_type === 'straight') {
    sanitized.turn_direction = 'right';
    sanitized.turn_type = 'landing';
  }

  return sanitized;
}

function updateScenarioFields() {
  const baseConditionRaw = $('baseCondition')?.value || 'empty_opening';
  const baseCondition = normalizeBaseConditionValue(baseConditionRaw);
  const readyBaseShape = $('readyBaseShape')?.value || 'straight';
  const isEmptyOpening = baseCondition === 'empty_opening';
  const isReadyBaseChoice = baseConditionRaw === 'ready_base';
  const isExistingMetal = isReadyFrameCondition(baseCondition);
  const isExistingConcrete = baseCondition === 'existing_concrete_base';
  const usesGeometryInputs = isEmptyOpening;
  const usesStructuralShape = isEmptyOpening;
  const usesServiceOptions = isEmptyOpening || isExistingMetal || isExistingConcrete;
  const hasLanding = isReadyBaseChoice && ['l_turn_landing', 'u_turn_landing'].includes(readyBaseShape);
  const hasWinders = isReadyBaseChoice && ['l_turn_winders', 'u_turn_winders'].includes(readyBaseShape);
  const isFullCladding = normalizeFinishScope($('finishScope')?.value) === 'full_cladding';

  setHidden('baseSubtypeField', !isReadyBaseChoice);
  setHidden('openingTypeField', !isEmptyOpening);
  setHidden('stairTypeField', !usesStructuralShape);
  setHidden('geometryInputGroup', !usesGeometryInputs);
  setHidden('readyFrameGroup', !(isExistingMetal || isExistingConcrete));
  setHidden('existingMetalGroup', !isExistingMetal);
  setHidden('existingConcreteGroup', !isExistingConcrete);
  setHidden('landingToggleField', true);
  setHidden('winderToggleField', true);
  setHidden('landingLengthField', !hasLanding);
  setHidden('landingWidthField', !hasLanding);
  setHidden('landingAreaField', !hasLanding);
  setHidden('winderCountField', !hasWinders);
  setHidden('sheetCountField', true);
  setHidden('sheetSizeField', true);
  setHidden('pricingInputGroup', false);
  setHidden('frameMaterialField', !isEmptyOpening);
  setHidden('serviceOptionsGroup', !usesServiceOptions);

  const toResultsBtn = $('toResultsBtn');
  if (toResultsBtn) {
    if (isEmptyOpening) toResultsBtn.textContent = 'Рассчитать геометрию';
    if (isExistingMetal) toResultsBtn.textContent = 'Рассчитать отделку металлокаркаса';
    if (isExistingConcrete) toResultsBtn.textContent = 'Рассчитать отделку бетонной лестницы';
  }

  toggleTurnFields();
}

function resetFieldValue(id, value) {
  const node = $(id);
  if (!node) return;
  if (node.type === 'checkbox') {
    node.checked = Boolean(value);
    return;
  }
  node.value = value;
}

function clearIrrelevantScenarioFields() {
  const baseConditionRaw = $('baseCondition')?.value || 'empty_opening';
  const baseCondition = normalizeBaseConditionValue(baseConditionRaw);
  const isEmptyOpening = baseCondition === 'empty_opening';
  const isReadyBaseChoice = baseConditionRaw === 'ready_base';
  const isReadyFrame = isReadyFrameCondition(baseCondition);
  const isConcreteBase = baseCondition === 'existing_concrete_base';

  if (isEmptyOpening) {
    resetFieldValue('readyFrameStepCount', '');
    resetFieldValue('readyFrameMarchWidth', '');
    resetFieldValue('readyFrameTreadDepth', '');
    resetFieldValue('readyFrameRiserHeight', '');
    resetFieldValue('readyFrameStraightRailingLength', '');
    resetFieldValue('metalFrameCondition', 'good');
    resetFieldValue('concreteBaseCondition', 'ready');
    resetFieldValue('existingFrameNotes', '');
    resetFieldValue('readyBaseShape', 'straight');
    return;
  }

  resetFieldValue('openingType', 'none');
  if (!isReadyBaseChoice) resetFieldValue('baseSubtype', 'existing_metal_frame');

  if (!isReadyFrame) {
    resetFieldValue('metalFrameCondition', 'good');
    resetFieldValue('existingFrameNotes', '');
  }
  if (!isConcreteBase) resetFieldValue('concreteBaseCondition', 'ready');
}

function getConfigFromForm() {
  const baseConditionRaw = $('baseCondition')?.value || 'empty_opening';
  const baseCondition = normalizeBaseConditionValue(baseConditionRaw);
  const readyBaseShape = $('readyBaseShape')?.value || 'straight';
  const shapeToStair = {
    straight: { stair_type: 'straight', turn_type: 'landing' },
    l_turn_landing: { stair_type: 'l_turn', turn_type: 'landing' },
    l_turn_winders: { stair_type: 'l_turn', turn_type: 'winders' },
    u_turn_landing: { stair_type: 'u_turn', turn_type: 'landing' },
    u_turn_winders: { stair_type: 'u_turn', turn_type: 'winders' }
  };
  const mappedShape = shapeToStair[readyBaseShape] || shapeToStair.straight;
  const hasLandingFromShape = ['l_turn_landing', 'u_turn_landing'].includes(readyBaseShape);
  const hasWindersFromShape = ['l_turn_winders', 'u_turn_winders'].includes(readyBaseShape);
  const hasLanding = baseConditionRaw === 'ready_base' ? hasLandingFromShape : !!$('hasLanding')?.checked;
  const hasWinders = baseConditionRaw === 'ready_base' ? hasWindersFromShape : !!$('hasWinders')?.checked;
  return sanitizeConfigByScenario({
    base_condition: baseCondition,
    project_scenario: baseConditionRaw === 'ready_base' ? 'ready_base' : 'empty_opening',
    base_subtype: baseConditionRaw === 'ready_base' ? ($('baseSubtype')?.value || 'existing_metal_frame') : '',
    opening_type: normalizeOpeningTypeValue($('openingType')?.value || 'straight', 'straight'),
    stair_type: baseConditionRaw === 'ready_base' ? mappedShape.stair_type : ($('stairType')?.value || 'straight'),
    turn_direction: $('turnDirection')?.value || 'right',
    turn_type: baseConditionRaw === 'ready_base' ? mappedShape.turn_type : ($('turnType')?.value || 'landing'),
    floor_to_floor_height: Number($('floorHeight')?.value || 0),
    slab_thickness: Number($('slabThickness')?.value || 220),
    finish_thickness_top: Number($('finishThicknessTop')?.value || 0),
    finish_thickness_bottom: Number($('finishThicknessBottom')?.value || 0),
    opening_length: Number($('openingLength')?.value || 0),
    opening_width: Number($('openingWidth')?.value || 0),
    march_width: Number($('marchWidth')?.value || 0),
    frame_material: $('frameMaterial')?.value || 'metal',
    pricing_region_code: $('pricingRegion')?.value || getActivePricingRegions()[0]?.code || 'primary_region',
    finish_material: $('finishMaterial')?.value || 'oak',
    railing_option: $('railingOption')?.value || 'metal',
    coating_option: $('coatingOption')?.value || 'standard',
    lighting_option: $('lightingOption')?.value || 'none',
    metal_frame_condition: $('metalFrameCondition')?.value || 'good',
    existing_frame_notes: $('existingFrameNotes')?.value || '',
    ready_frame_step_count: Number($('readyFrameStepCount')?.value || 0),
    ready_frame_march_width: Number($('readyFrameMarchWidth')?.value || 0),
    ready_frame_tread_depth: Number($('readyFrameTreadDepth')?.value || 0),
    ready_frame_riser_height: Number($('readyFrameRiserHeight')?.value || 0),
    ready_frame_straight_railing_length: Number($('readyFrameStraightRailingLength')?.value || 0),
    finish_scope: normalizeFinishScope($('finishScope')?.value),
    clad_risers: normalizeFinishScope($('finishScope')?.value) !== 'treads_only',
    cladding_sheet_count: 0,
    cladding_sheet_width: 0,
    cladding_sheet_height: 0,
    has_landing: hasLanding,
    landing_length: Number($('landingLength')?.value || 0),
    landing_width: Number($('landingWidth')?.value || 0),
    landing_area: Number($('landingArea')?.value || 0),
    has_winders: hasWinders,
    winder_count: Number($('winderCount')?.value || 0),
    concrete_step_count: Number($('readyFrameStepCount')?.value || 0),
    concrete_stair_width: Number($('readyFrameMarchWidth')?.value || 0),
    concrete_tread_depth: Number($('readyFrameTreadDepth')?.value || 0),
    concrete_riser_height: Number($('readyFrameRiserHeight')?.value || 0),
    concrete_base_condition: $('concreteBaseCondition')?.value || 'ready',
    finish_step_count: 0,
    finish_stair_width: 0,
    finish_tread_depth: 0,
    finish_only_notes: '',
    consultation_notes: ''
  });
}

function svgPolyline(points, getX = (point) => point.x, getY = (point) => point.y) {
  return points.map((point) => `${getX(point)},${getY(point)}`).join(' ');
}

function getOpeningOutlinePoints(geometry) {
  const viz = geometry.visualization;
  const input = geometry.input || {};
  const baseCondition = normalizeBaseConditionValue(input.base_condition || geometry.base_condition || 'empty_opening');
  const length = Number(viz?.opening?.length || input.opening_length || 0);
  const width = Number(viz?.opening?.width || input.opening_width || 0);
  const openingType = normalizeOpeningTypeValue(input.opening_type || 'straight', 'straight');
  const turnDirection = input.turn_direction || 'right';
  const leg = Math.max(1, Math.min(Number(input.march_width || 0) || width, width, length));

  if (isReadyFrameCondition(baseCondition)) return [];
  if (openingType === 'none' || !length || !width) return [];

  if (openingType === 'l_turn') {
    if (turnDirection === 'right') {
      return [
        { x: 0, y: 0 },
        { x: length, y: 0 },
        { x: length, y: width },
        { x: length - leg, y: width },
        { x: length - leg, y: leg },
        { x: 0, y: leg }
      ];
    }

    return [
      { x: 0, y: width - leg },
      { x: length - leg, y: width - leg },
      { x: length - leg, y: 0 },
      { x: length, y: 0 },
      { x: length, y: width },
      { x: 0, y: width }
    ];
  }

  if (openingType === 'u_turn') {
    return [
      { x: 0, y: 0 },
      { x: length, y: 0 },
      { x: length, y: width },
      { x: 0, y: width },
      { x: 0, y: width - leg },
      { x: length - leg, y: width - leg },
      { x: length - leg, y: leg },
      { x: 0, y: leg }
    ];
  }

  return [
    { x: 0, y: 0 },
    { x: length, y: 0 },
    { x: length, y: width },
    { x: 0, y: width }
  ];
}

function renderTopView(geometry) {
  const viz = geometry.visualization;
  if (!viz?.walking_line?.length) return '';

  const input = geometry.input || {};
  const baseCondition = normalizeBaseConditionValue(input.base_condition || geometry.base_condition || 'empty_opening');
  const bounds = viz.bounds;
  const viewWidth = Math.max(bounds.max_x - bounds.min_x, 1000);
  const viewHeight = Math.max(bounds.max_y - bounds.min_y, 900);
  const warningPoints = (viz.warning_points || []).slice(0, 28);
  const path = svgPolyline(viz.walking_line);
  const openingPoints = getOpeningOutlinePoints(geometry);
  const openingOutline = openingPoints.length ? svgPolyline(openingPoints) : '';
  const openingMarkup = openingOutline
    ? `<polyline class="svg-opening-outline" points="${openingOutline}" fill="none"></polyline>`
    : '';
  const openingLabels = !isReadyFrameCondition(baseCondition) && viz.opening?.length && viz.opening?.width
    ? `
        <text class="svg-label" x="${viz.opening.length / 2}" y="-80" text-anchor="middle">проём ${formatMm(viz.opening.length)}</text>
        <text class="svg-label" x="${viz.opening.length + 80}" y="${viz.opening.width / 2}" transform="rotate(90 ${viz.opening.length + 80} ${viz.opening.width / 2})" text-anchor="middle">ширина ${formatMm(viz.opening.width)}</text>
      `
    : '';

  return `
    <article class="diagram-card">
      <div class="diagram-title">План</div>
      <svg class="stair-svg" viewBox="${bounds.min_x} ${bounds.min_y} ${viewWidth} ${viewHeight}" role="img" aria-label="План лестницы и проёма">
        <polyline class="svg-stair-line" points="${path}"></polyline>
        <polyline class="svg-walk-line" points="${path}"></polyline>
        ${openingMarkup}
        ${(viz.walking_line || [])
          .map((point, index) => `<circle class="svg-node" cx="${point.x}" cy="${point.y}" r="${index === 0 ? 28 : 18}"></circle>`)
          .join('')}
        ${warningPoints
          .map((point) => `<circle class="svg-warning-zone" cx="${point.x}" cy="${point.y}" r="42"></circle>`)
          .join('')}
        ${openingLabels}
        <text class="svg-label svg-label-strong" x="${viz.walking_line[0].x}" y="${viz.walking_line[0].y - 90}" text-anchor="middle">старт</text>
        <text class="svg-label svg-label-strong" x="${viz.walking_line.at(-1).x}" y="${viz.walking_line.at(-1).y - 90}" text-anchor="middle">верх</text>
      </svg>
    </article>
  `;
}

function renderSideView(geometry) {
  const viz = geometry.visualization;
  if (!viz?.side_profile?.length) return '';

  const floorHeight = geometry.input?.floor_to_floor_height || geometry.riser_height * geometry.riser_count;
  const runLength = Math.max(geometry.walking_line_length || geometry.run_length || 1000, 1000);
  const baseY = floorHeight + 240;
  const topY = baseY - floorHeight;
  const undersideY = baseY - viz.slab_underside_height;
  const viewBox = `-140 0 ${runLength + 360} ${baseY + 120}`;
  const sidePoints = svgPolyline(
    viz.side_profile,
    (point) => point.distance,
    (point) => baseY - point.height
  );
  const warningPoints = (viz.warning_points || []).slice(0, 28);

  return `
    <article class="diagram-card">
      <div class="diagram-title">Разрез</div>
      <svg class="stair-svg" viewBox="${viewBox}" role="img" aria-label="Боковой разрез лестницы">
        <line class="svg-floor" x1="0" y1="${baseY}" x2="${runLength}" y2="${baseY}"></line>
        <line class="svg-floor" x1="0" y1="${topY}" x2="${runLength}" y2="${topY}"></line>
        <rect class="svg-slab" x="0" y="${topY}" width="${runLength}" height="${Math.max(0, undersideY - topY)}"></rect>
        <line class="svg-slab-line" x1="0" y1="${undersideY}" x2="${runLength}" y2="${undersideY}"></line>
        <polyline class="svg-side-line" points="${sidePoints}"></polyline>
        ${warningPoints
          .map((point) => {
            const y = baseY - point.height;
            return `<line class="svg-clearance-warning" x1="${point.distance}" y1="${y}" x2="${point.distance}" y2="${undersideY}"></line><circle class="svg-warning-dot" cx="${point.distance}" cy="${y}" r="20"></circle>`;
          })
          .join('')}
        <text class="svg-label" x="${runLength / 2}" y="${topY - 70}" text-anchor="middle">этаж-этаж ${formatMm(floorHeight)}</text>
        <text class="svg-label" x="${runLength - 20}" y="${undersideY - 35}" text-anchor="end">низ перекрытия</text>
        <text class="svg-label svg-label-strong" x="${runLength / 2}" y="${baseY + 80}" text-anchor="middle">линия движения ${formatMm(geometry.walking_line_length || geometry.run_length)}</text>
      </svg>
    </article>
  `;
}

function renderGeometryDiagram(geometry) {
  const root = $('geometryDiagram');
  if (!root) return;

  if (!geometry.visualization) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = `
    <div class="diagram-grid">
      ${renderTopView(geometry)}
      ${renderSideView(geometry)}
    </div>
  `;
}

function getFinishMetricsFromGeometry(config, geometry) {
  const widthM = (config.march_width || 1000) / 1000;
  const treadDepthM = (geometry.tread_depth || 280) / 1000;
  const stepCount = Math.max(geometry.tread_count || 0, 1);
  const finishAreaM2 = round(stepCount * widthM * treadDepthM, 2);
  const railingLengthM =
    config.railing_option === 'none'
      ? 0
      : round(((geometry.walking_line_length || geometry.run_length || 0) / 1000) + 1.2, 2);

  return {
    stepCount,
    finishAreaM2,
    railingLengthM,
    coatingAreaM2: round(((geometry.walking_line_length || geometry.run_length || 0) / 1000) * widthM * 0.55, 2)
  };
}

function getFinishMetricsFromManualInputs(config, source) {
  const stepCount = Math.max(Number(config[`${source}_step_count`] || 0), 0);
  const widthM = Math.max(Number(config[`${source}_stair_width`] || 0), 0) / 1000;
  const treadDepthM = Math.max(Number(config[`${source}_tread_depth`] || 0), 0) / 1000;
  const finishAreaM2 = round(stepCount * widthM * treadDepthM, 2);
  const railingLengthM = config.railing_option === 'none' ? 0 : round(stepCount * treadDepthM + 1.2, 2);

  return {
    stepCount,
    finishAreaM2,
    railingLengthM,
    coatingAreaM2: finishAreaM2
  };
}

function getReadyFrameServiceMetrics(config, geometry) {
  const stepCount = Math.max(Number(config.ready_frame_step_count || geometry.tread_count || 0), 0);
  const widthM = Math.max(Number(config.ready_frame_march_width || config.march_width || 0), 0) / 1000;
  const treadDepthM = Math.max(Number(config.ready_frame_tread_depth || geometry.tread_depth || 0), 0) / 1000;
  const riserHeightM = Math.max(Number(config.ready_frame_riser_height || geometry.riser_height || 0), 0) / 1000;
  const finishScope = normalizeFinishScope(config.finish_scope);
  const treadAreaM2 = round(stepCount * widthM * treadDepthM, 2);
  const riserAreaM2 = finishScope !== 'treads_only' ? round(stepCount * widthM * riserHeightM, 2) : 0;
  const landingAreaM2 = config.has_landing
    ? round(Number(config.landing_area || 0) || ((Number(config.landing_length || 0) / 1000) * (Number(config.landing_width || 0) / 1000)), 2)
    : 0;
  const winderCount = config.has_winders ? Math.max(Number(config.winder_count || 0), 0) : 0;
  const fullCladdingAreaM2 = finishScope === 'full_cladding' ? round((treadAreaM2 + riserAreaM2 + landingAreaM2) * 1.35, 2) : 0;
  const finishSurfaceAreaM2 = round(treadAreaM2 + riserAreaM2 + landingAreaM2, 2);
  const totalFinishAreaM2 = round(finishSurfaceAreaM2 + fullCladdingAreaM2, 2);
  const additionalRailingLengthM = Math.max(Number(config.ready_frame_straight_railing_length || config.ready_frame_additional_railing_length_m || 0), 0);
  const autoStraightRailingLengthM = round(
    (((geometry.lower_march?.run_length || 0) + (geometry.upper_march?.run_length || 0)) || geometry.run_length || stepCount * treadDepthM * 1000) / 1000,
    2
  );
  const directRailingLengthM =
    config.railing_option === 'none'
      ? 0
      : round(autoStraightRailingLengthM + additionalRailingLengthM, 2);
  const turnRailingLengthM =
    config.railing_option === 'none' || config.stair_type === 'straight'
      ? 0
      : round((geometry.turn_node?.element_length || 0) / 1000, 2);
  const railingLengthM =
    config.railing_option === 'none'
      ? 0
      : round(directRailingLengthM + turnRailingLengthM, 2);

  return {
    stepCount,
    finishScope,
    finishScopeLabel: FINISH_SCOPE_LABELS[finishScope],
    treadAreaM2,
    riserAreaM2,
    cladRisers: finishScope !== 'treads_only',
    fullCladdingAreaM2,
    finishSurfaceAreaM2,
    totalFinishAreaM2,
    fullCladdingSummary: finishScope === 'full_cladding' ? `${fullCladdingAreaM2} м²` : 'Нет',
    hasLanding: !!config.has_landing,
    landingAreaM2,
    hasWinders: !!config.has_winders,
    winderCount,
    finishAreaM2: totalFinishAreaM2,
    coatingAreaM2: totalFinishAreaM2,
    directRailingLengthM,
    additionalRailingLengthM,
    manualStraightRailingLengthM: additionalRailingLengthM,
    autoStraightRailingLengthM,
    turnRailingLengthM,
    railingLengthM
  };
}

function makeScenarioResult(config, overrides) {
  const status = overrides.status || 'recommended';
  return {
    valid: overrides.valid ?? status !== 'invalid',
    allow_continue: overrides.allow_continue ?? status !== 'invalid',
    status,
    warnings: overrides.warnings || [],
    blockers: overrides.blockers || [],
    adjustment_hints: overrides.adjustment_hints || [],
    result_kind: overrides.result_kind,
    base_condition: overrides.base_condition || config.base_condition,
    alert_title: overrides.alert_title,
    alert_text: overrides.alert_text,
    summary_rows: overrides.summary_rows || [],
    service_metrics: overrides.service_metrics || null,
    visualization: overrides.visualization || null,
    riser_count: overrides.riser_count || 0,
    tread_count: overrides.tread_count || 0,
    riser_height: overrides.riser_height || 0,
    tread_depth: overrides.tread_depth || 0,
    comfort_value: overrides.comfort_value || 0,
    stair_angle_deg: overrides.stair_angle_deg || 0,
    run_length: overrides.run_length || 0,
    walking_line_length: overrides.walking_line_length || 0,
    stringer_length: overrides.stringer_length || 0,
    headroom_min: overrides.headroom_min || 0,
    lower_march: overrides.lower_march || null,
    upper_march: overrides.upper_march || null,
    turn_node: overrides.turn_node || null,
    input: overrides.input || null,
    reason: overrides.reason || null,
    geometry_summary: overrides.geometry_summary || null,
    score: overrides.score || null,
    best_candidate: overrides.best_candidate || null,
    alternatives: overrides.alternatives || [],
    candidates_evaluated: overrides.candidates_evaluated || 0
  };
}

function calculateScenarioResult(config) {
  const baseCondition = normalizeBaseConditionValue(config.base_condition || 'empty_opening');

  if (baseCondition === 'empty_opening') {
    return {
      ...calculateStairGeometry(config),
      result_kind: 'full_staircase',
      base_condition: baseCondition,
      allow_continue: undefined
    };
  }

  if (isReadyFrameCondition(baseCondition)) {
    const fit = calculateReadyFrameGeometry(config);
    const warnings = [...(fit.warnings || [])];
    const blockers = [...(fit.blockers || [])];

    const manualRailingLength = Number(config.ready_frame_straight_railing_length || 0);
    if (config.metal_frame_condition === 'defects') {
      warnings.push('Состояние металлокаркаса лучше проверить инженеру по фото или на объекте.');
    } else if (config.metal_frame_condition === 'needs_coating') {
      warnings.push('В расчёт добавлена покраска металлокаркаса.');
    } else if (config.metal_frame_condition === 'needs_fit') {
      warnings.push('В расчёте учтена подгонка металлокаркаса перед отделкой.');
    }
    if (manualRailingLength > 50) blockers.push('Введите длину в метрах, например 3.6 или 12, не в миллиметрах.');

    const status = warnings.length || fit.status === 'warning' ? 'warning' : 'recommended';
    const metrics = getReadyFrameServiceMetrics(config, fit);
        return makeScenarioResult(config, {
      ...fit,
      valid: true,
      allow_continue: true,
      status,
      warnings,
      blockers,
      result_kind: 'ready_frame',
      base_condition: baseCondition,
      service_metrics: metrics,
      alert_title: status === 'recommended' ? 'Готовый каркас проверен для отделки' : undefined,
      alert_text:
        'Расчёт готового каркаса идёт только по рабочим параметрам: ступени, марш, подступенок, конфигурация поворота и ограждение.',
      summary_rows: [
        ['Сценарий', BASE_CONDITION_LABELS.ready_frame],
        ['Конфигурация', getStairLabel(config, fit)],
        ['Состояние каркаса', $('metalFrameCondition')?.selectedOptions?.[0]?.textContent || 'уточняется'],
        ['Ступеней', `${fit.tread_count}`],
        ['Ширина марша', formatMm(config.ready_frame_march_width || fit.geometry_summary?.march_width || 0)],
        ['Глубина ступени', formatMm(config.ready_frame_tread_depth || fit.tread_depth || 0)],
        ['Высота подступенка', formatMm(config.ready_frame_riser_height || fit.riser_height || 0)],
        ['Проверка посадки', fit.status === 'invalid' ? 'нужна инженерная проверка' : 'выполнена без зависимости от проёма'],
        ['Что отделываем', metrics.finishScopeLabel],
        ['Площадь проступей', `${metrics.treadAreaM2} м²`],
        ['Подступенки', metrics.cladRisers ? `${metrics.riserAreaM2} м²` : 'Не обшиваются'],
        ['Обшивка каркаса', metrics.fullCladdingSummary || 'Нет'],
        ['Площадка', metrics.hasLanding ? `${metrics.landingAreaM2} м²` : 'Нет'],
        ['Забежные ступени', metrics.hasWinders ? `${metrics.winderCount}` : 'Нет'],
        ['Отделка ступеней/подступенков/площадки', `${metrics.finishSurfaceAreaM2} м²`],
        ['Полная обшивка каркаса', `${metrics.fullCladdingAreaM2} м²`],
        ['Площадь отделки всего', `${metrics.totalFinishAreaM2} м²`],
        ['Ограждение по маршам', config.railing_option === 'none' ? 'Не требуется' : `${metrics.autoStraightRailingLengthM} м`],
        ['Дополнительная балюстрада', config.railing_option === 'none' ? 'Не требуется' : `${metrics.additionalRailingLengthM} м`],
        ['Итого ограждение', config.railing_option === 'none' ? 'Не требуется' : `${metrics.railingLengthM} м`],
        ['Ограждение', getOptionLabel('railing', config.railing_option)],
        ['Подсветка', getOptionLabel('lighting', config.lighting_option)]
      ],
      adjustment_hints: fit.adjustment_hints
    });
  }

  if (baseCondition === 'existing_concrete_base') {
    const metrics = getReadyFrameServiceMetrics(config, {
      tread_count: config.ready_frame_step_count,
      tread_depth: config.ready_frame_tread_depth,
      riser_height: config.ready_frame_riser_height,
      run_length: config.ready_frame_step_count * config.ready_frame_tread_depth
    });
    const warnings = [];
    const blockers = [];

    if (!metrics.stepCount || !metrics.finishAreaM2) blockers.push('Укажите количество ступеней, ширину, глубину и высоту подступенка.');
    if (Number(config.ready_frame_straight_railing_length || 0) > 50) blockers.push('Введите длину в метрах, например 3.6 или 12, не в миллиметрах.');
    if (config.concrete_base_condition === 'prep_needed') warnings.push('Добавлена подготовка поверхности перед облицовкой.');
    if (config.concrete_base_condition === 'uneven') warnings.push('Есть перепады: нужна подготовка плоскостей перед отделкой.');
    if (config.concrete_base_condition === 'chips') warnings.push('Есть сколы: нужна ручная проверка объёма ремонта.');

    const status = warnings.length ? 'warning' : 'recommended';

    return makeScenarioResult(config, {
      status,
      result_kind: 'existing_concrete_base',
      warnings,
      blockers,
      service_metrics: metrics,
      alert_title: status === 'recommended' ? 'Бетонное основание готово к расчёту отделки' : undefined,
      alert_text:
        'Считаем облицовку, ограждение, финишную подготовку и монтажные работы без расчёта нового каркаса.',
      summary_rows: [
        ['Сценарий', BASE_CONDITION_LABELS.existing_concrete_base],
        ['Конфигурация', getStairLabel(config)],
        ['Что отделываем', metrics.finishScopeLabel],
        ['Ступеней', `${metrics.stepCount}`],
        ['Площадь проступей', `${metrics.treadAreaM2} м²`],
        ['Подступенки', metrics.cladRisers ? `${metrics.riserAreaM2} м²` : 'Не обшиваются'],
        ['Обшивка каркаса', metrics.fullCladdingSummary || 'Нет'],
        ['Площадка', metrics.hasLanding ? `${metrics.landingAreaM2} м²` : 'Нет'],
        ['Забежные ступени', metrics.hasWinders ? `${metrics.winderCount}` : 'Нет'],
        ['Отделка ступеней/подступенков/площадки', `${metrics.finishSurfaceAreaM2} м²`],
        ['Полная обшивка каркаса', `${metrics.fullCladdingAreaM2} м²`],
        ['Площадь облицовки всего', `${metrics.totalFinishAreaM2} м²`],
        ['Основание', $('concreteBaseCondition')?.selectedOptions?.[0]?.textContent || 'уточняется'],
        ['Ограждение', getOptionLabel('railing', config.railing_option)],
        ['Материал отделки', getOptionLabel('finish_material', config.finish_material)]
      ],
      adjustment_hints: ['приложить фото бетонного основания', 'уточнить перепады и сколы перед финальной сметой']
    });
  }

  return makeScenarioResult(config, { status: 'invalid', valid: false, allow_continue: false, result_kind: 'unsupported' });
}

function getVisibleMessages(geometry) {
  const messages = geometry.status === 'invalid' ? geometry.blockers || [] : geometry.warnings || [];
  return [...new Set(messages)].slice(0, 4);
}

function renderGeometryAlert(geometry, config) {
  const warnings = $('geometryWarnings');
  if (!warnings) return;

  const meta = STATUS_META[geometry.status] || STATUS_META.warning;
  const title = geometry.alert_title || meta.title;
  const text = geometry.alert_text || meta.text;
  const messages = getVisibleMessages(geometry);
  const hints = geometry.adjustment_hints || [];
  const reviewUrl = buildRequestUrl(buildCalculationPayload(config, geometry, null, null), 'engineer_review');

  if (geometry.status === 'recommended') {
    warnings.innerHTML = `
      <div class="geometry-alert ok-state">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    return;
  }

  if (geometry.status === 'warning') {
    warnings.innerHTML = `
      <div class="geometry-alert warning-state">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
        ${messages.length ? `<ul>${messages.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
        <a class="btn-review inline" href="${reviewUrl}">Отправить размеры на инженерную проверку</a>
      </div>
    `;
    return;
  }

  warnings.innerHTML = `
    <div class="geometry-alert invalid-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)} Лучше отправить размеры инженеру: он проверит вводные и возможные варианты компоновки.</p>
      ${hints.length ? `<div class="hint-title">Сначала стоит попробовать:</div><ul>${hints.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      <a class="btn-review inline strong" href="${reviewUrl}">Отправить размеры на инженерную проверку</a>
    </div>
  `;
}

function renderGeometry(geometry) {
  const root = $('geometryResult');
  if (!root) return;

  const config = state.config || getConfigFromForm();
  const meta = STATUS_META[geometry.status] || STATUS_META.warning;
  const comfortClass = `badge ${meta.badge}`;
  const rows = geometry.summary_rows?.length
    ? [
        ['Статус', `<span class="${comfortClass}">${meta.label}</span>`],
        ...geometry.summary_rows.map(([key, value]) => [key, escapeHtml(value)])
      ]
    : [
        ['Статус', `<span class="${comfortClass}">${meta.label}</span>`],
        ['Тип', escapeHtml(getStairLabel(config, geometry))],
        ['Количество подъёмов', `${geometry.riser_count}`],
        ['Высота подступенка', formatMm(geometry.riser_height)],
        ['Количество проступей', `${geometry.tread_count}`],
        ['Глубина проступи', formatMm(geometry.tread_depth)],
        ['Формула 2h + b', formatMm(geometry.comfort_value)],
        ['Угол наклона', `${geometry.stair_angle_deg || 0}°`],
        ['Линия движения', formatMm(geometry.walking_line_length || geometry.run_length)],
        ['Минимальный просвет', geometry.headroom_min ? formatMm(geometry.headroom_min) : 'нужно уточнить']
      ];

  if (geometry.turn_node) {
    rows.push(['Поворотный узел', `${escapeHtml(geometry.turn_node.label)}, ${geometry.turn_node.direction === 'left' ? 'левый' : 'правый'}`]);
  }

  if (geometry.lower_march && geometry.upper_march) {
    rows.push(['Нижний марш', `${geometry.lower_march.tread_count} проступей`]);
    rows.push(['Верхний марш', `${geometry.upper_march.tread_count} проступей`]);
  }

  root.innerHTML = `
    <div class="result-heading">
      <div>
        <div class="eyebrow">phase 1 geometry</div>
        <h3>${escapeHtml(meta.label)}</h3>
      </div>
      <span class="${comfortClass}">${escapeHtml(BASE_CONDITION_LABELS[config.base_condition] || getStairLabel(config, geometry))}</span>
    </div>
    <table class="result-table">
      <tbody>
        ${rows.map(([key, value]) => `<tr><th>${key}</th><td>${value}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  renderGeometryDiagram(geometry);
  renderGeometryAlert(geometry, config);
  updateGeometryActions(geometry);
}

function calculateMaterials(config, geometry) {
  if (config.base_condition !== 'empty_opening') {
    if (!geometry.valid) {
      return { valid: false, reason: 'Нужна инженерная проверка перед расчётом состава работ.' };
    }

    const metrics = geometry.service_metrics || {};
    const items = [
      { label: 'Сценарий', value: BASE_CONDITION_LABELS[config.base_condition] || 'Уточняется' },
      { label: 'Что отделываем', value: metrics.finishScopeLabel || FINISH_SCOPE_LABELS[config.finish_scope] || 'Уточняется' },
      { label: 'Материал отделки', value: getOptionLabel('finish_material', config.finish_material) },
      { label: 'Площадь проступей', value: `${metrics.treadAreaM2 || metrics.finishAreaM2 || 0} м²` },
      { label: 'Подступенки', value: metrics.cladRisers ? `${metrics.riserAreaM2 || 0} м²` : 'Не обшиваются' },
      { label: 'Обшивка каркаса', value: metrics.fullCladdingSummary || 'Нет' },
      { label: 'Площадка', value: metrics.hasLanding ? `${metrics.landingAreaM2 || 0} м²` : 'Нет' },
      { label: 'Забежные ступени', value: metrics.hasWinders ? `${metrics.winderCount || 0} шт` : 'Нет' },
      { label: 'Отделка ступеней/подступенков/площадки', value: `${metrics.finishSurfaceAreaM2 || metrics.finishAreaM2 || 0} м²` },
      { label: 'Полная обшивка каркаса', value: `${metrics.fullCladdingAreaM2 || 0} м²` },
      { label: 'Площадь отделки всего', value: `${metrics.totalFinishAreaM2 || metrics.finishAreaM2 || 0} м²` },
      { label: 'Ограждение', value: metrics.railingLengthM ? `${getOptionLabel('railing', config.railing_option)} · ${metrics.railingLengthM} м` : 'Не требуется' },
      { label: 'Покрытие / защита', value: getOptionLabel('coating', config.coating_option) },
      { label: 'Подсветка', value: getOptionLabel('lighting', config.lighting_option) },
      { label: 'Монтаж', value: 'Подготовка и установка отделки' }
    ];

    if (isReadyFrameCondition(config.base_condition)) {
      items.splice(
        1,
        0,
        { label: 'Проверка каркаса', value: 'Посадка, покрытие, узлы крепления' },
        { label: 'Ступеней', value: `${geometry.tread_count || metrics.stepCount || 0} шт` },
        { label: 'Ширина марша', value: formatMm(config.ready_frame_march_width || 0) },
        { label: 'Глубина ступени', value: formatMm(config.ready_frame_tread_depth || 0) },
        { label: 'Высота подступенка', value: formatMm(config.ready_frame_riser_height || 0) }
      );

      if (config.railing_option !== 'none') {
        items.splice(
          6,
          0,
          {
            label: 'Дополнительная балюстрада',
            value:
              `${metrics.additionalRailingLengthM || 0} м`
          }
        );
      }
    }

    if (config.base_condition === 'existing_concrete_base') {
      items.splice(2, 0, { label: 'Состояние бетона', value: $('concreteBaseCondition')?.selectedOptions?.[0]?.textContent || 'уточняется' });
    }

    return {
      valid: true,
      type: config.base_condition,
      items,
      metrics
    };
  }

  const baseMaterials =
    config.frame_material === 'wood'
      ? calculateWoodMaterials(config, geometry)
      : config.frame_material === 'concrete'
        ? calculateConcreteMaterials(config, geometry)
        : calculateMetalMaterials(config, geometry);

  if (baseMaterials.valid) {
    const finishMetrics = getFinishMetricsFromGeometry(config, geometry);
    baseMaterials.metrics = { ...(baseMaterials.metrics || {}), finish: finishMetrics };
  }
  return baseMaterials;
}

function renderMaterials(materials) {
  const root = $('materialsResult');
  if (!root) return;

  if (!materials.valid) {
    root.innerHTML = `<div class="warning">${escapeHtml(materials.reason)}</div>`;
    return;
  }

  root.innerHTML = `
    <table class="result-table">
      <tbody>
        ${materials.items
          .map((item) => `<tr><th>${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`)
          .join('')}
      </tbody>
    </table>
  `;
}

function calculatePrice(config, geometry, materials) {
  if (!geometry.valid || !materials.valid) return null;

  const region = getPricingRegion(config.pricing_region_code);
  const regionCoef = Number(region?.price_coef || 1);
  const scenarioRates = getScenarioRates();
  let subtotal = 0;
  let baseLabor = 0;
  let materialCost = 0;

  if (config.base_condition !== 'empty_opening') {
    const metrics = materials.metrics || {};
    const finishRate = scenarioRates.finishMaterialPerM2[config.finish_material] ?? scenarioRates.finishMaterialPerM2.oak ?? 0;
    const finishCost = (metrics.finishSurfaceAreaM2 || metrics.finishAreaM2 || 0) * finishRate;
    const fullCladdingCost = (metrics.fullCladdingAreaM2 || 0) * (scenarioRates.service.fullCladdingPerM2 ?? 0);
    const railingCost = (metrics.railingLengthM || 0) * (scenarioRates.railingPerM[config.railing_option] ?? 0);
    const lightingCost = (metrics.stepCount || 0) * (scenarioRates.lightingPerStep[config.lighting_option] ?? 0);
    const coatingCost = (metrics.coatingAreaM2 || 0) * (scenarioRates.coatingPerM2[config.coating_option] ?? 0);
    const prepCost =
      config.base_condition === 'existing_concrete_base' && config.concrete_base_condition !== 'ready'
        ? (metrics.finishAreaM2 || 0) * (scenarioRates.service.prepPerM2 ?? 0)
        : 0;
    const fitCheckCost = isReadyFrameCondition(config.base_condition) ? (scenarioRates.service.fitCheck ?? 0) : 0;
    const installCost = (metrics.finishAreaM2 || 0) * (scenarioRates.service.installPerM2 ?? 0);
    baseLabor = installCost + fitCheckCost + prepCost;
    materialCost = finishCost + fullCladdingCost + railingCost + lightingCost + coatingCost;
    subtotal = baseLabor + materialCost;
  } else {
    const defaults = state.dictionaries.defaults;
    baseLabor = geometry.tread_count * defaults.labor_rate_per_step;

    if (materials.type === 'metal') {
      materialCost = (materials.metrics.profileTubeLengthM || 0) * defaults.metal_rate_per_meter;
    } else if (materials.type === 'wood') {
      materialCost = (materials.metrics.treadAreaM2 || 0) * defaults.wood_rate_per_m2;
    } else {
      materialCost = (materials.metrics.concreteVolumeM3 || 0) * defaults.concrete_rate_per_m3;
    }

    const metrics = materials.metrics?.finish || getFinishMetricsFromGeometry(config, geometry);
    const finishRate = scenarioRates.finishMaterialPerM2[config.finish_material] ?? scenarioRates.finishMaterialPerM2.oak ?? 0;
    materialCost += (metrics.finishAreaM2 || 0) * finishRate;
    subtotal = (baseLabor + materialCost) * defaults.install_coef * defaults.markup_coef;
  }

  const total = subtotal * regionCoef;
  const regionalAdjustment = total - subtotal;
  const rangeMin = config.base_condition !== 'empty_opening' ? total * 0.9 : total * 0.92;
  const rangeMax = config.base_condition !== 'empty_opening' ? total * 1.18 : total * 1.12;

  return {
    total,
    min: rangeMin,
    max: rangeMax,
    subtotalBeforeRegion: subtotal,
    regionalAdjustment,
    regionalCoef: regionCoef,
    pricingRegion: {
      code: region.code,
      name: region.name
    },
    scenarioRatesUsed: scenarioRates,
    baseLabor,
    materialCost
  };
}

function money(value) {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(value || 0))} ₽`;
}

function renderPrice(price) {
  const root = $('priceResult');
  if (!root) return;

  if (!price) {
    root.innerHTML = '<div class="warning">Стоимость недоступна без валидной геометрии и материалов.</div>';
    return;
  }

  const isInspection = isInspectionScenario(state.config?.base_condition);
  root.innerHTML = `
    <div class="price-main">${isInspection ? 'Предварительная стоимость отделки' : money(price.total)}</div>
    <div class="muted">${isInspection ? `Диапазон: ${money(price.min)} — ${money(price.max)}` : `Диапазон: ${money(price.min)} — ${money(price.max)}`}</div>
    ${isInspection ? '' : `<div class="muted">База до региона: ${money(price.subtotalBeforeRegion)}</div>`}
    <div class="muted">Регион: ${escapeHtml(price.pricingRegion?.name || 'не выбран')}</div>
    <div class="muted">Региональная корректировка: ${money(price.regionalAdjustment)}</div>
    <div class="muted">Работы: ${money(price.baseLabor)} · Материалы: ${money(price.materialCost)}</div>
    ${isInspection ? `<div class="muted">Цена рассчитана по введённым размерам и выбранным материалам. Итоговая стоимость уточняется после проверки состояния каркаса, размеров ступеней, узлов примыкания и объёма работ на объекте.</div>` : ''}
  `;
}

function compactGeometryForPayload(geometry) {
  return {
    result_kind: geometry.result_kind,
    base_condition: geometry.base_condition,
    status: geometry.status,
    summary_rows: geometry.summary_rows || null,
    service_metrics: geometry.service_metrics || null,
    riser_count: geometry.riser_count,
    tread_count: geometry.tread_count,
    riser_height: geometry.riser_height,
    tread_depth: geometry.tread_depth,
    comfort_value: geometry.comfort_value,
    stair_angle_deg: geometry.stair_angle_deg,
    walking_line_length: geometry.walking_line_length || geometry.run_length,
    stringer_length: geometry.stringer_length,
    headroom_min: geometry.headroom_min,
    lower_march: geometry.lower_march,
    upper_march: geometry.upper_march,
    turn_node: geometry.turn_node
      ? {
          type: geometry.turn_node.type,
          direction: geometry.turn_node.direction,
          tread_count: geometry.turn_node.tread_count,
          element_length: geometry.turn_node.element_length
        }
      : null
  };
}

function buildCalculationPayload(config, geometry, materials = state.materials, price = state.price, requestMode = 'calculation') {
  const compactGeometry = compactGeometryForPayload(geometry);
  const warnings = geometry.status === 'invalid' ? geometry.blockers || [] : geometry.warnings || [];
  const region = getPricingRegion(config.pricing_region_code);

  return {
    schema: 'tekstura.stair.phase1',
    request_mode: requestMode,
    project_scenario: config.project_scenario,
    base_condition: config.base_condition,
    base_subtype: config.base_subtype,
    baseCondition: BASE_CONDITION_LABELS[config.base_condition] || config.base_condition,
    selected_staircase_type: config.stair_type,
    staircaseType:
      config.base_condition === 'empty_opening' ||
      isReadyFrameCondition(config.base_condition) ||
      config.base_condition === 'existing_concrete_base'
        ? getStairLabel(config, geometry)
        : BASE_CONDITION_LABELS[config.base_condition] || getStairLabel(config, geometry),
    status: geometry.status,
    warnings,
    input_dimensions: {
      floor_to_floor_height: config.floor_to_floor_height,
      slab_thickness: config.slab_thickness,
      finish_thickness_top: config.finish_thickness_top,
      finish_thickness_bottom: config.finish_thickness_bottom,
      opening_length: config.opening_length,
      opening_width: config.opening_width,
      march_width: config.march_width,
      ready_frame_step_count: config.ready_frame_step_count,
      ready_frame_march_width: config.ready_frame_march_width,
      ready_frame_tread_depth: config.ready_frame_tread_depth,
      ready_frame_riser_height: config.ready_frame_riser_height,
      ready_frame_straight_railing_length: config.ready_frame_straight_railing_length
    },
    dimensions: {
      floorHeight: config.floor_to_floor_height,
      openingLength: config.opening_length,
      openingWidth: config.opening_width,
      marchWidth: config.march_width
    },
    chosen_geometry_result: compactGeometry,
    geometryResult: compactGeometry,
    price_relevant_selections: {
      frame_material: config.frame_material,
      pricing_region_code: config.pricing_region_code,
      finish_material: config.finish_material,
      railing_option: config.railing_option,
      coating_option: config.coating_option,
      lighting_option: config.lighting_option,
      turn_direction: config.turn_direction,
      turn_type: config.turn_type,
      finish_scope: config.finish_scope,
      finish_scope_label: FINISH_SCOPE_LABELS[config.finish_scope],
      cladding_sheet_count: config.cladding_sheet_count,
      cladding_sheet_width: config.cladding_sheet_width,
      cladding_sheet_height: config.cladding_sheet_height,
      full_cladding_area_m2: compactGeometry.service_metrics?.fullCladdingAreaM2 || 0,
      finish_surface_area_m2: compactGeometry.service_metrics?.finishSurfaceAreaM2 || 0,
      total_finish_area_m2: compactGeometry.service_metrics?.totalFinishAreaM2 || compactGeometry.service_metrics?.finishAreaM2 || 0,
      has_landing: config.has_landing,
      landing_length: config.landing_length,
      landing_width: config.landing_width,
      landing_area: config.landing_area,
      has_winders: config.has_winders,
      winder_count: config.winder_count
    },
    pricing_region: {
      code: region.code,
      name: region.name,
      price_coef: Number(region.price_coef || 1)
    },
    pricing_breakdown: price
      ? {
          subtotal_before_region: Math.round(price.subtotalBeforeRegion || 0),
          regional_adjustment: Math.round(price.regionalAdjustment || 0),
          regional_coef: Number(price.regionalCoef || 1),
          total: Math.round(price.total || 0)
        }
      : null,
    pricing_snapshot: price
      ? {
          defaults: state.dictionaries.defaults,
          scenario_rates: price.scenarioRatesUsed || getScenarioRates(),
          region: {
            code: region.code,
            name: region.name,
            price_coef: Number(region.price_coef || 1)
          }
        }
      : null,
    scenario_details: {
      project_scenario: config.project_scenario,
      base_subtype: config.base_subtype,
      metal_frame_condition: config.metal_frame_condition,
      existing_frame_notes: config.existing_frame_notes,
      ready_frame_step_count: config.ready_frame_step_count,
      ready_frame_march_width: config.ready_frame_march_width,
      ready_frame_tread_depth: config.ready_frame_tread_depth,
      ready_frame_riser_height: config.ready_frame_riser_height,
      ready_frame_straight_railing_length: config.ready_frame_straight_railing_length,
      ready_frame_additional_railing_length_m: config.ready_frame_straight_railing_length,
      additional_railing_length_m: config.ready_frame_straight_railing_length,
      finish_scope: config.finish_scope,
      finish_scope_label: FINISH_SCOPE_LABELS[config.finish_scope],
      clad_risers: config.clad_risers,
      cladding_sheet_count: config.cladding_sheet_count,
      cladding_sheet_width: config.cladding_sheet_width,
      cladding_sheet_height: config.cladding_sheet_height,
      full_cladding_area_m2: compactGeometry.service_metrics?.fullCladdingAreaM2 || 0,
      finish_surface_area_m2: compactGeometry.service_metrics?.finishSurfaceAreaM2 || 0,
      total_finish_area_m2: compactGeometry.service_metrics?.totalFinishAreaM2 || compactGeometry.service_metrics?.finishAreaM2 || 0,
      railing_length_m: compactGeometry.service_metrics?.railingLengthM || 0,
      has_landing: config.has_landing,
      landing_length: config.landing_length,
      landing_width: config.landing_width,
      landing_area: config.landing_area,
      has_winders: config.has_winders,
      winder_count: config.winder_count,
      concrete_step_count: config.concrete_step_count,
      concrete_stair_width: config.concrete_stair_width,
      concrete_tread_depth: config.concrete_tread_depth,
      concrete_riser_height: config.concrete_riser_height,
      concrete_base_condition: config.concrete_base_condition,
      finish_material: config.finish_material,
      coating_option: config.coating_option,
      railing_option: config.railing_option,
      lighting_option: config.lighting_option
    },
    materials: materials?.valid
      ? {
          type: materials.type,
          metrics: materials.metrics
        }
      : null,
    total: price?.total ? Math.round(price.total) : 0
  };
}

function saveCalculationPayload(payload) {
  state.payload = payload;

  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Calculation payload was not saved locally', error);
  }
}

function buildRequestUrl(payload, requestMode = 'calculation') {
  const nextPayload = { ...payload, request_mode: requestMode };
  const encoded = encodeURIComponent(JSON.stringify(nextPayload));
  return `/request.html?calc=${encoded}`;
}

function updateRequestLinks(payload) {
  const requestLink = $('requestLink');
  const reviewLink = $('engineerReviewLink');

  if (requestLink) requestLink.href = buildRequestUrl(payload, 'calculation');
  if (reviewLink) reviewLink.href = buildRequestUrl(payload, 'engineer_review');
}

function updateGeometryActions(geometry) {
  const calculateBtn = $('calculateBtn');
  const reviewLink = $('engineerReviewLink');
  const requestLink = $('requestLink');
  const canContinue = geometry.valid && geometry.allow_continue !== false;
  const inspectionScenario = isInspectionScenario(state.config?.base_condition);

  if (calculateBtn) {
    calculateBtn.classList.toggle('hidden', !canContinue);
    calculateBtn.disabled = !canContinue;
    calculateBtn.textContent =
      geometry.status === 'warning'
        ? 'Продолжить с пометкой инженера'
        : 'Перейти к материалам и цене';
  }

  if (reviewLink) {
    reviewLink.textContent = 'Отправить размеры на инженерную проверку';
    reviewLink.classList.toggle('hidden', inspectionScenario || (geometry.status === 'recommended' && canContinue));
  }

  if (requestLink) {
    requestLink.textContent = inspectionScenario
      ? 'Отправить размеры на инженерную проверку'
      : 'Оставить заявку';
  }
}

function runGeometryCalculation() {
  const config = getConfigFromForm();
  const geometry = calculateScenarioResult(config);
  state.config = config;
  state.geometry = geometry;
  state.materials = null;
  state.price = null;

  const payload = buildCalculationPayload(config, geometry, null, null);
  saveCalculationPayload(payload);
  updateRequestLinks(payload);
  renderGeometry(geometry);
  showStep(3);
}

function runConfigurator() {
  const config = getConfigFromForm();
  const geometry = calculateScenarioResult(config);
  state.config = config;
  state.geometry = geometry;
  state.materials = null;
  state.price = null;
  renderGeometry(geometry);

  if (!geometry.valid || geometry.allow_continue === false) {
    const payload = buildCalculationPayload(config, geometry, null, null, 'engineer_review');
    saveCalculationPayload(payload);
    updateRequestLinks(payload);
    showStep(3);
    return;
  }

  const materials = calculateMaterials(config, geometry);
  state.materials = materials;
  renderMaterials(materials);

  state.price = calculatePrice(config, geometry, materials);
  renderPrice(state.price);

  const payload = buildCalculationPayload(config, geometry, materials, state.price);
  saveCalculationPayload(payload);
  updateRequestLinks(payload);
  showStep(4);
}

window.runGeometryCalculation = runGeometryCalculation;
window.runConfigurator = runConfigurator;
globalThis.runGeometryCalculation = runGeometryCalculation;
globalThis.runConfigurator = runConfigurator;

async function loadSupabaseDictionaries() {
  if (!window.supabase || !window.SUPABASE_CONFIG) return;

  setStatus('Загрузка ценовых справочников...');
  try {
    const client = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.anonKey
    );

    const [defaultsRes, rulesRes, regionsRes, scenarioRatesRes] = await Promise.all([
      client
        .from('stair_defaults')
        .select('*')
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from('stair_material_rules')
        .select('*')
        .eq('active', true),
      client
        .from('stair_pricing_regions')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      client
        .from('stair_scenario_rates')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
    ]);

    if (!defaultsRes.error && defaultsRes.data) {
      state.dictionaries.defaults = normalizePricingDefaults(defaultsRes.data);
    }

    if (!rulesRes.error && rulesRes.data) {
      state.dictionaries.materialRules = rulesRes.data;
    }

    if (!regionsRes.error && Array.isArray(regionsRes.data) && regionsRes.data.length) {
      state.dictionaries.regions = regionsRes.data.map((region, index) => normalizePricingRegion(region, index));
      renderPricingRegionOptions(state.config?.pricing_region_code);
    }

    if (scenarioRatesRes.error) {
      console.warn('stair_scenario_rates load failed', scenarioRatesRes.error);
    } else if (Array.isArray(scenarioRatesRes.data) && scenarioRatesRes.data.length) {
      state.dictionaries.scenarioRateRows = scenarioRatesRes.data.map((row, index) => normalizeScenarioRateRow(row, index));
    }

    renderScenarioRateSelects(state.config || getConfigFromForm());

    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus('Ценовые справочники Supabase не загружены. Используются встроенные коэффициенты.');
  }
}

function init() {
  const baseConditionNode = $('baseCondition');
  const baseSubtypeNode = $('baseSubtype');
  const stairTypeNode = $('stairType');
  const calculateBtn = $('calculateBtn');
  const toResultsBtn = $('toResultsBtn');

  if (!stairTypeNode || !calculateBtn || !toResultsBtn) return;

  baseConditionNode?.addEventListener('change', () => {
    clearIrrelevantScenarioFields();
    updateScenarioFields();
  });
  baseSubtypeNode?.addEventListener('change', () => {
    clearIrrelevantScenarioFields();
    updateScenarioFields();
  });
  $('readyBaseShape')?.addEventListener('change', updateScenarioFields);
  $('finishScope')?.addEventListener('change', updateScenarioFields);
  $('hasLanding')?.addEventListener('change', updateScenarioFields);
  $('hasWinders')?.addEventListener('change', updateScenarioFields);
  stairTypeNode.addEventListener('change', toggleTurnFields);
  calculateBtn.addEventListener('click', runConfigurator);
  toResultsBtn.addEventListener('click', runGeometryCalculation);
  document.querySelectorAll('[data-next-step]').forEach((node) => {
    node.addEventListener('click', () => showStep(Number(node.getAttribute('data-next-step') || 1)));
  });
  document.querySelectorAll('[data-prev-step]').forEach((node) => {
    node.addEventListener('click', () => showStep(Number(node.getAttribute('data-prev-step') || 1)));
  });

  renderPricingRegionOptions();
  renderScenarioRateSelects();
  updateScenarioFields();
  loadSupabaseDictionaries();
}

init();
