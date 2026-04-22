import { GEOMETRY_LIMITS, calculateStairGeometryEngine } from './stair-geometry-engine.js';
import { calculateMetalMaterials, calculateWoodMaterials, calculateConcreteMaterials } from './stair-materials.js';

const state = { geometry: null, materials: null, price: null, lastConfig: null, dictionaries: { defaults: { labor_rate_per_step: 2500, metal_rate_per_meter: 1800, wood_rate_per_m2: 16000, concrete_rate_per_m3: 14000, install_coef: 1.12, markup_coef: 1.08, delivery_rate_per_km: 110, installation_base: 18000 }, materialRules: [] } } };

const LABELS = {
  base_condition: { empty_opening: 'Пустой проём', ready_frame: 'Готовый каркас' },
  base_subtype: { existing_metal_frame: 'Готовый металлокаркас', existing_concrete_base: 'Готовое бетонное основание' },
  stair_type: { straight: 'Прямая', l_turn_landing: 'Г-образная с площадкой', l_turn_winders: 'Г-образная с забежными', u_turn_landing: 'П-образная с площадкой', u_turn_winders: 'П-образная с забежными' },
  configuration_type: { straight: 'Прямая', l_shaped: 'Г-образная', u_shaped: 'П-образная' },
  turn_type: { landing: 'Площадка', winders: 'Забежные' },
  frame_material: { metal: 'Металлокаркас', concrete: 'Бетонный каркас', wood: 'Деревянный каркас' },
  cladding: { none: 'Без облицовки', standard: 'Стандартная облицовка', premium: 'Премиальная облицовка' },
  railing: { none: 'Без ограждения', metal: 'Металлическое ограждение', glass: 'Стеклянное ограждение', wood: 'Деревянное ограждение' },
  finish_level: { basic: 'Базовый', standard: 'Стандарт', premium: 'Премиум' }
};
const EXTRA_LABELS = { lighting: 'Подсветка ступеней', painted_metal: 'Окраска металла', premium_coating: 'Премиум-покрытие', hidden_fasteners: 'Скрытый крепёж' };
const SCOPE_LABELS = {
  steps_only: 'Только ступени',
  steps_risers: 'Ступени + подступенки',
  railing: 'Ограждение',
  frame_cladding: 'Обшивка каркаса',
  finish_coating: 'Финиш/покрытие',
  lighting: 'Подсветка',
  installation: 'Монтаж'
};
const STAIR_TYPE_HINTS = {
  straight: { title: 'Прямая лестница', text: 'Подходит для длинных проёмов без поворотов.', invalidAdvice: 'Увеличьте длину проёма или рассмотрите поворотную схему.' },
  l_turn_landing: { title: 'Г-образная с площадкой', text: 'Плавный поворот 90° с площадкой.', invalidAdvice: 'Проверьте длину/ширину проёма в зоне поворота.' },
  l_turn_winders: { title: 'Г-образная с забежными', text: 'Компактный поворот для ограниченного пространства.', invalidAdvice: 'Чаще всего помогает увеличение ширины проёма.' },
  u_turn_landing: { title: 'П-образная с площадкой', text: 'Разворот на 180° с площадкой.', invalidAdvice: 'Нужна достаточная ширина под два марша.' },
  u_turn_winders: { title: 'П-образная с забежными', text: 'Компактный разворот 180°.', invalidAdvice: 'Для комфорта критична проверка по линии хода.' }
};

const $ = (id) => document.getElementById(id);
let currentStep = 1;

function getAvailableSteps() { return [...document.querySelectorAll('.step')].map((n) => Number((n.id || '').replace('step', ''))).filter(Number.isFinite).sort((a, b) => a - b); }
function showStep(step) { const available = getAvailableSteps(); const target = available.includes(step) ? step : (available[0] || 1); document.querySelectorAll('.step').forEach((n) => n.classList.remove('active')); $(`step${target}`)?.classList.add('active'); currentStep = target; const progress = $('stepProgress'); if (progress) { const labels = { 1: 'Конфигурация', 2: 'Геометрия', 4: 'Материалы и стоимость' }; const order = { 1: 1, 2: 2, 4: 3 }; progress.textContent = `Шаг ${order[target] || 1} из 3 · ${labels[target] || 'Конфигурация'}`; } }
window.prevStep = () => { const prev = [...getAvailableSteps()].reverse().find((s) => s < currentStep); if (prev) showStep(prev); };
function setStatus(message = '') { const n = $('pageStatus'); if (n) n.textContent = message; }
function setProceedAvailability(canProceed) { const btn = $('calculateBtn'); if (!btn) return; btn.disabled = !canProceed; btn.setAttribute('aria-disabled', String(!canProceed)); }

function bindVisualSelectors() {
  document.querySelectorAll('.visual-choice').forEach((group) => {
    const cards = [...group.querySelectorAll('.visual-card')];
    const hiddenInput = $(group.dataset.target);
    const apply = (card) => { if (!card || !hiddenInput) return; hiddenInput.value = card.dataset.value; cards.forEach((c) => c.classList.toggle('selected', c === card)); hiddenInput.dispatchEvent(new Event('change')); };
    group.addEventListener('click', (e) => { const card = e.target.closest('.visual-card'); if (card) apply(card); });
  });
}

function toggleTurnFields() {
  const stairType = $('stairType')?.value || 'straight';
  const base = $('baseCondition')?.value || 'empty_opening';
  const field = $('turnDirectionField');
  const input = $('turnDirection');
  if (!field || !input) return;
  const show = stairType !== 'straight' && base === 'empty_opening';
  field.classList.toggle('hidden', !show);
  input.disabled = !show;
}
function toggleReadyFlowFields() {
  const configuration = $('configurationType')?.value || 'straight';
  const turnType = $('turnType')?.value || 'landing';
  const showTurn = configuration !== 'straight';
  $('turnTypeField')?.classList.toggle('hidden', !showTurn);
  $('readyTurnDirectionField')?.classList.toggle('hidden', !showTurn);
  const showLanding = showTurn && turnType === 'landing';
  const showWinders = showTurn && turnType === 'winders';
  $('landingLengthField')?.classList.toggle('hidden', !showLanding);
  $('landingWidthField')?.classList.toggle('hidden', !showLanding);
  $('winderCountField')?.classList.toggle('hidden', !showWinders);
}
function setSectionEnabled(sectionId, enabled) {
  const root = $(sectionId);
  if (!root) return;
  root.querySelectorAll('input, select, textarea, button').forEach((el) => {
    if (el.id === 'calculateBtn' || el.id === 'toResultsBtn') return;
    el.disabled = !enabled;
  });
}
function toggleScenarioFields() {
  const base = $('baseCondition')?.value || 'empty_opening';
  const empty = base === 'empty_opening';
  $('baseSubtypeField')?.classList.toggle('hidden', empty);
  $('readyFlowFields')?.classList.toggle('hidden', empty);
  $('emptyStairTypeField')?.classList.toggle('hidden', !empty);
  $('emptyOpeningGrid')?.classList.toggle('hidden', !empty);
  $('frameMaterialField')?.classList.toggle('hidden', !empty);
  $('finishGrid')?.classList.toggle('hidden', !empty);
  setSectionEnabled('readyFlowFields', !empty);
  setSectionEnabled('emptyOpeningGrid', empty);
  setSectionEnabled('frameMaterialField', empty);
  setSectionEnabled('finishGrid', empty);
  toggleReadyFlowFields();
}

function getEffectiveStairType(config = null) {
  const source = config || getConfigFromForm();
  if (source.base_condition === 'ready_frame') {
    const cfg = source.configuration_type || 'straight';
    const turn = source.turn_type || 'landing';
    if (cfg === 'straight') return 'straight';
    if (cfg === 'l_shaped') return turn === 'winders' ? 'l_turn_winders' : 'l_turn_landing';
    if (cfg === 'u_shaped') return turn === 'winders' ? 'u_turn_winders' : 'u_turn_landing';
  }
  return source.stair_type || 'straight';
}

function renderStairTypeHint(target, stairType, geometry) { if (!target) return; const hint = STAIR_TYPE_HINTS[stairType] || STAIR_TYPE_HINTS.straight; const invalidHelp = geometry && !geometry.valid ? `<div class="stair-type-hint-invalid">${hint.invalidAdvice}</div>` : ''; target.innerHTML = `<div class="stair-type-hint-card"><div class="stair-type-hint-label">Подсказка по проёму</div><h3>${hint.title}</h3><p>${hint.text}</p>${invalidHelp}</div>`; }
function updateStairTypeHints(geometry = null, config = null) {
  const stairType = getEffectiveStairType(config);
  renderStairTypeHint($('stairTypeHint'), stairType, geometry);
  renderStairTypeHint($('geometryTypeHint'), stairType, geometry);
}

function getConfigFromForm() {
  const baseCondition = $('baseCondition')?.value || 'empty_opening';
  const readyFlow = baseCondition === 'ready_frame';
  const scope_of_work = [...document.querySelectorAll('input[name="scopeWork"]:checked')].map((x) => x.value);
  const stairTypeFromReady = (() => {
    const cfg = $('configurationType')?.value || 'straight';
    const turn = $('turnType')?.value || 'landing';
    if (cfg === 'straight') return 'straight';
    if (cfg === 'l_shaped') return turn === 'winders' ? 'l_turn_winders' : 'l_turn_landing';
    if (cfg === 'u_shaped') return turn === 'winders' ? 'u_turn_winders' : 'u_turn_landing';
    return 'straight';
  })();
  return {
    base_condition: baseCondition,
    base_subtype: $('baseSubtype')?.value || 'existing_metal_frame',
    stair_type: readyFlow ? stairTypeFromReady : ($('stairType')?.value || 'straight'),
    configuration_type: $('configurationType')?.value || 'straight',
    turn_type: $('turnType')?.value || 'landing',
    turn_direction: baseCondition === 'empty_opening' ? ($('turnDirection')?.value || 'left') : ($('readyTurnDirection')?.value || 'left'),
    floor_to_floor_height: Number($('floorHeight')?.value || 0), slab_thickness: Number($('slabThickness')?.value || 220), top_finish_thickness: Number($('topFinishThickness')?.value || 20), bottom_finish_thickness: Number($('bottomFinishThickness')?.value || 20),
    opening_length: Number($('openingLength')?.value || 0), opening_width: Number($('openingWidth')?.value || 0), march_width: Number($('marchWidth')?.value || 0),
    step_count: Number($('stepCount')?.value || 0),
    riser_height: Number($('riserHeight')?.value || 0),
    tread_depth: Number($('treadDepth')?.value || 0),
    ready_march_width: Number($('readyMarchWidth')?.value || 0),
    landing_length: Number($('landingLength')?.value || 0),
    landing_width: Number($('landingWidth')?.value || 0),
    winder_count: Number($('winderCount')?.value || 0),
    frame_material: $('frameMaterial')?.value || 'metal', finish_level: $('finishLevel')?.value || 'basic', cladding: $('claddingType')?.value || 'standard', railing: $('railingType')?.value || 'metal',
    delivery_distance: Number($('deliveryDistance')?.value || 20), existing_condition_notes: $('existingConditionNotes')?.value?.trim() || '',
    scope_of_work: readyFlow ? scope_of_work : [],
    extras: readyFlow ? [] : [...document.querySelectorAll('input[name="extras"]:checked')].map((x) => x.value)
  };
}

function validateBase(config) {
  if (config.base_condition === 'ready_frame') {
    if (config.step_count <= 0) return 'Укажите количество ступеней для существующего основания.';
    if (config.ready_march_width <= 0) return 'Укажите ширину марша для существующего основания.';
    if (config.riser_height <= 0) return 'Поле "Высота подступенка" обязательно.';
    if (config.tread_depth <= 0) return 'Укажите глубину проступи.';
    if (config.configuration_type !== 'straight' && config.turn_type === 'landing' && (config.landing_length <= 0 || config.landing_width <= 0)) return 'Для площадки укажите длину и ширину площадки.';
    if (config.configuration_type !== 'straight' && config.turn_type === 'winders' && config.winder_count <= 0) return 'Для забежной схемы укажите количество забежных ступеней.';
    if (!config.scope_of_work.length) return 'Выберите хотя бы один пункт в объёме работ.';
    return null;
  }
  if (config.floor_to_floor_height <= 0) return 'Укажите корректную высоту этаж-этаж.';
  if (config.opening_length <= 0) return 'Укажите корректную длину проёма.';
  if (config.opening_width <= 0) return 'Укажите корректную ширину проёма.';
  if (config.march_width <= 0) return 'Укажите корректную ширину марша.';
  return null;
}

function calculateGeometry(config) {
  const err = validateBase(config);
  if (err) return { valid: false, status: 'invalid', warnings: [err], geometrySummary: null, visualization: null, alternatives: [] };

  if (config.base_condition === 'ready_frame') {
    return calculateStairGeometryEngine({
      mode: 'ready_frame',
      stairType: config.stair_type,
      turnType: config.turn_type,
      turnDirection: config.turn_direction,
      stepCount: config.step_count,
      riserHeight: config.riser_height,
      treadDepth: config.tread_depth,
      marchWidth: config.ready_march_width,
      landingLength: config.landing_length,
      landingWidth: config.landing_width,
      winderCount: config.winder_count,
      slabThickness: config.slab_thickness,
      topFinish: config.top_finish_thickness,
      bottomFinish: config.bottom_finish_thickness
    });
  }

  return calculateStairGeometryEngine({
    stairType: config.stair_type,
    floorHeight: config.floor_to_floor_height,
    slabThickness: config.slab_thickness,
    topFinish: config.top_finish_thickness,
    bottomFinish: config.bottom_finish_thickness,
    openingLength: config.opening_length,
    openingWidth: config.opening_width,
    marchWidth: config.march_width,
    turnDirection: config.turn_direction
  });
}

function dimensionLine({ x1, y1, x2, y2, label, vertical = false }) {
  const tx = vertical ? x1 - 8 : (x1 + x2) / 2;
  const ty = vertical ? (y1 + y2) / 2 : y1 - 6;
  const rotate = vertical ? ` transform="rotate(-90 ${tx} ${ty})"` : '';
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,.5)" stroke-dasharray="4 3"/>\n<text x="${tx}" y="${ty}" fill="#f0d7b7" font-size="10" text-anchor="middle"${rotate}>${label}</text>`;
}

function renderGeometryVisuals(visualization) {
  const plan = $('geometryPlanSvg'); const elev = $('geometryElevationSvg'); if (!plan || !elev) return;
  if (!visualization) { plan.innerHTML = '<div class="muted">Визуализация будет показана после расчёта.</div>'; elev.innerHTML = '<div class="muted">Нет данных для бокового вида.</div>'; return; }
  const maxX = Math.max(visualization.opening.length, ...visualization.path.map((p) => p.x), 1);
  const minY = Math.min(0, ...visualization.path.map((p) => p.y));
  const maxY = Math.max(visualization.opening.width, ...visualization.path.map((p) => p.y), 1);
  const pyRange = Math.max(1, maxY - minY);
  const px = (x) => 26 + (x / maxX) * 488;
  const py = (y) => 26 + ((y - minY) / pyRange) * 188;
  const poly = visualization.path.map((p) => `${px(p.x)},${py(p.y)}`).join(' ');
  const warningDots = (visualization.warningZones || []).map((p) => `<circle cx="${px(p.x)}" cy="${py(p.y)}" r="2.4" fill="#f5d98c"/>`).join('');
  const criticalDots = (visualization.criticalZones || []).map((p) => `<circle cx="${px(p.x)}" cy="${py(p.y)}" r="3" fill="#ff9898"/>`).join('');
  plan.innerHTML = `<svg viewBox="0 0 540 240" class="geo-svg"><rect x="26" y="26" width="488" height="188" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.2)"/><rect x="26" y="${py(0)}" width="${(visualization.opening.length / maxX) * 488}" height="${(visualization.opening.width / pyRange) * 188}" fill="rgba(221,183,134,0.08)" stroke="rgba(221,183,134,.7)"/><polyline points="${poly}" fill="none" stroke="#ddb786" stroke-width="3"/>${warningDots}${criticalDots}${dimensionLine({ x1: 26, y1: 220, x2: 514, y2: 220, label: `Длина зоны ${visualization.dimensions.openingLength} мм` })}${dimensionLine({ x1: 520, y1: 26, x2: 520, y2: 214, label: `Ширина зоны ${visualization.dimensions.openingWidth} мм`, vertical: true })}${dimensionLine({ x1: 26, y1: 16, x2: 26 + (visualization.dimensions.marchWidth / maxX) * 488, y2: 16, label: `Марш ${visualization.dimensions.marchWidth} мм` })}</svg>`;

  const n = Math.max(1, visualization.elevation.treadCount || 1); const stepW = 488 / n;
  const stairs = Array.from({ length: n }).map((_, i) => { const x = 26 + i * stepW; const y = 214 - ((i + 1) / n) * 158; return `<path d="M${x} 214 L${x} ${y} L${x + stepW} ${y}" stroke="#ddb786" fill="none" stroke-width="2"/>`; }).join('');
  const slabY = 214 - ((visualization.elevation.slabUnderside || 0) / Math.max(visualization.elevation.floorHeight || 1, 1)) * 176;
  const criticalBand = slabY + 10;
  elev.innerHTML = `<svg viewBox="0 0 540 240" class="geo-svg"><rect x="26" y="26" width="488" height="188" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.2)"/><line x1="26" y1="${slabY}" x2="514" y2="${slabY}" stroke="#f5d98c" stroke-dasharray="6 6"/><rect x="26" y="${criticalBand}" width="488" height="${214 - criticalBand}" fill="rgba(245,123,123,.09)"/>${stairs}${dimensionLine({ x1: 12, y1: 214, x2: 12, y2: 26, label: `Этаж-этаж ${visualization.dimensions.floorHeight} мм`, vertical: true })}</svg>`;
}

function renderAlternatives(geometry) {
  const root = $('geometryAlternatives');
  if (!root) return;
  const alternatives = geometry?.alternatives || [];
  if (!alternatives.length) {
    root.innerHTML = '<div class="muted">Альтернативные варианты появятся, когда движок найдёт несколько рабочих конфигураций.</div>';
    return;
  }
  root.innerHTML = `<div class="alt-grid">${alternatives.slice(0, 3).map((item, idx) => `<article class="alt-card"><div class="alt-title">Вариант ${idx + 2}</div><div class="alt-row"><span>Подъёмы</span><b>${item.riserCount}</b></div><div class="alt-row"><span>Проступь</span><b>${item.treadDepth} мм</b></div><div class="alt-row"><span>Угол</span><b>${item.angleDeg}°</b></div><div class="alt-row"><span>Просвет</span><b>${item.minHeadroom} мм</b></div><div class="alt-row"><span>Статус</span><b class="badge ${item.status}">${item.status === 'recommended' ? 'Рекомендуем' : item.status === 'warning' ? 'Допустимо' : 'Проверить'}</b></div></article>`).join('')}</div>`;
}

function getInvalidGeometryGuidance(config) {
  if (config.base_condition === 'ready_frame') {
    return [
      'Сверьте количество ступеней по факту, а не по проектному листу.',
      'Проверьте высоту подступенка и глубину проступи после чистовой отделки.',
      'Если основание уже смонтировано, отправьте размеры инженеру Tekstura для ручного fit-check.'
    ];
  }
  const steps = ['Проверьте размеры после чистовой отделки.', 'Попробуйте уменьшить ширину марша на 50–100 мм.', 'Сохраните расчёт и отправьте размеры инженеру Tekstura.'];
  if ((config.stair_type || '').startsWith('u_turn')) steps.push('Для П-образной схемы особенно важна ширина проёма под разворот.');
  return steps;
}

function renderGeometry(geometry) {
  const root = $('geometryResult'); const warnings = $('geometryWarnings'); const fallbackCta = $('geometryFallbackCta'); if (!root || !warnings) return;
  if (!geometry.valid || geometry.status === 'invalid') {
    const guidance = getInvalidGeometryGuidance(state.lastConfig || {});
    root.innerHTML = `<div class="warning-block invalid"><div class="warning-title">Для текущих размеров онлайн-подбор не нашёл безопасный и удобный вариант</div><div class="warning-text">Это не отказ — просто нужен ручной инженерный подбор.</div></div>`;
    warnings.innerHTML = `<div class="warning-block invalid"><div class="warning-text">${(geometry.warnings || []).join(' ')}</div><ul class="warning-list">${guidance.map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
    if (fallbackCta) fallbackCta.hidden = false; renderGeometryVisuals(null); renderAlternatives(null); setProceedAvailability(false); return;
  }

  const statusText = { recommended: 'Рекомендуем', warning: 'Допустимо с проверкой', invalid: 'Нужна проверка' };
  const summary = geometry.geometrySummary || {};
  const isReady = state.lastConfig.base_condition === 'ready_frame';
  const rows = [
    ['Сценарий', LABELS.base_condition[state.lastConfig.base_condition] || state.lastConfig.base_condition],
    [isReady ? 'Тип основания' : 'Тип лестницы', isReady ? (LABELS.base_subtype[state.lastConfig.base_subtype] || state.lastConfig.base_subtype) : (LABELS.stair_type[state.lastConfig.stair_type] || state.lastConfig.stair_type)],
    ['Статус', `<span class="badge ${geometry.status}">${statusText[geometry.status] || geometry.status}</span>`],
    ['Количество подъёмов', summary.riser_count || '—'],
    ['Количество проступей', summary.tread_count || '—'],
    ['Высота подступенка', `${summary.riser_height || '—'} мм`],
    ['Глубина проступи', `${summary.tread_depth || '—'} мм`],
    ['Формула 2h+b', `${summary.comfort_value || '—'} мм`],
    ['Угол', `${summary.stair_angle_deg || '—'}°`],
    ['Мин. просвет по линии хода', `${summary.headroom_min || '—'} мм`],
    ['Критичные точки просвета', `${summary.headroom_critical_count ?? '—'}`],
    ['Оценка кандидата', `${summary.score || '—'}/100`]
  ];
  if (isReady) {
    rows.splice(2, 0,
      ['Конфигурация', LABELS.configuration_type[state.lastConfig.configuration_type] || state.lastConfig.configuration_type],
      ['Тип поворота', state.lastConfig.configuration_type === 'straight' ? 'Не требуется' : (LABELS.turn_type[state.lastConfig.turn_type] || state.lastConfig.turn_type)],
      ['Направление поворота', state.lastConfig.configuration_type === 'straight' ? 'Не требуется' : (state.lastConfig.turn_direction === 'left' ? 'Левый' : 'Правый')]
    );
  } else if (state.lastConfig.stair_type !== 'straight') {
    rows.splice(2, 0, ['Направление поворота', state.lastConfig.turn_direction === 'left' ? 'Левый' : 'Правый']);
  }
  if (geometry.scenarioSummary) rows.push(['Логика сценария', geometry.scenarioSummary]);
  root.innerHTML = `<table class="result-table"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;

  const warningList = [...(geometry.warnings || [])];
  if (geometry.status === 'recommended') warningList.unshift('Геометрия в рекомендованной зоне: сохраняем спокойный премиальный баланс шага и угла.');
  if (geometry.status === 'warning') warningList.unshift('Вариант строится, но перед запуском рекомендуем инженерное подтверждение и контроль на объекте.');
  warnings.innerHTML = warningList.length ? warningList.map((w) => `<div class="warning-block"><div class="warning-text">${w}</div></div>`).join('') : '<div class="ok">Геометрия в рекомендованных пределах.</div>';
  if (fallbackCta) fallbackCta.hidden = geometry.status === 'recommended';
  renderGeometryVisuals(geometry.visualization);
  renderAlternatives(geometry);
  setProceedAvailability(true);
}

function getGeometryPayloadForMaterials(geometry) {
  if (!geometry?.valid) return { valid: false };
  return {
    valid: geometry.valid,
    ...(geometry.geometrySummary || {}),
    ...(geometry.metrics || {})
  };
}

function calculateMaterials(config, geometry) {
  if (config.base_condition === 'ready_frame') {
    const items = [
      { label: 'Тип основания', value: LABELS.base_subtype[config.base_subtype] || config.base_subtype },
      { label: 'Конфигурация', value: LABELS.configuration_type[config.configuration_type] || config.configuration_type },
      { label: 'Объём работ', value: config.scope_of_work.map((x) => SCOPE_LABELS[x] || x).join(', ') || '—' }
    ];
    if (config.configuration_type !== 'straight' && config.turn_type === 'landing') {
      items.push({ label: 'Площадка', value: `${config.landing_length} × ${config.landing_width} мм` });
    }
    if (config.configuration_type !== 'straight' && config.turn_type === 'winders') {
      items.push({ label: 'Забежные ступени', value: `${config.winder_count} шт` });
    }
    return { valid: true, items, metrics: {} };
  }
  const geometryPayload = getGeometryPayloadForMaterials(geometry);
  if (config.frame_material === 'wood') return calculateWoodMaterials(config, geometryPayload);
  if (config.frame_material === 'concrete') return calculateConcreteMaterials(config, geometryPayload);
  return calculateMetalMaterials(config, geometryPayload);
}
function renderMaterials(materials) { const root = $('materialsResult'); if (!root) return; if (!materials.valid) { root.innerHTML = `<div class="warning">${materials.reason}</div>`; return; } root.innerHTML = `<table class="result-table"><tbody>${materials.items.map((i) => `<tr><th>${i.label}</th><td>${i.value}</td></tr>`).join('')}</tbody></table>`; }

function calculateReadyMetalPrice(config, defaults) {
  const unit = config.step_count || 0;
  const areaCoef = (config.ready_march_width || 0) / 1000;
  const scope = new Set(config.scope_of_work || []);
  const stepFinishing = scope.has('steps_only') ? unit * 3200 * areaCoef : 0;
  const risers = scope.has('steps_risers') ? unit * 1800 * areaCoef : 0;
  const landingOrWinders = config.configuration_type === 'straight' ? 0 : (config.turn_type === 'landing' ? ((config.landing_length * config.landing_width) / 1_000_000) * 9500 : (config.winder_count || 0) * 2600);
  const railing = scope.has('railing') ? unit * 1400 : 0;
  const claddingCoating = scope.has('frame_cladding') || scope.has('finish_coating') ? unit * 1200 : 0;
  const lighting = scope.has('lighting') ? unit * 900 : 0;
  const installationFitting = scope.has('installation') ? (defaults.installation_base + unit * 1700) : 0;
  const complexityCoef = config.configuration_type === 'straight' ? 1 : (config.turn_type === 'winders' ? 1.18 : 1.1);
  const subtotal = (stepFinishing + risers + landingOrWinders + railing + claddingCoating + lighting + installationFitting) * complexityCoef;
  const total = subtotal * defaults.markup_coef;
  return { total, min: total * 0.9, max: total * 1.14, breakdown: { stepFinishing, risers, landingOrWinders, railing, claddingCoating, lighting, installationFitting, complexityCoef } };
}

function calculateReadyConcretePrice(config, defaults) {
  const unit = config.step_count || 0;
  const areaCoef = (config.ready_march_width || 0) / 1000;
  const scope = new Set(config.scope_of_work || []);
  const stairCladding = scope.has('steps_only') || scope.has('steps_risers') ? unit * 3600 * areaCoef : 0;
  const risers = scope.has('steps_risers') ? unit * 1900 * areaCoef : 0;
  const landingOrWinders = config.configuration_type === 'straight' ? 0 : (config.turn_type === 'landing' ? ((config.landing_length * config.landing_width) / 1_000_000) * 9100 : (config.winder_count || 0) * 2400);
  const railing = scope.has('railing') ? unit * 1450 : 0;
  const concretePrepWorks = unit * 950;
  const finish = scope.has('finish_coating') ? unit * 1200 : 0;
  const installation = scope.has('installation') ? (defaults.installation_base + unit * 1600) : 0;
  const subtotal = stairCladding + risers + landingOrWinders + railing + concretePrepWorks + finish + installation;
  const total = subtotal * defaults.markup_coef;
  return { total, min: total * 0.9, max: total * 1.14, breakdown: { stairCladding, risers, landingOrWinders, railing, concretePrepWorks, finish, installation } };
}

function calculateNewBuildPrice(config, geometry, materials, defaults) {
  const baseFrame = (materials.metrics.profileTubeLengthM || 0) * defaults.metal_rate_per_meter + (materials.metrics.loadBearingWoodM3 || 0) * 32000 + (materials.metrics.concreteVolumeM3 || 0) * defaults.concrete_rate_per_m3;
  const stepsArea = (materials.metrics.treadAreaM2 || materials.metrics.claddingAreaM2 || 0);
  const claddingCost = stepsArea * (config.cladding === 'premium' ? 22000 : config.cladding === 'standard' ? 12500 : 0);
  const railingLen = (materials.metrics.railingLengthM || 0);
  const railingRates = { none: 0, metal: 9800, glass: 18700, wood: 13200 };
  const railingCost = railingLen * (railingRates[config.railing] || 0);
  const finishCost = baseFrame * (config.finish_level === 'premium' ? 0.16 : config.finish_level === 'standard' ? 0.08 : 0.04);
  const extrasMap = { lighting: 24000, painted_metal: 17500, premium_coating: 28000, hidden_fasteners: 19000 };
  const extrasCost = config.extras.reduce((sum, key) => sum + (extrasMap[key] || 0), 0);
  const installation = defaults.installation_base + ((geometry.geometrySummary?.tread_count || 0) * defaults.labor_rate_per_step);
  const delivery = Math.max(9000, config.delivery_distance * defaults.delivery_rate_per_km);
  const subtotal = (baseFrame + claddingCost + railingCost + finishCost + extrasCost + installation + delivery) * defaults.install_coef;
  const total = subtotal * defaults.markup_coef;
  return { total, min: total * 0.9, max: total * 1.14, breakdown: { newFrameBase: baseFrame, stairsCladding: claddingCost, railing: railingCost, finish: finishCost, extras: extrasCost, installation, delivery } };
}

function calculatePrice(config, geometry, materials) {
  if (!geometry.valid || !materials.valid) return null;
  const d = state.dictionaries.defaults;
  if (config.base_condition === 'ready_frame' && config.base_subtype === 'existing_metal_frame') {
    return calculateReadyMetalPrice(config, d);
  }
  if (config.base_condition === 'ready_frame' && config.base_subtype === 'existing_concrete_base') {
    return calculateReadyConcretePrice(config, d);
  }
  return calculateNewBuildPrice(config, geometry, materials, d);
}

function money(v) { return `${new Intl.NumberFormat('ru-RU').format(Math.round(v || 0))} ₽`; }
function renderPrice(price) {
  const root = $('priceResult');
  if (!root) return;
  if (!price) { root.innerHTML = '<div class="warning">Стоимость недоступна без валидной геометрии.</div>'; return; }
  const b = price.breakdown;
  const cfg = state.lastConfig || {};
  let rows = '';
  if (cfg.base_condition === 'ready_frame' && cfg.base_subtype === 'existing_metal_frame') {
    rows = `<tr><th>Отделка ступеней</th><td>${money(b.stepFinishing)}</td></tr><tr><th>Подступенки</th><td>${money(b.risers)}</td></tr><tr><th>Площадка/забежные</th><td>${money(b.landingOrWinders)}</td></tr><tr><th>Ограждение</th><td>${money(b.railing)}</td></tr><tr><th>Обшивка/покрытие металла</th><td>${money(b.claddingCoating)}</td></tr><tr><th>Подсветка</th><td>${money(b.lighting)}</td></tr><tr><th>Монтаж/подгонка</th><td>${money(b.installationFitting)}</td></tr><tr><th>Коэффициент сложности</th><td>${(b.complexityCoef || 1).toFixed(2)}</td></tr>`;
  } else if (cfg.base_condition === 'ready_frame' && cfg.base_subtype === 'existing_concrete_base') {
    rows = `<tr><th>Облицовка ступеней</th><td>${money(b.stairCladding)}</td></tr><tr><th>Подступенки</th><td>${money(b.risers)}</td></tr><tr><th>Площадка/забежные</th><td>${money(b.landingOrWinders)}</td></tr><tr><th>Ограждение</th><td>${money(b.railing)}</td></tr><tr><th>Подготовка бетона</th><td>${money(b.concretePrepWorks)}</td></tr><tr><th>Финиш</th><td>${money(b.finish)}</td></tr><tr><th>Монтаж</th><td>${money(b.installation)}</td></tr>`;
  } else {
    rows = `<tr><th>Новое основание/каркас</th><td>${money(b.newFrameBase)}</td></tr><tr><th>Ступени и облицовка</th><td>${money(b.stairsCladding)}</td></tr><tr><th>Ограждение</th><td>${money(b.railing)}</td></tr><tr><th>Финиш</th><td>${money(b.finish)}</td></tr><tr><th>Доп. опции</th><td>${money(b.extras)}</td></tr><tr><th>Монтаж</th><td>${money(b.installation)}</td></tr><tr><th>Доставка</th><td>${money(b.delivery)}</td></tr>`;
  }
  root.innerHTML = `<div class="price-main">${money(price.total)}</div><div class="muted">Диапазон: ${money(price.min)} — ${money(price.max)}</div><table class="result-table"><tbody>${rows}</tbody></table>`;
  const payload = buildRequestPayload();
  try { sessionStorage.setItem('tekstura_calc_payload', encodeURIComponent(JSON.stringify(payload))); } catch {}
  const reqBtn = $('requestBtn');
  if (reqBtn) reqBtn.href = `/request.html?calc=${encodeURIComponent(JSON.stringify(payload))}`;
}

function buildRequestPayload() {
  const cfg = state.lastConfig || {};
  const isReadyFlow = cfg.base_condition === 'ready_frame';
  const stairTypeLabel = isReadyFlow
    ? (LABELS.configuration_type[cfg.configuration_type] || cfg.configuration_type)
    : (LABELS.stair_type[cfg.stair_type] || cfg.stair_type);
  const dimensions = isReadyFlow
    ? { ready_march_width: cfg.ready_march_width, step_count: cfg.step_count, riser_height: cfg.riser_height, tread_depth: cfg.tread_depth, landing_length: cfg.landing_length, landing_width: cfg.landing_width, winder_count: cfg.winder_count, turn_direction: cfg.turn_direction }
    : { floor_to_floor_height: cfg.floor_to_floor_height, opening_length: cfg.opening_length, opening_width: cfg.opening_width, march_width: cfg.march_width, slab_thickness: cfg.slab_thickness, top_finish_thickness: cfg.top_finish_thickness, bottom_finish_thickness: cfg.bottom_finish_thickness, turn_direction: cfg.turn_direction };
  return {
    base_condition: cfg.base_condition,
    base_subtype: cfg.base_subtype,
    configuration_type: cfg.configuration_type,
    turn_type: cfg.turn_type,
    turn_direction: cfg.turn_direction,
    step_count: cfg.step_count,
    riser_height: cfg.riser_height,
    tread_depth: cfg.tread_depth,
    march_width: cfg.base_condition === 'ready_frame' ? cfg.ready_march_width : cfg.march_width,
    landing_length: cfg.landing_length,
    landing_width: cfg.landing_width,
    winder_count: cfg.winder_count,
    scope_of_work: cfg.scope_of_work || [],
    existing_condition_notes: cfg.existing_condition_notes || '',
    staircaseType: stairTypeLabel,
    dimensions,
    inputDimensions: dimensions,
    geometrySummary: state.geometry?.geometrySummary || null,
    scenario_summary: state.geometry?.scenarioSummary || '',
    status: state.geometry?.status || 'invalid',
    warnings: state.geometry?.warnings || [],
    materialsSummary: isReadyFlow
      ? { base: LABELS.base_subtype[cfg.base_subtype] || cfg.base_subtype, configuration: LABELS.configuration_type[cfg.configuration_type] || cfg.configuration_type, turn_type: cfg.configuration_type === 'straight' ? '' : (LABELS.turn_type[cfg.turn_type] || cfg.turn_type), scope_of_work: (cfg.scope_of_work || []).map((x) => SCOPE_LABELS[x] || x) }
      : { frame: LABELS.frame_material[cfg.frame_material], cladding: LABELS.cladding[cfg.cladding], railing: LABELS.railing[cfg.railing], finish: LABELS.finish_level[cfg.finish_level] },
    selectedExtras: isReadyFlow
      ? (cfg.scope_of_work || []).map((x) => ({ code: x, label: SCOPE_LABELS[x] || x }))
      : (cfg.extras || []).map((x) => ({ code: x, label: EXTRA_LABELS[x] || x })),
    priceBreakdown: state.price?.breakdown || {},
    total: Math.round(state.price?.total || 0)
  };
}

function runGeometryCalculation() {
  const config = getConfigFromForm();
  state.lastConfig = config;
  state.geometry = calculateGeometry(config);
  renderGeometry(state.geometry);
  updateStairTypeHints(state.geometry, config);
  setStatus(state.geometry.valid ? 'Геометрия рассчитана' : 'Проверьте параметры');
  showStep(2);
}
function runConfigurator() {
  const config = getConfigFromForm();
  state.lastConfig = config;
  state.geometry = calculateGeometry(config);
  renderGeometry(state.geometry);
  updateStairTypeHints(state.geometry, config);
  if (!state.geometry.valid || state.geometry.status === 'invalid') { setStatus('Исправьте параметры геометрии, чтобы продолжить'); showStep(2); return; }
  state.materials = calculateMaterials(config, state.geometry);
  renderMaterials(state.materials);
  state.price = calculatePrice(config, state.geometry, state.materials);
  renderPrice(state.price);
  setStatus('Расчёт обновлён');
  showStep(4);
}

async function loadSupabaseDictionaries() { if (!window.supabase || !window.SUPABASE_CONFIG) return; try { const client = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey); const { data } = await client.from('stair_defaults').select('*').eq('active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(); if (data) state.dictionaries.defaults = { ...state.dictionaries.defaults, ...data }; } catch { setStatus('Используются встроенные коэффициенты.'); } }

function init() {
  bindVisualSelectors();
  $('stairType')?.addEventListener('change', () => { toggleTurnFields(); updateStairTypeHints(); });
  $('baseCondition')?.addEventListener('change', () => { toggleScenarioFields(); toggleTurnFields(); updateStairTypeHints(); });
  $('configurationType')?.addEventListener('change', () => { toggleReadyFlowFields(); updateStairTypeHints(); });
  $('turnType')?.addEventListener('change', () => { toggleReadyFlowFields(); updateStairTypeHints(); });
  $('calculateBtn')?.addEventListener('click', runConfigurator);
  $('toResultsBtn')?.addEventListener('click', runGeometryCalculation);
  setProceedAvailability(false);
  toggleScenarioFields();
  toggleTurnFields();
  updateStairTypeHints();
  loadSupabaseDictionaries();
}
init();
