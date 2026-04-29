const LIMITS = {
  riser: {
    recommendedMin: 150,
    recommendedMax: 180,
    warningMin: 140,
    warningMax: 200
  },
  tread: {
    recommendedMin: 250,
    recommendedMax: 320,
    warningMin: 230,
    warningMax: 340
  },
  comfort: {
    min: 600,
    max: 640,
    target: 620,
    warningMin: 580,
    warningMax: 660
  },
  angle: {
    target: 37,
    recommendedMax: 42,
    warningMax: 47
  },
  headroom: {
    target: 2000,
    warningMin: 1900,
    sampleStep: 120
  },
  defaultSlabThickness: 220,
  defaultWalkOffset: 500,
  minMarchWidth: 700,
  recommendedMarchWidth: 900
};

const TYPE_LABELS = {
  straight: 'Прямая',
  l_turn: 'Г-образная',
  u_turn: 'П-образная'
};

const TURN_LABELS = {
  landing: 'площадка',
  winders: 'забежные ступени'
};

const STATUS_LABELS = {
  recommended: 'Рекомендуемая',
  warning: 'Нужна проверка',
  invalid: 'Инженерная проверка'
};

const round = (value, digits = 1) => Number(value.toFixed(digits));
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBaseConditionValue(value, fallback = 'empty_opening') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ready_frame') return 'existing_metal_frame';
  return normalized || fallback;
}

function normalizeOpeningTypeValue(value, fallback = 'straight') {
  const normalized = String(value || '').trim().toLowerCase();

  if (['straight', 'l_turn', 'u_turn'].includes(normalized)) return normalized;
  if (['none', 'empty', 'no_opening', 'without_opening', 'not_selected'].includes(normalized)) return 'none';
  return fallback;
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => Math.round(value)))].sort((a, b) => a - b);
}

function normalizeInput(rawInput = {}) {
  let stairType = rawInput.stair_type || rawInput.stairType || rawInput.staircaseType || 'straight';
  let turnType = rawInput.turn_type || rawInput.turnType || 'landing';

  if (stairType === 'l_winders') {
    stairType = 'l_turn';
    turnType = 'winders';
  }

  if (stairType === 'u_winders') {
    stairType = 'u_turn';
    turnType = 'winders';
  }

  if (!['straight', 'l_turn', 'u_turn'].includes(stairType)) stairType = 'straight';
  if (!['landing', 'winders'].includes(turnType)) turnType = 'landing';

  return {
    base_condition: normalizeBaseConditionValue(rawInput.base_condition || rawInput.baseCondition, 'empty_opening'),
    stair_type: stairType,
    opening_type: normalizeOpeningTypeValue(rawInput.opening_type || rawInput.openingType, stairType),
    turn_direction: rawInput.turn_direction || rawInput.turnDirection || 'right',
    turn_type: stairType === 'straight' ? 'landing' : turnType,
    floor_to_floor_height: numberValue(rawInput.floor_to_floor_height ?? rawInput.floorHeight),
    slab_thickness: numberValue(
      rawInput.slab_thickness ?? rawInput.slabThickness,
      LIMITS.defaultSlabThickness
    ),
    finish_thickness_top: numberValue(
      rawInput.finish_thickness_top ?? rawInput.finishThicknessTop,
      0
    ),
    finish_thickness_bottom: numberValue(
      rawInput.finish_thickness_bottom ?? rawInput.finishThicknessBottom,
      0
    ),
    opening_length: numberValue(rawInput.opening_length ?? rawInput.openingLength),
    opening_width: numberValue(rawInput.opening_width ?? rawInput.openingWidth),
    march_width: numberValue(rawInput.march_width ?? rawInput.marchWidth)
  };
}

function getCandidateRiserCounts(floorHeight) {
  if (!floorHeight || floorHeight <= 0) return [];

  const minCount = Math.ceil(floorHeight / LIMITS.riser.warningMax);
  const maxCount = Math.floor(floorHeight / LIMITS.riser.warningMin);
  const counts = [];

  for (let count = minCount; count <= maxCount; count += 1) {
    counts.push(count);
  }

  return counts;
}

function getCandidateTreadDepths(riserHeight) {
  const preferred = LIMITS.comfort.target - 2 * riserHeight;
  const values = [];

  for (let depth = LIMITS.tread.warningMin; depth <= LIMITS.tread.warningMax; depth += 10) {
    values.push(depth);
  }

  [-45, -30, -20, -10, -5, 0, 5, 10, 20, 30, 45].forEach((offset) => {
    values.push(clamp(Math.round((preferred + offset) / 5) * 5, LIMITS.tread.warningMin, LIMITS.tread.warningMax));
  });

  return uniqueSorted(values);
}

function getTurnTreadCount(stairType, turnType) {
  if (stairType === 'straight') return 0;
  if (stairType === 'l_turn') return turnType === 'winders' ? 3 : 1;
  return turnType === 'winders' ? 6 : 2;
}

function splitTreadOptions(input, treadCount) {
  if (input.stair_type === 'straight') {
    return [{ lower: treadCount, turn: 0, upper: 0 }];
  }

  const turn = getTurnTreadCount(input.stair_type, input.turn_type);
  const straightTreads = treadCount - turn;

  if (straightTreads < 6) return [];

  const options = [];
  for (let lower = 3; lower <= straightTreads - 3; lower += 1) {
    options.push({ lower, turn, upper: straightTreads - lower });
  }

  return options;
}

function getUsableWidthOffset(input) {
  if (input.opening_width <= 0) return LIMITS.defaultWalkOffset;
  if (input.opening_width < input.march_width) return input.opening_width / 2;
  return input.march_width / 2;
}

function buildStraightPath(input, split, treadDepth) {
  const run = split.lower * treadDepth;
  const y = input.opening_width > 0 ? input.opening_width / 2 : input.march_width / 2;

  return [
    { x: input.opening_length - run, y },
    { x: input.opening_length, y }
  ];
}

function buildLTurnPath(input, split, treadDepth) {
  const lowerRun = split.lower * treadDepth;
  const upperRun = split.upper * treadDepth;
  const turnLine = Math.max(split.turn * treadDepth, input.turn_type === 'landing' ? input.march_width : input.march_width * 0.8);
  const offset = getUsableWidthOffset(input);
  const sign = input.turn_direction === 'left' ? -1 : 1;
  const topX = input.opening_length > input.march_width ? input.opening_length - input.march_width / 2 : input.opening_length;
  const turnSpan = turnLine + upperRun;
  const turnStartY =
    sign > 0
      ? clamp(input.opening_width - offset - turnSpan, 0, input.opening_width)
      : clamp(offset + turnSpan, 0, input.opening_width);
  const topY = turnStartY + sign * turnSpan;

  return [
    { x: topX - lowerRun, y: turnStartY },
    { x: topX, y: turnStartY },
    { x: topX, y: turnStartY + sign * turnLine },
    { x: topX, y: topY }
  ];
}

function buildUTurnPath(input, split, treadDepth) {
  const lowerRun = split.lower * treadDepth;
  const upperRun = split.upper * treadDepth;
  const sign = input.turn_direction === 'left' ? -1 : 1;
  const offset = getUsableWidthOffset(input);
  const lowerY = sign > 0 ? offset : input.opening_width - offset;
  const upperY = sign > 0 ? input.opening_width - offset : offset;
  const radius = Math.abs(upperY - lowerY) / 2;
  const turnX =
    input.turn_type === 'winders' && radius > 1
      ? input.opening_length - offset - radius
      : input.opening_length > input.march_width
        ? input.opening_length - input.march_width / 2
        : input.opening_length;
  const lowerStart = { x: turnX - lowerRun, y: lowerY };
  const lowerEnd = { x: turnX, y: lowerY };
  const upperStart = { x: turnX, y: upperY };
  const upperEnd = { x: turnX - upperRun, y: upperY };

  if (input.turn_type !== 'winders') {
    return [lowerStart, lowerEnd, upperStart, upperEnd];
  }

  if (radius < 1) return [lowerStart, lowerEnd, upperStart, upperEnd];

  const center = { x: turnX, y: (lowerY + upperY) / 2 };
  const points = [lowerStart, lowerEnd];
  const startAngle = lowerY < upperY ? -Math.PI / 2 : Math.PI / 2;
  const endAngle = lowerY < upperY ? Math.PI / 2 : -Math.PI / 2;
  const steps = 8;

  for (let index = 1; index <= steps; index += 1) {
    const ratio = index / steps;
    const angle = startAngle + (endAngle - startAngle) * ratio;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    });
  }

  points.push(upperEnd);
  return points;
}

function distanceBetween(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function buildSegments(points, floorHeight) {
  const rawSegments = [];
  let totalLength = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = distanceBetween(start, end);
    if (length < 1) continue;
    rawSegments.push({ start, end, length });
    totalLength += length;
  }

  let distance = 0;
  const segments = rawSegments.map((segment) => {
    const startDistance = distance;
    const endDistance = distance + segment.length;
    distance = endDistance;

    return {
      ...segment,
      start_distance: startDistance,
      end_distance: endDistance,
      start_height: totalLength ? (floorHeight * startDistance) / totalLength : 0,
      end_height: totalLength ? (floorHeight * endDistance) / totalLength : floorHeight
    };
  });

  return { segments, totalLength };
}

function translatePointsToPositive(points = []) {
  if (!points.length) return [];

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const shiftX = minX < 0 ? Math.abs(minX) : 0;
  const shiftY = minY < 0 ? Math.abs(minY) : 0;

  return points.map((point) => ({
    x: round(point.x + shiftX),
    y: round(point.y + shiftY)
  }));
}

function interpolateSegment(segment, ratio) {
  return {
    x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
    y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
    distance: segment.start_distance + (segment.end_distance - segment.start_distance) * ratio,
    height: segment.start_height + (segment.end_height - segment.start_height) * ratio
  };
}

function isInsideOpening(point, input) {
  return (
    point.x >= 0 &&
    point.x <= input.opening_length &&
    point.y >= 0 &&
    point.y <= input.opening_width
  );
}

function evaluateHeadroom(input, segments) {
  const slabUnderside =
    input.floor_to_floor_height -
    input.slab_thickness -
    input.finish_thickness_top -
    input.finish_thickness_bottom;

  let minClearance = Infinity;
  let minPoint = null;
  const warningPoints = [];
  const samples = [];

  segments.forEach((segment) => {
    const count = Math.max(2, Math.ceil(segment.length / LIMITS.headroom.sampleStep));

    for (let index = 0; index <= count; index += 1) {
      const point = interpolateSegment(segment, index / count);
      const insideOpening = isInsideOpening(point, input);
      const clearance = insideOpening ? null : slabUnderside - point.height;

      samples.push({
        x: round(point.x),
        y: round(point.y),
        distance: round(point.distance),
        height: round(point.height),
        inside_opening: insideOpening,
        clearance: clearance === null ? null : round(clearance)
      });

      if (clearance === null) continue;

      if (clearance < minClearance) {
        minClearance = clearance;
        minPoint = point;
      }

      if (clearance < LIMITS.headroom.target) {
        warningPoints.push({
          x: round(point.x),
          y: round(point.y),
          distance: round(point.distance),
          height: round(point.height),
          clearance: round(clearance)
        });
      }
    }
  });

  if (!Number.isFinite(minClearance)) {
    minClearance = slabUnderside;
  }

  return {
    min_clearance: Math.max(0, round(minClearance)),
    target_clearance: LIMITS.headroom.target,
    warning_clearance: LIMITS.headroom.warningMin,
    slab_underside_height: round(slabUnderside),
    critical_point: minPoint
      ? { x: round(minPoint.x), y: round(minPoint.y), distance: round(minPoint.distance), height: round(minPoint.height) }
      : null,
    warning_points: warningPoints,
    samples
  };
}

function getBounds(points, input, opening = null) {
  const openingLength = numberValue(opening?.length ?? input.opening_length, 0);
  const openingWidth = numberValue(opening?.width ?? input.opening_width, 0);
  const allX = [...points.map((point) => point.x)];
  const allY = [...points.map((point) => point.y)];

  if (openingLength > 0) {
    allX.push(0, openingLength);
  }

  if (openingWidth > 0) {
    allY.push(0, openingWidth);
  }

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const margin = Math.max(input.march_width * 0.4, 250);

  return {
    min_x: round(minX - margin),
    max_x: round(maxX + margin),
    min_y: round(minY - margin),
    max_y: round(maxY + margin),
    width: round(maxX - minX),
    depth: round(maxY - minY)
  };
}

function buildVisualization(input, points, segments, headroom, openingOverride) {
  const sideProfile = segments.flatMap((segment, index) => {
    const start = {
      distance: round(segment.start_distance),
      height: round(segment.start_height),
      inside_opening: isInsideOpening(segment.start, input)
    };
    const end = {
      distance: round(segment.end_distance),
      height: round(segment.end_height),
      inside_opening: isInsideOpening(segment.end, input)
    };
    return index === 0 ? [start, end] : [end];
  });

  const opening =
    openingOverride === undefined
      ? {
          x: 0,
          y: 0,
          length: round(input.opening_length),
          width: round(input.opening_width)
        }
      : openingOverride;

  return {
    opening,
    slab_underside_height: headroom.slab_underside_height,
    walking_line: points.map((point) => ({ x: round(point.x), y: round(point.y) })),
    side_profile: sideProfile,
    warning_points: headroom.warning_points,
    bounds: getBounds(points, input, opening)
  };
}

function normalizeReadyFrameInput(rawInput = {}) {
  const base = normalizeInput(rawInput);
  const stepCount = Math.max(0, Math.round(numberValue(
    rawInput.ready_frame_step_count ??
    rawInput.readyFrameStepCount ??
    rawInput.step_count ??
    rawInput.stepCount
  )));
  const marchWidth = numberValue(
    rawInput.ready_frame_march_width ??
    rawInput.readyFrameMarchWidth ??
    rawInput.march_width ??
    rawInput.marchWidth
  );
  const treadDepth = numberValue(
    rawInput.ready_frame_tread_depth ??
    rawInput.readyFrameTreadDepth ??
    rawInput.tread_depth ??
    rawInput.treadDepth
  );
  const riserHeight = numberValue(
    rawInput.ready_frame_riser_height ??
    rawInput.readyFrameRiserHeight ??
    rawInput.riser_height ??
    rawInput.riserHeight
  );

  return {
    ...base,
    base_condition: normalizeBaseConditionValue(rawInput.base_condition || rawInput.baseCondition, 'existing_metal_frame'),
    opening_type: normalizeOpeningTypeValue(rawInput.opening_type || rawInput.openingType, 'none'),
    step_count: stepCount,
    tread_count: stepCount,
    riser_count: stepCount,
    floor_to_floor_height: numberValue(
      rawInput.floor_to_floor_height ?? rawInput.floorHeight,
      stepCount * riserHeight
    ),
    march_width: marchWidth,
    tread_depth: treadDepth,
    riser_height: riserHeight,
    straight_railing_length: numberValue(
      rawInput.ready_frame_straight_railing_length ??
      rawInput.readyFrameStraightRailingLength ??
      rawInput.straight_railing_length ??
      rawInput.straightRailingLength
    )
  };
}

function getReadyFrameInputMessages(input) {
  const warnings = [];
  const blockers = [];
  const comfortValue = 2 * input.riser_height + input.tread_depth;
  const stairAngle = input.tread_depth > 0 ? (Math.atan(input.riser_height / input.tread_depth) * 180) / Math.PI : 0;

  if (!input.tread_count) blockers.push('Укажите количество ступеней готового каркаса.');
  if (!input.march_width || input.march_width < LIMITS.minMarchWidth) {
    blockers.push('Укажите корректную ширину марша готового каркаса.');
  } else if (input.march_width < LIMITS.recommendedMarchWidth) {
    warnings.push('Ширина марша готового каркаса близка к минимально комфортной.');
  }

  if (!input.tread_depth) blockers.push('Укажите глубину ступени готового каркаса.');
  if (!input.riser_height) blockers.push('Укажите высоту подступенка готового каркаса.');

  if (input.riser_height && (input.riser_height < LIMITS.riser.recommendedMin || input.riser_height > LIMITS.riser.recommendedMax)) {
    warnings.push('Высота подступенка выходит из комфортного диапазона.');
  }

  if (input.tread_depth && (input.tread_depth < LIMITS.tread.recommendedMin || input.tread_depth > LIMITS.tread.recommendedMax)) {
    warnings.push('Глубина ступени находится на границе комфортного диапазона.');
  }

  if (comfortValue) {
    if (comfortValue < LIMITS.comfort.warningMin || comfortValue > LIMITS.comfort.warningMax) {
      blockers.push('Формула шага 2h + b сильно выходит за допустимый диапазон.');
    } else if (comfortValue < LIMITS.comfort.min || comfortValue > LIMITS.comfort.max) {
      warnings.push('Формула шага 2h + b выходит за рекомендуемые 600-640 мм.');
    }
  }

  if (stairAngle) {
    if (stairAngle > LIMITS.angle.warningMax) {
      blockers.push('Угол наклона готового каркаса получается слишком крутым.');
    } else if (stairAngle > LIMITS.angle.recommendedMax) {
      warnings.push('Угол наклона близок к верхней границе комфорта.');
    }
  }

  return { warnings, blockers };
}

function splitReadyFrameTreads(input) {
  if (input.stair_type === 'straight') {
    return { lower: input.tread_count, turn: 0, upper: 0 };
  }

  const turn = getTurnTreadCount(input.stair_type, input.turn_type);
  const straightTreads = input.tread_count - turn;
  if (straightTreads < 2) return null;

  const lower = Math.max(1, Math.floor(straightTreads / 2));
  const upper = Math.max(1, straightTreads - lower);
  return { lower, turn, upper };
}

function getReadyFrameTurnLine(input, split) {
  if (!split?.turn) return 0;
  if (input.turn_type === 'landing') return input.march_width;
  return Math.max(input.march_width * 0.8, split.turn * input.tread_depth * 0.35);
}

function buildReadyFramePath(input, split) {
  const lowerRun = split.lower * input.tread_depth;
  const upperRun = split.upper * input.tread_depth;
  const turnLine = getReadyFrameTurnLine(input, split);
  const sign = input.turn_direction === 'left' ? -1 : 1;

  if (input.stair_type === 'straight') {
    return [
      { x: 0, y: input.march_width / 2 },
      { x: lowerRun, y: input.march_width / 2 }
    ];
  }

  if (input.stair_type === 'l_turn') {
    return translatePointsToPositive([
      { x: 0, y: 0 },
      { x: lowerRun, y: 0 },
      { x: lowerRun, y: sign * turnLine },
      { x: lowerRun, y: sign * (turnLine + upperRun) }
    ]);
  }

  return translatePointsToPositive([
    { x: 0, y: 0 },
    { x: lowerRun, y: 0 },
    { x: lowerRun, y: sign * turnLine },
    { x: lowerRun - upperRun, y: sign * turnLine }
  ]);
}

function getReadyFrameOpening(input, points) {
  if (input.opening_type === 'none') return null;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);

  return {
    x: 0,
    y: 0,
    length: round(
      input.opening_length > 0
        ? input.opening_length
        : Math.max(spanX + input.march_width * 0.8, input.march_width * 1.5)
    ),
    width: round(
      input.opening_width > 0
        ? input.opening_width
        : Math.max(spanY + input.march_width * 0.8, input.march_width)
    )
  };
}

export function calculateReadyFrameGeometry(rawInput = {}) {
  const input = normalizeReadyFrameInput(rawInput);
  const inputMessages = getReadyFrameInputMessages(input);
  const split = splitReadyFrameTreads(input);

  if (!split) {
    return {
      valid: false,
      status: 'invalid',
      status_label: STATUS_LABELS.invalid,
      warnings: inputMessages.warnings,
      blockers: [...inputMessages.blockers, 'Для выбранной конфигурации не хватает ступеней на прямые марши и поворотный узел.'],
      tread_count: input.tread_count,
      riser_count: input.riser_count,
      riser_height: round(input.riser_height),
      tread_depth: round(input.tread_depth),
      comfort_value: round(2 * input.riser_height + input.tread_depth),
      stair_angle_deg: input.tread_depth > 0 ? round((Math.atan(input.riser_height / input.tread_depth) * 180) / Math.PI, 2) : 0,
      run_length: 0,
      walking_line_length: 0,
      stringer_length: 0,
      headroom_min: 0,
      lower_march: null,
      upper_march: null,
      turn_node: null,
      visualization: null,
      input
    };
  }

  const points = buildReadyFramePath(input, split);
  const floorHeight = input.riser_count * input.riser_height;
  const { segments, totalLength } = buildSegments(points, floorHeight);
  const stringerLength = segments.reduce(
    (sum, segment) => sum + Math.hypot(segment.length, segment.end_height - segment.start_height),
    0
  );
  const status = inputMessages.blockers.length ? 'invalid' : inputMessages.warnings.length ? 'warning' : 'recommended';
  const opening = getReadyFrameOpening(input, points);
  const visualization = buildVisualization(
    input,
    points,
    segments,
    {
      min_clearance: 0,
      target_clearance: LIMITS.headroom.target,
      warning_clearance: LIMITS.headroom.warningMin,
      slab_underside_height: 0,
      critical_point: null,
      warning_points: [],
      samples: []
    },
    opening
  );
  const comfortValue = 2 * input.riser_height + input.tread_depth;
  const stairAngle = input.tread_depth > 0 ? (Math.atan(input.riser_height / input.tread_depth) * 180) / Math.PI : 0;
  const turnElementLength = getReadyFrameTurnLine(input, split);

  return {
    valid: status !== 'invalid',
    status,
    status_label: STATUS_LABELS[status],
    warnings: [...new Set(inputMessages.warnings)],
    blockers: [...new Set(inputMessages.blockers)],
    riser_count: input.riser_count,
    tread_count: input.tread_count,
    riser_height: round(input.riser_height),
    tread_depth: round(input.tread_depth),
    comfort_value: round(comfortValue),
    stair_angle_deg: round(stairAngle, 2),
    run_length: round(totalLength),
    stringer_length: round(stringerLength),
    headroom_min: 0,
    walking_line_length: round(totalLength),
    lower_march: split.lower
      ? {
          tread_count: split.lower,
          run_length: round(split.lower * input.tread_depth)
        }
      : null,
    upper_march: split.upper
      ? {
          tread_count: split.upper,
          run_length: round(split.upper * input.tread_depth)
        }
      : null,
    turn_node:
      input.stair_type === 'straight'
        ? null
        : {
            type: input.turn_type,
            label: TURN_LABELS[input.turn_type],
            direction: input.turn_direction,
            tread_count: split.turn,
            element_length: round(turnElementLength)
          },
    geometry_summary: {
      type: input.stair_type,
      type_label: TYPE_LABELS[input.stair_type],
      turn_type: input.stair_type === 'straight' ? null : input.turn_type,
      turn_label: input.stair_type === 'straight' ? null : TURN_LABELS[input.turn_type],
      march_width: round(input.march_width),
      ready_frame_step_count: input.step_count,
      ready_frame_straight_railing_length: round(input.straight_railing_length, 2)
    },
    visualization,
    input
  };
}

function getInputWarnings(input) {
  const warnings = [];
  const blockers = [];

  if (!input.floor_to_floor_height || input.floor_to_floor_height <= 0) {
    blockers.push('Укажите корректную высоту этаж-этаж.');
  }

  if (!input.opening_length || input.opening_length <= 0) {
    blockers.push('Укажите корректную длину проёма.');
  }

  if (!input.opening_width || input.opening_width <= 0) {
    blockers.push('Укажите корректную ширину проёма.');
  }

  if (!input.march_width || input.march_width < LIMITS.minMarchWidth) {
    blockers.push('Ширина марша меньше практического минимума для безопасной лестницы.');
  } else if (input.march_width < LIMITS.recommendedMarchWidth) {
    warnings.push('Марш уже рекомендуемого комфортного значения, проверьте проход с инженером.');
  }

  if (input.opening_width > 0 && input.march_width > 0 && input.opening_width < input.march_width) {
    blockers.push('Ширина проёма меньше ширины марша.');
  }

  return { warnings, blockers };
}

function getTypeFitMessages(input) {
  const warnings = [];
  const blockers = [];

  if (input.stair_type === 'u_turn') {
    const recommendedWidth = input.march_width * 2 + 120;
    const criticalWidth = input.march_width * 1.75;

    if (input.opening_width < criticalWidth) {
      blockers.push('Для П-образной лестницы не хватает ширины проёма под два встречных марша.');
    } else if (input.opening_width < recommendedWidth) {
      warnings.push('П-образная компоновка проходит по ширине на грани, нужна ручная проверка узла поворота.');
    }
  }

  if (input.stair_type === 'l_turn') {
    const recommendedWidth = input.march_width + 180;
    if (input.opening_width < recommendedWidth) {
      warnings.push('Г-образная компоновка близка к минимальной ширине проёма.');
    }
  }

  return { warnings, blockers };
}

function buildAdjustmentHints(candidate, input) {
  const hints = [];

  if (candidate.headroom.min_clearance < LIMITS.headroom.target) {
    hints.push('увеличить длину проёма по направлению верхнего марша');
  }

  if (input.stair_type === 'u_turn' && input.opening_width < input.march_width * 2 + 120) {
    hints.push('увеличить ширину проёма или уменьшить ширину марша');
  } else if (input.opening_width < input.march_width + 180) {
    hints.push('проверить ширину проёма относительно выбранного марша');
  }

  if (candidate.tread_depth < LIMITS.tread.recommendedMin || candidate.stair_angle_deg > LIMITS.angle.recommendedMax) {
    hints.push('перейти на поворотную схему или увеличить доступную длину');
  }

  if (candidate.riser_height > LIMITS.riser.recommendedMax) {
    hints.push('увеличить число подъёмов за счёт более длинной компоновки');
  }

  if (!hints.length) {
    hints.push('уточнить толщину перекрытия и чистовые отметки с инженером');
  }

  return [...new Set(hints)].slice(0, 4);
}

function scoreCandidate(candidate, input) {
  const comfortPenalty = Math.abs(candidate.comfort_value - LIMITS.comfort.target) * 2.4;
  const anglePenalty = Math.abs(candidate.stair_angle_deg - LIMITS.angle.target) * 4.5;
  const headroomGap = Math.max(0, LIMITS.headroom.target - candidate.headroom.min_clearance);
  const compactTarget = input.stair_type === 'straight' ? input.opening_length * 1.35 : (input.opening_length + input.opening_width) * 1.2;
  const compactPenalty = Math.max(0, candidate.run_length - compactTarget) / 35;
  const statusPenalty = candidate.status === 'invalid' ? 1400 : candidate.status === 'warning' ? 260 : 0;

  return round(
    1000 -
      comfortPenalty -
      anglePenalty -
      headroomGap * 1.3 -
      compactPenalty -
      statusPenalty -
      candidate.blockers.length * 450 -
      candidate.warnings.length * 18,
    2
  );
}

function buildCandidate(input, riserCount, treadDepth, split, inputMessages, typeMessages) {
  const floorHeight = input.floor_to_floor_height;
  const riserHeight = floorHeight / riserCount;
  const treadCount = riserCount - 1;
  const comfortValue = 2 * riserHeight + treadDepth;
  const stairAngle = (Math.atan(riserHeight / treadDepth) * 180) / Math.PI;

  let points;
  if (input.stair_type === 'l_turn') {
    points = buildLTurnPath(input, split, treadDepth);
  } else if (input.stair_type === 'u_turn') {
    points = buildUTurnPath(input, split, treadDepth);
  } else {
    points = buildStraightPath(input, split, treadDepth);
  }

  const { segments, totalLength } = buildSegments(points, floorHeight);
  const headroom = evaluateHeadroom(input, segments);
  const stringerLength = segments.reduce(
    (sum, segment) => sum + Math.hypot(segment.length, segment.end_height - segment.start_height),
    0
  );

  const warnings = [...inputMessages.warnings, ...typeMessages.warnings];
  const blockers = [...inputMessages.blockers, ...typeMessages.blockers];

  if (riserHeight < LIMITS.riser.recommendedMin || riserHeight > LIMITS.riser.recommendedMax) {
    warnings.push('Высота подступенка выходит из комфортного диапазона.');
  }

  if (treadDepth < LIMITS.tread.recommendedMin || treadDepth > LIMITS.tread.recommendedMax) {
    warnings.push('Глубина проступи находится на границе комфортного диапазона.');
  }

  if (comfortValue < LIMITS.comfort.warningMin || comfortValue > LIMITS.comfort.warningMax) {
    blockers.push('Формула шага 2h + b сильно выходит за допустимый диапазон.');
  } else if (comfortValue < LIMITS.comfort.min || comfortValue > LIMITS.comfort.max) {
    warnings.push('Формула шага 2h + b выходит за рекомендуемые 600-640 мм.');
  }

  if (stairAngle > LIMITS.angle.warningMax) {
    blockers.push('Угол наклона получается слишком крутым.');
  } else if (stairAngle > LIMITS.angle.recommendedMax) {
    warnings.push('Угол наклона близок к верхней границе комфорта.');
  }

  if (headroom.min_clearance < LIMITS.headroom.warningMin) {
    blockers.push('Недостаточный просвет над линией движения под перекрытием.');
  } else if (headroom.min_clearance < LIMITS.headroom.target) {
    warnings.push('Просвет над линией движения ниже целевых 2000 мм.');
  }

  const status = blockers.length ? 'invalid' : warnings.length ? 'warning' : 'recommended';
  const visualization = buildVisualization(input, points, segments, headroom);
  const candidate = {
    valid: status !== 'invalid',
    status,
    status_label: STATUS_LABELS[status],
    warnings: [...new Set(warnings)],
    blockers: [...new Set(blockers)],
    riser_count: riserCount,
    tread_count: treadCount,
    riser_height: round(riserHeight),
    tread_depth: round(treadDepth),
    comfort_value: round(comfortValue),
    comfort_deviation: round(Math.abs(comfortValue - LIMITS.comfort.target)),
    stair_angle_deg: round(stairAngle, 2),
    run_length: round(totalLength),
    stringer_length: round(stringerLength),
    headroom,
    headroom_min: headroom.min_clearance,
    walking_line_length: round(totalLength),
    lower_march: split.lower
      ? {
          tread_count: split.lower,
          run_length: round(split.lower * treadDepth)
        }
      : null,
    upper_march: split.upper
      ? {
          tread_count: split.upper,
          run_length: round(split.upper * treadDepth)
        }
      : null,
    turn_node:
      input.stair_type === 'straight'
        ? null
        : {
            type: input.turn_type,
            label: TURN_LABELS[input.turn_type],
            direction: input.turn_direction,
            tread_count: split.turn,
            element_length: round(Math.max(split.turn * treadDepth, distanceBetween(points[1], points[2] || points[1])))
          },
    geometry_summary: {
      type: input.stair_type,
      type_label: TYPE_LABELS[input.stair_type],
      turn_type: input.stair_type === 'straight' ? null : input.turn_type,
      turn_label: input.stair_type === 'straight' ? null : TURN_LABELS[input.turn_type],
      opening_length: round(input.opening_length),
      opening_width: round(input.opening_width),
      march_width: round(input.march_width),
      min_headroom: headroom.min_clearance,
      slab_underside_height: headroom.slab_underside_height,
      footprint_length: visualization.bounds.width,
      footprint_width: visualization.bounds.depth
    },
    visualization
  };

  candidate.adjustment_hints = buildAdjustmentHints(candidate, input);
  candidate.score = scoreCandidate(candidate, input);

  return candidate;
}

function compactCandidate(candidate) {
  return {
    status: candidate.status,
    score: candidate.score,
    riser_count: candidate.riser_count,
    riser_height: candidate.riser_height,
    tread_depth: candidate.tread_depth,
    comfort_value: candidate.comfort_value,
    stair_angle_deg: candidate.stair_angle_deg,
    headroom_min: candidate.headroom_min,
    run_length: candidate.run_length
  };
}

function buildNoCandidateResult(input, inputMessages) {
  const reason =
    inputMessages.blockers[0] ||
    'Онлайн-подбор не нашёл безопасную и удобную геометрию для текущих размеров.';

  return {
    valid: false,
    status: 'invalid',
    status_label: STATUS_LABELS.invalid,
    warnings: [],
    blockers: [reason],
    reason,
    riser_count: 0,
    tread_count: 0,
    riser_height: 0,
    tread_depth: 0,
    comfort_value: 0,
    stair_angle_deg: 0,
    run_length: 0,
    stringer_length: 0,
    headroom_min: 0,
    adjustment_hints: ['проверить исходные размеры проёма', 'отправить размеры на инженерную проверку'],
    geometry_summary: {
      type: input.stair_type,
      type_label: TYPE_LABELS[input.stair_type],
      opening_length: input.opening_length,
      opening_width: input.opening_width,
      march_width: input.march_width
    },
    alternatives: [],
    candidates_evaluated: 0
  };
}

export function calculateStairGeometry(rawInput = {}) {
  const input = normalizeInput(rawInput);
  const inputMessages = getInputWarnings(input);
  const typeMessages = getTypeFitMessages(input);
  const riserCounts = getCandidateRiserCounts(input.floor_to_floor_height);
  const candidates = [];

  riserCounts.forEach((riserCount) => {
    const riserHeight = input.floor_to_floor_height / riserCount;
    const treadDepths = getCandidateTreadDepths(riserHeight);

    treadDepths.forEach((treadDepth) => {
      const splitOptions = splitTreadOptions(input, riserCount - 1);
      splitOptions.forEach((split) => {
        candidates.push(buildCandidate(input, riserCount, treadDepth, split, inputMessages, typeMessages));
      });
    });
  });

  if (!candidates.length) {
    return buildNoCandidateResult(input, inputMessages);
  }

  candidates.sort((a, b) => {
    const statusRank = { recommended: 3, warning: 2, invalid: 1 };
    const rankDelta = statusRank[b.status] - statusRank[a.status];
    if (rankDelta !== 0) return rankDelta;
    return b.score - a.score;
  });

  const best = candidates[0];
  const usefulAlternatives = candidates
    .filter((candidate) => candidate !== best && candidate.status !== 'invalid')
    .slice(0, 3)
    .map(compactCandidate);

  return {
    ...best,
    input,
    reason: best.blockers[0] || best.warnings[0] || null,
    alternatives: usefulAlternatives,
    best_candidate: compactCandidate(best),
    candidates_evaluated: candidates.length
  };
}

export const GEOMETRY_LIMITS = LIMITS;
