const round = (value, digits = 2) => Number(value.toFixed(digits));

function normalizeGeometry(geometry = {}) {
  if (!geometry) return null;
  return {
    valid: Boolean(geometry.valid ?? true),
    tread_count: Number(geometry.tread_count || 0),
    riser_count: Number(geometry.riser_count || 0),
    tread_depth: Number(geometry.tread_depth || 0),
    riser_height: Number(geometry.riser_height || 0),
    run_length: Number(geometry.run_length || geometry.walking_line_length || 0),
    walking_line_length: Number(geometry.walking_line_length || geometry.run_length || 0),
    stringer_length: Number(geometry.stringer_length || 0),
    railing_length: Number(geometry.railing_length || 0),
    tread_area_m2: Number(geometry.tread_area_m2 || 0),
    riser_area_m2: Number(geometry.riser_area_m2 || 0),
    footprint_length: Number(geometry.footprint_length || 0),
    footprint_width: Number(geometry.footprint_width || 0)
  };
}

function estimateRailingLength(geometry) {
  if (!geometry?.valid) return 0;
  if (geometry.railing_length > 0) return round(geometry.railing_length, 2);
  const walkLength = (geometry.walking_line_length || geometry.run_length || 0) / 1000;
  return round(walkLength + 1.2, 2);
}

export function calculateMetalMaterials(config, geometryInput) {
  const geometry = normalizeGeometry(geometryInput);
  if (!geometry?.valid) return { valid: false, reason: 'Нет валидной геометрии для расчёта металла.' };

  const stepCount = geometry.tread_count;
  const stringerLengthM = geometry.stringer_length > 0
    ? geometry.stringer_length / 1000
    : Math.hypot((geometry.run_length || 0), (geometry.riser_count * geometry.riser_height)) / 1000;
  const profileTubeLengthM = round((stringerLengthM * 2) + (stepCount * 0.45), 2);
  const sheetAreaM2 = geometry.tread_area_m2 > 0
    ? round(Math.max(geometry.tread_area_m2 * 0.34, 0.2), 2)
    : round(stepCount * ((config.march_width || 1000) / 1000) * 0.12, 2);
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

export function calculateWoodMaterials(config, geometryInput) {
  const geometry = normalizeGeometry(geometryInput);
  if (!geometry?.valid) return { valid: false, reason: 'Нет валидной геометрии для расчёта дерева.' };

  const widthM = (config.march_width || config.ready_march_width || 1000) / 1000;
  const treadAreaM2 = geometry.tread_area_m2 > 0
    ? geometry.tread_area_m2
    : geometry.tread_count * widthM * (geometry.tread_depth / 1000);
  const riserAreaM2 = geometry.riser_area_m2 > 0
    ? geometry.riser_area_m2
    : geometry.riser_count * widthM * (geometry.riser_height / 1000);
  const loadBearingWoodM3 = geometry.stringer_length > 0
    ? round(((geometry.stringer_length / 1000) * 2 * 0.05 * 0.25), 3)
    : round(((Math.hypot(geometry.run_length || 0, geometry.riser_count * geometry.riser_height) / 1000) * 2 * 0.05 * 0.25), 3);
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

export function calculateConcreteMaterials(config, geometryInput) {
  const geometry = normalizeGeometry(geometryInput);
  if (!geometry?.valid) return { valid: false, reason: 'Нет валидной геометрии для расчёта бетона.' };

  const widthM = (config.march_width || config.ready_march_width || 1000) / 1000;
  const runM = (geometry.run_length || 0) / 1000;
  const riseM = (geometry.riser_height * geometry.riser_count) / 1000;
  const concreteVolumeM3 = round(widthM * runM * riseM * 0.45, 3);
  const claddingAreaM2 = geometry.tread_area_m2 > 0
    ? round(geometry.tread_area_m2, 2)
    : round(geometry.tread_count * widthM * (geometry.tread_depth / 1000), 2);
  const riserAreaM2 = geometry.riser_area_m2 > 0
    ? round(geometry.riser_area_m2, 2)
    : round(geometry.riser_count * widthM * (geometry.riser_height / 1000), 2);
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
