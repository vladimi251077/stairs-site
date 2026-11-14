const defaultRegions = [
  { code: 'tatarstan', name: 'Татарстан', turnkeyCoefficient: 2.7 },
  { code: 'moscow', name: 'Москва', turnkeyCoefficient: 3 }
];
const defaults = { otherExpensesPercent: 15.924, regions: defaultRegions };
const storageKey = 'tekstura_stepwise_pricing_v1';

export function validateSettings(settings) {
  const { otherExpensesPercent, regions } = settings || {};
  if (!Number.isFinite(otherExpensesPercent) || otherExpensesPercent < 0 || otherExpensesPercent > 100
      || !Array.isArray(regions) || regions.length === 0 || regions.length > 100
      || regions.some((region) => !region || typeof region.code !== 'string' || !/^[a-z0-9_-]{1,80}$/.test(region.code)
        || typeof region.name !== 'string' || !region.name.trim() || region.name.length > 80
        || !Number.isFinite(region.turnkeyCoefficient) || region.turnkeyCoefficient < 1 || region.turnkeyCoefficient > 20)
      || new Set(regions.map((region) => region.code)).size !== regions.length
      || new Set(regions.map((region) => region.name.trim().toLowerCase())).size !== regions.length) {
    throw new Error('Укажите разные названия городов, коэффициенты от 1 до 20 и прочие расходы от 0 до 100%.');
  }
  return { otherExpensesPercent, regions: regions.map(({ code, name, turnkeyCoefficient }) => ({
    code, name: name.trim(), turnkeyCoefficient
  })) };
}

export function readStepwisePricingSettings() {
  if (sharedSettings) return validateSettings(sharedSettings);
  try {
    return validateSettings(JSON.parse(globalThis.localStorage?.getItem(storageKey)));
  } catch {
    return validateSettings(defaults);
  }
}

let sharedSettings;
export function useSharedStepwisePricingSettings(settings) {
  sharedSettings = validateSettings(settings);
}

export function saveStepwisePricingSettings(settings) {
  const verified = validateSettings(settings);
  globalThis.localStorage.setItem(storageKey, JSON.stringify(verified));
  return verified;
}

// ХольцКом, Кастамону, белый матовый ЛМДФ 10 мм, одна сторона.
// Закупочная цена за лист 2070 × 2800. Для другого формата — оценка по площади.
const whiteLaminatedMdfPerM2 = 2075 / (2.07 * 2.8);
// Закупочная цена мастерской, МДФ 38 мм 2070 × 2800.
export const enamelTreadMdfSheetCost = 12000;
// Shell Wood, Казань, МДФ 16 мм 2070 × 2800. Сапожки занимают половину листа.
export const shoeMdfHalfSheetCost = 3280 / 2;
// Opex-F, шлифованный МДФ 4 мм. Пропорция площади без раскроя и доставки.
export const trimMdfCost = Math.round(1333 * (15 * 0.04 * 2.8) / (2.07 * 2.8) * 100) / 100;

// Control order: seven metres and an estimated 10,154–10,734 ₽ in components.
// Fasteners are budgeted separately at the stair level.
export const referenceTubeRailingCostPerMeter = 10444 / 7;
export const glassRailingClientPricePerMeter = 35000;

export const stepwiseTreadMaterials = {
  mdf_enamel: 'МДФ 38 мм · эмаль',
  oak: 'Дуб',
  ash: 'Ясень',
  stone: 'Камень',
  porcelain: 'Керамогранит',
  microcement: 'Микроцемент'
};

export const stepwiseRailingOptions = {
  metal: 'Металлические трубки Ø16 мм',
  glass: 'Стекло',
  wood: 'Дерево',
  none: 'Без ограждения'
};

export function estimateStepwiseCladding(stepCount, marchWidth, treadDepth, riserHeight) {
  // The reference job used five half sheets for 15 steps on a 900 mm march.
  const referenceFace = 15 * 900 * (265 + 180);
  const face = stepCount * marchWidth * (treadDepth + riserHeight);
  if (!Number.isFinite(face) || face <= 0) return null;
  return { sheets: Math.max(1, Math.ceil(5 * face / referenceFace)), widthMm: 1035, heightMm: 2800 };
}

export const underStairDoorMaterials = [
  // Закупочная цена мастерской за заказную дверку с кромкой.
  { code: 'UNDER_STAIR_DOOR_LMDF', name: 'Заказная дверка 1350 × 680 мм с кромкой, двусторонний ЛМДФ 16 мм', unit: 'piece',
    quantity: 1, baseCost: 2000 },
  { code: 'UNDER_STAIR_FRAME_TIMBER', name: 'Брус каркаса 40 × 40 × 3000 мм', unit: 'piece', quantity: 13, baseCost: 500 }
];

export function getStepwisePricingRegion(code) {
  const { regions, otherExpensesPercent } = readStepwisePricingSettings();
  return { ...(regions.find((region) => region.code === code) || regions[0]), otherExpensesPercent };
}

export function getStepwiseCladdingSheetCost(widthMm, heightMm) {
  return Math.round(whiteLaminatedMdfPerM2 * widthMm * heightMm / 10_000) / 100;
}
