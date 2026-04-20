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
  frame_material: { metal: 'Металлический каркас', wood: 'Деревянный каркас', concrete: 'Бетонный каркас' },
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
    text: 'Требует большой ширины проёма для разворота на 180°. Лучше подходит для просторных планировок.',
    invalidAdvice: 'Если расчёт не проходит, сначала увеличьте ширину проёма под разворот и среднюю зону.'
  },
  u_turn_winders: {
    title: 'П-образная с забежными',
    text: 'Компактнее П-образной с площадкой, но всё равно требует достаточной ширины проёма и точной геометрии.',
    invalidAdvice: 'При невалидной геометрии увеличьте ширину проёма и проверьте ограничения по маршу.'
  }
};

const $ = (id) => document.getElementById(id);
function showStep(step) { document.querySelectorAll('.step').forEach((n) => n.classList.remove('active')); $(`step${step}`)?.classList.add('active'); }
window.nextStep = showStep;
window.prevStep = showStep;

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

function getSelectedStairCardNode() {
  const stairTypeValue = $('stairType')?.value || 'straight';
  const turnTypeValue = $('turnType')?.value || 'landing';

  return document.querySelector(
    `.stair-type-card[data-stair-type="${stairTypeValue}"][data-turn-type="${turnTypeValue}"]`
  ) || document.querySelector(`.stair-type-card[data-stair-type="${stairTypeValue}"]`);
}

function updateStairTypeHint() {
  const hintNode = $('stairTypeHint');
  const selectedCard = getSelectedStairCardNode();
  if (!hintNode || !selectedCard) return;

  const helperText = selectedCard.querySelector('.stair-type-card__hint')?.textContent || '';
  hintNode.textContent = helperText;
}

function syncStairTypeCards() {
  const cards = document.querySelectorAll('.stair-type-card');
  const selectedCard = getSelectedStairCardNode();

  cards.forEach((card) => {
    const isSelected = selectedCard === card;
    card.classList.toggle('is-selected', isSelected);
    card.setAttribute('aria-checked', String(isSelected));
    if (isSelected) card.setAttribute('tabindex', '0');
    else card.setAttribute('tabindex', '-1');
  });

  updateStairTypeHint();
}

function applyStairTypeCardSelection(card) {
  const stairTypeNode = $('stairType');
  const turnTypeNode = $('turnType');
  if (!stairTypeNode || !turnTypeNode || !card) return;

  stairTypeNode.value = card.dataset.stairType || 'straight';
  turnTypeNode.value = card.dataset.turnType || 'landing';
  toggleTurnFields();
  syncStairTypeCards();
}

function initStairTypeCards() {
  const cards = Array.from(document.querySelectorAll('.stair-type-card'));
  if (!cards.length) return;

  cards.forEach((card) => {
    card.setAttribute('role', 'radio');
    card.addEventListener('click', () => applyStairTypeCardSelection(card));
    card.addEventListener('keydown', (event) => {
      const horizontalKey = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
      const verticalKey = event.key === 'ArrowDown' || event.key === 'ArrowUp';
      if (!horizontalKey && !verticalKey && event.key !== 'Home' && event.key !== 'End') return;

      event.preventDefault();
      const currentIndex = cards.indexOf(card);
      if (currentIndex < 0) return;

      let nextIndex = currentIndex;
      if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = cards.length - 1;
      else {
        const moveForward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
        const move = moveForward ? 1 : -1;
        nextIndex = (currentIndex + move + cards.length) % cards.length;
      }

      cards[nextIndex].focus();
      applyStairTypeCardSelection(cards[nextIndex]);
    });
  });

  syncStairTypeCards();
}

function toggleTurnFields() {
  const stairTypeNode = $('stairType');
  const openingTypeNode = $('openingType');
  const turnDirection = $('turnDirectionField');
  const turnType = $('turnTypeField');
  const turnDirectionInput = $('turnDirection');
  const turnTypeInput = $('turnType');

  if (!stairTypeNode || !turnDirection || !turnDirectionInput || !turnTypeInput) return;

  const stairType = stairTypeNode.value;
  if (openingTypeNode && openingTypeNode.value !== stairType) {
    openingTypeNode.value = stairType;
  }

  const showTurnDirection = stairType === 'l_turn';
  const showTurnType = stairType !== 'straight';

  turnDirection.classList.toggle('hidden', !showTurnDirection);
  turnDirectionInput.disabled = !showTurnDirection;

  if (turnType) turnType.classList.toggle('hidden', !showTurnType);
  turnTypeInput.disabled = !showTurnType;

  syncStairTypeCards();
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

function validateBaseDimensions(config) {
  if (!config.floor_to_floor_height || config.floor_to_floor_height <= 0) {
    return 'Укажите корректную высоту этаж-этаж.';
  }
  if (!config.opening_length || config.opening_length <= 0) {
    return 'Недостаточная длина проёма: укажите корректное значение.';
  }
  if (!config.opening_width || config.opening_width <= 0) {
    return 'Недостаточная ширина проёма: укажите корректное значение.';
  }
  if (!config.march_width || config.march_width <= 0) {
    return 'Укажите корректную ширину марша.';
  }
  return null;
}

function buildInvalidGeometry(reason) {
  return {
    valid: false,
    status: 'invalid',
    reason,
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

function assessTurnAvailableRun(config) {
  const minGap = 50;
  if (config.march_width + minGap > config.opening_width) {
    return { valid: false, reason: 'Ширина марша слишком большая для заданной ширины проёма.' };
  }

  const availableUpperRun = config.opening_width - config.march_width;
  if (availableUpperRun < FORMULA_LIMITS.minTreadDepth * 3) {
    return { valid: false, reason: 'Недостаточная ширина проёма для верхнего марша Г-образной лестницы.' };
  }

  const turnElementLength =
    config.turn_type === 'landing'
      ? Math.max(config.march_width, 900)
      : Math.max(Math.round(config.march_width * 0.9), 750);

  const availableLowerRun = config.opening_length - turnElementLength;
  if (availableLowerRun < FORMULA_LIMITS.minTreadDepth * 3) {
    return { valid: false, reason: 'Недостаточная длина проёма для нижнего марша Г-образной лестницы.' };
  }

  return {
    valid: true,
    availableLowerRun,
    availableUpperRun,
    turnElementLength
  };
}

function calculateLTurnGeometry(config) {
  const baseValidationError = validateBaseDimensions(config);
  if (baseValidationError) return buildInvalidGeometry(baseValidationError);

  const runAssessment = assessTurnAvailableRun(config);
  if (!runAssessment.valid) return buildInvalidGeometry(runAssessment.reason);

  const risersForTurn = config.turn_type === 'winders' ? 3 : 1;
  const combinedRun = runAssessment.availableLowerRun + runAssessment.availableUpperRun;
  const totalStraight = calculateStraightGeometry({
    ...config,
    opening_length: combinedRun
  });
  if (!totalStraight.valid) {
    return buildInvalidGeometry(totalStraight.reason || 'Не удалось подобрать суммарную геометрию Г-образной лестницы.');
  }

  const marchRisers = totalStraight.riser_count - risersForTurn;
  if (marchRisers < 6) {
    return buildInvalidGeometry('Слишком мало подъёмов для выбранного типа поворота. Увеличьте высоту лестницы или смените тип поворота.');
  }

  const splitRatio = runAssessment.availableLowerRun / (combinedRun || 1);
  const lowerRisers = Math.max(3, Math.round(marchRisers * splitRatio));
  const upperRisers = marchRisers - lowerRisers;

  if (upperRisers < 3) {
    return buildInvalidGeometry('Недостаточно подъёмов для верхнего марша после поворота. Увеличьте проём или высоту.');
  }
  return invalid('Не удалось подобрать Г-образную геометрию под заданный проём.');
}

  const riserHeight = totalStraight.riser_height;
  const lowerTreads = lowerRisers;
  const upperTreads = upperRisers - 1;

  if (lowerTreads < 3 || upperTreads < 2) {
    return buildInvalidGeometry('Недостаточно ступеней для формирования Г-образной лестницы.');
  }

  const lowerTreadDepth = runAssessment.availableLowerRun / lowerTreads;
  const upperTreadDepth = runAssessment.availableUpperRun / upperTreads;

  if (lowerTreadDepth < FORMULA_LIMITS.minTreadDepth) {
    return buildInvalidGeometry('Недостаточная длина проёма: нижний марш не помещается с минимальной глубиной проступи.');
  }
  if (upperTreadDepth < FORMULA_LIMITS.minTreadDepth) {
    return buildInvalidGeometry('Недостаточная ширина проёма: верхний марш не помещается с минимальной глубиной проступи.');
  }
  if (lowerTreadDepth > FORMULA_LIMITS.maxTreadDepth || upperTreadDepth > FORMULA_LIMITS.maxTreadDepth) {
    return buildInvalidGeometry('Проём слишком велик для выбранной высоты: проступи получаются слишком глубокими.');
  }

  const avgTreadDepth = (lowerTreadDepth * lowerTreads + upperTreadDepth * upperTreads) / (lowerTreads + upperTreads);
  const stairAngle = Number(((Math.atan(riserHeight / avgTreadDepth) * 180) / Math.PI).toFixed(2));
  if (stairAngle > FORMULA_LIMITS.maxRecommendedAngle) {
    return buildInvalidGeometry('Лестница становится слишком крутой. Увеличьте длину или ширину проёма.');
  }

  const comfortValue = Number((2 * riserHeight + avgTreadDepth).toFixed(1));
  const comfortDeviation = Math.abs(comfortValue - FORMULA_LIMITS.targetComfort);
  const comfortStatus =
    comfortDeviation <= FORMULA_LIMITS.maxComfortDeviationForComfortable
      ? 'comfortable'
      : comfortDeviation > FORMULA_LIMITS.maxComfortDeviationForAcceptable
        ? 'too_steep'
        : 'acceptable';

  const totalRunLength = runAssessment.availableLowerRun + runAssessment.availableUpperRun + runAssessment.turnElementLength;
  const lowerRise = lowerRisers * riserHeight;
  const upperRise = upperRisers * riserHeight;
  const lowerStringer = Math.hypot(lowerRise, runAssessment.availableLowerRun);
  const upperStringer = Math.hypot(upperRise, runAssessment.availableUpperRun);

  return {
    valid: true,
    riser_count: totalStraight.riser_count,
    tread_count: lowerTreads + upperTreads,
    riser_height: riserHeight,
    tread_depth: Number(avgTreadDepth.toFixed(1)),
    comfort_value: comfortValue,
    comfort_deviation: Number(comfortDeviation.toFixed(1)),
    stair_angle_deg: stairAngle,
    run_length: Math.round(totalRunLength),
    stringer_length: Math.round(lowerStringer + upperStringer + runAssessment.turnElementLength),
    status: comfortStatus,
    reason: comfortStatus === 'too_steep' ? 'Формула удобства и угол близки к предельным.' : null,
    turn_node: {
      type: config.turn_type,
      direction: config.turn_direction,
      element_length: runAssessment.turnElementLength,
      risers_in_turn: risersForTurn
    },
    lower_march: {
      risers: lowerRisers,
      treads: lowerTreads,
      run_length: Math.round(runAssessment.availableLowerRun),
      tread_depth: Number(lowerTreadDepth.toFixed(1))
    },
    upper_march: {
      risers: upperRisers,
      treads: upperTreads,
      run_length: Math.round(runAssessment.availableUpperRun),
      tread_depth: Number(upperTreadDepth.toFixed(1))
    }
  };
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

  if (config.stair_type === 'u_turn') {
    return buildInvalidGeometry('П-образная лестница пока не реализована в расчёте.');
  }
  return steps;
}

function renderGeometry(geometry) {
  const root = $('geometryResult'); const warnings = $('geometryWarnings');
  if (!root || !warnings) return;
  if (!geometry.valid) {
    root.innerHTML = '<div class="warning">Расчёт геометрии недоступен для текущих параметров.</div>';
    warnings.innerHTML = `<div class="warning">${geometry.reason || 'Проверьте исходные параметры.'}</div>`;
    return;
  }

  const statusText = { comfortable: 'Комфортно', acceptable: 'Допустимо', too_steep: 'На границе', invalid: 'Ошибка' };
  const rows = [
    ['Тип лестницы', LABELS.stair_type[state.lastConfig.stair_type] || state.lastConfig.stair_type],
    ['Статус удобства', `<span class="badge ${geometry.status}">${statusText[geometry.status] || geometry.status}</span>`],
    ['Количество подъёмов', `${geometry.riser_count}`],
    ['Количество проступей', `${geometry.tread_count}`],
    ['Высота подступенка', `${geometry.riser_height} мм`],
    ['Глубина проступи', `${geometry.tread_depth} мм`],
    ['Формула 2h+b', `${geometry.comfort_value} мм`],
    ['Угол', `${geometry.stair_angle_deg}°`],
    ['Длина маршей', `${geometry.run_length} мм`],
    ['Длина косоуров', `${geometry.stringer_length} мм`]
  ];
  if (geometry.turn_node) {
    rows.push(['Поворотный узел', `${geometry.turn_node.type}, ${geometry.turn_node.direction}`]);
    rows.push(['Элемент поворота', `${geometry.turn_node.element_length} мм`]);
    rows.push([
      'Нижний марш',
      `${geometry.lower_march?.risers || 0} под., ${geometry.lower_march?.treads || 0} прост., ${geometry.lower_march?.run_length || 0} мм`
    ]);
    rows.push([
      'Верхний марш',
      `${geometry.upper_march?.risers || 0} под., ${geometry.upper_march?.treads || 0} прост., ${geometry.upper_march?.run_length || 0} мм`
    ]);
  }
  root.innerHTML = `<table class="result-table"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;

  const warningList = [];
  if (geometry.reason) warningList.push(geometry.reason);
  if (geometry.stair_angle_deg > FORMULA_LIMITS.maxRecommendedAngle - 2) warningList.push('Угол близок к верхней рекомендуемой границе.');
  if (geometry.tread_depth < FORMULA_LIMITS.minTreadDepth + 10) warningList.push('Глубина проступи близка к минимальной.');
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
  const geometry = calculateGeometry(config);
  state.geometry = geometry;
  renderGeometry(geometry);
  if (geometry.valid) {
    setStatus('Геометрия рассчитана');
  } else if (config.stair_type === 'u_turn') {
    setStatus('П-образная лестница пока не реализована');
  } else {
    setStatus('Проверьте исходные параметры');
  }
  showStep(2);
}

function runConfigurator() {
  const config = getConfigFromForm();
  const geometry = calculateGeometry(config);
  state.geometry = geometry;
  renderGeometry(geometry);

  const materials = calculateMaterials(config, geometry);
  state.materials = materials;
  renderMaterials(materials);

  state.price = calculatePrice(config, geometry, materials);
  renderPrice(state.price);

  if (geometry.valid) {
    setStatus('Геометрия рассчитана');
  } else if (config.stair_type === 'u_turn') {
    setStatus('П-образная лестница пока не реализована');
  } else {
    setStatus('Проверьте исходные параметры');
  }

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
  const stairTypeNode = $('stairType');
  const openingTypeNode = $('openingType');
  const turnTypeNode = $('turnType');
  const calculateBtn = $('calculateBtn');
  const toResultsBtn = $('toResultsBtn');

  if (!stairTypeNode || !turnTypeNode || !calculateBtn || !toResultsBtn) return;

  stairTypeNode.addEventListener('change', toggleTurnFields);
  turnTypeNode.addEventListener('change', syncStairTypeCards);
  if (openingTypeNode) {
    openingTypeNode.addEventListener('change', () => {
      stairTypeNode.value = openingTypeNode.value;
      if (openingTypeNode.value === 'straight') {
        turnTypeNode.value = 'landing';
      }
      toggleTurnFields();
    });
  }
  calculateBtn.addEventListener('click', runConfigurator);
  toResultsBtn.addEventListener('click', runGeometryCalculation);

  initStairTypeCards();
  toggleTurnFields();
  updateStairTypeHints();
  loadSupabaseDictionaries();
}

init();
