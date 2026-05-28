// Quantity Engine intentionally contains:
// - quantities
// - material normalization
// - consumables
// - pricing skeleton
//
// It MUST NOT contain:
// - UI logic
// - DOM access
// - calculator rendering
// - visual configuration
// - regional markup logic
// - install/fit labor subtotals

const MATERIAL_CATEGORIES = [
  'MDF',
  'дуб',
  'ясень',
  'эмаль',
  'лак',
  'грунт',
  'расходники',
  'доборы',
  'металл',
  'стекло'
];

export const materialsCatalog = [
  createMaterial({ id: 'mat_mdf_18', code: 'MDF_18_SHEET', name: 'MDF 18 мм, лист', unit: 'sheet', category: 'MDF', baseCost: 2500, wastePercent: 12, sortOrder: 10 }),
  createMaterial({ id: 'mat_mdf_10', code: 'MDF_10_SHEET', name: 'MDF 10 мм, лист', unit: 'sheet', category: 'MDF', baseCost: 1700, wastePercent: 12, sortOrder: 20 }),
  createMaterial({ id: 'mat_oak_tread', code: 'OAK_TREAD_BLANK', name: 'Дуб, заготовка ступени', unit: 'm2', category: 'дуб', baseCost: 18500, wastePercent: 15, sortOrder: 30 }),
  createMaterial({ id: 'mat_ash_tread', code: 'ASH_TREAD_BLANK', name: 'Ясень, заготовка ступени', unit: 'm2', category: 'ясень', baseCost: 14500, wastePercent: 15, sortOrder: 40 }),
  createMaterial({ id: 'mat_enamel', code: 'ENAMEL_FINISH', name: 'Эмаль', unit: 'l', category: 'эмаль', baseCost: 1200, wastePercent: 8, sortOrder: 50 }),
  createMaterial({ id: 'mat_lacquer', code: 'LACQUER_FINISH', name: 'Лак', unit: 'l', category: 'лак', baseCost: 1350, wastePercent: 8, sortOrder: 60 }),
  createMaterial({ id: 'mat_primer', code: 'PRIMER_BASE', name: 'Грунт', unit: 'l', category: 'грунт', baseCost: 650, wastePercent: 8, sortOrder: 70 }),
  createMaterial({ id: 'mat_fasteners', code: 'FASTENERS_BASIC', name: 'Крепёж и клей', unit: 'set', category: 'расходники', baseCost: 900, wastePercent: 10, sortOrder: 80 }),
  createMaterial({ id: 'mat_addons', code: 'ADDONS_TRIMS', name: 'Доборы и планки', unit: 'm', category: 'доборы', baseCost: 950, wastePercent: 10, sortOrder: 90 }),
  createMaterial({ id: 'mat_metal_railing', code: 'METAL_RAILING_PARTS', name: 'Металлические элементы ограждения', unit: 'm', category: 'металл', baseCost: 6200, wastePercent: 7, sortOrder: 100 }),
  createMaterial({ id: 'mat_glass_railing', code: 'GLASS_RAILING_PARTS', name: 'Стеклянные элементы ограждения', unit: 'm', category: 'стекло', baseCost: 12800, wastePercent: 7, sortOrder: 110 })
];

export const railingTypes = [
  createRailingType({ id: 'rail_tubes_16', name: 'трубки 16 мм', pricePerMeter: 9500, description: 'Лёгкое ограждение с горизонтальными трубками 16 мм.', sortOrder: 10 }),
  createRailingType({ id: 'rail_square_balusters', name: 'квадратные балясины', pricePerMeter: 11000, description: 'Ограждение с квадратными вертикальными балясинами.', sortOrder: 20 }),
  createRailingType({ id: 'rail_milled_balusters', name: 'фрезерованные балясины', pricePerMeter: 14500, description: 'Деревянные фрезерованные балясины для классического вида.', sortOrder: 30 }),
  createRailingType({ id: 'rail_glass', name: 'стекло', pricePerMeter: 18500, description: 'Стеклянное ограждение по выбранной длине лестницы.', sortOrder: 40 }),
  createRailingType({ id: 'rail_metal', name: 'металл', pricePerMeter: 12500, description: 'Металлическое ограждение без выделения балюстрады в отдельный тип.', sortOrder: 50 }),
  createRailingType({ id: 'rail_wood', name: 'дерево', pricePerMeter: 13500, description: 'Деревянное ограждение по маршу и верхней балюстраде.', sortOrder: 60 }),
  createRailingType({ id: 'rail_combined', name: 'комбинированные', pricePerMeter: 16500, description: 'Комбинация дерева, металла или стекла в одном выбранном типе.', sortOrder: 70 })
];

export const configurationPresets = {
  straight: createPreset({
    type: 'straight',
    internalKey: 'straight',
    displayName: 'Прямая лестница',
    mdfSheetNorms: { treadSheetFactor: 0.18, riserSheetFactor: 0.08, platformSheetFactor: 0 },
    addons: { shoesPerStep: 1, nosingPerStepM: 1, endTrimPerOpenSideM: 0.45 },
    wastePercent: 10,
    complexityFactor: 1,
    railingDefaults: { enabled: true, topBalustradeLengthM: 0 }
  }),
  L: createPreset({
    type: 'L',
    internalKey: 'L',
    displayName: 'Г-образная лестница',
    mdfSheetNorms: { treadSheetFactor: 0.2, riserSheetFactor: 0.09, platformSheetFactor: 0.8 },
    addons: { shoesPerStep: 1, nosingPerStepM: 1, endTrimPerOpenSideM: 0.55 },
    wastePercent: 12,
    complexityFactor: 1.12,
    railingDefaults: { enabled: true, topBalustradeLengthM: 0.8 }
  }),
  U: createPreset({
    type: 'U',
    internalKey: 'U',
    displayName: 'П-образная лестница',
    mdfSheetNorms: { treadSheetFactor: 0.22, riserSheetFactor: 0.1, platformSheetFactor: 1.2 },
    addons: { shoesPerStep: 1, nosingPerStepM: 1, endTrimPerOpenSideM: 0.65 },
    wastePercent: 14,
    complexityFactor: 1.2,
    railingDefaults: { enabled: true, topBalustradeLengthM: 1.2 }
  }),
  platform: createPreset({
    type: 'platform',
    internalKey: 'platform',
    displayName: 'Лестница с площадкой',
    mdfSheetNorms: { treadSheetFactor: 0.18, riserSheetFactor: 0.08, platformSheetFactor: 1 },
    addons: { shoesPerStep: 1, nosingPerStepM: 1, endTrimPerOpenSideM: 0.6 },
    wastePercent: 12,
    complexityFactor: 1.1,
    railingDefaults: { enabled: true, topBalustradeLengthM: 0.8 }
  }),
  winder: createPreset({
    type: 'winder',
    internalKey: 'winder',
    displayName: 'Лестница с забежными ступенями',
    mdfSheetNorms: { treadSheetFactor: 0.24, riserSheetFactor: 0.1, platformSheetFactor: 0 },
    addons: { shoesPerStep: 1, nosingPerStepM: 1.08, endTrimPerOpenSideM: 0.7 },
    wastePercent: 16,
    complexityFactor: 1.28,
    railingDefaults: { enabled: true, topBalustradeLengthM: 1 }
  }),
  concrete: createPreset({
    type: 'concrete',
    internalKey: 'concrete',
    displayName: 'Бетонное основание',
    mdfSheetNorms: { treadSheetFactor: 0.16, riserSheetFactor: 0.08, platformSheetFactor: 0.8 },
    addons: { shoesPerStep: 0, nosingPerStepM: 1, endTrimPerOpenSideM: 0.5 },
    wastePercent: 11,
    complexityFactor: 1.08,
    railingDefaults: { enabled: true, topBalustradeLengthM: 0 }
  }),
  metal_frame: createPreset({
    type: 'metal_frame',
    internalKey: 'metal_frame',
    displayName: 'Металлический каркас',
    mdfSheetNorms: { treadSheetFactor: 0.2, riserSheetFactor: 0.08, platformSheetFactor: 0.9 },
    addons: { shoesPerStep: 1, nosingPerStepM: 1, endTrimPerOpenSideM: 0.6 },
    wastePercent: 13,
    complexityFactor: 1.15,
    railingDefaults: { enabled: true, topBalustradeLengthM: 0 }
  })
};

const DEFAULT_TURNKEY_COEFFICIENT = 2.35;
const DEFAULT_RAILING_TYPE_ID = 'rail_tubes_16';

export function calculateTotalRailingLength(input = {}) {
  const lowerMarchLengthM = numberValue(input.lowerMarchLengthM ?? input.marchLengthM ?? input.railingLengthM);
  const upperMarchLengthM = numberValue(input.upperMarchLengthM);
  const platformLengthM = numberValue(input.platformRailingLengthM);
  const topBalustradeLengthM = numberValue(input.topBalustradeLengthM ?? input.upperBalustradeLengthM);
  const explicitSections = Array.isArray(input.sections)
    ? input.sections.reduce((total, section) => total + numberValue(section.lengthM ?? section.length), 0)
    : 0;

  return roundTo(
    lowerMarchLengthM + upperMarchLengthM + platformLengthM + topBalustradeLengthM + explicitSections,
    2
  );
}

export function calculateQuantityEngine(rawInput = {}, options = {}) {
  const diagnostics = [];
  const preset = resolvePreset(rawInput.configurationType ?? rawInput.type ?? rawInput.stair_type, diagnostics);
  const geometry = normalizeGeometry(rawInput, preset);
  const catalog = options.materialsCatalog || materialsCatalog;
  const selectedRailingType = resolveRailingType(rawInput.railingTypeId ?? rawInput.railingType, options.railingTypes || railingTypes, diagnostics);
  const materialRows = buildMaterialRows({ catalog, geometry, preset });
  const consumableRows = buildConsumableRows({ catalog, geometry, preset });
  const railing = buildRailing(rawInput, preset, selectedRailingType);
  const pricing = calculatePricing({
    materials: materialRows,
    consumables: consumableRows,
    railing,
    turnkeyCoefficient: rawInput.turnkeyCoefficient ?? options.turnkeyCoefficient
  });

  return {
    geometry,
    quantities: buildQuantities({ geometry, preset, railing }),
    materials: materialRows,
    consumables: consumableRows,
    railing,
    diagnostics,
    pricing
  };
}

function createMaterial({ id, code, name, unit, category, baseCost, wastePercent, active = true, visibleToClient = false, sortOrder }) {
  if (!MATERIAL_CATEGORIES.includes(category)) {
    throw new Error(`Unsupported material category: ${category}`);
  }

  return { id, code, name, unit, category, baseCost, wastePercent, active, visibleToClient, sortOrder };
}

function createRailingType({ id, name, pricePerMeter, description, active = true, visibleToClient = true, sortOrder }) {
  return { id, name, pricePerMeter, description, active, visibleToClient, sortOrder };
}

function createPreset({ type, internalKey = type, displayName, mdfSheetNorms, addons, wastePercent, complexityFactor, railingDefaults = {} }) {
  return { type, internalKey, displayName, mdfSheetNorms, addons, wastePercent, complexityFactor, railingDefaults };
}

function resolvePreset(type, diagnostics) {
  const normalizedType = normalizePresetType(type);
  const preset = configurationPresets[normalizedType];

  if (!preset) {
    diagnostics.push({ level: 'warning', code: 'UNKNOWN_CONFIGURATION_PRESET', message: 'Unknown configuration preset; straight preset was used.' });
    return configurationPresets.straight;
  }

  return preset;
}

function normalizePresetType(type) {
  const normalized = String(type || '').trim();
  const aliases = {
    l_turn: 'L',
    u_turn: 'U',
    landing: 'platform',
    winders: 'winder',
    ready_frame: 'metal_frame',
    existing_metal_frame: 'metal_frame',
    existing_concrete_base: 'concrete'
  };

  return aliases[normalized] || normalized || 'straight';
}

function normalizeGeometry(rawInput, preset) {
  const stepCount = integerValue(rawInput.stepCount ?? rawInput.tread_count ?? rawInput.treadCount, 0);
  const riserCount = integerValue(rawInput.riserCount ?? rawInput.riser_count, stepCount);
  const marchWidthM = mmToM(rawInput.marchWidth ?? rawInput.march_width ?? 1000);
  const treadDepthM = mmToM(rawInput.treadDepth ?? rawInput.tread_depth ?? 300);
  const riserHeightM = mmToM(rawInput.riserHeight ?? rawInput.riser_height ?? 170);
  const platformCount = integerValue(rawInput.platformCount ?? rawInput.platform_count, ['L', 'U', 'platform'].includes(preset.type) ? 1 : 0);
  const openSideCount = integerValue(rawInput.openSideCount ?? rawInput.open_side_count, 1);

  return {
    configurationType: preset.type,
    stepCount,
    riserCount,
    platformCount,
    marchWidthM: roundTo(marchWidthM, 3),
    treadDepthM: roundTo(treadDepthM, 3),
    riserHeightM: roundTo(riserHeightM, 3),
    treadAreaM2: roundTo(stepCount * marchWidthM * treadDepthM, 2),
    riserAreaM2: roundTo(riserCount * marchWidthM * riserHeightM, 2),
    platformAreaM2: roundTo(platformCount * marchWidthM * marchWidthM, 2),
    openSideCount
  };
}

function buildQuantities({ geometry, preset, railing }) {
  const finishAreaM2 = roundTo(geometry.treadAreaM2 + geometry.riserAreaM2 + geometry.platformAreaM2, 2);
  const mdfSheets = Math.ceil(
    geometry.stepCount * preset.mdfSheetNorms.treadSheetFactor +
    geometry.riserCount * preset.mdfSheetNorms.riserSheetFactor +
    geometry.platformCount * preset.mdfSheetNorms.platformSheetFactor
  );
  const endTrimLengthM = roundTo(geometry.openSideCount * geometry.stepCount * preset.addons.endTrimPerOpenSideM, 2);

  return {
    treads: { count: geometry.stepCount, areaM2: geometry.treadAreaM2 },
    risers: { count: geometry.riserCount, areaM2: geometry.riserAreaM2 },
    platforms: { count: geometry.platformCount, areaM2: geometry.platformAreaM2 },
    mdfSheets: { count: mdfSheets, wastePercent: preset.wastePercent },
    railing: { lengthM: railing.totalLengthM, typeId: railing.typeId },
    topBalustrade: { lengthM: railing.topBalustradeLengthM, includedInRailingLength: true },
    shoes: { count: geometry.stepCount * preset.addons.shoesPerStep },
    nosingStrips: { lengthM: roundTo(geometry.stepCount * preset.addons.nosingPerStepM, 2) },
    endTrims: { lengthM: endTrimLengthM },
    enamel: { liters: roundTo(finishAreaM2 * 0.12, 2) },
    lacquer: { liters: roundTo(finishAreaM2 * 0.1, 2) },
    primer: { liters: roundTo(finishAreaM2 * 0.14, 2) },
    consumables: { sets: Math.max(1, Math.ceil(geometry.stepCount / 8)) }
  };
}

function buildMaterialRows({ catalog, geometry, preset }) {
  const quantities = buildQuantities({ geometry, preset, railing: { totalLengthM: 0, topBalustradeLengthM: 0, typeId: null } });

  return [
    materialLine(catalog, 'MDF_18_SHEET', quantities.mdfSheets.count),
    materialLine(catalog, 'ADDONS_TRIMS', quantities.nosingStrips.lengthM + quantities.endTrims.lengthM),
    materialLine(catalog, 'ENAMEL_FINISH', quantities.enamel.liters),
    materialLine(catalog, 'LACQUER_FINISH', quantities.lacquer.liters),
    materialLine(catalog, 'PRIMER_BASE', quantities.primer.liters)
  ].filter(Boolean);
}

function buildConsumableRows({ catalog, geometry, preset }) {
  const quantities = buildQuantities({ geometry, preset, railing: { totalLengthM: 0, topBalustradeLengthM: 0, typeId: null } });

  return [materialLine(catalog, 'FASTENERS_BASIC', quantities.consumables.sets)].filter(Boolean);
}

function buildRailing(rawInput, preset, selectedRailingType) {
  const topBalustradeLengthM = numberValue(
    rawInput.topBalustradeLengthM ?? rawInput.upperBalustradeLengthM,
    preset.railingDefaults.topBalustradeLengthM || 0
  );
  const totalLengthM = calculateTotalRailingLength({
    marchLengthM: rawInput.marchRailingLengthM ?? rawInput.railingLengthM,
    lowerMarchLengthM: rawInput.lowerMarchRailingLengthM,
    upperMarchLengthM: rawInput.upperMarchRailingLengthM,
    platformRailingLengthM: rawInput.platformRailingLengthM,
    topBalustradeLengthM,
    sections: rawInput.railingSections
  });
  const effectiveLengthM = totalLengthM || defaultRailingLength(rawInput);
  const materialSubtotal = roundTo(effectiveLengthM * selectedRailingType.pricePerMeter, 2);

  return {
    typeId: selectedRailingType.id,
    name: selectedRailingType.name,
    pricePerMeter: selectedRailingType.pricePerMeter,
    totalLengthM: effectiveLengthM,
    topBalustradeLengthM,
    upperBalustradeIsSeparateType: false,
    materialSubtotal
  };
}

function defaultRailingLength(rawInput) {
  const stepCount = integerValue(rawInput.stepCount ?? rawInput.tread_count ?? rawInput.treadCount, 0);
  const treadDepthM = mmToM(rawInput.treadDepth ?? rawInput.tread_depth ?? 300);
  return roundTo(stepCount * treadDepthM, 2);
}

function resolveRailingType(value, types, diagnostics) {
  const requested = String(value || DEFAULT_RAILING_TYPE_ID).trim();
  const match = types.find((type) => type.id === requested || type.name === requested);

  if (!match) {
    diagnostics.push({ level: 'warning', code: 'UNKNOWN_RAILING_TYPE', message: 'Unknown railing type; default railing type was used.' });
    return types.find((type) => type.id === DEFAULT_RAILING_TYPE_ID) || types[0];
  }

  return match;
}

function calculatePricing({ materials, consumables, railing, turnkeyCoefficient }) {
  const materialAndConsumablesSubtotal = roundTo(
    sumRows(materials) + sumRows(consumables) + numberValue(railing.materialSubtotal),
    2
  );
  const safeTurnkeyCoefficient = Math.max(
    numberValue(turnkeyCoefficient, DEFAULT_TURNKEY_COEFFICIENT),
    1
  );

  return {
    materialAndConsumablesSubtotal,
    turnkeyCoefficient: safeTurnkeyCoefficient,
    clientPrice: roundTo(materialAndConsumablesSubtotal * safeTurnkeyCoefficient, 2)
  };
}

function materialLine(catalog, code, quantity) {
  const material = catalog.find((item) => item.code === code && item.active);
  if (!material || quantity <= 0) return null;

  const quantityWithWaste = roundTo(quantity * (1 + material.wastePercent / 100), 3);

  return {
    materialId: material.id,
    code: material.code,
    name: material.name,
    category: material.category,
    unit: material.unit,
    quantity: roundTo(quantity, 3),
    wastePercent: material.wastePercent,
    quantityWithWaste,
    unitCost: material.baseCost,
    subtotal: roundTo(quantityWithWaste * material.baseCost, 2),
    visibleToClient: material.visibleToClient
  };
}

function sumRows(rows) {
  return rows.reduce((total, row) => total + numberValue(row.subtotal), 0);
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integerValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function mmToM(value) {
  const number = numberValue(value);
  return number > 20 ? number / 1000 : number;
}

function roundTo(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round((numberValue(value) + Number.EPSILON) * multiplier) / multiplier;
}
