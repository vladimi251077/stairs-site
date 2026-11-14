export const stepwisePricingRegions = [
  { code: 'tatarstan', name: 'Татарстан', turnkeyCoefficient: 2.7 },
  { code: 'moscow', name: 'Москва', turnkeyCoefficient: 3 }
];

// ХольцКом, Кастамону, белый матовый ЛМДФ 10 мм, одна сторона.
// Закупочная цена за лист 2070 × 2800. Для другого формата — оценка по площади.
const whiteLaminatedMdfPerM2 = 2075 / (2.07 * 2.8);
// Закупочная цена мастерской, МДФ 38 мм 2070 × 2800.
export const enamelTreadMdfSheetCost = 12000;
// Shell Wood, Казань, МДФ 16 мм 2070 × 2800. Сапожки занимают половину листа.
export const shoeMdfHalfSheetCost = 3280 / 2;
// Opex-F, шлифованный МДФ 4 мм. Пропорция площади без раскроя и доставки.
export const trimMdfCost = Math.round(1333 * (15 * 0.04 * 2.8) / (2.07 * 2.8) * 100) / 100;

export function getStepwisePricingRegion(code) {
  return stepwisePricingRegions.find((region) => region.code === code) || stepwisePricingRegions[0];
}

export function getStepwiseCladdingSheetCost(widthMm, heightMm) {
  return Math.round(whiteLaminatedMdfPerM2 * widthMm * heightMm / 10_000) / 100;
}
