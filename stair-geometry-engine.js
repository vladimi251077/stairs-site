const LIMITS = {
  riser: { recommendedMin: 150, recommendedMax: 180, warningMin: 140, warningMax: 200 },
  tread: { recommendedMin: 250, recommendedMax: 320, warningMin: 220, warningMax: 360 },
  comfort: { min: 600, max: 640, target: 620 },
  angle: { recommendedMax: 42, warningMax: 47 },
  headroom: { recommendedMin: 2000, warningMin: 1900 }
};

const round = (v, d = 1) => Number(v.toFixed(d));
const EDGE_BLEND_MM = 120;

function getRiserCounts(height) {
  const minCount = Math.ceil(height / LIMITS.riser.recommendedMax);
  const maxCount = Math.floor(height / LIMITS.riser.recommendedMin);
  const out = [];
  for (let i = minCount; i <= maxCount; i += 1) out.push(i);
  return out;
}

function comfortOf(riser, tread) {
  const value = 2 * riser + tread;
  return { value: round(value), deviation: round(Math.abs(value - LIMITS.comfort.target), 2) };
}

function classify(score, minHeadroom) {
  if (score >= 82 && minHeadroom >= LIMITS.headroom.recommendedMin) return 'recommended';
  if (score >= 58 && minHeadroom >= LIMITS.headroom.warningMin) return 'warning';
  return 'invalid';
}

function polylineLength(points) {
  if (!points?.length) return 0;
  let acc = 0;
  for (let i = 1; i < points.length; i += 1) {
    acc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return round(acc, 1);
}

function pathBounds(points, marchWidth = 0) {
  if (!points?.length) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const margin = marchWidth / 2;
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

function estimateStringerLength({
  stairType,
  treadDepth,
  riserHeight,
  lowerRisers = 0,
  upperRisers = 0,
  treadsLower = 0,
  treadsUpper = 0,
  turnType = 'landing',
  marchWidth = 0
}) {
  const lowerFlight = Math.hypot(treadsLower * treadDepth, lowerRisers * riserHeight);
  if (stairType === 'straight') return round(lowerFlight);
  const upperFlight = Math.hypot(treadsUpper * treadDepth, upperRisers * riserHeight);
  const turnAllowance = turnType === 'winders' ? marchWidth * 0.65 : Math.max(marchWidth * 0.45, treadDepth);
  return round(lowerFlight + upperFlight + turnAllowance);
}

function scoreCandidate(candidate) {
  const comfortPenalty = Math.min(35, candidate.comfort.deviation * 1.4);
  const anglePenalty = candidate.angleDeg > LIMITS.angle.recommendedMax ? (candidate.angleDeg - LIMITS.angle.recommendedMax) * 4 : 0;
  const headroomPenalty = Math.max(0, LIMITS.headroom.recommendedMin - candidate.minHeadroom) * 0.06;
  const compactnessPenalty = Math.max(0, candidate.totalRun - candidate.openingLength) * 0.01;
  const winderPenalty = candidate.turnType === 'winders' ? 2 : 0;
  const overflowPenalty = candidate.fitPenalty || 0;
  const score = Math.max(0, 100 - comfortPenalty - anglePenalty - headroomPenalty - compactnessPenalty - winderPenalty - overflowPenalty);
  return round(score, 1);
}

function buildPath(params, treadsPerFlight) {
  const path = [];
  const treadDepth = params.treadDepth;
  const lower = treadsPerFlight[0] || 0;
  const upper = treadsPerFlight[1] || 0;
  const yMid = params.marchWidth / 2;
  const orientation = params.turnDirection === 'left' ? -1 : 1;
  const baseY = params.stairType === 'straight'
    ? params.openingWidth / 2
    : (params.turnDirection === 'left' ? Math.max(yMid, params.openingWidth - yMid) : yMid);
  let x = 0;
  let y = baseY;

  for (let i = 0; i < lower; i += 1) {
    x += treadDepth;
    path.push({ x: round(x), y: round(y) });
  }

  if (params.stairType === 'straight') return path;

  if (params.stairType.startsWith('l_turn')) {
    const cornerX = Math.max(x, params.openingLength - params.marchWidth);
    if (path.length) path[path.length - 1].x = round(cornerX);
    const turnCount = params.turnType === 'winders' ? 3 : 1;
    for (let i = 1; i <= turnCount; i += 1) {
      path.push({
        x: round(cornerX + (params.marchWidth * i) / (turnCount + 1)),
        y: round(baseY + (orientation * params.marchWidth * i) / (turnCount + 1))
      });
    }
    y = baseY + (orientation * params.marchWidth);
    for (let i = 0; i < upper; i += 1) {
      y += orientation * treadDepth;
      path.push({ x: round(cornerX + params.marchWidth), y: round(y) });
    }
    return path;
  }

  if (params.stairType.startsWith('u_turn')) {
    const turnCount = params.turnType === 'winders' ? 3 : 1;
    const farX = Math.max(x, params.openingLength - params.marchWidth);
    if (path.length) path[path.length - 1].x = round(farX);
    for (let i = 1; i <= turnCount; i += 1) {
      path.push({
        x: round(farX + (params.marchWidth * i) / (turnCount + 1)),
        y: round(baseY + (orientation * params.marchWidth * i) / (turnCount + 1))
      });
    }
    x = farX;
    y = baseY + (orientation * params.marchWidth);
    for (let i = 0; i < upper; i += 1) {
      x -= treadDepth;
      path.push({ x: round(x), y: round(y) });
    }
  }
  return path;
}

function samplePolyline(points, step = 80) {
  if (!points.length) return [];
  const samples = [{ ...points[0], dist: 0 }];
  let acc = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segment = Math.hypot(dx, dy);
    if (!segment) continue;
    const chunks = Math.max(1, Math.ceil(segment / step));
    for (let j = 1; j <= chunks; j += 1) {
      const t = j / chunks;
      const x = a.x + dx * t;
      const y = a.y + dy * t;
      const d = acc + segment * t;
      samples.push({ x: round(x), y: round(y), dist: round(d) });
    }
    acc += segment;
  }
  return samples;
}

function ceilingBlendFactor(point, openingLength, openingWidth) {
  const dx = Math.min(point.x, openingLength - point.x);
  const dy = Math.min(point.y, openingWidth - point.y);
  const edgeDist = Math.min(dx, dy);
  if (edgeDist <= 0) return 0;
  if (edgeDist >= EDGE_BLEND_MM) return 1;
  return edgeDist / EDGE_BLEND_MM;
}

function evaluateHeadroom(params, treadsPerFlight, riserHeight) {
  const path = buildPath(params, treadsPerFlight);
  const walkingSamples = samplePolyline(path, 70);
  const slabUnderside = params.floorHeight - params.slabThickness - params.topFinish - params.bottomFinish;
  const openCeiling = params.floorHeight + 2600;
  const pathLength = Math.max(walkingSamples[walkingSamples.length - 1]?.dist || 1, 1);

  const headroomSamples = walkingSamples.map((point) => {
    const progress = point.dist / pathLength;
    const stepHeight = riserHeight * progress * Math.max(1, path.length);
    const inside = point.x >= 0 && point.x <= params.openingLength && point.y >= 0 && point.y <= params.openingWidth;
    const blend = inside ? ceilingBlendFactor(point, params.openingLength, params.openingWidth) : 0;
    const ceilingHeight = slabUnderside + (openCeiling - slabUnderside) * blend;
    const clearance = ceilingHeight - stepHeight;
    return {
      ...point,
      stepHeight: round(stepHeight),
      clearance: round(clearance),
      insideOpening: inside,
      blend: round(blend, 2)
    };
  });

  const minHeadroom = headroomSamples.reduce((min, item) => Math.min(min, item.clearance), Infinity);
  const warningZones = headroomSamples.filter((item) => item.clearance < LIMITS.headroom.recommendedMin);
  const criticalZones = headroomSamples.filter((item) => item.clearance < LIMITS.headroom.warningMin);
  const criticalLocations = criticalZones.slice(0, 5).map((item) => ({
    x: item.x,
    y: item.y,
    clearance: item.clearance,
    distance: item.dist
  }));

  return {
    minHeadroom: Number.isFinite(minHeadroom) ? round(minHeadroom) : 0,
    path,
    walkingSamples: headroomSamples,
    warningZones,
    criticalZones,
    criticalLocations,
    totalTreads: Math.max(1, path.length)
  };
}

function derivePlanMetrics(input, path) {
  const bounds = pathBounds(path, input.marchWidth);
  return {
    walkingLineLength: polylineLength(path),
    bounds
  };
}

function attachMetrics(candidate, input, path) {
  const planMetrics = derivePlanMetrics(input, path);
  const treadArea = (candidate.treadCount * input.marchWidth * candidate.treadDepth) / 1_000_000;
  const riserArea = (candidate.riserCount * input.marchWidth * candidate.riserHeight) / 1_000_000;
  const railingLength = round((planMetrics.walkingLineLength / 1000) + 1.2, 2);
  const stringerLength = estimateStringerLength({
    stairType: input.stairType,
    treadDepth: candidate.treadDepth,
    riserHeight: candidate.riserHeight,
    lowerRisers: candidate.marching.lowerRisers,
    upperRisers: candidate.marching.upperRisers,
    treadsLower: candidate.marching.treadsLower,
    treadsUpper: candidate.marching.treadsUpper,
    turnType: candidate.turnType,
    marchWidth: input.marchWidth
  });
  return {
    ...candidate,
    totalRun: round(planMetrics.walkingLineLength),
    stringerLength,
    railingLength,
    treadArea: round(treadArea, 2),
    riserArea: round(riserArea, 2),
    footprintWidth: planMetrics.bounds.height,
    footprintLength: planMetrics.bounds.width,
    planBounds: planMetrics.bounds
  };
}

function fitPenaltyFromBounds(bounds, input) {
  const overflowX = Math.max(0, bounds.maxX - input.openingLength) + Math.max(0, -bounds.minX);
  const overflowY = Math.max(0, bounds.maxY - input.openingWidth) + Math.max(0, -bounds.minY);
  return round((overflowX + overflowY) * 0.03, 1);
}

function buildCandidate(input, riserCount, splitRatio = 0.5) {
  const riserHeight = input.floorHeight / riserCount;
  const turnType = input.stairType.includes('winders') ? 'winders' : 'landing';
  const turnRisers = input.stairType === 'straight' ? 0 : (turnType === 'winders' ? 3 : 1);
  const marchRisers = riserCount - turnRisers;
  if (marchRisers < 6) return null;

  const lowerRisers = input.stairType === 'straight' ? marchRisers : Math.max(3, Math.round(marchRisers * splitRatio));
  const upperRisers = input.stairType === 'straight' ? 0 : marchRisers - lowerRisers;
  if (input.stairType !== 'straight' && upperRisers < 3) return null;

  const treadsLower = input.stairType === 'straight' ? riserCount - 1 : lowerRisers;
  const treadsUpper = input.stairType === 'straight' ? 0 : Math.max(upperRisers - 1, 3);
  const totalTreads = treadsLower + treadsUpper;
  if (totalTreads < 2) return null;

  const treadDepth = input.openingLength / Math.max(totalTreads, 1);
  const angleDeg = round((Math.atan(riserHeight / treadDepth) * 180) / Math.PI, 2);
  const comfort = comfortOf(riserHeight, treadDepth);

  const headroom = evaluateHeadroom({ ...input, treadDepth, turnType }, [treadsLower, treadsUpper], riserHeight);
  const metricsReady = attachMetrics({
    riserCount,
    treadCount: totalTreads,
    riserHeight: round(riserHeight),
    treadDepth: round(treadDepth),
    comfort,
    angleDeg,
    minHeadroom: round(headroom.minHeadroom),
    openingLength: input.openingLength,
    turnType,
    marching: { lowerRisers, upperRisers, treadsLower, treadsUpper },
    headroomMeta: {
      warningCount: headroom.warningZones.length,
      criticalCount: headroom.criticalZones.length,
      criticalLocations: headroom.criticalLocations
    },
    visualization: {
      path: headroom.path,
      walkingSamples: headroom.walkingSamples,
      warningZones: headroom.warningZones,
      criticalZones: headroom.criticalZones,
      opening: { length: input.openingLength, width: input.openingWidth },
      dimensions: {
        openingLength: input.openingLength,
        openingWidth: input.openingWidth,
        marchWidth: input.marchWidth,
        floorHeight: input.floorHeight
      },
      elevation: {
        floorHeight: input.floorHeight,
        slabUnderside: input.floorHeight - input.slabThickness - input.topFinish - input.bottomFinish,
        treadDepth: round(treadDepth),
        riserHeight: round(riserHeight),
        treadCount: totalTreads
      }
    }
  }, input, headroom.path);

  const limitsOk = (
    metricsReady.riserHeight >= LIMITS.riser.warningMin && metricsReady.riserHeight <= LIMITS.riser.warningMax &&
    metricsReady.treadDepth >= LIMITS.tread.warningMin && metricsReady.treadDepth <= LIMITS.tread.warningMax &&
    metricsReady.angleDeg <= LIMITS.angle.warningMax
  );
  if (!limitsOk) return null;

  metricsReady.fitPenalty = fitPenaltyFromBounds(metricsReady.planBounds, input);
  metricsReady.score = scoreCandidate(metricsReady);
  metricsReady.status = classify(metricsReady.score, metricsReady.minHeadroom);
  return metricsReady;
}

function deriveReadyOpening(rawInput, split) {
  const marchWidth = Number(rawInput.marchWidth || 0);
  const treadDepth = Number(rawInput.treadDepth || 0);
  const landingLength = Number(rawInput.landingLength || 0);
  const landingWidth = Number(rawInput.landingWidth || 0);
  const lowerRun = split.treadsLower * treadDepth;
  const upperRun = split.treadsUpper * treadDepth;

  if (rawInput.stairType === 'straight') {
    return {
      openingLength: Math.max(lowerRun, treadDepth * 2),
      openingWidth: marchWidth
    };
  }
  if (rawInput.stairType.startsWith('l_turn')) {
    const turnInset = rawInput.turnType === 'landing' ? Math.max(landingLength, marchWidth) : marchWidth;
    return {
      openingLength: Math.max(lowerRun + turnInset, marchWidth * 1.5),
      openingWidth: Math.max((upperRun + marchWidth), landingWidth || marchWidth * 2)
    };
  }
  return {
    openingLength: Math.max(Math.max(lowerRun, upperRun) + marchWidth, marchWidth * 1.8),
    openingWidth: Math.max(marchWidth * 2, landingWidth || marchWidth * 2)
  };
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
      headroom_warning_count: candidate.headroomMeta.warningCount,
      headroom_critical_count: candidate.headroomMeta.criticalCount,
      headroom_critical_locations: candidate.headroomMeta.criticalLocations,
      score: candidate.score
    },
    metrics: {
      run_length: candidate.totalRun,
      walking_line_length: candidate.totalRun,
      stringer_length: candidate.stringerLength,
      railing_length: candidate.railingLength,
      tread_area_m2: candidate.treadArea,
      riser_area_m2: candidate.riserArea,
      footprint_length: candidate.footprintLength,
      footprint_width: candidate.footprintWidth
    },
    visualization: candidate.visualization,
    scenarioSummary: extra.scenarioSummary || ''
  };
}

function calculateReadyFrameGeometry(rawInput) {
  const stairType = rawInput.stairType || 'straight';
  const stepCount = Number(rawInput.stepCount || 0);
  const riserHeight = Number(rawInput.riserHeight || 0);
  const treadDepth = Number(rawInput.treadDepth || 0);
  const marchWidth = Number(rawInput.marchWidth || 0);
  const slabThickness = Number(rawInput.slabThickness || 220);
  const topFinish = Number(rawInput.topFinish || 20);
  const bottomFinish = Number(rawInput.bottomFinish || 20);
  const turnType = rawInput.turnType || (stairType.includes('winders') ? 'winders' : 'landing');
  const winderCount = Math.max(3, Number(rawInput.winderCount || 3));

  if (stepCount <= 0 || riserHeight <= 0 || treadDepth <= 0 || marchWidth <= 0) {
    return {
      status: 'invalid',
      valid: false,
      warnings: ['Заполните количество ступеней, высоту подступенка, глубину проступи и ширину марша.'],
      bestCandidate: null,
      alternatives: []
    };
  }

  const turnRisers = stairType === 'straight' ? 0 : (turnType === 'winders' ? winderCount : 1);
  const marchRisers = stepCount - turnRisers;
  if (marchRisers < 6) {
    return {
      status: 'invalid',
      valid: false,
      warnings: ['Для выбранной конфигурации слишком мало ступеней: нужен ручной инженерный подбор существующего основания.'],
      bestCandidate: null,
      alternatives: []
    };
  }

  const lowerRisers = stairType === 'straight' ? stepCount : Math.max(3, Math.round(marchRisers * 0.5));
  const upperRisers = stairType === 'straight' ? 0 : marchRisers - lowerRisers;
  if (stairType !== 'straight' && upperRisers < 3) {
    return {
      status: 'invalid',
      valid: false,
      warnings: ['Для поворотной схемы нужно минимум по 3 подъёма на марш для корректной проверки.'],
      bestCandidate: null,
      alternatives: []
    };
  }

  const split = {
    lowerRisers,
    upperRisers,
    treadsLower: stairType === 'straight' ? stepCount : lowerRisers,
    treadsUpper: stairType === 'straight' ? 0 : Math.max(upperRisers - 1, 3)
  };
  const opening = deriveReadyOpening({
    stairType,
    turnType,
    marchWidth,
    treadDepth,
    landingLength: Number(rawInput.landingLength || 0),
    landingWidth: Number(rawInput.landingWidth || 0)
  }, split);
  const floorHeight = stepCount * riserHeight;
  const angleDeg = round((Math.atan(riserHeight / treadDepth) * 180) / Math.PI, 2);
  const comfort = comfortOf(riserHeight, treadDepth);
  const headroom = evaluateHeadroom({
    stairType,
    floorHeight,
    slabThickness,
    topFinish,
    bottomFinish,
    openingLength: opening.openingLength,
    openingWidth: opening.openingWidth,
    marchWidth,
    turnDirection: rawInput.turnDirection || 'left',
    treadDepth,
    turnType
  }, [split.treadsLower, split.treadsUpper], riserHeight);

  let candidate = attachMetrics({
    riserCount: stepCount,
    treadCount: stairType === 'straight' ? stepCount : split.treadsLower + split.treadsUpper,
    riserHeight: round(riserHeight),
    treadDepth: round(treadDepth),
    comfort,
    angleDeg,
    minHeadroom: round(headroom.minHeadroom),
    openingLength: opening.openingLength,
    turnType,
    marching: split,
    headroomMeta: {
      warningCount: headroom.warningZones.length,
      criticalCount: headroom.criticalZones.length,
      criticalLocations: headroom.criticalLocations
    },
    visualization: {
      path: headroom.path,
      walkingSamples: headroom.walkingSamples,
      warningZones: headroom.warningZones,
      criticalZones: headroom.criticalZones,
      opening: { length: opening.openingLength, width: opening.openingWidth },
      dimensions: {
        openingLength: opening.openingLength,
        openingWidth: opening.openingWidth,
        marchWidth,
        floorHeight
      },
      elevation: {
        floorHeight,
        slabUnderside: floorHeight - slabThickness - topFinish - bottomFinish,
        treadDepth: round(treadDepth),
        riserHeight: round(riserHeight),
        treadCount: stairType === 'straight' ? stepCount : split.treadsLower + split.treadsUpper
      }
    }
  }, {
    stairType,
    marchWidth,
    openingLength: opening.openingLength,
    openingWidth: opening.openingWidth,
    floorHeight
  }, headroom.path);

  candidate.fitPenalty = 0;
  candidate.score = scoreCandidate(candidate);
  candidate.status = classify(candidate.score, candidate.minHeadroom);

  const warnings = [];
  warnings.push('Fit-check выполнен по существующей геометрии основания и введённым размерам ступеней.');
  warnings.push('Просвет рассчитан по рабочей схеме движения, но размеры проёма для existing base приняты по геометрии лестницы и требуют подтверждения инженером на объекте.');
  if (candidate.comfort.value < LIMITS.comfort.min || candidate.comfort.value > LIMITS.comfort.max) warnings.push('Формула 2h+b вышла за целевой диапазон 600–640 мм.');
  if (candidate.angleDeg > LIMITS.angle.recommendedMax) warnings.push('Угол подъёма близок к верхней границе комфорта.');
  if (candidate.headroomMeta.warningCount) warnings.push(`Есть зоны по просвету ниже ${LIMITS.headroom.recommendedMin} мм: ${candidate.headroomMeta.warningCount} точек.`);
  if (candidate.headroomMeta.criticalCount) warnings.push(`Критичные точки по просвету ниже ${LIMITS.headroom.warningMin} мм: ${candidate.headroomMeta.criticalCount}.`);

  const alternatives = [];
  const treadVariants = [treadDepth - 10, treadDepth + 10].filter((v) => v >= LIMITS.tread.warningMin && v <= LIMITS.tread.warningMax);
  treadVariants.forEach((variantDepth) => {
    const altAngle = round((Math.atan(riserHeight / variantDepth) * 180) / Math.PI, 2);
    const altComfort = comfortOf(riserHeight, variantDepth);
    alternatives.push({
      riserCount: stepCount,
      treadCount: candidate.treadCount,
      treadDepth: round(variantDepth),
      angleDeg: altAngle,
      minHeadroom: candidate.minHeadroom,
      status: classify(Math.max(0, candidate.score - Math.abs(variantDepth - treadDepth) * 0.4), candidate.minHeadroom)
    });
  });

  return buildGeometryResponse(candidate, warnings, {
    alternatives,
    scenarioSummary: 'Существующее основание проверено как реальная конфигурация по линии движения, углу, формуле шага и просвету.'
  });
}

export function calculateStairGeometryEngine(rawInput) {
  if (rawInput?.mode === 'ready_frame') return calculateReadyFrameGeometry(rawInput);

  const input = {
    stairType: rawInput.stairType || 'straight',
    floorHeight: Number(rawInput.floorHeight || 0),
    slabThickness: Number(rawInput.slabThickness || 220),
    topFinish: Number(rawInput.topFinish || 20),
    bottomFinish: Number(rawInput.bottomFinish || 20),
    openingLength: Number(rawInput.openingLength || 0),
    openingWidth: Number(rawInput.openingWidth || 0),
    marchWidth: Number(rawInput.marchWidth || 0),
    turnDirection: rawInput.turnDirection || 'left'
  };

  if (input.floorHeight <= 0 || input.openingLength <= 0 || input.openingWidth <= 0 || input.marchWidth <= 0) {
    return { status: 'invalid', valid: false, warnings: ['Заполните ключевые размеры проёма и высоты.'], bestCandidate: null, alternatives: [] };
  }

  const variants = [];
  const splits = input.stairType === 'straight' ? [1] : [0.42, 0.5, 0.58];
  getRiserCounts(input.floorHeight).forEach((count) => {
    splits.forEach((split) => {
      const candidate = buildCandidate(input, count, split);
      if (candidate) variants.push(candidate);
    });
  });

  if (!variants.length) {
    return {
      status: 'invalid',
      valid: false,
      warnings: ['Онлайн-подбор не нашёл безопасную геометрию. Нужна инженерная проверка.'],
      bestCandidate: null,
      alternatives: []
    };
  }

  variants.sort((a, b) => b.score - a.score);
  const best = variants[0];
  const warnings = [];
  if (best.minHeadroom < LIMITS.headroom.recommendedMin) warnings.push('Просвет по линии хода ниже 2000 мм: вариант строится, но нужен контроль инженера Tekstura.');
  if (best.comfort.value < LIMITS.comfort.min || best.comfort.value > LIMITS.comfort.max) warnings.push('Формула 2h+b вышла за целевой диапазон 600–640 мм.');
  if (best.angleDeg > LIMITS.angle.recommendedMax) warnings.push('Угол близок к верхней границе комфорта.');
  if (best.headroomMeta.criticalCount) warnings.push(`Есть критичные точки по просвету: ${best.headroomMeta.criticalCount} участков ниже ${LIMITS.headroom.warningMin} мм.`);
  if (best.fitPenalty > 0) warnings.push('Геометрия близка к границам проёма: проверка реального замера обязательна.');

  const alternatives = variants.slice(1, 4).map((item) => ({
    riserCount: item.riserCount,
    treadCount: item.treadCount,
    treadDepth: item.treadDepth,
    angleDeg: item.angleDeg,
    minHeadroom: item.minHeadroom,
    status: item.status
  }));

  return buildGeometryResponse(best, warnings, { alternatives });
}

export const GEOMETRY_LIMITS = LIMITS;
