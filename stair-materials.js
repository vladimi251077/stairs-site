const round = (value, digits = 2) => Number(value.toFixed(digits));

function estimateRailingLength(geometry) {
  if (!geometry?.valid) return 0;
  const walkLength = (geometry.run_length || 0) / 1000;
  return round(walkLength + 1.2, 2);
}

export function calculateMetalMaterials(config, geometry) {
  if (!geometry?.valid) return { valid: false, reason: 'Нет валидной геометрии для расчёта металла.' };

  const stepCount = geometry.tread_count;
  const stringerLengthM = (geometry.stringer_length * 2) / 1000;
  const profileTubeLengthM = stringerLengthM + stepCount * 0.45;
  const sheetAreaM2 = (stepCount * ((config.march_width || 1000) / 1000) * 0.12);
  const railingLengthM = estimateRailingLength(geometry);
  const postCount = Math.max(2, Math.ceil(railingLengthM / 0.9));
  const wastePercent = 12;

  return {
    valid: true,
    type: 'metal',
    items: [
      { label: 'Количество ступеней', value: `${stepCount} шт` },
      { label: 'Длина несущих элементов', value: `${round(stringerLengthM, 2)} м` },
      { label: 'Профильная труба (ориентир)', value: `${round(profileTubeLengthM, 2)} м` },
      { label: 'Листовые элементы (ориентир)', value: `${round(sheetAreaM2, 2)} м²` },
      { label: 'Длина ограждения', value: `${railingLengthM} м` },
      { label: 'Количество стоек', value: `${postCount} шт` },
      { label: 'Отходы', value: `${wastePercent}%` }
    ],
    metrics: { stepCount, stringerLengthM, profileTubeLengthM, sheetAreaM2, railingLengthM, postCount, wastePercent }
  };
}

export function calculateWoodMaterials(config, geometry) {
  if (!geometry?.valid) return { valid: false, reason: 'Нет валидной геометрии для расчёта дерева.' };

  const widthM = (config.march_width || 1000) / 1000;
  const treadAreaM2 = geometry.tread_count * widthM * (geometry.tread_depth / 1000);
  const riserAreaM2 = geometry.riser_count * widthM * (geometry.riser_height / 1000);
  const loadBearingWoodM3 = round(((geometry.stringer_length / 1000) * 2 * 0.05 * 0.25), 3);
  const railingLengthM = estimateRailingLength(geometry);
  const wastePercent = 15;

  return {
    valid: true,
    type: 'wood',
    items: [
      { label: 'Объём несущих элементов', value: `${loadBearingWoodM3} м³` },
      { label: 'Ступени (площадь)', value: `${round(treadAreaM2, 2)} м²` },
      { label: 'Подступенки (площадь)', value: `${round(riserAreaM2, 2)} м²` },
      { label: 'Длина ограждения', value: `${railingLengthM} м` },
      { label: 'Отходы', value: `${wastePercent}%` }
    ],
    metrics: { loadBearingWoodM3, treadAreaM2, riserAreaM2, railingLengthM, wastePercent }
  };
}

export function calculateConcreteMaterials(config, geometry) {
  if (!geometry?.valid) return { valid: false, reason: 'Нет валидной геометрии для расчёта бетона.' };

  const widthM = (config.march_width || 1000) / 1000;
  const runM = geometry.run_length / 1000;
  const riseM = (geometry.riser_height * geometry.riser_count) / 1000;
  const concreteVolumeM3 = round(widthM * runM * riseM * 0.45, 3);
  const claddingAreaM2 = round(geometry.tread_count * widthM * (geometry.tread_depth / 1000), 2);
  const riserAreaM2 = round(geometry.riser_count * widthM * (geometry.riser_height / 1000), 2);
  const railingLengthM = estimateRailingLength(geometry);

  return {
    valid: true,
    type: 'concrete',
    items: [
      { label: 'Объём бетона (ориентир)', value: `${concreteVolumeM3} м³` },
      { label: 'Облицовка ступеней', value: `${claddingAreaM2} м²` },
      { label: 'Подступенки', value: `${riserAreaM2} м²` },
      { label: 'Длина ограждения', value: `${railingLengthM} м` }
    ],
    metrics: { concreteVolumeM3, claddingAreaM2, riserAreaM2, railingLengthM }
  };
}
