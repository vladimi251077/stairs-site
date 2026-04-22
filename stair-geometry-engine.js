const LIMITS = {
  riser: { recommendedMin: 150, recommendedMax: 180, warningMin: 140, warningMax: 200 },
  tread: { recommendedMin: 250, recommendedMax: 320, warningMin: 220, warningMax: 360 },
  comfort: { min: 600, max: 640, target: 620 },
  angle: { recommendedMax: 42, warningMax: 47 },
  headroom: { recommendedMin: 2000, warningMin: 1900 }
};

const round = (v, d = 1) => Number(v.toFixed(d));
const WALKLINE_OFFSET = 0.5;

function comfortOf(riser, tread) {
  const value = 2 * riser + tread;
  return { value: round(value), deviation: round(Math.abs(value - LIMITS.comfort.target), 2) };
}

function classify(score, diagnostics) {
  if (!diagnostics.fit.fits || diagnostics.angle.status === 'critical') return 'invalid';
  if (score >= 82 && diagnostics.headroom.min >= LIMITS.headroom.recommendedMin && diagnostics.comfort.status !== 'warning') return 'recommended';
  if (score >= 58) return 'warning';
  return 'invalid';
}

function getRiserCounts(height) {
  const minCount = Math.ceil(height / LIMITS.riser.recommendedMax);
  const maxCount = Math.floor(height / LIMITS.riser.recommendedMin);
  const counts = [];
  for (let i = minCount; i <= maxCount; i += 1) counts.push(i);
  return counts;
}

function polylineLength(points) {
  if (!points?.length) return 0;
  let acc = 0;
  for (let i = 1; i < points.length; i += 1) {
    acc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return round(acc, 1);
}

function boundsFromPolygons(polygons) {
  const pts = (polygons || []).flatMap((poly) => poly.points || []);
  if (!pts.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX: round(minX),
    maxX: round(maxX),
    minY: round(minY),
    maxY: round(maxY),
    width: round(Math.max(0, maxX - minX)),
    height: round(Math.max(0, maxY - minY))
  };
}

function scoreCandidate(candidate) {
  const comfortPenalty = Math.min(35, candidate.comfort.deviation * 1.6);
  const anglePenalty = candidate.angleDeg > LIMITS.angle.recommendedMax ? (candidate.angleDeg - LIMITS.angle.recommendedMax) * 4 : 0;
  const headroomPenalty = Math.max(0, LIMITS.headroom.recommendedMin - candidate.minHeadroom) * 0.08;
  const fitPenalty = candidate.diagnostics.fit.fits ? 0 : (candidate.diagnostics.fit.overflowX + candidate.diagnostics.fit.overflowY) * 0.04;
  const score = Math.max(0, 100 - comfortPenalty - anglePenalty - headroomPenalty - fitPenalty);
  return round(score, 1);
}

function makeRect(x1, y1, x2, y2, type = 'flight') {
  return {
    type,
    points: [
      { x: round(Math.min(x1, x2)), y: round(Math.min(y1, y2)) },
      { x: round(Math.max(x1, x2)), y: round(Math.min(y1, y2)) },
      { x: round(Math.max(x1, x2)), y: round(Math.max(y1, y2)) },
      { x: round(Math.min(x1, x2)), y: round(Math.max(y1, y2)) }
    ]
  };
}

function walklineAlongFlight(start, dir, steps, treadDepth, offsetFromLeft, turnDirection) {
  const dirVec = dir === 'x+' ? { x: 1, y: 0 } : dir === 'x-' ? { x: -1, y: 0 } : dir === 'y+' ? { x: 0, y: 1 } : { x: 0, y: -1 };
  const normal = dir === 'x+' || dir === 'x-' ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    points.push({
      x: round(start.x + dirVec.x * treadDepth * i + normal.x * offsetFromLeft),
      y: round(start.y + dirVec.y * treadDepth * i + normal.y * offsetFromLeft)
    });
  }
  return points;
}

function splitRisers(totalRisers, stairType, splitRatio = 0.5, turnRisers = 0) {
  if (stairType === 'straight') {
    return { lowerRisers: totalRisers, upperRisers: 0, turnRisers: 0 };
  }
  const flightRisers = totalRisers - turnRisers;
  if (flightRisers < 6) return null;
  const lowerRisers = Math.max(3, Math.round(flightRisers * splitRatio));
  const upperRisers = flightRisers - lowerRisers;
  if (upperRisers < 3) return null;
  return { lowerRisers, upperRisers, turnRisers };
}

function buildStraightCandidate(input, riserCount) {
  const riserHeight = input.floorHeight / riserCount;
  const treadCount = Math.max(1, riserCount - 1);
  const treadDepth = input.openingLength / treadCount;
  if (treadDepth < LIMITS.tread.warningMin || treadDepth > LIMITS.tread.warningMax) return null;

  const y0 = input.openingWidth / 2 - input.marchWidth / 2;
  const y1 = y0 + input.marchWidth;
  const run = treadDepth * treadCount;
  const flights = [{ name: 'lower', risers: riserCount, treads: treadCount, run: round(run), direction: 'x+' }];
  const footprintPolygons = [makeRect(0, y0, run, y1, 'flight')];
  const walkline = walklineAlongFlight({ x: 0, y: y0 }, 'x+', treadCount, treadDepth, input.marchWidth * WALKLINE_OFFSET, input.turnDirection);
  const elevationProfile = [{ type: 'flight', steps: treadCount, stepRun: treadDepth, length: run, riserHeight, startHeight: 0 }];

  return {
    stairType: 'straight',
    riserCount,
    treadCount,
    riserHeight: round(riserHeight),
    treadDepth: round(treadDepth),
    turnType: null,
    flights,
    walkline,
    footprintPolygons,
    elevationProfile,
    landing: null,
    winders: null
  };
}

function buildLTurnLandingCandidate(input, riserCount, splitRatio) {
  const split = splitRisers(riserCount, 'l_turn_landing', splitRatio, 1);
  if (!split) return null;
  const { lowerRisers, upperRisers } = split;
  const treadsLower = lowerRisers;
  const treadsUpper = Math.max(upperRisers - 1, 1);
  const turnBlock = input.marchWidth;
  const runX = Math.max(1, input.openingLength - turnBlock);
  const runY = Math.max(1, input.openingWidth - input.marchWidth);
  const treadDepth = Math.min(runX / treadsLower, runY / treadsUpper);
  if (treadDepth < LIMITS.tread.warningMin || treadDepth > LIMITS.tread.warningMax) return null;

  const riserHeight = input.floorHeight / riserCount;
  const sign = input.turnDirection === 'left' ? -1 : 1;
  const yBottom = input.turnDirection === 'left' ? input.openingWidth - input.marchWidth : 0;
  const yTop = yBottom + input.marchWidth;
  const xTurn = treadsLower * treadDepth;
  const yTurnStart = yBottom;
  const yTurnEnd = yBottom + sign * input.marchWidth;

  const flights = [
    { name: 'lower', risers: lowerRisers, treads: treadsLower, run: round(treadsLower * treadDepth), direction: 'x+' },
    { name: 'upper', risers: upperRisers, treads: treadsUpper, run: round(treadsUpper * treadDepth), direction: sign > 0 ? 'y+' : 'y-' }
  ];

  const lowerRect = makeRect(0, yBottom, xTurn, yTop, 'flight');
  const landingRect = makeRect(xTurn, yBottom, xTurn + input.marchWidth, yTop, 'landing');
  const upperRect = sign > 0
    ? makeRect(xTurn, yTop, xTurn + input.marchWidth, yTop + treadsUpper * treadDepth, 'flight')
    : makeRect(xTurn, yBottom - treadsUpper * treadDepth, xTurn + input.marchWidth, yBottom, 'flight');

  const lowerWalk = walklineAlongFlight({ x: 0, y: yBottom }, 'x+', treadsLower, treadDepth, input.marchWidth * WALKLINE_OFFSET, input.turnDirection);
  const landingWalk = [
    lowerWalk[lowerWalk.length - 1],
    { x: round(xTurn + input.marchWidth * WALKLINE_OFFSET), y: round(yTurnStart + input.marchWidth * WALKLINE_OFFSET * sign) }
  ];
  const upperStart = landingWalk[landingWalk.length - 1];
  const upperWalk = walklineAlongFlight(upperStart, sign > 0 ? 'y+' : 'y-', treadsUpper, treadDepth, 0, input.turnDirection);

  const lowerLen = treadsLower * treadDepth;
  const landingLen = input.marchWidth;
  const upperLen = treadsUpper * treadDepth;

  return {
    stairType: 'l_turn_landing',
    riserCount,
    treadCount: treadsLower + treadsUpper,
    riserHeight: round(riserHeight),
    treadDepth: round(treadDepth),
    turnType: 'landing',
    flights,
    landing: { length: input.marchWidth, width: input.marchWidth, risers: 1 },
    winders: null,
    walkline: [...lowerWalk, ...landingWalk.slice(1), ...upperWalk.slice(1)],
    footprintPolygons: [lowerRect, landingRect, upperRect],
    elevationProfile: [
      { type: 'flight', steps: treadsLower, stepRun: treadDepth, length: lowerLen, riserHeight, startHeight: 0 },
      { type: 'landing', steps: 0, stepRun: 0, length: landingLen, riserHeight, startHeight: lowerRisers * riserHeight },
      { type: 'flight', steps: treadsUpper, stepRun: treadDepth, length: upperLen, riserHeight, startHeight: (lowerRisers + 1) * riserHeight }
    ]
  };
}

function buildUTurnLandingCandidate(input, riserCount, splitRatio) {
  const split = splitRisers(riserCount, 'u_turn_landing', splitRatio, 1);
  if (!split) return null;
  const { lowerRisers, upperRisers } = split;
  const treadsLower = lowerRisers;
  const treadsUpper = Math.max(upperRisers - 1, 1);
  const runAvailable = Math.max(1, input.openingLength - input.marchWidth);
  const treadDepth = runAvailable / Math.max(treadsLower, treadsUpper);
  if (treadDepth < LIMITS.tread.warningMin || treadDepth > LIMITS.tread.warningMax) return null;

  const riserHeight = input.floorHeight / riserCount;
  const stackHeight = input.marchWidth * 2;
  const yBase = input.turnDirection === 'left' ? 0 : Math.max(0, input.openingWidth - stackHeight);
  const yLower0 = yBase;
  const yLower1 = yBase + input.marchWidth;
  const yUpper0 = yBase + input.marchWidth;
  const yUpper1 = yBase + stackHeight;
  const lowerRun = treadsLower * treadDepth;
  const upperRun = treadsUpper * treadDepth;
  const turnX = lowerRun;

  const flights = [
    { name: 'lower', risers: lowerRisers, treads: treadsLower, run: round(lowerRun), direction: 'x+' },
    { name: 'upper', risers: upperRisers, treads: treadsUpper, run: round(upperRun), direction: 'x-' }
  ];

  const lowerRect = makeRect(0, yLower0, lowerRun, yLower1, 'flight');
  const landingRect = makeRect(turnX, yLower0, turnX + input.marchWidth, yUpper1, 'landing');
  const upperRect = makeRect(turnX - upperRun + input.marchWidth, yUpper0, turnX + input.marchWidth, yUpper1, 'flight');

  const lowerWalk = walklineAlongFlight({ x: 0, y: yLower0 }, 'x+', treadsLower, treadDepth, input.marchWidth * WALKLINE_OFFSET, input.turnDirection);
  const landingWalk = [
    lowerWalk[lowerWalk.length - 1],
    { x: round(turnX + input.marchWidth * WALKLINE_OFFSET), y: round(yUpper0 + input.marchWidth * WALKLINE_OFFSET) }
  ];
  const upperWalk = walklineAlongFlight(landingWalk[landingWalk.length - 1], 'x-', treadsUpper, treadDepth, 0, input.turnDirection);

  return {
    stairType: 'u_turn_landing',
    riserCount,
    treadCount: treadsLower + treadsUpper,
    riserHeight: round(riserHeight),
    treadDepth: round(treadDepth),
    turnType: 'landing',
    flights,
    landing: { length: input.marchWidth, width: input.marchWidth * 2, risers: 1 },
    winders: null,
    walkline: [...lowerWalk, ...landingWalk.slice(1), ...upperWalk.slice(1)],
    footprintPolygons: [lowerRect, landingRect, upperRect],
    elevationProfile: [
      { type: 'flight', steps: treadsLower, stepRun: treadDepth, length: lowerRun, riserHeight, startHeight: 0 },
      { type: 'landing', steps: 0, stepRun: 0, length: input.marchWidth, riserHeight, startHeight: lowerRisers * riserHeight },
      { type: 'flight', steps: treadsUpper, stepRun: treadDepth, length: upperRun, riserHeight, startHeight: (lowerRisers + 1) * riserHeight }
    ]
  };
}

function buildLTurnWindersCandidate(input, riserCount, splitRatio) {
  const winderCount = 3;
  const split = splitRisers(riserCount, 'l_turn_winders', splitRatio, winderCount);
  if (!split) return null;
  const { lowerRisers, upperRisers } = split;
  const treadsLower = lowerRisers;
  const treadsUpper = Math.max(upperRisers - 1, 1);
  const runX = Math.max(1, input.openingLength - input.marchWidth);
  const runY = Math.max(1, input.openingWidth - input.marchWidth);
  const treadDepth = Math.min(runX / treadsLower, runY / treadsUpper);
  if (treadDepth < LIMITS.tread.warningMin || treadDepth > LIMITS.tread.warningMax) return null;
  const riserHeight = input.floorHeight / riserCount;
  const sign = input.turnDirection === 'left' ? -1 : 1;
  const yBottom = input.turnDirection === 'left' ? input.openingWidth - input.marchWidth : 0;
  const xTurn = treadsLower * treadDepth;

  const lowerRect = makeRect(0, yBottom, xTurn, yBottom + input.marchWidth, 'flight');
  const windersRect = makeRect(xTurn, yBottom, xTurn + input.marchWidth, yBottom + input.marchWidth, 'winders');
  const upperRect = sign > 0
    ? makeRect(xTurn, yBottom + input.marchWidth, xTurn + input.marchWidth, yBottom + input.marchWidth + treadsUpper * treadDepth, 'flight')
    : makeRect(xTurn, yBottom - treadsUpper * treadDepth, xTurn + input.marchWidth, yBottom, 'flight');

  const lowerWalk = walklineAlongFlight({ x: 0, y: yBottom }, 'x+', treadsLower, treadDepth, input.marchWidth * WALKLINE_OFFSET, input.turnDirection);
  const winderWalk = [
    lowerWalk[lowerWalk.length - 1],
    { x: round(xTurn + input.marchWidth * 0.34), y: round(yBottom + sign * input.marchWidth * 0.34 + input.marchWidth * WALKLINE_OFFSET) },
    { x: round(xTurn + input.marchWidth * 0.66), y: round(yBottom + sign * input.marchWidth * 0.66 + input.marchWidth * WALKLINE_OFFSET) },
    { x: round(xTurn + input.marchWidth * WALKLINE_OFFSET), y: round(yBottom + sign * input.marchWidth + input.marchWidth * WALKLINE_OFFSET) }
  ];
  const upperWalk = walklineAlongFlight(winderWalk[winderWalk.length - 1], sign > 0 ? 'y+' : 'y-', treadsUpper, treadDepth, 0, input.turnDirection);

  return {
    stairType: 'l_turn_winders',
    riserCount,
    treadCount: treadsLower + treadsUpper + winderCount,
    riserHeight: round(riserHeight),
    treadDepth: round(treadDepth),
    turnType: 'winders',
    flights: [
      { name: 'lower', risers: lowerRisers, treads: treadsLower, run: round(treadsLower * treadDepth), direction: 'x+' },
      { name: 'upper', risers: upperRisers, treads: treadsUpper, run: round(treadsUpper * treadDepth), direction: sign > 0 ? 'y+' : 'y-' }
    ],
    landing: null,
    winders: { count: winderCount },
    walkline: [...lowerWalk, ...winderWalk.slice(1), ...upperWalk.slice(1)],
    footprintPolygons: [lowerRect, windersRect, upperRect],
    elevationProfile: [
      { type: 'flight', steps: treadsLower, stepRun: treadDepth, length: treadsLower * treadDepth, riserHeight, startHeight: 0 },
      { type: 'winders', steps: winderCount, stepRun: input.marchWidth / winderCount, length: input.marchWidth, riserHeight, startHeight: lowerRisers * riserHeight },
      { type: 'flight', steps: treadsUpper, stepRun: treadDepth, length: treadsUpper * treadDepth, riserHeight, startHeight: (lowerRisers + winderCount) * riserHeight }
    ]
  };
}

function buildUTurnWindersCandidate(input, riserCount, splitRatio) {
  const winderCount = 3;
  const split = splitRisers(riserCount, 'u_turn_winders', splitRatio, winderCount);
  if (!split) return null;
  const { lowerRisers, upperRisers } = split;
  const treadsLower = lowerRisers;
  const treadsUpper = Math.max(upperRisers - 1, 1);
  const runAvailable = Math.max(1, input.openingLength - input.marchWidth);
  const treadDepth = runAvailable / Math.max(treadsLower, treadsUpper);
  if (treadDepth < LIMITS.tread.warningMin || treadDepth > LIMITS.tread.warningMax) return null;
  const riserHeight = input.floorHeight / riserCount;
  const stackHeight = input.marchWidth * 2;
  const yBase = input.turnDirection === 'left' ? 0 : Math.max(0, input.openingWidth - stackHeight);
  const lowerRun = treadsLower * treadDepth;
  const upperRun = treadsUpper * treadDepth;

  const lowerRect = makeRect(0, yBase, lowerRun, yBase + input.marchWidth, 'flight');
  const windersRect = makeRect(lowerRun, yBase, lowerRun + input.marchWidth, yBase + stackHeight, 'winders');
  const upperRect = makeRect(lowerRun - upperRun + input.marchWidth, yBase + input.marchWidth, lowerRun + input.marchWidth, yBase + stackHeight, 'flight');

  const lowerWalk = walklineAlongFlight({ x: 0, y: yBase }, 'x+', treadsLower, treadDepth, input.marchWidth * WALKLINE_OFFSET, input.turnDirection);
  const windersWalk = [
    lowerWalk[lowerWalk.length - 1],
    { x: round(lowerRun + input.marchWidth * 0.35), y: round(yBase + input.marchWidth * 0.7) },
    { x: round(lowerRun + input.marchWidth * 0.7), y: round(yBase + input.marchWidth * 1.3) },
    { x: round(lowerRun + input.marchWidth * WALKLINE_OFFSET), y: round(yBase + input.marchWidth * 1.5) }
  ];
  const upperWalk = walklineAlongFlight(windersWalk[windersWalk.length - 1], 'x-', treadsUpper, treadDepth, 0, input.turnDirection);

  return {
    stairType: 'u_turn_winders',
    riserCount,
    treadCount: treadsLower + treadsUpper + winderCount,
    riserHeight: round(riserHeight),
    treadDepth: round(treadDepth),
    turnType: 'winders',
    flights: [
      { name: 'lower', risers: lowerRisers, treads: treadsLower, run: round(lowerRun), direction: 'x+' },
      { name: 'upper', risers: upperRisers, treads: treadsUpper, run: round(upperRun), direction: 'x-' }
    ],
    landing: null,
    winders: { count: winderCount },
    walkline: [...lowerWalk, ...windersWalk.slice(1), ...upperWalk.slice(1)],
    footprintPolygons: [lowerRect, windersRect, upperRect],
    elevationProfile: [
      { type: 'flight', steps: treadsLower, stepRun: treadDepth, length: lowerRun, riserHeight, startHeight: 0 },
      { type: 'winders', steps: winderCount, stepRun: input.marchWidth / winderCount, length: input.marchWidth, riserHeight, startHeight: lowerRisers * riserHeight },
      { type: 'flight', steps: treadsUpper, stepRun: treadDepth, length: upperRun, riserHeight, startHeight: (lowerRisers + winderCount) * riserHeight }
    ]
  };
}

function heightAtDistance(profile, dist) {
  let cursor = 0;
  for (const segment of profile) {
    const segEnd = cursor + segment.length;
    if (dist <= segEnd || segment === profile[profile.length - 1]) {
      const local = Math.max(0, dist - cursor);
      if (segment.type === 'landing') return round(segment.startHeight);
      const stepRun = Math.max(1, segment.stepRun || (segment.length / Math.max(1, segment.steps)));
      const climbedSteps = Math.min(segment.steps, Math.floor((local + 1e-6) / stepRun));
      return round(segment.startHeight + climbedSteps * segment.riserHeight);
    }
    cursor = segEnd;
  }
  return 0;
}

function sampleWalkline(points, step = 80) {
  if (!points?.length) return [];
  const samples = [{ ...points[0], dist: 0 }];
  let acc = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const seg = Math.hypot(dx, dy);
    if (!seg) continue;
    const chunks = Math.max(1, Math.ceil(seg / step));
    for (let j = 1; j <= chunks; j += 1) {
      const t = j / chunks;
      samples.push({ x: round(a.x + dx * t), y: round(a.y + dy * t), dist: round(acc + seg * t) });
    }
    acc += seg;
  }
  return samples;
}

function evaluateHeadroom(input, candidate) {
  const slabUnderside = input.floorHeight - input.slabThickness - input.topFinish - input.bottomFinish;
  const openCeiling = input.floorHeight + 2600;
  const opening = input.openingLength > 0 && input.openingWidth > 0
    ? { x: 0, y: 0, length: input.openingLength, width: input.openingWidth }
    : null;

  const samples = sampleWalkline(candidate.walkline, 70).map((pt) => {
    const stepHeight = heightAtDistance(candidate.elevationProfile, pt.dist);
    const inside = !!opening &&
      pt.x >= opening.x - 1 && pt.x <= opening.x + opening.length + 1 &&
      pt.y >= opening.y - 1 && pt.y <= opening.y + opening.width + 1;
    const ceilingHeight = opening ? (inside ? openCeiling : slabUnderside) : slabUnderside;
    const clearance = round(ceilingHeight - stepHeight);
    return { ...pt, stepHeight, clearance, insideOpening: inside };
  });

  const min = samples.reduce((acc, p) => Math.min(acc, p.clearance), Number.POSITIVE_INFINITY);
  const criticalPoints = samples.filter((p) => p.clearance < LIMITS.headroom.warningMin).slice(0, 8).map((p) => ({ x: p.x, y: p.y, clearance: p.clearance, distance: p.dist }));
  const status = min < LIMITS.headroom.warningMin ? 'critical' : min < LIMITS.headroom.recommendedMin ? 'warning' : 'ok';
  return { min: Number.isFinite(min) ? round(min) : 0, status, criticalPoints, samples };
}

function evaluateFit(input, candidate, skipFit = false) {
  if (skipFit || !(input.openingLength > 0 && input.openingWidth > 0)) {
    return { fits: true, overflowX: 0, overflowY: 0, message: 'Проверка на вписываемость отключена: размеры проёма не заданы.' };
  }
  const bounds = boundsFromPolygons(candidate.footprintPolygons);
  const overflowX = round(Math.max(0, bounds.maxX - input.openingLength) + Math.max(0, -bounds.minX));
  const overflowY = round(Math.max(0, bounds.maxY - input.openingWidth) + Math.max(0, -bounds.minY));
  const fits = overflowX <= 0 && overflowY <= 0;
  const message = fits
    ? 'Лестница помещается в заданный проём.'
    : (overflowX > 0 ? `Недостаточно длины проёма на ${overflowX} мм.` : `Недостаточно ширины проёма на ${overflowY} мм.`);
  return { fits, overflowX, overflowY, message, bounds };
}

function candidateWithDiagnostics(input, candidate, mode = 'empty_opening') {
  const comfort = comfortOf(candidate.riserHeight, candidate.treadDepth);
  const angleDeg = round((Math.atan(candidate.riserHeight / Math.max(candidate.treadDepth, 1)) * 180) / Math.PI, 2);
  const headroom = evaluateHeadroom(input, candidate);
  const fit = evaluateFit(input, candidate, mode === 'ready_frame');
  const comfortStatus = comfort.value < LIMITS.comfort.min || comfort.value > LIMITS.comfort.max ? 'warning' : 'ok';
  const angleStatus = angleDeg > LIMITS.angle.warningMax ? 'critical' : angleDeg > LIMITS.angle.recommendedMax ? 'warning' : 'ok';

  const diagnostics = {
    fit,
    comfort: {
      value: comfort.value,
      status: comfortStatus,
      message: comfortStatus === 'ok' ? 'Формула 2h+b в комфортной зоне.' : 'Формула 2h+b выше или ниже комфортной зоны.'
    },
    headroom: {
      min: headroom.min,
      status: headroom.status,
      message: headroom.status === 'ok' ? 'Просвет в норме.' : headroom.status === 'warning' ? 'Есть зоны с пониженным просветом.' : 'Критичный просвет, ниже допустимого.',
      criticalPoints: headroom.criticalPoints
    },
    angle: {
      value: angleDeg,
      status: angleStatus,
      message: angleStatus === 'ok' ? 'Угол в рекомендуемой зоне.' : angleStatus === 'warning' ? 'Угол близок к верхней границе.' : 'Угол превышает допустимую границу.'
    }
  };

  const result = {
    ...candidate,
    comfort,
    angleDeg,
    minHeadroom: headroom.min,
    diagnostics,
    visualization: {
      walkline: candidate.walkline,
      planPolygons: candidate.footprintPolygons,
      elevationProfile: candidate.elevationProfile,
      walkingSamples: headroom.samples,
      opening: { length: input.openingLength || 0, width: input.openingWidth || 0 },
      dimensions: {
        openingLength: input.openingLength || 0,
        openingWidth: input.openingWidth || 0,
        marchWidth: input.marchWidth,
        floorHeight: input.floorHeight
      }
    }
  };

  const runLength = round(candidate.flights.reduce((acc, f) => acc + f.run, 0));
  const walkingLineLength = polylineLength(candidate.walkline);
  const stepHyp = Math.hypot(candidate.treadDepth, candidate.riserHeight);
  const stringerLength = round(stepHyp * candidate.treadCount);
  const railingLength = round(walkingLineLength / 1000 + 1.2, 2);
  const treadArea = round((candidate.treadCount * input.marchWidth * candidate.treadDepth) / 1_000_000, 2);
  const riserArea = round((candidate.riserCount * input.marchWidth * candidate.riserHeight) / 1_000_000, 2);
  const bounds = boundsFromPolygons(candidate.footprintPolygons);

  result.metrics = {
    run_length: runLength,
    walking_line_length: walkingLineLength,
    stringer_length: stringerLength,
    railing_length: railingLength,
    tread_area_m2: treadArea,
    riser_area_m2: riserArea,
    footprint_length: bounds.width,
    footprint_width: bounds.height
  };

  result.score = scoreCandidate(result);
  result.status = classify(result.score, diagnostics);
  return result;
}

function buildGeometryResponse(candidate, warnings = [], alternatives = [], scenarioSummary = '') {
  const headroomCriticalCount = candidate?.diagnostics?.headroom?.criticalPoints?.length || 0;
  return {
    valid: candidate.status !== 'invalid',
    status: candidate.status,
    warnings,
    bestCandidate: candidate,
    geometrySummary: {
      riser_count: candidate.riserCount,
      tread_count: candidate.treadCount,
      riser_height: candidate.riserHeight,
      tread_depth: candidate.treadDepth,
      comfort_value: candidate.comfort.value,
      stair_angle_deg: candidate.angleDeg,
      headroom_min: candidate.minHeadroom,
      headroom_critical_count: headroomCriticalCount,
      headroom_critical_locations: candidate?.diagnostics?.headroom?.criticalPoints || [],
      score: candidate.score
    },
    metrics: candidate.metrics,
    diagnostics: candidate.diagnostics,
    visualization: candidate.visualization,
    alternatives,
    scenarioSummary
  };
}

function buildByType(input, riserCount, splitRatio = 0.5) {
  switch (input.stairType) {
    case 'straight': return buildStraightCandidate(input, riserCount);
    case 'l_turn_landing': return buildLTurnLandingCandidate(input, riserCount, splitRatio);
    case 'l_turn_winders': return buildLTurnWindersCandidate(input, riserCount, splitRatio);
    case 'u_turn_landing': return buildUTurnLandingCandidate(input, riserCount, splitRatio);
    case 'u_turn_winders': return buildUTurnWindersCandidate(input, riserCount, splitRatio);
    default: return null;
  }
}

function deriveReadyProbe(stairType, stepCount, treadDepth, marchWidth, splitRatio = 0.5) {
  if (stairType === 'straight') {
    return { openingLength: treadDepth * Math.max(1, stepCount - 1), openingWidth: marchWidth };
  }
  const turnRisers = stairType.includes('winders') ? 3 : 1;
  const split = splitRisers(stepCount, stairType, splitRatio, turnRisers);
  if (!split) return { openingLength: 6000, openingWidth: 4000 };
  const treadsLower = split.lowerRisers;
  const treadsUpper = Math.max(split.upperRisers - 1, 1);
  if (stairType.startsWith('l_turn')) {
    return {
      openingLength: treadDepth * treadsLower + marchWidth,
      openingWidth: treadDepth * treadsUpper + marchWidth
    };
  }
  return {
    openingLength: treadDepth * Math.max(treadsLower, treadsUpper) + marchWidth,
    openingWidth: marchWidth * 2
  };
}

function calculateReadyFrameGeometry(rawInput) {
  const stairType = rawInput.stairType || rawInput.configurationType || 'straight';
  const stepCount = Number(rawInput.stepCount || 0);
  const riserHeightInput = Number(rawInput.riserHeight || 0);
  const treadDepthInput = Number(rawInput.treadDepth || 0);
  const marchWidth = Number(rawInput.marchWidth || 0);

  if (stepCount <= 0 || riserHeightInput <= 0 || treadDepthInput <= 0 || marchWidth <= 0) {
    return { valid: false, status: 'invalid', warnings: ['Заполните шаги, подступенок, проступь и ширину марша.'], diagnostics: null, alternatives: [] };
  }

  const floorHeight = stepCount * riserHeightInput;
  const input = {
    stairType,
    floorHeight,
    slabThickness: Number(rawInput.slabThickness || 220),
    topFinish: Number(rawInput.topFinish || 20),
    bottomFinish: Number(rawInput.bottomFinish || 20),
    openingLength: Number(rawInput.openingLength || 0),
    openingWidth: Number(rawInput.openingWidth || 0),
    marchWidth,
    turnDirection: rawInput.turnDirection || 'left'
  };

  const probe = deriveReadyProbe(stairType, stepCount, treadDepthInput, marchWidth, 0.5);
  const probeInput = {
    ...input,
    openingLength: input.openingLength || probe.openingLength,
    openingWidth: input.openingWidth || probe.openingWidth
  };
  let candidate = buildByType(probeInput, stepCount, 0.5);
  if (!candidate && stairType !== 'straight') {
    candidate = buildByType(probeInput, stepCount, 0.42) || buildByType(probeInput, stepCount, 0.58);
  }
  if (!candidate) {
    return { valid: false, status: 'invalid', warnings: ['Конфигурация не может быть проверена с указанными параметрами.'], diagnostics: null, alternatives: [] };
  }

  candidate.riserHeight = round(riserHeightInput);
  candidate.treadDepth = round(treadDepthInput);
  candidate.elevationProfile = candidate.elevationProfile.map((seg) => ({ ...seg, riserHeight: riserHeightInput, stepRun: seg.steps > 0 ? treadDepthInput : seg.stepRun, length: seg.steps > 0 ? seg.steps * treadDepthInput : seg.length }));
  candidate.flights = candidate.flights.map((f) => ({ ...f, run: round(f.treads * treadDepthInput) }));

  const checked = candidateWithDiagnostics(input, candidate, 'ready_frame');
  const warnings = [
    'Fit-check выполнен как проверка существующей лестницы по фактической геометрии.',
    checked.diagnostics.comfort.message,
    checked.diagnostics.angle.message,
    checked.diagnostics.headroom.message
  ];
  if (input.openingLength > 0 && input.openingWidth > 0) warnings.push(checked.diagnostics.fit.message);

  return buildGeometryResponse(checked, warnings.filter(Boolean), [], 'Проверена существующая геометрия без подбора новой лестницы.');
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
    return { valid: false, status: 'invalid', warnings: ['Заполните ключевые размеры проёма и высоты.'], diagnostics: null, alternatives: [] };
  }

  const splits = input.stairType === 'straight' ? [1] : [0.42, 0.5, 0.58];
  const variants = [];

  getRiserCounts(input.floorHeight).forEach((riserCount) => {
    splits.forEach((splitRatio) => {
      const base = buildByType(input, riserCount, splitRatio);
      if (!base) return;
      if (base.riserHeight < LIMITS.riser.warningMin || base.riserHeight > LIMITS.riser.warningMax) return;
      const candidate = candidateWithDiagnostics(input, base, 'empty_opening');
      if (candidate.angleDeg > LIMITS.angle.warningMax) return;
      variants.push(candidate);
    });
  });

  if (!variants.length) {
    return {
      valid: false,
      status: 'invalid',
      warnings: ['Онлайн-подбор не нашёл рабочую геометрию в заданном проёме.'],
      diagnostics: {
        fit: { fits: false, overflowX: 0, overflowY: 0, message: 'Не удалось собрать геометрию, которая помещается и проходит проверки.' },
        comfort: { status: 'warning', value: 0, message: 'Нет кандидатов в зоне комфорта.' },
        headroom: { min: 0, status: 'critical', message: 'Нет кандидатов с достаточным просветом.', criticalPoints: [] }
      },
      alternatives: []
    };
  }

  variants.sort((a, b) => b.score - a.score);
  const best = variants[0];
  const warnings = [];
  if (!best.diagnostics.fit.fits) warnings.push(best.diagnostics.fit.message);
  if (best.diagnostics.comfort.status !== 'ok') warnings.push(best.diagnostics.comfort.message);
  if (best.diagnostics.angle.status !== 'ok') warnings.push(best.diagnostics.angle.message);
  if (best.diagnostics.headroom.status !== 'ok') warnings.push(best.diagnostics.headroom.message);

  const alternatives = variants.slice(1, 4).map((item) => ({
    riserCount: item.riserCount,
    treadCount: item.treadCount,
    treadDepth: item.treadDepth,
    angleDeg: item.angleDeg,
    minHeadroom: item.minHeadroom,
    status: item.status,
    diagnostics: item.diagnostics
  }));

  return buildGeometryResponse(best, warnings, alternatives);
}

export const GEOMETRY_LIMITS = LIMITS;
