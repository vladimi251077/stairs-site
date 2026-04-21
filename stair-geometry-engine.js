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

function scoreCandidate(candidate) {
  const comfortPenalty = Math.min(35, candidate.comfort.deviation * 1.4);
  const anglePenalty = candidate.angleDeg > LIMITS.angle.recommendedMax ? (candidate.angleDeg - LIMITS.angle.recommendedMax) * 4 : 0;
  const headroomPenalty = Math.max(0, LIMITS.headroom.recommendedMin - candidate.minHeadroom) * 0.06;
  const compactnessPenalty = Math.max(0, candidate.totalRun - candidate.openingLength) * 0.01;
  const winderPenalty = candidate.turnType === 'winders' ? 2 : 0;
  const score = Math.max(0, 100 - comfortPenalty - anglePenalty - headroomPenalty - compactnessPenalty - winderPenalty);
  return round(score, 1);
}

function buildPath(params, treadsPerFlight) {
  const path = [];
  const yMid = params.marchWidth / 2;
  const treadDepth = params.treadDepth;
  const lower = treadsPerFlight[0] || 0;
  const upper = treadsPerFlight[1] || 0;
  let x = 0;
  let y = yMid;

  for (let i = 0; i < lower; i += 1) {
    x += treadDepth;
    path.push({ x, y });
  }

  if (params.stairType === 'straight') return path;

  if (params.stairType.startsWith('l_turn')) {
    const cornerX = Math.max(x, params.openingLength - params.marchWidth);
    if (path.length) path[path.length - 1].x = cornerX;
    const turnCount = params.turnType === 'winders' ? 3 : 1;
    for (let i = 1; i <= turnCount; i += 1) {
      path.push({
        x: cornerX + (params.marchWidth * i) / (turnCount + 1),
        y: yMid + (params.marchWidth * i) / (turnCount + 1)
      });
    }
    y = yMid + params.marchWidth;
    for (let i = 0; i < upper; i += 1) {
      y += treadDepth;
      path.push({ x: cornerX + params.marchWidth, y });
    }
    return path;
  }

  if (params.stairType.startsWith('u_turn')) {
    const turnCount = params.turnType === 'winders' ? 3 : 1;
    const farX = Math.max(x, params.openingLength - params.marchWidth);
    if (path.length) path[path.length - 1].x = farX;
    for (let i = 1; i <= turnCount; i += 1) {
      path.push({
        x: farX + (params.marchWidth * i) / (turnCount + 1),
        y: yMid + (params.marchWidth * i) / (turnCount + 1)
      });
    }
    x = farX;
    y = yMid + params.marchWidth;
    for (let i = 0; i < upper; i += 1) {
      x -= treadDepth;
      path.push({ x, y });
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
  const candidate = {
    riserCount,
    treadCount: totalTreads,
    riserHeight: round(riserHeight),
    treadDepth: round(treadDepth),
    comfort,
    angleDeg,
    minHeadroom: round(headroom.minHeadroom),
    openingLength: input.openingLength,
    totalRun: round(totalTreads * treadDepth),
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
  };

  const limitsOk = (
    candidate.riserHeight >= LIMITS.riser.warningMin && candidate.riserHeight <= LIMITS.riser.warningMax &&
    candidate.treadDepth >= LIMITS.tread.warningMin && candidate.treadDepth <= LIMITS.tread.warningMax &&
    candidate.angleDeg <= LIMITS.angle.warningMax
  );
  if (!limitsOk) return null;

  candidate.score = scoreCandidate(candidate);
  candidate.status = classify(candidate.score, candidate.minHeadroom);
  return candidate;
}

export function calculateStairGeometryEngine(rawInput) {
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

  return {
    valid: best.status !== 'invalid',
    status: best.status,
    warnings,
    bestCandidate: best,
    alternatives: variants.slice(1, 4),
    geometrySummary: {
      riser_count: best.riserCount,
      tread_count: best.treadCount,
      riser_height: best.riserHeight,
      tread_depth: best.treadDepth,
      comfort_value: best.comfort.value,
      stair_angle_deg: best.angleDeg,
      headroom_min: best.minHeadroom,
      headroom_warning_count: best.headroomMeta.warningCount,
      headroom_critical_count: best.headroomMeta.criticalCount,
      headroom_critical_locations: best.headroomMeta.criticalLocations,
      score: best.score
    },
    visualization: best.visualization
  };
}

export const GEOMETRY_LIMITS = LIMITS;
