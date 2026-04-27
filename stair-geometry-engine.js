// Tekstura staircase geometry engine.
// Stage 1 keeps the public contract stable for stair-configurator.js while making diagnostics explicit.

const LIMITS = {
  riser: { recommendedMin: 150, recommendedMax: 180, warningMin: 140, warningMax: 200 },
  tread: { recommendedMin: 250, recommendedMax: 320, warningMin: 220, warningMax: 360 },
  comfort: { min: 600, max: 640, target: 620 },
  angle: { recommendedMax: 42, warningMax: 47 },
  headroom: { recommendedMin: 2000, warningMin: 1900 }
};

const EDGE_BLEND_MM = 120;
const MIN_HEADROOM_SAMPLE_OFFSET_MM = 250;

const round = (value, digits = 1) => Number(Number(value || 0).toFixed(digits));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getRiserCounts(height) {
  const h = Number(height || 0);
  if (!Number.isFinite(h) || h <= 0) return [];
  const minCount = Math.ceil(h / LIMITS.riser.recommendedMax);
  const maxCount = Math.floor(h / LIMITS.riser.recommendedMin);
  const out = [];
  for (let count = minCount; count <= maxCount; count += 1) out.push(count);
  return out;
}

function comfortOf(riserHeight, treadDepth) {
  const value = 2 * Number(riserHeight || 0) + Number(treadDepth || 0);
  const deviation = Math.abs(value - LIMITS.comfort.target);
  const status = value >= LIMITS.comfort.min && value <= LIMITS.comfort.max ? 'ok' : 'warning';
  return {
    value: round(value),
    deviation: round(deviation, 2),
    status,
    message: status === 'ok'
      ? 'Формула шага 2h+b находится в комфортном диапазоне.'
      : `Формула шага 2h+b = ${round(value)} мм выходит за ориентир ${LIMITS.comfort.min}–${LIMITS.comfort.max} мм.`
  };
}

function angleStatus(angleDeg) {
  if (angleDeg > LIMITS.angle.warningMax) return { status: 'critical', message: `Угол ${angleDeg}° выше мягкого предела ${LIMITS.angle.warningMax}°.` };
  if (angleDeg > LIMITS.angle.recommendedMax) return { status: 'warning', message: `Угол ${angleDeg}° выше рекомендованной зоны ${LIMITS.angle.recommendedMax}°.` };
  return { status: 'ok', message: 'Угол подъёма в рекомендованной зоне.' };
}

function polylineLength(points = []) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return round(total, 1);
}

function interpolatePolyline(points = [], step = 70) {
  if (!points.length) return [];
  const samples = [{ ...points[0], dist: 0 }];
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segmentLength = Math.hypot(dx, dy);
    if (!segmentLength) continue;
    const chunks = Math.max(1, Math.ceil(segmentLength / step));
    for (let chunk = 1; chunk <= chunks; chunk += 1) {
      const t = chunk / chunks;
      samples.push({
        x: round(start.x + dx * t),
        y: round(start.y + dy * t),
        dist: round(distance + segmentLength * t)
      });
    }
    distance += segmentLength;
  }
  return samples;
}

function boundsFromPath(points = [], marchWidth = 0) {
  if (!points.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const margin = Number(marchWidth || 0) / 2;
  const minX = Math.min(...xs) - margin;
  const maxX = Math.max(...xs) + margin;
  const minY = Math.min(...ys) - margin;
  const maxY = Math.max(...ys) + margin;
  return {
    minX: round(minX),
    maxX: round(maxX),
    minY: round(minY),
    maxY: round(maxY),
    width: round(Math.max(0, maxX - minX)),
    height: round(Math.max(0, maxY - minY))
  };
}

function fitDiagnostics(input, bounds, skipFit = false) {
  if (skipFit) {
    return {
      status: 'soft',
      fits: true,
      overflowX: 0,
      overflowY: 0,
      message: 'Для готового основания fit-check не блокирует расчёт: размеры проверяются инженером после замера.'
    };
  }
  const openingLength = Number(input.openingLength || 0);
  const openingWidth = Number(input.openingWidth || 0);
  const overflowX = round(Math.max(0, bounds.maxX - openingLength) + Math.max(0, -bounds.minX));
  const overflowY = round(Math.max(0, bounds.maxY - openingWidth) + Math.max(0, -bounds.minY));
  const fits = overflowX <= 0 && overflowY <= 0;
  let message = 'Лестница помещается в заданный проём.';
  if (!fits) {
    const parts = [];
    if (overflowX > 0) parts.push(`длины не хватает примерно на ${overflowX} мм`);
    if (overflowY > 0) parts.push(`ширины не хватает примерно на ${overflowY} мм`);
    message = `Лестница не помещается в заданный проём: ${parts.join(', ')}.`;
  }
  return { status: fits ? 'ok' : 'critical', fits, overflowX, overflowY, message };
}

function ceilingBlendFactor(point, openingLength, openingWidth) {
  const dx = Math.min(point.x, openingLength - point.x);
  const dy = Math.min(point.y, openingWidth - point.y);
  const edgeDistance = Math.min(dx, dy);
  if (edgeDistance <= 0) return 0.55;
  if (edgeDistance >= EDGE_BLEND_MM) return 1;
  return 0.55 + (edgeDistance / EDGE_BLEND_MM) * 0.45;
}

function evaluateHeadroom(input, candidate, options = {}) {
  const floorHeight = Number(input.floorHeight || 0);
  const slabThickness = Number(input.slabThickness || 220);
  const topFinish = Number(input.topFinish || 20);
  const bottomFinish = Number(input.bottomFinish || 20);
  const slabUnderside = floorHeight - slabThickness - topFinish - bottomFinish;
  const openCeiling = floorHeight + 2600;
  const openingLength = Number(input.openingLength || 0);
  const openingWidth = Number(input.openingWidth || 0);
  const samples = interpolatePolyline(candidate.path, 70);
  const totalDistance = Math.max(samples[samples.length - 1]?.dist || 1, 1);
  const soft = Boolean(options.soft);
  const headroomSamples = samples.map((point) => {
    const progress = clamp(point.dist / totalDistance, 0, 1);
    const stepHeight = progress * floorHeight;
    const insideOpening = openingLength > 0 && openingWidth > 0 && point.x >= 0 && point.x <= openingLength && point.y >= 0 && point.y <= openingWidth;
    const blend = insideOpening ? ceilingBlendFactor(point, openingLength, openingWidth) : 0;
    const ceilingHeight = soft ? openCeiling : slabUnderside + (openCeiling - slabUnderside) * blend;
    return { ...point, stepHeight: round(stepHeight), clearance: round(ceilingHeight - stepHeight), insideOpening, blend: round(blend, 2) };
  });
  const interiorSamples = headroomSamples.filter((point) => point.dist >= MIN_HEADROOM_SAMPLE_OFFSET_MM && point.dist <= totalDistance - MIN_HEADROOM_SAMPLE_OFFSET_MM);
  const checkedSamples = interiorSamples.length ? interiorSamples : headroomSamples;
  const minHeadroom = checkedSamples.reduce((min, point) => Math.min(min, point.clearance), Number.POSITIVE_INFINITY);
  const warningZones = checkedSamples.filter((point) => point.clearance < LIMITS.headroom.recommendedMin);
  const criticalZones = checkedSamples.filter((point) => point.clearance < LIMITS.headroom.warningMin);
  const min = Number.isFinite(minHeadroom) ? round(minHeadroom) : 0;
  const status = soft ? 'soft' : (min < LIMITS.headroom.warningMin ? 'critical' : min < LIMITS.headroom.recommendedMin ? 'warning' : 'ok');
  const message = soft
    ? 'Просвет для готового основания показан как предварительный ориентир и уточняется на замере.'
    : status === 'ok'
      ? 'Минимальный просвет находится в рабочей зоне.'
      : status === 'warning'
        ? `Минимальный просвет ${min} мм ниже ориентира ${LIMITS.headroom.recommendedMin} мм.`
        : `Минимальный просвет ${min} мм ниже мягкого предела ${LIMITS.headroom.warningMin} мм.`;
  return {
    min,
    status,
    message,
    warningZones,
    criticalZones,
    criticalLocations: criticalZones.slice(0, 5).map((point) => ({ x: point.x, y: point.y, clearance: point.clearance, distance: point.dist })),
    samples: headroomSamples,
    slabUnderside
  };
}

function scoreCandidate(candidate) {
  const comfortPenalty = Math.min(34, candidate.comfort.deviation * 1.35);
  const anglePenalty = candidate.angleDeg > LIMITS.angle.recommendedMax ? (candidate.angleDeg - LIMITS.angle.recommendedMax) * 4 : 0;
  const headroomPenalty = candidate.headroom.status === 'critical' ? 26 : candidate.headroom.status === 'warning' ? Math.min(18, (LIMITS.headroom.recommendedMin - candidate.headroom.min) * 0.04) : 0;
  const fitPenalty = candidate.fit.fits ? 0 : Math.min(40, (candidate.fit.overflowX + candidate.fit.overflowY) * 0.035);
  const winderPenalty = candidate.turnType === 'winders' ? 2 : 0;
  return round(Math.max(0, 100 - comfortPenalty - anglePenalty - headroomPenalty - fitPenalty - winderPenalty), 1);
}

function classifyCandidate(candidate, mode) {
  if (mode === 'ready_frame') return candidate.angle.status === 'ok' && candidate.comfort.status === 'ok' ? 'recommended' : 'warning';
  if (!candidate.fit.fits || candidate.angle.status === 'critical' || candidate.headroom.status === 'critical') return 'invalid';
  if (candidate.score >= 82 && candidate.comfort.status === 'ok' && candidate.headroom.status === 'ok') return 'recommended';
  if (candidate.score >= 58) return 'warning';
  return 'invalid';
}

function splitRisers(totalRisers, stairType, splitRatio = 0.5, turnRisers = 0) {
  if (stairType === 'straight') return { lowerRisers: totalRisers, upperRisers: 0, turnRisers: 0 };
  const flightRisers = totalRisers - turnRisers;
  if (flightRisers < 4) return null;
  const lowerRisers = Math.max(2, Math.round(flightRisers * splitRatio));
  const upperRisers = flightRisers - lowerRisers;
  if (upperRisers < 2) return null;
  return { lowerRisers, upperRisers, turnRisers };
}

function linePoints(start, end, count) {
  const points = [];
  const safeCount = Math.max(1, count);
  for (let index = 0; index <= safeCount; index += 1) {
    const t = index / safeCount;
    points.push({ x: round(start.x + (end.x - start.x) * t), y: round(start.y + (end.y - start.y) * t) });
  }
  return points;
}

function allowMeasuredTread(input, treadDepth) {
  if (input.allowMeasuredGeometry) return Number.isFinite(treadDepth) && treadDepth > 0;
  return treadDepth >= LIMITS.tread.warningMin && treadDepth <= LIMITS.tread.warningMax;
}

function buildStraightCandidate(input, riserCount, fixedTreadDepth = null) {
  const riserHeight = input.floorHeight / riserCount;
  const treadCount = Math.max(1, Number(input.treadCountOverride || 0) || riserCount - 1);
  const treadDepth = fixedTreadDepth || input.openingLength / treadCount;
  if (!allowMeasuredTread(input, treadDepth)) return null;
  const run = treadDepth * treadCount;
  const centerY = input.openingWidth > 0 ? input.openingWidth / 2 : input.marchWidth / 2;
  const path = linePoints({ x: 0, y: centerY }, { x: run, y: centerY }, treadCount);
  const bounds = { minX: 0, maxX: round(run), minY: round(centerY - input.marchWidth / 2), maxY: round(centerY + input.marchWidth / 2), width: round(run), height: round(input.marchWidth) };
  return { stairType: 'straight', turnType: 'straight', riserCount, treadCount, riserHeight: round(riserHeight), treadDepth: round(treadDepth), path, bounds, marching: { lowerRisers: riserCount, upperRisers: 0, treadsLower: treadCount, treadsUpper: 0, turnRisers: 0 } };
}

function buildLTurnCandidate(input, riserCount, splitRatio = 0.5, fixedTreadDepth = null, fixedWinderCount = null) {
  const turnType = input.stairType.includes('winders') ? 'winders' : 'landing';
  const turnRisers = turnType === 'winders' ? Math.max(2, Number(fixedWinderCount || input.winderCount || 3)) : 1;
  const split = splitRisers(riserCount, input.stairType, splitRatio, turnRisers);
  if (!split) return null;
  const treadsLower = split.lowerRisers;
  const treadsUpper = Math.max(split.upperRisers - 1, 1);
  const turnBlockX = turnType === 'landing' ? Math.max(input.landingLength || 0, input.marchWidth) : input.marchWidth;
  const turnBlockY = turnType === 'landing' ? Math.max(input.landingWidth || 0, input.marchWidth) : input.marchWidth;
  const runXAvailable = Math.max(1, input.openingLength - turnBlockX);
  const runYAvailable = Math.max(1, input.openingWidth - turnBlockY);
  const treadDepth = fixedTreadDepth || Math.min(runXAvailable / treadsLower, runYAvailable / treadsUpper);
  if (!allowMeasuredTread(input, treadDepth)) return null;
  const riserHeight = input.floorHeight / riserCount;
  const lowerRun = treadsLower * treadDepth;
  const upperRun = treadsUpper * treadDepth;
  const sign = input.turnDirection === 'left' ? -1 : 1;
  const centerY = sign < 0 ? Math.max(input.marchWidth / 2, (input.openingWidth || (upperRun + turnBlockY)) - input.marchWidth / 2) : input.marchWidth / 2;
  const turnCenterX = lowerRun + turnBlockX / 2;
  const upperX = lowerRun + turnBlockX / 2;
  const upperEndY = centerY + sign * (turnBlockY / 2 + upperRun);
  const minY = sign > 0 ? centerY - input.marchWidth / 2 : centerY - turnBlockY / 2 - upperRun - input.marchWidth / 2;
  const maxY = sign > 0 ? centerY + turnBlockY / 2 + upperRun + input.marchWidth / 2 : centerY + input.marchWidth / 2;
  const bounds = { minX: 0, maxX: round(lowerRun + turnBlockX), minY: round(minY), maxY: round(maxY), width: round(lowerRun + turnBlockX), height: round(maxY - minY) };
  const path = [
    ...linePoints({ x: 0, y: centerY }, { x: lowerRun, y: centerY }, treadsLower),
    { x: round(turnCenterX), y: round(centerY + sign * turnBlockY / 2) },
    ...linePoints({ x: upperX, y: centerY + sign * turnBlockY / 2 }, { x: upperX, y: upperEndY }, treadsUpper).slice(1)
  ];
  return { stairType: input.stairType, turnType, riserCount, treadCount: treadsLower + treadsUpper + (turnType === 'winders' ? turnRisers : 0), riserHeight: round(riserHeight), treadDepth: round(treadDepth), path, bounds, marching: { ...split, treadsLower, treadsUpper } };
}

function buildUTurnCandidate(input, riserCount, splitRatio = 0.5, fixedTreadDepth = null, fixedWinderCount = null) {
  const turnType = input.stairType.includes('winders') ? 'winders' : 'landing';
  const turnRisers = turnType === 'winders' ? Math.max(2, Number(fixedWinderCount || input.winderCount || 3)) : 1;
  const split = splitRisers(riserCount, input.stairType, splitRatio, turnRisers);
  if (!split) return null;
  const treadsLower = split.lowerRisers;
  const treadsUpper = Math.max(split.upperRisers - 1, 1);
  const turnBlock = turnType === 'landing' ? Math.max(input.landingLength || 0, input.marchWidth) : input.marchWidth;
  const runAvailable = Math.max(1, input.openingLength - turnBlock);
  const treadDepth = fixedTreadDepth || runAvailable / Math.max(treadsLower, treadsUpper);
  if (!allowMeasuredTread(input, treadDepth)) return null;
  const riserHeight = input.floorHeight / riserCount;
  const lowerRun = treadsLower * treadDepth;
  const upperRun = treadsUpper * treadDepth;
  const stackWidth = input.marchWidth * 2;
  const yBase = input.openingWidth > stackWidth ? (input.openingWidth - stackWidth) / 2 : 0;
  const lowerY = yBase + input.marchWidth / 2;
  const upperY = yBase + input.marchWidth * 1.5;
  const turnX = lowerRun + turnBlock / 2;
  const upperStartX = lowerRun + turnBlock / 2;
  const upperEndX = upperStartX - upperRun;
  const minX = Math.min(0, upperEndX);
  const maxX = lowerRun + turnBlock;
  const bounds = { minX: round(minX), maxX: round(maxX), minY: round(yBase), maxY: round(yBase + stackWidth), width: round(maxX - minX), height: round(stackWidth) };
  const path = [
    ...linePoints({ x: 0, y: lowerY }, { x: lowerRun, y: lowerY }, treadsLower),
    { x: round(turnX), y: round(upperY) },
    ...linePoints({ x: upperStartX, y: upperY }, { x: upperEndX, y: upperY }, treadsUpper).slice(1)
  ];
  return { stairType: input.stairType, turnType, riserCount, treadCount: treadsLower + treadsUpper + (turnType === 'winders' ? turnRisers : 0), riserHeight: round(riserHeight), treadDepth: round(treadDepth), path, bounds, marching: { ...split, treadsLower, treadsUpper } };
}

function buildCandidateByType(input, riserCount, splitRatio = 0.5, fixedTreadDepth = null) {
  if (input.stairType === 'straight') return buildStraightCandidate(input, riserCount, fixedTreadDepth);
  if (input.stairType.startsWith('l_turn')) return buildLTurnCandidate(input, riserCount, splitRatio, fixedTreadDepth, input.winderCount);
  if (input.stairType.startsWith('u_turn')) return buildUTurnCandidate(input, riserCount, splitRatio, fixedTreadDepth, input.winderCount);
  return null;
}

function buildReadyFallbackCandidate(input, stepCount, treadDepth) {
  const fallbackInput = { ...input, stairType: 'straight', openingLength: Math.max(input.openingLength || 0, stepCount * treadDepth), openingWidth: Math.max(input.openingWidth || 0, input.marchWidth), treadCountOverride: stepCount, allowMeasuredGeometry: true };
  const fallback = buildStraightCandidate(fallbackInput, stepCount, treadDepth);
  if (!fallback) return null;
  return { input: fallbackInput, candidate: { ...fallback, stairType: input.stairType, turnType: input.stairType.includes('winders') ? 'winders' : input.stairType === 'straight' ? 'straight' : 'landing' } };
}

function finalizeCandidate(input, candidate, mode = 'empty_opening') {
  const effectiveTreadCount = mode === 'ready_frame' ? Math.max(1, Number(input.measuredStepCount || candidate.treadCount || 1)) : candidate.treadCount;
  const bounds = candidate.bounds || boundsFromPath(candidate.path, input.marchWidth);
  const fit = fitDiagnostics(input, bounds, mode === 'ready_frame');
  const comfort = comfortOf(candidate.riserHeight, candidate.treadDepth);
  const angleDeg = round((Math.atan(candidate.riserHeight / Math.max(candidate.treadDepth, 1)) * 180) / Math.PI, 2);
  const angle = angleStatus(angleDeg);
  const headroom = evaluateHeadroom(input, candidate, { soft: mode === 'ready_frame' });
  const walkingLineLength = polylineLength(candidate.path);
  const totalRun = round((candidate.marching.treadsLower + candidate.marching.treadsUpper) * candidate.treadDepth);
  const stringerLength = round(Math.hypot(candidate.treadDepth, candidate.riserHeight) * Math.max(1, candidate.treadCount));
  const railingLength = round(walkingLineLength / 1000 + 1.2, 2);
  const treadArea = round((effectiveTreadCount * input.marchWidth * candidate.treadDepth) / 1_000_000, 2);
  const riserArea = round((candidate.riserCount * input.marchWidth * candidate.riserHeight) / 1_000_000, 2);
  const enriched = {
    ...candidate,
    treadCount: effectiveTreadCount,
    comfort,
    angleDeg,
    angle,
    minHeadroom: headroom.min,
    headroom,
    fit,
    totalRun,
    stringerLength,
    railingLength,
    treadArea,
    riserArea,
    footprintLength: bounds.width,
    footprintWidth: bounds.height,
    planBounds: bounds,
    diagnostics: { fit, comfort: { status: comfort.status, value: comfort.value, message: comfort.message }, angle, headroom: { status: headroom.status, min: headroom.min, message: headroom.message, criticalPoints: headroom.criticalLocations } },
    visualization: {
      path: candidate.path,
      walkingSamples: headroom.samples,
      warningZones: headroom.warningZones,
      criticalZones: headroom.criticalZones,
      opening: { length: input.openingLength, width: input.openingWidth },
      dimensions: { openingLength: input.openingLength, openingWidth: input.openingWidth, marchWidth: input.marchWidth, floorHeight: input.floorHeight },
      elevation: { floorHeight: input.floorHeight, slabUnderside: headroom.slabUnderside, treadDepth: candidate.treadDepth, riserHeight: candidate.riserHeight, treadCount: effectiveTreadCount }
    }
  };
  enriched.score = scoreCandidate(enriched);
  enriched.status = classifyCandidate(enriched, mode);
  return enriched;
}

function warningsForCandidate(candidate, mode = 'empty_opening') {
  const warnings = [];
  if (mode === 'ready_frame') {
    warnings.push('Предварительная схема и стоимость рассчитаны по удалённым размерам. Финальный расход материалов и смета уточняются после замера Tekstura.');
    if (candidate.usedSimplifiedPreview) warnings.push('Для существующего основания построена упрощённая preview-схема: расчёт материалов сохранён по введённому количеству ступеней.');
  } else if (!candidate.fit.fits) warnings.push(candidate.fit.message);
  if (candidate.comfort.status !== 'ok') warnings.push(candidate.comfort.message);
  if (candidate.angle.status !== 'ok') warnings.push(candidate.angle.message);
  if (candidate.headroom.status !== 'ok' && candidate.headroom.status !== 'soft') warnings.push(candidate.headroom.message);
  if (mode === 'ready_frame' && candidate.turnType === 'winders') warnings.push(`Забежная зона рассчитана по введённому количеству забежных ступеней: ${candidate.marching.turnRisers}.`);
  return warnings;
}

function buildGeometryResponse(candidate, warnings = [], extra = {}) {
  return {
    valid: candidate.status !== 'invalid',
    status: candidate.status,
    warnings,
    bestCandidate: candidate,
    alternatives: extra.alternatives || [],
    geometrySummary: {
      riser_count: candidate.riserCount,
      tread_count: candidate.treadCount,
      riser_height: candidate.riserHeight,
      tread_depth: candidate.treadDepth,
      comfort_value: candidate.comfort.value,
      stair_angle_deg: candidate.angleDeg,
      headroom_min: candidate.minHeadroom,
      headroom_warning_count: candidate.headroom.warningZones.length,
      headroom_critical_count: candidate.headroom.criticalZones.length,
      headroom_critical_locations: candidate.headroom.criticalLocations,
      score: candidate.score
    },
    metrics: {
      run_length: candidate.totalRun,
      walking_line_length: polylineLength(candidate.path),
      stringer_length: candidate.stringerLength,
      railing_length: candidate.railingLength,
      tread_area_m2: candidate.treadArea,
      riser_area_m2: candidate.riserArea,
      footprint_length: candidate.footprintLength,
      footprint_width: candidate.footprintWidth
    },
    diagnostics: candidate.diagnostics,
    visualization: candidate.visualization,
    scenarioSummary: extra.scenarioSummary || ''
  };
}

function invalidResponse(message, diagnostics = null) {
  return { valid: false, status: 'invalid', warnings: [message], bestCandidate: null, alternatives: [], geometrySummary: null, metrics: null, visualization: null, diagnostics };
}

function normalizeStairType(rawInput = {}) {
  if (rawInput.stairType) return rawInput.stairType;
  const configurationType = rawInput.configurationType || rawInput.configuration_type || 'straight';
  const turnType = rawInput.turnType || rawInput.turn_type || 'landing';
  if (configurationType === 'l_shaped') return turnType === 'winders' ? 'l_turn_winders' : 'l_turn_landing';
  if (configurationType === 'u_shaped') return turnType === 'winders' ? 'u_turn_winders' : 'u_turn_landing';
  return 'straight';
}

function deriveReadyOpening(input, stepCount, treadDepth) {
  const stairType = input.stairType;
  const turnType = stairType.includes('winders') ? 'winders' : 'landing';
  const turnRisers = stairType === 'straight' ? 0 : (turnType === 'winders' ? Math.max(2, Number(input.winderCount || 3)) : 1);
  const split = splitRisers(stepCount, stairType, 0.5, turnRisers);
  if (stairType === 'straight' || !split) return { openingLength: Math.max(treadDepth * stepCount, treadDepth * 2), openingWidth: input.marchWidth };
  const treadsLower = split.lowerRisers;
  const treadsUpper = Math.max(split.upperRisers - 1, 1);
  const landingLength = Number(input.landingLength || 0);
  const landingWidth = Number(input.landingWidth || 0);
  const turnBlockX = turnType === 'landing' ? Math.max(landingLength, input.marchWidth) : input.marchWidth;
  const turnBlockY = turnType === 'landing' ? Math.max(landingWidth, input.marchWidth) : input.marchWidth;
  if (stairType.startsWith('l_turn')) return { openingLength: Math.max(treadsLower * treadDepth + turnBlockX, input.marchWidth * 1.5), openingWidth: Math.max(treadsUpper * treadDepth + turnBlockY, input.marchWidth * 1.5) };
  return { openingLength: Math.max(Math.max(treadsLower, treadsUpper) * treadDepth + turnBlockX, input.marchWidth * 1.8), openingWidth: Math.max(input.marchWidth * 2, turnBlockY, landingWidth || 0) };
}

function calculateReadyFrameGeometry(rawInput = {}) {
  const stairType = normalizeStairType(rawInput);
  const stepCount = Number(rawInput.stepCount || 0);
  const riserHeight = Number(rawInput.riserHeight || 0);
  const treadDepth = Number(rawInput.treadDepth || 0);
  const marchWidth = Number(rawInput.marchWidth || 0);
  if (stepCount <= 0 || riserHeight <= 0 || treadDepth <= 0 || marchWidth <= 0) return invalidResponse('Заполните количество ступеней, высоту подступенка, глубину проступи и ширину марша для существующего основания.');
  const baseInput = {
    stairType,
    floorHeight: round(stepCount * riserHeight),
    slabThickness: Number(rawInput.slabThickness || 220),
    topFinish: Number(rawInput.topFinish || 20),
    bottomFinish: Number(rawInput.bottomFinish || 20),
    openingLength: Number(rawInput.openingLength || 0),
    openingWidth: Number(rawInput.openingWidth || 0),
    marchWidth,
    turnDirection: rawInput.turnDirection || 'left',
    landingLength: Number(rawInput.landingLength || 0),
    landingWidth: Number(rawInput.landingWidth || 0),
    winderCount: Math.max(2, Number(rawInput.winderCount || 3)),
    measuredStepCount: stepCount,
    treadCountOverride: stairType === 'straight' ? stepCount : undefined,
    allowMeasuredGeometry: true
  };
  const derivedOpening = deriveReadyOpening(baseInput, stepCount, treadDepth);
  const input = { ...baseInput, openingLength: baseInput.openingLength || derivedOpening.openingLength, openingWidth: baseInput.openingWidth || derivedOpening.openingWidth };
  let candidateInput = input;
  let candidateBase = buildCandidateByType(candidateInput, stepCount, 0.5, treadDepth) || buildCandidateByType(candidateInput, stepCount, 0.42, treadDepth) || buildCandidateByType(candidateInput, stepCount, 0.58, treadDepth);
  let usedSimplifiedPreview = false;
  if (!candidateBase) {
    const fallback = buildReadyFallbackCandidate(input, stepCount, treadDepth);
    if (!fallback) return invalidResponse('Не удалось построить даже упрощённую preview-схему существующего основания. Проверьте количество ступеней, подступенок, проступь и ширину марша.');
    candidateInput = fallback.input;
    candidateBase = fallback.candidate;
    usedSimplifiedPreview = true;
  }
  const candidate = finalizeCandidate(candidateInput, candidateBase, 'ready_frame');
  candidate.usedSimplifiedPreview = usedSimplifiedPreview;
  const warnings = warningsForCandidate(candidate, 'ready_frame');
  const alternatives = [treadDepth - 10, treadDepth + 10].filter((depth) => depth > 0).map((depth) => {
    const altBase = buildCandidateByType({ ...input, openingLength: input.openingLength + Math.abs(depth - treadDepth) }, stepCount, 0.5, depth);
    if (!altBase) return null;
    const alt = finalizeCandidate(input, altBase, 'ready_frame');
    return { riserCount: alt.riserCount, treadCount: alt.treadCount, treadDepth: alt.treadDepth, angleDeg: alt.angleDeg, minHeadroom: alt.minHeadroom, status: alt.status };
  }).filter(Boolean);
  return buildGeometryResponse(candidate, warnings, { alternatives, scenarioSummary: 'Готовое основание проверено как предварительная схема отделки/ограждения. Расчёт не блокируется fit-check и требует подтверждения после замера.' });
}

export function calculateStairGeometryEngine(rawInput = {}) {
  if (rawInput?.mode === 'ready_frame') return calculateReadyFrameGeometry(rawInput);
  const input = {
    stairType: normalizeStairType(rawInput),
    floorHeight: Number(rawInput.floorHeight || 0),
    slabThickness: Number(rawInput.slabThickness || 220),
    topFinish: Number(rawInput.topFinish || 20),
    bottomFinish: Number(rawInput.bottomFinish || 20),
    openingLength: Number(rawInput.openingLength || 0),
    openingWidth: Number(rawInput.openingWidth || 0),
    marchWidth: Number(rawInput.marchWidth || 0),
    turnDirection: rawInput.turnDirection || 'left',
    landingLength: Number(rawInput.landingLength || 0),
    landingWidth: Number(rawInput.landingWidth || 0),
    winderCount: Math.max(2, Number(rawInput.winderCount || 3)),
    allowMeasuredGeometry: false
  };
  if (input.floorHeight <= 0 || input.openingLength <= 0 || input.openingWidth <= 0 || input.marchWidth <= 0) return invalidResponse('Заполните ключевые размеры проёма, высоты и ширины марша.');
  if (input.marchWidth > input.openingWidth && input.stairType !== 'straight') return invalidResponse('Ширина марша больше ширины проёма: поворотная схема не может быть проверена онлайн.');
  const variants = [];
  const splitRatios = input.stairType === 'straight' ? [1] : [0.42, 0.5, 0.58];
  getRiserCounts(input.floorHeight).forEach((riserCount) => {
    splitRatios.forEach((splitRatio) => {
      const baseCandidate = buildCandidateByType(input, riserCount, splitRatio);
      if (!baseCandidate) return;
      if (baseCandidate.riserHeight < LIMITS.riser.warningMin || baseCandidate.riserHeight > LIMITS.riser.warningMax) return;
      variants.push(finalizeCandidate(input, baseCandidate, 'empty_opening'));
    });
  });
  if (!variants.length) {
    return invalidResponse('Онлайн-подбор не нашёл рабочую геометрию в заданном проёме. Проверьте габариты или рассмотрите другой тип лестницы.', {
      fit: { fits: false, overflowX: 0, overflowY: 0, message: 'Нет кандидатов, которые проходят базовые диапазоны подступенка/проступи.' },
      comfort: { status: 'warning', value: 0, message: 'Нет кандидатов в диапазоне формулы шага.' },
      headroom: { status: 'critical', min: 0, message: 'Нет кандидатов для проверки просвета.', criticalPoints: [] },
      angle: { status: 'critical', value: 0, message: 'Нет кандидатов для проверки угла.' }
    });
  }
  variants.sort((a, b) => {
    const statusWeight = { recommended: 3, warning: 2, invalid: 1 };
    return (statusWeight[b.status] - statusWeight[a.status]) || (b.score - a.score);
  });
  const best = variants[0];
  const warnings = warningsForCandidate(best, 'empty_opening');
  const alternatives = variants.slice(1).filter((item) => item.status !== 'invalid').slice(0, 3).map((item) => ({ riserCount: item.riserCount, treadCount: item.treadCount, treadDepth: item.treadDepth, angleDeg: item.angleDeg, minHeadroom: item.minHeadroom, status: item.status }));
  return buildGeometryResponse(best, warnings, { alternatives });
}

export const GEOMETRY_LIMITS = LIMITS;
