export const stepwisePricingRegions = [
  { code: 'tatarstan', name: 'Татарстан', turnkeyCoefficient: 2.7 },
  { code: 'moscow', name: 'Москва', turnkeyCoefficient: 3 }
];

// ХольцКом, Кастамону, белый матовый ЛМДФ 10 мм, одна сторона.
// Закупочная цена за лист 2070 × 2800. Для другого формата — оценка по площади.
const whiteLaminatedMdfPerM2 = 2075 / (2.07 * 2.8);
// Materialov.net, шлифованный МДФ 38 мм 2070 × 2800, арт. 001514.
export const enamelTreadMdfSheetCost = 12171;
// Shell Wood, Казань, МДФ 16 мм 2070 × 2800. Сапожки занимают половину листа.
export const shoeMdfHalfSheetCost = 3280 / 2;

export function getStepwisePricingRegion(code) {
  return stepwisePricingRegions.find((region) => region.code === code) || stepwisePricingRegions[0];
}

export function getStepwiseCladdingSheetCost(widthMm, heightMm) {
  return Math.round(whiteLaminatedMdfPerM2 * widthMm * heightMm / 10_000) / 100;
}
