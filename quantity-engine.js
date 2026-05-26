const round = (value, digits = 3) => Number((value || 0).toFixed(digits));

export const MATERIALS_CATALOG_SEED = [
  { id: 'tube_16mm', name: 'Трубки 16 мм', unit: 'm', baseRate: 680, consumableRate: 54, active: true, sortOrder: 10 },
  { id: 'square_balusters', name: 'Квадратные балясины', unit: 'pcs', baseRate: 420, consumableRate: 34, active: true, sortOrder: 20 },
  { id: 'milled_balusters', name: 'Фрезерованные балясины', unit: 'pcs', baseRate: 670, consumableRate: 48, active: true, sortOrder: 30 },
  { id: 'glass', name: 'Стекло', unit: 'm2', baseRate: 5400, consumableRate: 280, active: true, sortOrder: 40 },
  { id: 'metal', name: 'Металл', unit: 'm', baseRate: 1800, consumableRate: 110, active: true, sortOrder: 50 },
  { id: 'wood', name: 'Дерево', unit: 'm2', baseRate: 8200, consumableRate: 330, active: true, sortOrder: 60 },
  { id: 'combined', name: 'Комбинированные', unit: 'set', baseRate: 9200, consumableRate: 500, active: true, sortOrder: 70 }
];

export const RAILING_TYPES_SEED = [
  { id: 'tube_16mm', name: 'Трубки 16 мм', pricePerMeter: 9500, description: 'Вертикальные заполнения из трубки 16 мм.', active: true, visibleToClient: true, sortOrder: 10 },
  { id: 'square_balusters', name: 'Квадратные балясины', pricePerMeter: 11200, description: 'Квадратные металлические балясины.', active: true, visibleToClient: true, sortOrder: 20 },
  { id: 'milled_balusters', name: 'Фрезерованные балясины', pricePerMeter: 12800, description: 'Декоративные фрезерованные балясины.', active: true, visibleToClient: true, sortOrder: 30 },
  { id: 'glass', name: 'Стекло', pricePerMeter: 18000, description: 'Закалённое стекло в ограждении.', active: true, visibleToClient: true, sortOrder: 40 },
  { id: 'metal', name: 'Металл', pricePerMeter: 9800, description: 'Металлическое ограждение.', active: true, visibleToClient: true, sortOrder: 50 },
  { id: 'wood', name: 'Дерево', pricePerMeter: 12500, description: 'Деревянное ограждение.', active: true, visibleToClient: true, sortOrder: 60 },
  { id: 'combined', name: 'Комбинированные', pricePerMeter: 14500, description: 'Комбинация металла, дерева и/или стекла.', active: true, visibleToClient: true, sortOrder: 70 }
];

export const CONFIGURATION_PRESETS_SEED = [
  { id: 'straight', mdfSheets: 1.3, norms: { metalPerStep: 0.4 }, addons: {}, wastePercent: 10, complexityFactor: 1 },
  { id: 'L', mdfSheets: 1.55, norms: { metalPerStep: 0.45 }, addons: { turnNode: 1 }, wastePercent: 12, complexityFactor: 1.1 },
  { id: 'U', mdfSheets: 1.8, norms: { metalPerStep: 0.5 }, addons: { turnNodes: 2 }, wastePercent: 14, complexityFactor: 1.18 },
  { id: 'platform', mdfSheets: 1.7, norms: { metalPerStep: 0.46 }, addons: { platform: 1 }, wastePercent: 12, complexityFactor: 1.12 },
  { id: 'winder', mdfSheets: 1.85, norms: { metalPerStep: 0.52 }, addons: { winderSet: 1 }, wastePercent: 15, complexityFactor: 1.2 },
  { id: 'concrete', mdfSheets: 0.95, norms: { claddingPerM2: 1 }, addons: { prep: 1 }, wastePercent: 11, complexityFactor: 1.08 },
  { id: 'metal_frame', mdfSheets: 1.1, norms: { finishPerM2: 1 }, addons: { fitCheck: 1 }, wastePercent: 10, complexityFactor: 1.06 }
];

export function getClientVisibleRailingTypes(types = RAILING_TYPES_SEED) {
  return types.filter((type) => type.active && type.visibleToClient).sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeMeters(valueMm) {
  return Number(valueMm || 0) / 1000;
}

function resolvePresetId(config = {}) {
  if (config.base_condition === 'existing_concrete_base') return 'concrete';
  if (config.base_condition === 'existing_metal_frame') return 'metal_frame';
  if (config.opening_type === 'l_turn') return 'L';
  if (config.opening_type === 'u_turn') return config.turn_type === 'landing' ? 'platform' : 'winder';
  return 'straight';
}

export function runQuantityEngine({ config = {}, geometry = {}, materialsCatalog = MATERIALS_CATALOG_SEED, railingTypes = RAILING_TYPES_SEED, presets = CONFIGURATION_PRESETS_SEED } = {}) {
  const preset = presets.find((item) => item.id === resolvePresetId(config)) || presets[0];
  const stepCount = Number(geometry.tread_count || 0);
  const railingLengthM = round(Number(geometry.railing_length || 0) > 0 ? Number(geometry.railing_length) / 1000 : normalizeMeters(geometry.walking_line_length || geometry.run_length || 0));
  const upperBalustradeLengthM = round(normalizeMeters(config.upper_balustrade_length || 0), 2);
  const totalRailingLengthM = round(railingLengthM + upperBalustradeLengthM, 2);

  const activeMaterials = materialsCatalog.filter((item) => item.active);
  const items = activeMaterials.map((material) => {
    const quantity = material.unit === 'pcs'
      ? Math.max(2, Math.ceil(totalRailingLengthM / 0.9))
      : material.unit === 'm2'
        ? round((Number(geometry.tread_area_m2 || 0) + Number(geometry.riser_area_m2 || 0)) * preset.complexityFactor, 2)
        : material.unit === 'set'
          ? 1
          : round((stepCount * (preset.norms.metalPerStep || 0.4)) + totalRailingLengthM, 2);
    const subtotal = round(quantity * Number(material.baseRate || 0), 2);
    const consumables = round(quantity * Number(material.consumableRate || 0), 2);
    return { materialId: material.id, name: material.name, unit: material.unit, quantity, subtotal, consumables };
  });

  const materialSubtotal = round(items.reduce((sum, item) => sum + item.subtotal, 0), 2);
  const consumablesTotal = round(items.reduce((sum, item) => sum + item.consumables, 0), 2);
  const selectedRailingType = railingTypes.find((item) => item.id === config.railing_option) || railingTypes.find((item) => item.id === 'metal') || railingTypes[0];

  return {
    presetId: preset.id,
    preset,
    quantities: items,
    totals: {
      materialSubtotal,
      consumables: consumablesTotal,
      total: round(materialSubtotal + consumablesTotal, 2),
      turnkeyCoefficient: Number(config.turnkey_coefficient || 1)
    },
    railing: {
      typeId: selectedRailingType?.id,
      typeName: selectedRailingType?.name,
      pricePerMeter: Number(selectedRailingType?.pricePerMeter || 0),
      baseLengthM: railingLengthM,
      upperBalustradeLengthM,
      totalLengthM: totalRailingLengthM
    }
  };
}
