const DEFAULTS = {
  minRiser: 150,
  maxRiser: 180,
  minTreadDepth: 250,
  maxTreadDepth: 320,
  minComfort: 600,
  maxComfort: 640,
  targetComfort: 620,
  maxComfortDeviationForComfortable: 8,
  maxComfortDeviationForAcceptable: 20,
  maxRecommendedAngle: 42
};

const toFixedNumber = (value, digits = 1) => Number(value.toFixed(digits));

export function getCandidateRiserCounts(floorToFloorHeight, minRiser = DEFAULTS.minRiser, maxRiser = DEFAULTS.maxRiser) {
  const height = Number(floorToFloorHeight);
  if (!Number.isFinite(height) || height <= 0) return [];

  const minCount = Math.ceil(height / maxRiser);
  const maxCount = Math.floor(height / minRiser);
  if (minCount > maxCount) return [];

  const counts = [];
  for (let count = minCount; count <= maxCount; count += 1) {
    counts.push(count);
  }
  return counts;
}

export function evaluateComfort(riserHeight, treadDepth) {
  const comfortValue = 2 * riserHeight + treadDepth;
  const inRange = comfortValue >= DEFAULTS.minComfort && comfortValue <= DEFAULTS.maxComfort;
  const deviation = Math.abs(comfortValue - DEFAULTS.targetComfort);

  let status = 'acceptable';
  if (deviation <= DEFAULTS.maxComfortDeviationForComfortable) {
    status = 'comfortable';
  } else if (deviation > DEFAULTS.maxComfortDeviationForAcceptable) {
    status = 'too_steep';
  }

  return {
    comfort_value: toFixedNumber(comfortValue),
    in_range: inRange,
    deviation: toFixedNumber(deviation),
    status
  };
}

export function calculateStairAngle(riserHeight, treadDepth) {
  return toFixedNumber((Math.atan(riserHeight / treadDepth) * 180) / Math.PI, 2);
}

export function calculateStringerLength(riserHeight, treadCount, treadDepth) {
  const rise = riserHeight * (treadCount + 1);
  const run = treadDepth * treadCount;
  return toFixedNumber(Math.hypot(rise, run), 1);
}

function getInvalidReason(params, candidates) {
  const { floor_to_floor_height, opening_length } = params;
  if (!floor_to_floor_height || floor_to_floor_height <= 0) {
    return 'Укажите корректную высоту от пола до пола.';
  }
  if (!opening_length || opening_length <= 0) {
    return 'Укажите корректную длину проёма.';
  }
  if (!candidates.length) {
    return 'Не найдено допустимое количество подъёмов для заданной высоты.';
  }
  return 'Не удалось подобрать геометрию в инженерных диапазонах. Увеличьте проём или измените конфигурацию.';
}

export function calculateStraightGeometry(params) {
  const floorHeight = Number(params.floor_to_floor_height);
  const openingLength = Number(params.opening_length);

  const candidateRiserCounts = getCandidateRiserCounts(
    floorHeight,
    DEFAULTS.minRiser,
    DEFAULTS.maxRiser
  );

  const variants = candidateRiserCounts
    .map((riserCount) => {
      const treadCount = riserCount - 1;
      if (treadCount <= 0) return null;

      const riserHeight = floorHeight / riserCount;
      const treadDepth = openingLength / treadCount;

      if (riserHeight < DEFAULTS.minRiser || riserHeight > DEFAULTS.maxRiser) return null;
      if (treadDepth < DEFAULTS.minTreadDepth || treadDepth > DEFAULTS.maxTreadDepth) return null;

      const comfort = evaluateComfort(riserHeight, treadDepth);
      const stairAngle = calculateStairAngle(riserHeight, treadDepth);

      return {
        valid: true,
        reason: null,
        riser_count: riserCount,
        tread_count: treadCount,
        riser_height: toFixedNumber(riserHeight),
        tread_depth: toFixedNumber(treadDepth),
        comfort_value: comfort.comfort_value,
        comfort_deviation: comfort.deviation,
        stair_angle_deg: stairAngle,
        run_length: toFixedNumber(treadDepth * treadCount),
        stringer_length: calculateStringerLength(riserHeight, treadCount, treadDepth)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.comfort_deviation - b.comfort_deviation);

  if (!variants.length) {
    return {
      valid: false,
      status: 'invalid',
      reason: getInvalidReason({ floor_to_floor_height: floorHeight, opening_length: openingLength }, candidateRiserCounts),
      riser_count: 0,
      tread_count: 0,
      riser_height: 0,
      tread_depth: 0,
      comfort_value: 0,
      stair_angle_deg: 0,
      run_length: 0,
      stringer_length: 0
    };
  }

  const best = variants[0];
  const comfort = evaluateComfort(best.riser_height, best.tread_depth);

  let status = comfort.status;
  let reason = null;

  if (!comfort.in_range) {
    status = 'acceptable';
    reason = 'Формула удобства 2h + b выходит за пределы 600–640 мм.';
  }

  if (best.stair_angle_deg > DEFAULTS.maxRecommendedAngle) {
    status = 'too_steep';
    reason = 'Лестница получается слишком крутой. Рекомендуется увеличить длину проёма.';
  }

  return {
    ...best,
    status,
    reason
  };
}

export const FORMULA_LIMITS = DEFAULTS;
