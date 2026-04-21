import { calculateStraightGeometry, FORMULA_LIMITS, evaluateMarch, getCandidateRiserCounts, evaluateComfort } from './stair-formulas.js';
import { calculateMetalMaterials, calculateWoodMaterials, calculateConcreteMaterials } from './stair-materials.js';

const state = {
  geometry: null,
  materials: null,
  price: null,
  lastConfig: null,
  dictionaries: {
    defaults: {
      labor_rate_per_step: 2500,
      metal_rate_per_meter: 1800,
      wood_rate_per_m2: 16000,
      concrete_rate_per_m3: 14000,
      install_coef: 1.12,
      markup_coef: 1.08,
      delivery_rate_per_km: 110,
      installation_base: 18000
    },
    materialRules: []
  }
};

const LABELS = {
  stair_type: {
    straight: 'Прямая',
    l_turn_landing: 'Г-образная с площадкой',
    l_turn_winders: 'Г-образная с забежными',
    u_turn_landing: 'П-образная с площадкой',
    u_turn_winders: 'П-образная с забежными'
  },
  frame_material: { metal: 'Металлокаркас', concrete: 'Бетонный каркас', wood: 'Деревянный каркас' },
  cladding: { none: 'Без облицовки', standard: 'Стандартная облицовка', premium: 'Премиальная облицовка' },
  railing: { none: 'Без ограждения', metal: 'Металлическое ограждение', glass: 'Стеклянное ограждение', wood: 'Деревянное ограждение' },
  finish_level: { basic: 'Базовый', standard: 'Стандарт', premium: 'Премиум' }
};

const STAIR_TYPE_HINTS = {
  straight: {
    title: 'Прямая лестница',
    text: 'Подходит для узких и длинных проёмов. Обычно требуется достаточная длина проёма, но меньше ширины.',
    invalidAdvice: 'Если расчёт не проходит, увеличьте длину проёма или уменьшите ширину марша.'
  },
  l_turn_landing: {
    title: 'Г-образная с площадкой',
    text: 'Требует запаса по длине и ширине проёма. Для площадки нужен более свободный поворотный узел.',
    invalidAdvice: 'При ошибке геометрии увеличьте длину и ширину проёма в зоне поворота.'
  },
  l_turn_winders: {
    title: 'Г-образная с забежными',
    text: 'Более компактное решение, чем площадка. Подходит при ограниченном пространстве, но требует точного расчёта.',
    invalidAdvice: 'Если геометрия невалидна, проверьте ширину проёма и попробуйте уменьшить ширину марша.'
  },
  u_turn_landing: {
    title: 'П-образная с площадкой',
    text: 'Поворотная площадка считается по ширине проёма, а каждый марш проверяется отдельно. Хорошо подходит для просторных и средних планировок.',
    invalidAdvice: 'Если расчёт не проходит, сначала увеличьте длину проёма марша или уменьшите ширину марша.'
  },
  u_turn_winders: {
    title: 'П-образная с забежными',
    text: 'Компактнее П-образной с площадкой. Разворот считается по ширине проёма, а марши подбираются отдельно.',
    invalidAdvice: 'При невалидной геометрии увеличьте длину или ширину проёма и проверьте ограничения по маршу.'
  }
};

const UTURN_LIMITS = {
  preferredMinTread: FORMULA_LIMITS.minTreadDepth,
  preferredMaxTread: FORMULA_LIMITS.maxTreadDepth,
  borderlineMinTread: 220,
  borderlineMaxTread: 360,
  borderlineMinRiser: 145,
  borderlineMaxRiser: 190,
  borderlineMaxAngle: 47
};

const $ = (id) => document.getElementById(id);
let currentStep = 1;
function getAvailableSteps() {
  return [...document.querySelectorAll('.step')]
    .map((node) => Number((node.id || '').replace('step', '')))
    .filter((step) => Number.isFinite(step))
    .sort((a, b) => a - b);
}

function showStep(step) {
  const available = getAvailableSteps();
  const target = available.includes(step) ? step : (available[0] || 1);
  document.querySelectorAll('.step').forEach((n) => n.classList.remove('active'));
  $(`step${target}`)?.classList.add('active');
  currentStep = target;
}

window.nextStep = () => {
  const available = getAvailableSteps();
  const next = available.find((step) => step > currentStep);
  if (next) showStep(next);
};

window.prevStep = () => {
  const available = getAvailableSteps();
  const previous = [...available].reverse().find((step) => step < currentStep);
  if (previous) showStep(previous);
};

function setStatus(message = '') { const n = $('pageStatus'); if (n) n.textContent = message; }

function setProceedAvailability(canProceed) {
  const proceedBtn = $('calculateBtn');
  if (!proceedBtn) return;
  proceedBtn.disabled = !canProceed;
  proceedBtn.setAttribute('aria-disabled', String(!canProceed));
  proceedBtn.title = canProceed ? '' : 'Исправьте параметры геометрии, чтобы перейти к материалам и цене.';
}

function bindVisualSelectors() {
  document.querySelectorAll('.visual-choice').forEach((group) => {
    const cards = [...group.querySelectorAll('.visual-card')];
    const hiddenInput = $(group.dataset.target);

    const applySelection = (card) => {
      if (!card || !hiddenInput) return;
      hiddenInput.value = card.dataset.value;
      cards.forEach((c) => {
        c.classList.toggle('selected', c === card);
        c.setAttribute('aria-pressed', String(c === card));
      });
      hiddenInput.dispatchEvent(new Event('change'));
    };

    group.addEventListener('click', (e) => {
      const card = e.target.closest('.visual-card');
      if (!card) return;
      applySelection(card);
    });

    cards.forEach((card, index) => {
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
          return;
        }
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = (index + delta + cards.length) % cards.length;
        cards[nextIndex].focus();
        if (group.classList.contains('stair-type-choice')) {
          applySelection(cards[nextIndex]);
        }
      });
    });
  });
}

function toggleTurnFields() {
  const stairType = $('stairType')?.value || 'straight';
  const turnDirection = $('turnDirectionField');
  const turnDirectionInput = $('turnDirection');
  if (!turnDirection || !turnDirectionInput) return;
  const isTurn = stairType !== 'straight';
  turnDirection.classList.toggle('hidden', !isTurn);
  turnDirectionInput.disabled = !isTurn;
}

function renderStairTypeHint(target, stairType, geometry) {
  if (!target) return;
  const hint = STAIR_TYPE_HINTS[stairType] || STAIR_TYPE_HINTS.straight;
  const uTurnNote = stairType === 'u_turn_landing' || stairType === 'u_turn_winders'
    ? '<div class="stair-type-hint-warning">Для П-образной лестницы важны и ширина проёма под разворот, и длина каждого марша.</div>'
    : '';
  const invalidHelp = geometry && !geometry.valid
    ? `<div class="stair-type-hint-invalid">${hint.invalidAdvice}</div>`
    : '';
  target.innerHTML = `
    <div class="stair-type-hint-card">
      <div class="stair-type-hint-label">Подсказка по проёму</div>
      <h3>${hint.title}</h3>
      <p>${hint.text}</p>
      ${uTurnNote}
      ${invalidHelp}
    </div>
  `;
}

function updateStairTypeHints(geometry = null) {
  const stairType = $('stairType')?.value || state.lastConfig?.stair_type || 'straight';
  renderStairTypeHint($('stairTypeHint'), stairType, geometry);
  renderStairTypeHint($('geometryTypeHint'), stairType, geometry);
}

function getConfigFromForm() {
  return {
    stair_type: $('stairType')?.value || 'straight',
    turn_direction: $('turnDirection')?.value || 'left',
    floor_to_floor_height: Number($('floorHeight')?.value || 0),
    opening_length: Number($('openingLength')?.value || 0),
    opening_width: Number($('openingWidth')?.value || 0),
    march_width: Number($('marchWidth')?.value || 0),
    frame_material: $('frameMaterial')?.value || 'metal',
    finish_level: $('finishLevel')?.value || 'basic',
    cladding: $('claddingType')?.value || 'standard',
    railing: $('railingType')?.value || 'metal',
    extras: [...document.querySelectorAll('input[name="extras"]:checked')].map((x) => x.value)
  };
}

function validateBase(config) {
  if (config.floor_to_floor_height <= 0) return 'Укажите корректную высоту этаж-этаж.';
  if (config.opening_length <= 0) return 'Укажите корректную длину проёма.';
  if (config.opening_width <= 0) return 'Укажите корректную ширину проёма.';
  if (config.march_width <= 0) return 'Укажите корректную ширину марша.';
  return null;
}

function invalid(reason) {
  return { valid: false, status: 'invalid', reason, riser_count: 0, tread_count: 0, riser_height: 0, tread_depth: 0, comfort_value: 0, stair_angle_deg: 0, run_length: 0, stringer_length: 0 };
}

function calculateAngle(riserHeight, treadDepth) {
  return Number(((Math.atan(riserHeight / treadDepth) * 180) / Math.PI).toFixed(2));
}

function evaluateMarchWithinOpening({ availableRun, risers, treadCount, riserHeight }) {
  if (risers < 3 || treadCount < 2) return { valid: false, reason: 'Недостаточно ступеней в марше.' };
  const maxFitTread = availableRun / treadCount;
  if (maxFitTread < UTURN_LIMITS.borderlineMinTread) {
    return { valid: false, reason: 'Длины проёма недостаточно даже для компактного марша.' };
  }

  const targetTread = FORMULA_LIMITS.targetComfort - (2 * riserHeight);
  const treadDepth = Math.min(
    maxFitTread,
    Math.max(targetTread, UTURN_LIMITS.borderlineMinTread)
  );

  const comfort = evaluateComfort(riserHeight, treadDepth);
  const angle = calculateAngle(riserHeight, treadDepth);
  const usedRun = treadDepth * treadCount;

  const strictValid = (
    riserHeight >= FORMULA_LIMITS.minRiser &&
    riserHeight <= FORMULA_LIMITS.maxRiser &&
    treadDepth >= UTURN_LIMITS.preferredMinTread &&
    treadDepth <= UTURN_LIMITS.preferredMaxTread &&
    angle <= FORMULA_LIMITS.maxRecommendedAngle &&
    comfort.in_range
  );

  const borderlineValid = (
    riserHeight >= UTURN_LIMITS.borderlineMinRiser &&
    riserHeight <= UTURN_LIMITS.borderlineMaxRiser &&
    treadDepth >= UTURN_LIMITS.borderlineMinTread &&
    treadDepth <= UTURN_LIMITS.borderlineMaxTread &&
    angle <= UTURN_LIMITS.borderlineMaxAngle
  );

  if (!strictValid && !borderlineValid) {
    return { valid: false, reason: 'Марш выходит за пределы допустимой геометрии.' };
  }

  return {
    valid: true,
    borderline: !strictValid,
    risers,
    treads: treadCount,
    tread_depth: Number(treadDepth.toFixed(1)),
    stair_angle_deg: angle,
    run_length: Math.round(usedRun),
    available_run: Math.round(availableRun),
    comfort
  };
}

function calculateLTurnGeometry(config, useWinders) {
  const runLower = config.opening_length - Math.max(config.march_width, useWinders ? 760 : 900);
  const runUpper = config.opening_width - config.march_width;
  if (runLower < FORMULA_LIMITS.minTreadDepth * 3) return invalid('Недостаточная длина проёма для нижнего марша.');
  if (runUpper < FORMULA_LIMITS.minTreadDepth * 2) return invalid('Недостаточная ширина проёма для верхнего марша.');

  const risersForTurn = useWinders ? 3 : 1;
  const counts = getCandidateRiserCounts(config.floor_to_floor_height);
  for (const riserCount of counts) {
    const marchRisers = riserCount - risersForTurn;
    if (marchRisers < 6) continue;
    const split = runLower / (runLower + runUpper);
    const lowerRisers = Math.max(3, Math.round(marchRisers * split));
    const upperRisers = marchRisers - lowerRisers;
    if (upperRisers < 3) continue;
    const rh = config.floor_to_floor_height / riserCount;
    const low = evaluateMarch({ runLength: runLower, risers: lowerRisers, treadCount: lowerRisers, riserHeight: rh });
    const up = evaluateMarch({ runLength: runUpper, risers: upperRisers, treadCount: upperRisers - 1, riserHeight: rh });
    if (!low.valid || !up.valid) continue;
    const avgTread = (low.tread_depth * low.treads + up.tread_depth * up.treads) / (low.treads + up.treads);
    const comfort = evaluateComfort(rh, avgTread);
    const turnLength = Math.max(config.march_width, useWinders ? 760 : 900);
    return {
      valid: true,
      status: comfort.status,
      reason: comfort.in_range ? null : 'Формула удобства вне идеального диапазона.',
      riser_count: riserCount,
      tread_count: low.treads + up.treads,
      riser_height: Number(rh.toFixed(1)),
      tread_depth: Number(avgTread.toFixed(1)),
      comfort_value: comfort.comfort_value,
      comfort_deviation: comfort.deviation,
      stair_angle_deg: Math.max(low.stair_angle_deg, up.stair_angle_deg),
      run_length: Math.round(runLower + runUpper + turnLength),
      stringer_length: Math.round(Math.hypot(runLower, rh * lowerRisers) + Math.hypot(runUpper, rh * upperRisers) + turnLength),
      turn_node: { type: useWinders ? 'winders' : 'landing', direction: config.turn_direction, element_length: turnLength, risers_in_turn: risersForTurn },
      lower_march: low,
      upper_march: up
    };
  }
  return invalid('Не удалось подобрать Г-образную геометрию под заданный проём.');
}

function calculateUTurnGeometry(config, useWinders) {
  const centerGap = config.opening_width - (config.march_width * 2);
  if (centerGap < 0) {
    return invalid('Ширина проёма меньше суммарной ширины двух маршей П-образной лестницы.');
  }

  const turnDepth = Math.max(useWinders ? Math.round(config.march_width * 0.8) : config.march_width, useWinders ? 720 : 900);
  const availableRunPerMarch = config.opening_length - turnDepth;
  if (availableRunPerMarch < UTURN_LIMITS.borderlineMinTread * 3) {
    return invalid('Длина проёма недостаточна для марша П-образной лестницы.');
  }

  const counts = getCandidateRiserCounts(
    config.floor_to_floor_height,
    UTURN_LIMITS.borderlineMinRiser,
    UTURN_LIMITS.borderlineMaxRiser
  );

  const variants = [];

  for (const riserCount of counts) {
    const riserHeight = config.floor_to_floor_height / riserCount;
    const startLower = Math.max(4, Math.floor(riserCount / 2) - 2);
    const endLower = Math.min(riserCount - 4, Math.ceil(riserCount / 2) + 2);

    for (let lowerRisers = startLower; lowerRisers <= endLower; lowerRisers += 1) {
      const upperRisers = riserCount - lowerRisers;
      const lowerTreads = Math.max(lowerRisers - 1, 3);
      const upperTreads = Math.max(upperRisers - 1, 3);

      const lower = evaluateMarchWithinOpening({
        availableRun: availableRunPerMarch,
        risers: lowerRisers,
        treadCount: lowerTreads,
        riserHeight
      });
      if (!lower.valid) continue;

      const upper = evaluateMarchWithinOpening({
        availableRun: availableRunPerMarch,
        risers: upperRisers,
        treadCount: upperTreads,
        riserHeight
      });
      if (!upper.valid) continue;

      const avgTread = ((lower.tread_depth * lower.treads) + (upper.tread_depth * upper.treads)) / (lower.treads + upper.treads);
      const comfort = evaluateComfort(riserHeight, avgTread);
      const overallAngle = Math.max(lower.stair_angle_deg, upper.stair_angle_deg);

      const isBorderline = (
        lower.borderline ||
        upper.borderline ||
        centerGap < 120 ||
        !comfort.in_range ||
        overallAngle > FORMULA_LIMITS.maxRecommendedAngle
      );

      const status = isBorderline ? 'borderline' : (comfort.status === 'comfortable' ? 'comfortable' : 'acceptable');
      const reason = isBorderline ? 'Конфигурация возможна, но требует проверки инженером.' : null;
      const score = comfort.deviation + Math.abs(lowerRisers - upperRisers) * 4 + (isBorderline ? 25 : 0);

      variants.push({
        valid: true,
        status,
        reason,
        score,
        riser_count: riserCount,
        tread_count: lower.treads + upper.treads,
        riser_height: Number(riserHeight.toFixed(1)),
        tread_depth: Number(avgTread.toFixed(1)),
        comfort_value: comfort.comfort_value,
        comfort_deviation: comfort.deviation,
        stair_angle_deg: overallAngle,
        run_length: Math.round(Math.max(lower.run_length, upper.run_length) + turnDepth),
        stringer_length: Math.round(
          Math.hypot(lower.run_length, riserHeight * lowerRisers) +
          Math.hypot(upper.run_length, riserHeight * upperRisers)
        ),
        turn_node: {
          type: useWinders ? 'winders' : 'landing',
          direction: config.turn_direction,
          element_length: turnDepth,
          center_gap: Math.round(centerGap),
          width_basis: Math.round(config.opening_width)
        },
        lower_march: lower,
        upper_march: upper,
        middle_march: {
          run_length: Math.round(turnDepth),
          note: useWinders ? 'разворот на забежных ступенях' : 'поворотная площадка',
          center_gap: Math.round(centerGap)
        }
      });
    }
  }

  if (!variants.length) {
    return invalid('Не удалось подобрать П-образную конфигурацию. Проверьте длину проёма марша и ширину марша.');
  }

  variants.sort((a, b) => a.score - b.score);
  return variants[0];
}

function calculateGeometry(config) {
  const err = validateBase(config);
  if (err) return invalid(err);
  if (config.stair_type === 'l_turn_landing') return calculateLTurnGeometry(config, false);
  if (config.stair_type === 'l_turn_winders') return calculateLTurnGeometry(config, true);
  if (config.stair_type === 'u_turn_landing') return calculateUTurnGeometry(config, false);
  if (config.stair_type === 'u_turn_winders') return calculateUTurnGeometry(config, true);
  return calculateStraightGeometry(config);
}

function getInvalidGeometryGuidance(config) {
  const steps = [
    'Проверьте длину проёма для каждого марша.',
    'Уменьшите ширину марша, если нужно выиграть место.',
    'Выберите другой тип лестницы, если планировка очень компактная.'
  ];
  if (config.stair_type === 'u_turn_landing' || config.stair_type === 'u_turn_winders') {
    steps.push('Для П-образной лестницы ширина проёма проверяется под два марша и разворотную зону.');
  }
  return steps;
}

function renderGeometry(geometry) {
  const root = $('geometryResult'); const warnings = $('geometryWarnings');
  if (!root || !warnings) return;
  if (!geometry.valid) {
    const guidanceItems = getInvalidGeometryGuidance(state.lastConfig || {});
    root.innerHTML = `
      <div class="warning-block invalid">
        <div class="warning-title">Геометрия не проходит проверку</div>
        <div class="warning-text">Исправьте параметры, затем пересчитайте геометрию.</div>
      </div>
    `;
    warnings.innerHTML = `
      <div class="warning-block invalid">
        <div class="warning-text">${geometry.reason}</div>
        <ul class="warning-list">${guidanceItems.map((item) => `<li>${item}</li>`).join('')}</ul>
      </div>
    `;
    setProceedAvailability(false);
    return;
  }

  const statusText = { comfortable: 'Комфортно', acceptable: 'Допустимо', borderline: 'Нужна проверка', too_steep: 'На границе', invalid: 'Ошибка' };
  const rows = [
    ['Тип лестницы', LABELS.stair_type[state.lastConfig.stair_type] || state.lastConfig.stair_type],
    ['Статус удобства', `<span class="badge ${geometry.status}">${statusText[geometry.status] || geometry.status}</span>`],
    ['Количество подъёмов', `${geometry.riser_count}`],
    ['Количество проступей', `${geometry.tread_count}`],
    ['Высота подступенка', `${geometry.riser_height} мм`],
    ['Глубина проступи', `${geometry.tread_depth} мм`],
    ['Формула 2h+b', `${geometry.comfort_value} мм`],
    ['Угол', `${geometry.stair_angle_deg}°`],
    ['Длина в плане', `${geometry.run_length} мм`],
    ['Длина косоуров', `${geometry.stringer_length} мм`]
  ];
  if (geometry.turn_node) {
    rows.push(['Поворотный узел', `${geometry.turn_node.type === 'winders' ? 'Забежные ступени' : 'Площадка'} · ${geometry.turn_node.direction === 'left' ? 'левый' : 'правый'}`]);
    if (Number.isFinite(geometry.turn_node.center_gap)) {
      rows.push(['Разворотная зона по ширине', `${geometry.turn_node.center_gap} мм`]);
    }
    rows.push(['Нижний марш', `${geometry.lower_march?.risers || 0} под., ${geometry.lower_march?.treads || 0} прост., ${geometry.lower_march?.run_length || 0} мм`]);
    rows.push(['Верхний марш', `${geometry.upper_march?.risers || 0} под., ${geometry.upper_march?.treads || 0} прост., ${geometry.upper_march?.run_length || 0} мм`]);
  }
  root.innerHTML = `<table class="result-table"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;

  const warningList = [];
  if (geometry.status === 'borderline') warningList.push('Конфигурация возможна, но требует проверки инженером.');
  if (geometry.reason) warningList.push(geometry.reason);
  if (geometry.stair_angle_deg > FORMULA_LIMITS.maxRecommendedAngle - 2) warningList.push('Угол близок к верхней рекомендуемой границе.');
  if (geometry.tread_depth < FORMULA_LIMITS.minTreadDepth) warningList.push('Глубина проступи компактная — проверьте удобство шага перед запуском в работу.');
  warnings.innerHTML = warningList.length
    ? warningList.map((i) => `<div class="warning-block"><div class="warning-text">${i}</div></div>`).join('')
    : '<div class="ok">Геометрия в инженерных пределах.</div>';
  setProceedAvailability(true);
}

function calculateMaterials(config, geometry) {
  if (config.frame_material === 'wood') return calculateWoodMaterials(config, geometry);
  if (config.frame_material === 'concrete') return calculateConcreteMaterials(config, geometry);
  return calculateMetalMaterials(config, geometry);
}

function renderMaterials(materials) {
  const root = $('materialsResult');
  if (!root) return;
  if (!materials.valid) { root.innerHTML = `<div class="warning">${materials.reason}</div>`; return; }
  root.innerHTML = `<table class="result-table"><tbody>${materials.items.map((item) => `<tr><th>${item.label}</th><td>${item.value}</td></tr>`).join('')}</tbody></table>`;
}

function calculatePrice(config, geometry, materials) {
  if (!geometry.valid || !materials.valid) return null;
  const d = state.dictionaries.defaults;
  const baseFrame = (materials.metrics.profileTubeLengthM || 0) * d.metal_rate_per_meter
    + (materials.metrics.loadBearingWoodM3 || 0) * 32000
    + (materials.metrics.concreteVolumeM3 || 0) * d.concrete_rate_per_m3;
  const stepsArea = (materials.metrics.treadAreaM2 || materials.metrics.claddingAreaM2 || 0);
  const claddingCost = stepsArea * (config.cladding === 'premium' ? 22000 : config.cladding === 'standard' ? 12500 : 0);
  const railingLen = (materials.metrics.railingLengthM || 0);
  const railingRates = { none: 0, metal: 9800, glass: 18700, wood: 13200 };
  const railingCost = railingLen * (railingRates[config.railing] || 0);
  const finishCost = baseFrame * (config.finish_level === 'premium' ? 0.16 : config.finish_level === 'standard' ? 0.08 : 0.04);
  const extrasMap = {
    lighting: 24000,
    painted_metal: 17500,
    premium_coating: 28000,
    hidden_fasteners: 19000
  };
  const extrasCost = config.extras.reduce((sum, key) => sum + (extrasMap[key] || 0), 0);
  const installation = d.installation_base + geometry.tread_count * d.labor_rate_per_step;
  const delivery = Math.max(9000, (Number($('deliveryDistance')?.value || 20) * d.delivery_rate_per_km));
  const subtotal = (baseFrame + claddingCost + railingCost + finishCost + extrasCost + installation + delivery) * d.install_coef;
  const total = subtotal * d.markup_coef;

  return {
    total,
    min: total * 0.9,
    max: total * 1.14,
    breakdown: { baseFrame, claddingCost, railingCost, finishCost, extrasCost, installation, delivery }
  };
}

function money(v) { return `${new Intl.NumberFormat('ru-RU').format(Math.round(v || 0))} ₽`; }

function renderPrice(price) {
  const root = $('priceResult');
  if (!root) return;
  if (!price) { root.innerHTML = '<div class="warning">Стоимость недоступна без валидной геометрии.</div>'; return; }

  const b = price.breakdown;
  root.innerHTML = `
    <div class="price-main">${money(price.total)}</div>
    <div class="muted">Диапазон: ${money(price.min)} — ${money(price.max)}</div>
    <table class="result-table">
      <tbody>
        <tr><th>Каркас/основание</th><td>${money(b.baseFrame)}</td></tr>
        <tr><th>Ступени и облицовка</th><td>${money(b.claddingCost)}</td></tr>
        <tr><th>Ограждение</th><td>${money(b.railingCost)}</td></tr>
        <tr><th>Финиш/покрытие</th><td>${money(b.finishCost)}</td></tr>
        <tr><th>Доп. опции</th><td>${money(b.extrasCost)}</td></tr>
        <tr><th>Монтаж</th><td>${money(b.installation)}</td></tr>
        <tr><th>Доставка</th><td>${money(b.delivery)}</td></tr>
      </tbody>
    </table>
  `;
  const reqBtn = $('requestBtn');
  if (reqBtn) reqBtn.href = `/request.html?calc=${encodeURIComponent(JSON.stringify(buildRequestPayload()))}`;
}

function buildRequestPayload() {
  const cfg = state.lastConfig || {};
  return {
    staircaseType: LABELS.stair_type[cfg.stair_type] || cfg.stair_type,
    geometrySummary: state.geometry,
    materialsSummary: {
      frame: LABELS.frame_material[cfg.frame_material],
      cladding: LABELS.cladding[cfg.cladding],
      railing: LABELS.railing[cfg.railing],
      finish: LABELS.finish_level[cfg.finish_level]
    },
    priceBreakdown: state.price?.breakdown || {},
    selectedExtras: (cfg.extras || []).map((x) => ({ code: x, label: x.replaceAll('_', ' ') })),
    total: Math.round(state.price?.total || 0),
    dimensions: {
      floor_to_floor_height: cfg.floor_to_floor_height,
      opening_length: cfg.opening_length,
      opening_width: cfg.opening_width,
      march_width: cfg.march_width
    },
    materials: state.materials,
    options: cfg.extras || []
  };
}

function runGeometryCalculation() {
  const config = getConfigFromForm();
  state.lastConfig = config;
  state.geometry = calculateGeometry(config);
  renderGeometry(state.geometry);
  updateStairTypeHints(state.geometry);
  setStatus(state.geometry.valid ? 'Геометрия рассчитана' : 'Проверьте параметры');
  showStep(2);
}

function runConfigurator() {
  const config = getConfigFromForm();
  state.lastConfig = config;
  state.geometry = calculateGeometry(config); renderGeometry(state.geometry);
  updateStairTypeHints(state.geometry);
  if (!state.geometry.valid) {
    setStatus('Исправьте параметры геометрии, чтобы продолжить');
    showStep(2);
    return;
  }
  state.materials = calculateMaterials(config, state.geometry); renderMaterials(state.materials);
  state.price = calculatePrice(config, state.geometry, state.materials); renderPrice(state.price);
  setStatus(state.geometry.valid ? 'Расчёт обновлён' : 'Проверьте параметры');
  showStep(4);
}

async function loadSupabaseDictionaries() {
  if (!window.supabase || !window.SUPABASE_CONFIG) return;
  try {
    const client = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    const { data } = await client.from('stair_defaults').select('*').eq('active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (data) state.dictionaries.defaults = { ...state.dictionaries.defaults, ...data };
  } catch {
    setStatus('Используются встроенные коэффициенты.');
  }
}

function init() {
  bindVisualSelectors();
  $('stairType')?.addEventListener('change', () => {
    toggleTurnFields();
    updateStairTypeHints();
  });
  $('calculateBtn')?.addEventListener('click', runConfigurator);
  $('toResultsBtn')?.addEventListener('click', runGeometryCalculation);
  setProceedAvailability(false);
  toggleTurnFields();
  updateStairTypeHints();
  loadSupabaseDictionaries();
}
init();
