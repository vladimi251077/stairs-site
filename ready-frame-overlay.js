const $ = (id) => document.getElementById(id);

const LABELS = {
  baseSubtype: {
    existing_metal_frame: 'Готовый металлокаркас',
    existing_concrete_base: 'Готовое бетонное основание'
  },
  configuration: {
    straight: 'Прямая',
    l_shaped: 'Г-образная',
    u_shaped: 'П-образная'
  },
  turnType: {
    landing: 'Площадка',
    winders: 'Забежные'
  },
  material: {
    ash: 'Ясень',
    oak: 'Дуб',
    pine: 'Сосна',
    mdf: 'МДФ'
  },
  railing: {
    none: 'Без ограждения',
    round_tube_16mm: 'Круглые трубки 16 мм',
    mdf: 'МДФ',
    glass: 'Стекло',
    pattern_2d: '2D узор',
    custom: 'Своё / по договорённости'
  },
  profile: {
    base: 'Базовый',
    tatarstan: 'Татарстан',
    moscow: 'Москва'
  },
  scope: {
    steps_only: 'Только ступени',
    steps_risers: 'Ступени + подступенки',
    railing: 'Ограждение',
    frame_cladding: 'Обшивка каркаса',
    finish_coating: 'Финиш/покрытие',
    lighting: 'Подсветка',
    installation: 'Монтаж'
  }
};

const MATERIAL_RULES = {
  ash: { price: 9800, waste: 1.12, sheetArea: 2.2 },
  oak: { price: 12400, waste: 1.12, sheetArea: 2.2 },
  pine: { price: 6200, waste: 1.10, sheetArea: 2.2 },
  mdf: { price: 1950, waste: 1.08, sheetArea: 2.6 }
};

const RAILING_PRICES = {
  none: 0,
  round_tube_16mm: 4200,
  mdf: 4800,
  glass: 12800,
  pattern_2d: 6900,
  custom: 7900
};

const PRICE_PROFILES = {
  base: { coef: 1.0, label: 'Базовый' },
  tatarstan: { coef: 2.7, label: 'Татарстан' },
  moscow: { coef: 3.2, label: 'Москва' }
};

function isReadyFrame() {
  return $('baseCondition')?.value === 'ready_frame';
}

function showStep(stepId) {
  document.querySelectorAll('.step').forEach((el) => el.classList.remove('active'));
  $(`step${stepId}`)?.classList.add('active');
  const labels = { 1: 'Конфигурация', 2: 'Геометрия', 4: 'Материалы и стоимость' };
  const order = { 1: 1, 2: 2, 4: 3 };
  const progress = $('stepProgress');
  if (progress) progress.textContent = `Шаг ${order[stepId]} из 3 · ${labels[stepId]}`;
}

function setStatus(text) {
  const node = $('pageStatus');
  if (node) node.textContent = text || '';
}

function selectedScope() {
  return [...document.querySelectorAll('input[name="scopeWork"]:checked')].map((el) => el.value);
}

function getReadyConfig() {
  return {
    baseSubtype: $('baseSubtype')?.value || 'existing_metal_frame',
    configurationType: $('configurationType')?.value || 'straight',
    turnType: $('turnType')?.value || 'landing',
    turnDirection: $('readyTurnDirection')?.value || 'left',
    stepCount: Number($('stepCount')?.value || 0),
    marchWidth: Number($('readyMarchWidth')?.value || 0),
    riserHeight: Number($('riserHeight')?.value || 0),
    treadDepth: Number($('treadDepth')?.value || 0),
    landingLength: Number($('landingLength')?.value || 0),
    landingWidth: Number($('landingWidth')?.value || 0),
    winderCount: Number($('winderCount')?.value || 0),
    material: $('readyMaterial')?.value || 'ash',
    railingType: $('readyRailingType')?.value || 'none',
    topFloorRailingLength: Number($('topFloorRailingLength')?.value || 0),
    pricingProfile: $('pricingProfile')?.value || 'base',
    existingConditionNotes: $('existingConditionNotes')?.value?.trim() || '',
    scope: selectedScope()
  };
}

function validateReady(cfg) {
  if (cfg.stepCount <= 0) return 'Укажите количество ступеней.';
  if (cfg.marchWidth <= 0) return 'Укажите ширину марша.';
  if (cfg.riserHeight <= 0) return 'Укажите высоту подступенка.';
  if (cfg.treadDepth <= 0) return 'Укажите глубину проступи.';
  if (cfg.configurationType !== 'straight' && cfg.turnType === 'landing' && (!cfg.landingLength || !cfg.landingWidth)) {
    return 'Для площадки укажите длину и ширину.';
  }
  if (cfg.configurationType !== 'straight' && cfg.turnType === 'winders' && !cfg.winderCount) {
    return 'Для забежной схемы укажите количество забежных ступеней.';
  }
  if (!cfg.scope.length) return 'Выберите хотя бы один пункт в объёме работ.';
  return '';
}

function estimateLandingArea(cfg) {
  if (cfg.configurationType === 'straight' || cfg.turnType !== 'landing') return 0;
  return (cfg.landingLength * cfg.landingWidth) / 1000000;
}

function estimateTreadArea(cfg) {
  return (cfg.stepCount * cfg.marchWidth * cfg.treadDepth) / 1000000;
}

function estimateRiserArea(cfg) {
  return cfg.scope.includes('steps_risers') ? (cfg.stepCount * cfg.marchWidth * cfg.riserHeight) / 1000000 : 0;
}

function estimateRailingLength(cfg) {
  if (!cfg.scope.includes('railing') || cfg.railingType === 'none') return 0;
  const run = (cfg.stepCount * cfg.treadDepth) / 1000;
  if (cfg.configurationType === 'straight') return run;
  if (cfg.configurationType === 'l_shaped') return run * 1.4;
  return run * 1.65;
}

function estimateMdfSheets(cfg, totalArea) {
  if ((cfg.material === 'mdf' || cfg.scope.includes('frame_cladding')) && cfg.configurationType === 'u_shaped' && cfg.scope.includes('steps_risers')) {
    return 5;
  }
  if (cfg.material === 'mdf' || cfg.scope.includes('frame_cladding')) {
    return Math.max(1, Math.ceil((totalArea * MATERIAL_RULES.mdf.waste) / MATERIAL_RULES.mdf.sheetArea));
  }
  return 0;
}

function money(value) {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(value || 0))} ₽`;
}

function renderReadyVisuals(cfg) {
  const plan = $('geometryPlanSvg');
  const elev = $('geometryElevationSvg');
  if (!plan || !elev) return;

  const run = Math.max(1, cfg.stepCount * cfg.treadDepth);
  const width = Math.max(1, cfg.marchWidth);
  const hasTurn = cfg.configurationType !== 'straight';
  const landingLength = hasTurn && cfg.turnType === 'landing' ? Math.max(cfg.landingLength || cfg.marchWidth, cfg.marchWidth) : 0;
  const secondRun = hasTurn ? Math.max(run * (cfg.configurationType === 'l_shaped' ? 0.75 : 0.9), cfg.marchWidth) : 0;
  const maxX = Math.max(run + landingLength + secondRun, 1);
  const maxY = Math.max(width + secondRun, landingLength + width, 1);
  const px = (x) => 26 + (x / maxX) * 488;
  const py = (y) => 26 + (y / maxY) * 188;

  let shapes = `<rect x="${px(0)}" y="${py(0)}" width="${(run / maxX) * 488}" height="${(width / maxY) * 188}" fill="rgba(221,183,134,.18)" stroke="#ddb786"/>`;
  let walk = `0,${width / 2} ${run},${width / 2}`;

  if (hasTurn && cfg.turnType === 'landing') {
    shapes += `<rect x="${px(run)}" y="${py(0)}" width="${(landingLength / maxX) * 488}" height="${(width / maxY) * 188}" fill="rgba(133,202,255,.22)" stroke="#85caff"/>`;
    if (cfg.configurationType === 'l_shaped') {
      shapes += `<rect x="${px(run)}" y="${py(width)}" width="${(cfg.marchWidth / maxX) * 488}" height="${(secondRun / maxY) * 188}" fill="rgba(221,183,134,.18)" stroke="#ddb786"/>`;
      walk += ` ${run + cfg.marchWidth / 2},${width / 2} ${run + cfg.marchWidth / 2},${width + secondRun}`;
    } else {
      shapes += `<rect x="${px(run + landingLength)}" y="${py(0)}" width="${(secondRun / maxX) * 488}" height="${(width / maxY) * 188}" fill="rgba(221,183,134,.18)" stroke="#ddb786"/>`;
      walk += ` ${run + landingLength},${width / 2} ${run + landingLength + secondRun},${width / 2}`;
    }
  } else if (hasTurn) {
    shapes += `<rect x="${px(run)}" y="${py(0)}" width="${(cfg.marchWidth / maxX) * 488}" height="${(cfg.marchWidth / maxY) * 188}" fill="rgba(191,153,255,.2)" stroke="#bf99ff"/>`;
    if (cfg.configurationType === 'l_shaped') {
      shapes += `<rect x="${px(run)}" y="${py(width)}" width="${(cfg.marchWidth / maxX) * 488}" height="${(secondRun / maxY) * 188}" fill="rgba(221,183,134,.18)" stroke="#ddb786"/>`;
      walk += ` ${run + cfg.marchWidth / 2},${width / 2} ${run + cfg.marchWidth / 2},${width + secondRun}`;
    } else {
      shapes += `<rect x="${px(run + cfg.marchWidth)}" y="${py(0)}" width="${(secondRun / maxX) * 488}" height="${(width / maxY) * 188}" fill="rgba(221,183,134,.18)" stroke="#ddb786"/>`;
      walk += ` ${run + cfg.marchWidth},${width / 2} ${run + cfg.marchWidth + secondRun},${width / 2}`;
    }
  }

  const walkPts = walk.split(' ').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return `${px(x)},${py(y)}`;
  }).join(' ');

  plan.innerHTML = `<svg viewBox="0 0 540 240" class="geo-svg"><rect x="26" y="26" width="488" height="188" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.2)"/>${shapes}<polyline points="${walkPts}" fill="none" stroke="#ffdfad" stroke-width="2.4" stroke-dasharray="5 4"/></svg>`;

  const totalHeight = Math.max(cfg.stepCount * cfg.riserHeight, 1);
  const stepW = 488 / Math.max(cfg.stepCount, 1);
  const stairs = Array.from({ length: Math.max(cfg.stepCount, 1) }).map((_, i) => {
    const x = 26 + i * stepW;
    const y = 214 - (((i + 1) * cfg.riserHeight) / totalHeight) * 176;
    return `<path d="M${x} 214 L${x} ${y} L${x + stepW} ${y}" stroke="#ddb786" fill="none" stroke-width="2"/>`;
  }).join('');
  elev.innerHTML = `<svg viewBox="0 0 540 240" class="geo-svg"><rect x="26" y="26" width="488" height="188" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.2)"/>${stairs}</svg>`;
}

function renderReadyGeometry(cfg) {
  const error = validateReady(cfg);
  if (error) {
    setStatus(error);
    $('geometryResult').innerHTML = `<div class="warning-block invalid"><div class="warning-text">${error}</div></div>`;
    $('geometryWarnings').innerHTML = '';
    showStep(2);
    return false;
  }

  const comfort = 2 * cfg.riserHeight + cfg.treadDepth;
  const angle = Math.round((Math.atan2(cfg.riserHeight, cfg.treadDepth) * 180 / Math.PI) * 10) / 10;
  const rows = [
    ['Сценарий', 'Готовый каркас'],
    ['Тип основания', LABELS.baseSubtype[cfg.baseSubtype] || cfg.baseSubtype],
    ['Конфигурация', LABELS.configuration[cfg.configurationType] || cfg.configurationType],
    ['Тип поворота', cfg.configurationType === 'straight' ? 'Не требуется' : LABELS.turnType[cfg.turnType]],
    ['Направление поворота', cfg.configurationType === 'straight' ? 'Не требуется' : (cfg.turnDirection === 'left' ? 'Левый' : 'Правый')],
    ['Количество ступеней', cfg.stepCount],
    ['Высота подступенка', `${cfg.riserHeight} мм`],
    ['Глубина проступи', `${cfg.treadDepth} мм`],
    ['Формула 2h+b', `${comfort} мм`],
    ['Угол', `${angle}°`],
    ['Материал', LABELS.material[cfg.material] || cfg.material],
    ['Ограждение', LABELS.railing[cfg.railingType] || cfg.railingType],
    ['Ценовой профиль', LABELS.profile[cfg.pricingProfile] || cfg.pricingProfile]
  ];
  $('geometryResult').innerHTML = `<table class="result-table"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;
  $('geometryWarnings').innerHTML = [
    'Предварительная схема и стоимость рассчитаны по удалённым размерам существующего основания.',
    'Финальный расход материалов и смета уточняются после замера Tekstura.',
    comfort < 580 || comfort > 660 ? 'Геометрию по удалённому замеру лучше подтвердить инженером на объекте.' : 'Геометрия выглядит рабочей для предварительной оценки.'
  ].map((text) => `<div class="warning-block"><div class="warning-text">${text}</div></div>`).join('');
  $('geometryAlternatives').innerHTML = '<div class="muted">Для готового основания на этом шаге показываем предварительную схему без блокирующего fit-check.</div>';
  $('geometryFallbackCta').hidden = true;
  renderReadyVisuals(cfg);
  showStep(2);
  setStatus('Предварительная схема обновлена');
  return true;
}

function buildReadyEstimate(cfg) {
  const treadArea = estimateTreadArea(cfg);
  const landingArea = estimateLandingArea(cfg);
  const riserArea = estimateRiserArea(cfg);
  const totalArea = treadArea + landingArea + riserArea;
  const stairRailingLength = estimateRailingLength(cfg);
  const totalRailingLength = stairRailingLength + cfg.topFloorRailingLength;
  const sheets = estimateMdfSheets(cfg, totalArea);
  const materialRule = MATERIAL_RULES[cfg.material];
  const profile = PRICE_PROFILES[cfg.pricingProfile] || PRICE_PROFILES.base;

  const woodCost = cfg.material === 'mdf'
    ? sheets * MATERIAL_RULES.mdf.price
    : totalArea * materialRule.price * materialRule.waste;
  const riserCost = cfg.material === 'mdf' ? 0 : riserArea * materialRule.price * 0.45;
  const railingCost = totalRailingLength * (RAILING_PRICES[cfg.railingType] || 0);
  const frameCladdingCost = cfg.scope.includes('frame_cladding') ? sheets * MATERIAL_RULES.mdf.price : 0;
  const finishCost = cfg.scope.includes('finish_coating') ? woodCost * 0.18 : 0;
  const lightingCost = cfg.scope.includes('lighting') ? cfg.stepCount * 850 : 0;
  const installationCost = cfg.scope.includes('installation') ? 18000 + cfg.stepCount * 1400 : 0;
  const subtotal = woodCost + riserCost + railingCost + frameCladdingCost + finishCost + lightingCost + installationCost;
  const total = subtotal * profile.coef;

  return {
    treadArea,
    landingArea,
    riserArea,
    totalArea,
    stairRailingLength,
    totalRailingLength,
    sheets,
    woodCost,
    riserCost,
    railingCost,
    frameCladdingCost,
    finishCost,
    lightingCost,
    installationCost,
    subtotal,
    total,
    min: total * 0.92,
    max: total * 1.12,
    profile
  };
}

function buildPayload(cfg, estimate) {
  return {
    base_condition: 'ready_frame',
    base_subtype: cfg.baseSubtype,
    configuration_type: cfg.configurationType,
    turn_type: cfg.turnType,
    turn_direction: cfg.turnDirection,
    step_count: cfg.stepCount,
    riser_height: cfg.riserHeight,
    tread_depth: cfg.treadDepth,
    march_width: cfg.marchWidth,
    landing_length: cfg.landingLength,
    landing_width: cfg.landingWidth,
    winder_count: cfg.winderCount,
    top_floor_railing_length: cfg.topFloorRailingLength,
    pricing_profile: cfg.pricingProfile,
    materialsSummary: {
      material: LABELS.material[cfg.material],
      railing: LABELS.railing[cfg.railingType],
      profile: LABELS.profile[cfg.pricingProfile],
      scope: cfg.scope.map((x) => LABELS.scope[x] || x)
    },
    estimate: {
      tread_area_m2: Number(estimate.treadArea.toFixed(2)),
      landing_area_m2: Number(estimate.landingArea.toFixed(2)),
      riser_area_m2: Number(estimate.riserArea.toFixed(2)),
      total_area_m2: Number(estimate.totalArea.toFixed(2)),
      stair_railing_length_m: Number(estimate.stairRailingLength.toFixed(2)),
      total_railing_length_m: Number(estimate.totalRailingLength.toFixed(2)),
      mdf_sheets: estimate.sheets
    },
    total: Math.round(estimate.total),
    scenario_summary: 'Предварительная калькуляция по существующему основанию. Финальный расход подтверждается после замера Tekstura.'
  };
}

function renderReadyEstimate(cfg) {
  if (!renderReadyGeometry(cfg)) return;
  const estimate = buildReadyEstimate(cfg);
  $('materialsResult').innerHTML = `<table class="result-table"><tbody>${[
    ['Материал ступеней / площадки', LABELS.material[cfg.material]],
    ['Тип ограждения', LABELS.railing[cfg.railingType]],
    ['Ценовой профиль', LABELS.profile[cfg.pricingProfile]],
    ['Площадь ступеней', `${estimate.treadArea.toFixed(2)} м²`],
    ['Площадь площадки', `${estimate.landingArea.toFixed(2)} м²`],
    ['Площадь подступенков', `${estimate.riserArea.toFixed(2)} м²`],
    ['Суммарная площадь отделки', `${estimate.totalArea.toFixed(2)} м²`],
    ['Длина ограждения по лестнице', `${estimate.stairRailingLength.toFixed(2)} м`],
    ['Прямое ограждение верхнего этажа', `${cfg.topFloorRailingLength.toFixed(2)} м`],
    ['Итоговая длина ограждения', `${estimate.totalRailingLength.toFixed(2)} м`],
    ['Оценка листов МДФ', estimate.sheets ? `${estimate.sheets} шт` : 'Не требуется']
  ].map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;

  $('priceResult').innerHTML = `<div class="price-main">${money(estimate.total)}</div>
    <div class="muted">Диапазон: ${money(estimate.min)} — ${money(estimate.max)}</div>
    <table class="result-table"><tbody>
      <tr><th>Ступени и площадка</th><td>${money(estimate.woodCost)}</td></tr>
      <tr><th>Подступенки</th><td>${money(estimate.riserCost)}</td></tr>
      <tr><th>Ограждение (${estimate.totalRailingLength.toFixed(2)} м)</th><td>${money(estimate.railingCost)}</td></tr>
      <tr><th>Обшивка / МДФ</th><td>${money(estimate.frameCladdingCost)}</td></tr>
      <tr><th>Финиш</th><td>${money(estimate.finishCost)}</td></tr>
      <tr><th>Подсветка</th><td>${money(estimate.lightingCost)}</td></tr>
      <tr><th>Монтаж</th><td>${money(estimate.installationCost)}</td></tr>
      <tr><th>Профиль / регион</th><td>${estimate.profile.label} × ${estimate.profile.coef}</td></tr>
    </tbody></table>`;

  const payload = buildPayload(cfg, estimate);
  try {
    sessionStorage.setItem('tekstura_calc_payload', encodeURIComponent(JSON.stringify(payload)));
  } catch {}
  const requestBtn = $('requestBtn');
  if (requestBtn) requestBtn.href = `/request.html?calc=${encodeURIComponent(JSON.stringify(payload))}`;
  showStep(4);
  setStatus('Предварительная калькуляция ready_frame обновлена');
}

function attachReadyFrameInterceptors() {
  const geometryBtn = $('toResultsBtn');
  const calcBtn = $('calculateBtn');
  if (geometryBtn) {
    geometryBtn.addEventListener('click', (event) => {
      if (!isReadyFrame()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      renderReadyGeometry(getReadyConfig());
    }, true);
  }
  if (calcBtn) {
    calcBtn.addEventListener('click', (event) => {
      if (!isReadyFrame()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      renderReadyEstimate(getReadyConfig());
    }, true);
  }
}

attachReadyFrameInterceptors();
