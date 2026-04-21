import { calculateStairGeometry } from './stair-geometry-engine.js';
import {
  calculateMetalMaterials,
  calculateWoodMaterials,
  calculateConcreteMaterials
} from './stair-materials.js';

const STORAGE_KEY = 'tekstura_stair_calc_payload';

const state = {
  config: null,
  geometry: null,
  materials: null,
  price: null,
  payload: null,
  dictionaries: {
    defaults: {
      labor_rate_per_step: 2500,
      metal_rate_per_meter: 1800,
      wood_rate_per_m2: 16000,
      concrete_rate_per_m3: 14000,
      install_coef: 1.12,
      markup_coef: 1.08
    },
    materialRules: []
  }
};

const STATUS_META = {
  recommended: {
    label: 'Рекомендуемая',
    badge: 'recommended',
    title: 'Геометрия выглядит уверенно',
    text: 'Подбор находится в комфортных пределах, можно переходить к материалам и ориентиру стоимости.'
  },
  warning: {
    label: 'Нужна проверка',
    badge: 'warning',
    title: 'Предварительно подходит, но требует ручной проверки',
    text: 'Геометрия может быть реализуемой, однако один или несколько параметров находятся рядом с инженерной границей.'
  },
  invalid: {
    label: 'Инженерная проверка',
    badge: 'invalid',
    title: 'Онлайн-подбор не нашёл безопасное решение',
    text: 'Для текущего проёма калькулятор не нашёл достаточно удобную и безопасную геометрию.'
  }
};

const STAIR_LABELS = {
  straight: 'Прямая',
  l_turn: 'Г-образная',
  u_turn: 'П-образная'
};

const TURN_LABELS = {
  landing: 'площадка',
  winders: 'забежные ступени'
};

const BASE_CONDITION_LABELS = {
  empty_opening: 'Пустой проём',
  existing_metal_frame: 'Готовый металлокаркас',
  existing_concrete_base: 'Готовое бетонное основание',
  finish_only: 'Только отделка / облицовка',
  consultation: 'Консультация'
};

const OPTION_LABELS = {
  finish_material: {
    oak: 'Дуб / шпон',
    ash: 'Ясень',
    stone: 'Камень',
    porcelain: 'Керамогранит',
    microcement: 'Микроцемент'
  },
  railing: {
    metal: 'Металл',
    glass: 'Стекло',
    wood: 'Дерево',
    none: 'Не нужно'
  },
  coating: {
    standard: 'Стандартное',
    premium: 'Премиальное',
    none: 'Не требуется'
  },
  lighting: {
    none: 'Не нужна',
    step: 'Точечная по ступеням',
    linear: 'Линейная'
  }
};

const SCENARIO_RATES = {
  finishMaterialPerM2: {
    oak: 22000,
    ash: 19000,
    stone: 34000,
    porcelain: 17500,
    microcement: 15500
  },
  railingPerM: {
    metal: 9500,
    glass: 18000,
    wood: 12500,
    none: 0
  },
  lightingPerStep: {
    none: 0,
    step: 1400,
    linear: 2100
  },
  coatingPerM2: {
    none: 0,
    standard: 2200,
    premium: 3600
  },
  fitCheck: 15000,
  prepPerM2: 4200,
  installPerM2: 5200
};

const $ = (id) => document.getElementById(id);
const formatMm = (value) => `${new Intl.NumberFormat('ru-RU').format(Math.round(value || 0))} мм`;
const round = (value, digits = 2) => Number((value || 0).toFixed(digits));

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showStep(step) {
  document.querySelectorAll('.step').forEach((node) => node.classList.remove('active'));
  $(`step${step}`)?.classList.add('active');
}

window.nextStep = showStep;
window.prevStep = showStep;

function setStatus(message = '') {
  const statusNode = $('pageStatus');
  if (statusNode) statusNode.textContent = message;
}

function getStairLabel(config, geometry = null) {
  const base = STAIR_LABELS[config?.stair_type] || STAIR_LABELS.straight;
  if (!config || config.stair_type === 'straight') return base;
  const turnLabel = geometry?.turn_node?.label || TURN_LABELS[config.turn_type] || '';
  return `${base}, ${turnLabel}`;
}

function toggleTurnFields() {
  const stairTypeNode = $('stairType');
  const turnDirection = $('turnDirectionField');
  const turnType = $('turnTypeField');
  const baseCondition = $('baseCondition')?.value || 'empty_opening';

  if (!stairTypeNode || !turnDirection || !turnType) return;

  const usesStructuralShape = ['empty_opening', 'existing_metal_frame'].includes(baseCondition);
  const isStraight = stairTypeNode.value === 'straight' || !usesStructuralShape;
  turnDirection.classList.toggle('hidden', isStraight);
  turnType.classList.toggle('hidden', isStraight);
}

function setHidden(id, hidden) {
  $(id)?.classList.toggle('hidden', hidden);
}

function updateScenarioFields() {
  const baseCondition = $('baseCondition')?.value || 'empty_opening';
  const isEmptyOpening = baseCondition === 'empty_opening';
  const isExistingMetal = baseCondition === 'existing_metal_frame';
  const isExistingConcrete = baseCondition === 'existing_concrete_base';
  const isFinishOnly = baseCondition === 'finish_only';
  const isConsultation = baseCondition === 'consultation';
  const usesGeometryInputs = isEmptyOpening || isExistingMetal;
  const usesStructuralShape = isEmptyOpening || isExistingMetal;
  const usesServiceOptions = isExistingMetal || isExistingConcrete || isFinishOnly;

  document.querySelectorAll('.structural-field').forEach((node) => {
    node.classList.toggle('hidden', !usesStructuralShape);
  });

  setHidden('geometryInputGroup', !usesGeometryInputs);
  setHidden('existingMetalGroup', !isExistingMetal);
  setHidden('existingConcreteGroup', !isExistingConcrete);
  setHidden('finishOnlyGroup', !isFinishOnly);
  setHidden('consultationGroup', !isConsultation);
  setHidden('pricingInputGroup', isConsultation);
  setHidden('frameMaterialField', !isEmptyOpening);
  setHidden('serviceOptionsGroup', !usesServiceOptions);

  const toResultsBtn = $('toResultsBtn');
  if (toResultsBtn) {
    if (isEmptyOpening) toResultsBtn.textContent = 'Рассчитать геометрию';
    if (isExistingMetal) toResultsBtn.textContent = 'Проверить посадку и отделку';
    if (isExistingConcrete) toResultsBtn.textContent = 'Рассчитать облицовку основания';
    if (isFinishOnly) toResultsBtn.textContent = 'Рассчитать отделку';
    if (isConsultation) toResultsBtn.textContent = 'Подготовить заявку на консультацию';
  }

  toggleTurnFields();
}

function getConfigFromForm() {
  return {
    base_condition: $('baseCondition')?.value || 'empty_opening',
    opening_type: $('openingType')?.value || 'straight',
    stair_type: $('stairType')?.value || 'straight',
    turn_direction: $('turnDirection')?.value || 'right',
    turn_type: $('turnType')?.value || 'landing',
    floor_to_floor_height: Number($('floorHeight')?.value || 0),
    slab_thickness: Number($('slabThickness')?.value || 220),
    finish_thickness_top: Number($('finishThicknessTop')?.value || 0),
    finish_thickness_bottom: Number($('finishThicknessBottom')?.value || 0),
    opening_length: Number($('openingLength')?.value || 0),
    opening_width: Number($('openingWidth')?.value || 0),
    march_width: Number($('marchWidth')?.value || 0),
    frame_material: $('frameMaterial')?.value || 'metal',
    finish_level: $('finishLevel')?.value || 'basic',
    finish_material: $('finishMaterial')?.value || 'oak',
    railing_option: $('railingOption')?.value || 'metal',
    coating_option: $('coatingOption')?.value || 'standard',
    lighting_option: $('lightingOption')?.value || 'none',
    metal_frame_condition: $('metalFrameCondition')?.value || 'good',
    existing_frame_notes: $('existingFrameNotes')?.value || '',
    concrete_step_count: Number($('concreteStepCount')?.value || 0),
    concrete_stair_width: Number($('concreteStairWidth')?.value || 0),
    concrete_tread_depth: Number($('concreteTreadDepth')?.value || 0),
    concrete_base_condition: $('concreteBaseCondition')?.value || 'ready',
    finish_step_count: Number($('finishStepCount')?.value || 0),
    finish_stair_width: Number($('finishStairWidth')?.value || 0),
    finish_tread_depth: Number($('finishTreadDepth')?.value || 0),
    finish_only_notes: $('finishOnlyNotes')?.value || '',
    consultation_notes: $('consultationNotes')?.value || ''
  };
}

function svgPolyline(points, getX = (point) => point.x, getY = (point) => point.y) {
  return points.map((point) => `${getX(point)},${getY(point)}`).join(' ');
}

function renderTopView(geometry) {
  const viz = geometry.visualization;
  if (!viz?.walking_line?.length) return '';

  const bounds = viz.bounds;
  const viewWidth = Math.max(bounds.max_x - bounds.min_x, 1000);
  const viewHeight = Math.max(bounds.max_y - bounds.min_y, 900);
  const warningPoints = (viz.warning_points || []).slice(0, 28);
  const path = svgPolyline(viz.walking_line);

  return `
    <article class="diagram-card">
      <div class="diagram-title">План</div>
      <svg class="stair-svg" viewBox="${bounds.min_x} ${bounds.min_y} ${viewWidth} ${viewHeight}" role="img" aria-label="План лестницы и проёма">
        <rect class="svg-opening" x="0" y="0" width="${viz.opening.length}" height="${viz.opening.width}" rx="18"></rect>
        <polyline class="svg-stair-line" points="${path}"></polyline>
        <polyline class="svg-walk-line" points="${path}"></polyline>
        ${(viz.walking_line || [])
          .map((point, index) => `<circle class="svg-node" cx="${point.x}" cy="${point.y}" r="${index === 0 ? 28 : 18}"></circle>`)
          .join('')}
        ${warningPoints
          .map((point) => `<circle class="svg-warning-zone" cx="${point.x}" cy="${point.y}" r="42"></circle>`)
          .join('')}
        <text class="svg-label" x="${viz.opening.length / 2}" y="-80" text-anchor="middle">проём ${formatMm(viz.opening.length)}</text>
        <text class="svg-label" x="${viz.opening.length + 80}" y="${viz.opening.width / 2}" transform="rotate(90 ${viz.opening.length + 80} ${viz.opening.width / 2})" text-anchor="middle">ширина ${formatMm(viz.opening.width)}</text>
        <text class="svg-label svg-label-strong" x="${viz.walking_line[0].x}" y="${viz.walking_line[0].y - 90}" text-anchor="middle">старт</text>
        <text class="svg-label svg-label-strong" x="${viz.walking_line.at(-1).x}" y="${viz.walking_line.at(-1).y - 90}" text-anchor="middle">верх</text>
      </svg>
    </article>
  `;
}

function renderSideView(geometry) {
  const viz = geometry.visualization;
  if (!viz?.side_profile?.length) return '';

  const floorHeight = geometry.input?.floor_to_floor_height || geometry.riser_height * geometry.riser_count;
  const runLength = Math.max(geometry.walking_line_length || geometry.run_length || 1000, 1000);
  const baseY = floorHeight + 240;
  const topY = baseY - floorHeight;
  const undersideY = baseY - viz.slab_underside_height;
  const viewBox = `-140 0 ${runLength + 360} ${baseY + 120}`;
  const sidePoints = svgPolyline(
    viz.side_profile,
    (point) => point.distance,
    (point) => baseY - point.height
  );
  const warningPoints = (viz.warning_points || []).slice(0, 28);

  return `
    <article class="diagram-card">
      <div class="diagram-title">Разрез</div>
      <svg class="stair-svg" viewBox="${viewBox}" role="img" aria-label="Боковой разрез лестницы">
        <line class="svg-floor" x1="0" y1="${baseY}" x2="${runLength}" y2="${baseY}"></line>
        <line class="svg-floor" x1="0" y1="${topY}" x2="${runLength}" y2="${topY}"></line>
        <rect class="svg-slab" x="0" y="${topY}" width="${runLength}" height="${Math.max(0, undersideY - topY)}"></rect>
        <line class="svg-slab-line" x1="0" y1="${undersideY}" x2="${runLength}" y2="${undersideY}"></line>
        <polyline class="svg-side-line" points="${sidePoints}"></polyline>
        ${warningPoints
          .map((point) => {
            const y = baseY - point.height;
            return `<line class="svg-clearance-warning" x1="${point.distance}" y1="${y}" x2="${point.distance}" y2="${undersideY}"></line><circle class="svg-warning-dot" cx="${point.distance}" cy="${y}" r="20"></circle>`;
          })
          .join('')}
        <text class="svg-label" x="${runLength / 2}" y="${topY - 70}" text-anchor="middle">этаж-этаж ${formatMm(floorHeight)}</text>
        <text class="svg-label" x="${runLength - 20}" y="${undersideY - 35}" text-anchor="end">низ перекрытия</text>
        <text class="svg-label svg-label-strong" x="${runLength / 2}" y="${baseY + 80}" text-anchor="middle">линия движения ${formatMm(geometry.walking_line_length || geometry.run_length)}</text>
      </svg>
    </article>
  `;
}

function renderGeometryDiagram(geometry) {
  const root = $('geometryDiagram');
  if (!root) return;

  if (!geometry.visualization) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = `
    <div class="diagram-grid">
      ${renderTopView(geometry)}
      ${renderSideView(geometry)}
    </div>
  `;
}

function getFinishLevelCoef(level) {
  if (level === 'premium') return 1.2;
  if (level === 'standard') return 1.08;
  return 1;
}

function getFinishMetricsFromGeometry(config, geometry) {
  const widthM = (config.march_width || 1000) / 1000;
  const treadDepthM = (geometry.tread_depth || 280) / 1000;
  const stepCount = Math.max(geometry.tread_count || 0, 1);
  const finishAreaM2 = round(stepCount * widthM * treadDepthM, 2);
  const railingLengthM =
    config.railing_option === 'none'
      ? 0
      : round(((geometry.walking_line_length || geometry.run_length || 0) / 1000) + 1.2, 2);

  return {
    stepCount,
    finishAreaM2,
    railingLengthM,
    coatingAreaM2: round(((geometry.walking_line_length || geometry.run_length || 0) / 1000) * widthM * 0.55, 2)
  };
}

function getFinishMetricsFromManualInputs(config, source) {
  const stepCount = Math.max(Number(config[`${source}_step_count`] || 0), 0);
  const widthM = Math.max(Number(config[`${source}_stair_width`] || 0), 0) / 1000;
  const treadDepthM = Math.max(Number(config[`${source}_tread_depth`] || 0), 0) / 1000;
  const finishAreaM2 = round(stepCount * widthM * treadDepthM, 2);
  const railingLengthM = config.railing_option === 'none' ? 0 : round(stepCount * treadDepthM + 1.2, 2);

  return {
    stepCount,
    finishAreaM2,
    railingLengthM,
    coatingAreaM2: finishAreaM2
  };
}

function makeScenarioResult(config, overrides) {
  const status = overrides.status || 'recommended';
  return {
    valid: overrides.valid ?? status !== 'invalid',
    allow_continue: overrides.allow_continue ?? status !== 'invalid',
    status,
    warnings: overrides.warnings || [],
    blockers: overrides.blockers || [],
    adjustment_hints: overrides.adjustment_hints || [],
    result_kind: overrides.result_kind,
    base_condition: config.base_condition,
    alert_title: overrides.alert_title,
    alert_text: overrides.alert_text,
    summary_rows: overrides.summary_rows || [],
    service_metrics: overrides.service_metrics || null,
    visualization: overrides.visualization || null,
    riser_count: overrides.riser_count || 0,
    tread_count: overrides.tread_count || 0,
    riser_height: overrides.riser_height || 0,
    tread_depth: overrides.tread_depth || 0,
    comfort_value: overrides.comfort_value || 0,
    stair_angle_deg: overrides.stair_angle_deg || 0,
    run_length: overrides.run_length || 0,
    walking_line_length: overrides.walking_line_length || 0,
    stringer_length: overrides.stringer_length || 0,
    headroom_min: overrides.headroom_min || 0,
    lower_march: overrides.lower_march || null,
    upper_march: overrides.upper_march || null,
    turn_node: overrides.turn_node || null
  };
}

function calculateScenarioResult(config) {
  if (config.base_condition === 'empty_opening') {
    return {
      ...calculateStairGeometry(config),
      result_kind: 'full_staircase',
      base_condition: config.base_condition,
      allow_continue: undefined
    };
  }

  if (config.base_condition === 'existing_metal_frame') {
    const fit = calculateStairGeometry(config);
    const warnings = [...(fit.warnings || [])];
    const blockers = [...(fit.blockers || [])];

    if (config.metal_frame_condition === 'needs_repair') {
      warnings.push('Состояние металлокаркаса лучше проверить инженеру по фото или на объекте.');
    } else if (config.metal_frame_condition === 'needs_coating') {
      warnings.push('В расчёт добавлено обновление покрытия металлокаркаса.');
    }

    const status = blockers.length ? 'invalid' : warnings.length || fit.status === 'warning' ? 'warning' : 'recommended';
    const metrics = getFinishMetricsFromGeometry(config, fit);

    return makeScenarioResult(config, {
      ...fit,
      valid: status !== 'invalid',
      allow_continue: status !== 'invalid',
      status,
      warnings,
      blockers,
      result_kind: 'existing_metal_frame',
      service_metrics: metrics,
      alert_title: status === 'recommended' ? 'Каркас проверен для отделки' : undefined,
      alert_text:
        'Новый металлокаркас не рассчитываем: учитываем посадку существующей конструкции, отделку, ограждение, покрытие, подсветку и монтаж.',
      summary_rows: [
        ['Сценарий', BASE_CONDITION_LABELS.existing_metal_frame],
        ['Проверка посадки', fit.status === 'invalid' ? 'нужна инженерная проверка' : 'выполнена по линии движения'],
        ['Состояние каркаса', $('metalFrameCondition')?.selectedOptions?.[0]?.textContent || 'уточняется'],
        ['Отделка ступеней', `${metrics.finishAreaM2} м²`],
        ['Ограждение', OPTION_LABELS.railing[config.railing_option]],
        ['Подсветка', OPTION_LABELS.lighting[config.lighting_option]]
      ],
      adjustment_hints: fit.adjustment_hints
    });
  }

  if (config.base_condition === 'existing_concrete_base') {
    const metrics = getFinishMetricsFromManualInputs(config, 'concrete');
    const warnings = [];
    const blockers = [];

    if (!metrics.stepCount || !metrics.finishAreaM2) blockers.push('Укажите количество ступеней и базовые размеры бетонного основания.');
    if (config.concrete_base_condition === 'prep_needed') warnings.push('Добавлена подготовка поверхности перед облицовкой.');
    if (config.concrete_base_condition === 'repair_needed') warnings.push('Есть сколы или перепады: нужна ручная проверка объёма подготовки.');

    const status = blockers.length ? 'invalid' : warnings.length ? 'warning' : 'recommended';

    return makeScenarioResult(config, {
      status,
      result_kind: 'existing_concrete_base',
      warnings,
      blockers,
      service_metrics: metrics,
      alert_title: status === 'recommended' ? 'Бетонное основание готово к расчёту отделки' : undefined,
      alert_text:
        'Считаем облицовку, ограждение, финишную подготовку и монтажные работы без расчёта нового каркаса.',
      summary_rows: [
        ['Сценарий', BASE_CONDITION_LABELS.existing_concrete_base],
        ['Ступеней', `${metrics.stepCount}`],
        ['Площадь облицовки', `${metrics.finishAreaM2} м²`],
        ['Основание', $('concreteBaseCondition')?.selectedOptions?.[0]?.textContent || 'уточняется'],
        ['Ограждение', OPTION_LABELS.railing[config.railing_option]],
        ['Материал отделки', OPTION_LABELS.finish_material[config.finish_material]]
      ],
      adjustment_hints: ['приложить фото бетонного основания', 'уточнить перепады и сколы перед финальной сметой']
    });
  }

  if (config.base_condition === 'finish_only') {
    const metrics = getFinishMetricsFromManualInputs(config, 'finish');
    const blockers = [];
    if (!metrics.stepCount || !metrics.finishAreaM2) blockers.push('Укажите количество ступеней и размеры отделки.');

    return makeScenarioResult(config, {
      status: blockers.length ? 'invalid' : 'recommended',
      result_kind: 'finish_only',
      blockers,
      service_metrics: metrics,
      alert_title: 'Считаем только отделку',
      alert_text:
        'Структурную геометрию и каркас пропускаем: в расчёте остаются материалы отделки, ограждение при необходимости и монтаж.',
      summary_rows: [
        ['Сценарий', BASE_CONDITION_LABELS.finish_only],
        ['Ступеней', `${metrics.stepCount}`],
        ['Площадь отделки', `${metrics.finishAreaM2} м²`],
        ['Материал отделки', OPTION_LABELS.finish_material[config.finish_material]],
        ['Ограждение', OPTION_LABELS.railing[config.railing_option]],
        ['Подсветка', OPTION_LABELS.lighting[config.lighting_option]]
      ],
      adjustment_hints: ['приложить фото текущей лестницы', 'уточнить материал ступеней и подступенков']
    });
  }

  return makeScenarioResult(config, {
    status: 'warning',
    valid: false,
    allow_continue: false,
    result_kind: 'consultation',
    alert_title: 'Передадим задачу инженеру',
    alert_text:
      'Для консультации калькулятор не строит геометрию и не делает смету вслепую. Отправьте вводные, и специалист предложит следующий шаг.',
    summary_rows: [
      ['Сценарий', BASE_CONDITION_LABELS.consultation],
      ['Задача', config.consultation_notes || 'Клиент хочет обсудить варианты с инженером']
    ],
    warnings: ['Консультационный сценарий требует ручного разбора.'],
    adjustment_hints: ['приложить фото проёма или текущей лестницы', 'указать город и удобный способ связи']
  });
}

function getVisibleMessages(geometry) {
  const messages = geometry.status === 'invalid' ? geometry.blockers || [] : geometry.warnings || [];
  return [...new Set(messages)].slice(0, 4);
}

function renderGeometryAlert(geometry, config) {
  const warnings = $('geometryWarnings');
  if (!warnings) return;

  const meta = STATUS_META[geometry.status] || STATUS_META.warning;
  const title = geometry.alert_title || meta.title;
  const text = geometry.alert_text || meta.text;
  const messages = getVisibleMessages(geometry);
  const hints = geometry.adjustment_hints || [];
  const reviewUrl = buildRequestUrl(buildCalculationPayload(config, geometry, null, null), 'engineer_review');

  if (geometry.status === 'recommended') {
    warnings.innerHTML = `
      <div class="geometry-alert ok-state">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    return;
  }

  if (geometry.status === 'warning') {
    warnings.innerHTML = `
      <div class="geometry-alert warning-state">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
        ${messages.length ? `<ul>${messages.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
        <a class="btn-review inline" href="${reviewUrl}">Отправить размеры на инженерную проверку</a>
      </div>
    `;
    return;
  }

  warnings.innerHTML = `
    <div class="geometry-alert invalid-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)} Лучше отправить размеры инженеру: он проверит вводные и возможные варианты компоновки.</p>
      ${hints.length ? `<div class="hint-title">Сначала стоит попробовать:</div><ul>${hints.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      <a class="btn-review inline strong" href="${reviewUrl}">Отправить размеры на инженерную проверку</a>
    </div>
  `;
}

function renderGeometry(geometry) {
  const root = $('geometryResult');
  if (!root) return;

  const config = state.config || getConfigFromForm();
  const meta = STATUS_META[geometry.status] || STATUS_META.warning;
  const comfortClass = `badge ${meta.badge}`;
  const rows = geometry.summary_rows?.length
    ? [
        ['Статус', `<span class="${comfortClass}">${meta.label}</span>`],
        ...geometry.summary_rows.map(([key, value]) => [key, escapeHtml(value)])
      ]
    : [
        ['Статус', `<span class="${comfortClass}">${meta.label}</span>`],
        ['Тип', escapeHtml(getStairLabel(config, geometry))],
        ['Количество подъёмов', `${geometry.riser_count}`],
        ['Высота подступенка', formatMm(geometry.riser_height)],
        ['Количество проступей', `${geometry.tread_count}`],
        ['Глубина проступи', formatMm(geometry.tread_depth)],
        ['Формула 2h + b', formatMm(geometry.comfort_value)],
        ['Угол наклона', `${geometry.stair_angle_deg || 0}°`],
        ['Линия движения', formatMm(geometry.walking_line_length || geometry.run_length)],
        ['Минимальный просвет', geometry.headroom_min ? formatMm(geometry.headroom_min) : 'нужно уточнить']
      ];

  if (geometry.turn_node) {
    rows.push(['Поворотный узел', `${escapeHtml(geometry.turn_node.label)}, ${geometry.turn_node.direction === 'left' ? 'левый' : 'правый'}`]);
  }

  if (geometry.lower_march && geometry.upper_march) {
    rows.push(['Нижний марш', `${geometry.lower_march.tread_count} проступей`]);
    rows.push(['Верхний марш', `${geometry.upper_march.tread_count} проступей`]);
  }

  root.innerHTML = `
    <div class="result-heading">
      <div>
        <div class="eyebrow">phase 1 geometry</div>
        <h3>${escapeHtml(meta.label)}</h3>
      </div>
      <span class="${comfortClass}">${escapeHtml(BASE_CONDITION_LABELS[config.base_condition] || getStairLabel(config, geometry))}</span>
    </div>
    <table class="result-table">
      <tbody>
        ${rows.map(([key, value]) => `<tr><th>${key}</th><td>${value}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  renderGeometryDiagram(geometry);
  renderGeometryAlert(geometry, config);
  updateGeometryActions(geometry);
}

function calculateMaterials(config, geometry) {
  if (config.base_condition !== 'empty_opening') {
    if (!geometry.valid) {
      return { valid: false, reason: 'Нужна инженерная проверка перед расчётом состава работ.' };
    }

    const metrics = geometry.service_metrics || {};
    const items = [
      { label: 'Сценарий', value: BASE_CONDITION_LABELS[config.base_condition] || 'Уточняется' },
      { label: 'Материал отделки', value: OPTION_LABELS.finish_material[config.finish_material] || 'Уточняется' },
      { label: 'Площадь отделки', value: `${metrics.finishAreaM2 || 0} м²` },
      { label: 'Ограждение', value: metrics.railingLengthM ? `${OPTION_LABELS.railing[config.railing_option]} · ${metrics.railingLengthM} м` : 'Не требуется' },
      { label: 'Покрытие / защита', value: OPTION_LABELS.coating[config.coating_option] || 'Уточняется' },
      { label: 'Подсветка', value: OPTION_LABELS.lighting[config.lighting_option] || 'Не нужна' },
      { label: 'Монтаж', value: 'Подготовка и установка отделки' }
    ];

    if (config.base_condition === 'existing_metal_frame') {
      items.splice(2, 0, { label: 'Проверка металлокаркаса', value: 'Посадка, покрытие, узлы крепления' });
    }

    if (config.base_condition === 'existing_concrete_base') {
      items.splice(2, 0, { label: 'Подготовка основания', value: config.concrete_base_condition === 'ready' ? 'Минимальная' : 'Расширенная' });
    }

    return {
      valid: true,
      type: config.base_condition,
      items,
      metrics
    };
  }

  if (config.frame_material === 'wood') return calculateWoodMaterials(config, geometry);
  if (config.frame_material === 'concrete') return calculateConcreteMaterials(config, geometry);
  return calculateMetalMaterials(config, geometry);
}

function renderMaterials(materials) {
  const root = $('materialsResult');
  if (!root) return;

  if (!materials.valid) {
    root.innerHTML = `<div class="warning">${escapeHtml(materials.reason)}</div>`;
    return;
  }

  root.innerHTML = `
    <table class="result-table">
      <tbody>
        ${materials.items
          .map((item) => `<tr><th>${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td></tr>`)
          .join('')}
      </tbody>
    </table>
  `;
}

function calculatePrice(config, geometry, materials) {
  if (!geometry.valid || !materials.valid) return null;

  if (config.base_condition !== 'empty_opening') {
    const metrics = materials.metrics || {};
    const finishRate = SCENARIO_RATES.finishMaterialPerM2[config.finish_material] || SCENARIO_RATES.finishMaterialPerM2.oak;
    const finishCoef = getFinishLevelCoef(config.finish_level);
    const finishCost = (metrics.finishAreaM2 || 0) * finishRate * finishCoef;
    const railingCost = (metrics.railingLengthM || 0) * (SCENARIO_RATES.railingPerM[config.railing_option] || 0);
    const lightingCost = (metrics.stepCount || 0) * (SCENARIO_RATES.lightingPerStep[config.lighting_option] || 0);
    const coatingCost = (metrics.coatingAreaM2 || 0) * (SCENARIO_RATES.coatingPerM2[config.coating_option] || 0);
    const prepCost =
      config.base_condition === 'existing_concrete_base' && config.concrete_base_condition !== 'ready'
        ? (metrics.finishAreaM2 || 0) * SCENARIO_RATES.prepPerM2
        : 0;
    const fitCheckCost = config.base_condition === 'existing_metal_frame' ? SCENARIO_RATES.fitCheck : 0;
    const installCost = (metrics.finishAreaM2 || 0) * SCENARIO_RATES.installPerM2;
    const total = finishCost + railingCost + lightingCost + coatingCost + prepCost + fitCheckCost + installCost;

    return {
      total,
      min: total * 0.9,
      max: total * 1.18,
      baseLabor: installCost + fitCheckCost + prepCost,
      materialCost: finishCost + railingCost + lightingCost + coatingCost
    };
  }

  const defaults = state.dictionaries.defaults;
  const baseLabor = geometry.tread_count * defaults.labor_rate_per_step;

  let materialCost = 0;
  if (materials.type === 'metal') {
    materialCost = (materials.metrics.profileTubeLengthM || 0) * defaults.metal_rate_per_meter;
  } else if (materials.type === 'wood') {
    materialCost = (materials.metrics.treadAreaM2 || 0) * defaults.wood_rate_per_m2;
  } else {
    materialCost = (materials.metrics.concreteVolumeM3 || 0) * defaults.concrete_rate_per_m3;
  }

  const finishCoef = getFinishLevelCoef(config.finish_level);

  const total = (baseLabor + materialCost) * defaults.install_coef * defaults.markup_coef * finishCoef;

  return {
    total,
    min: total * 0.92,
    max: total * 1.12,
    baseLabor,
    materialCost
  };
}

function money(value) {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(value || 0))} ₽`;
}

function renderPrice(price) {
  const root = $('priceResult');
  if (!root) return;

  if (!price) {
    root.innerHTML = '<div class="warning">Стоимость недоступна без валидной геометрии и материалов.</div>';
    return;
  }

  root.innerHTML = `
    <div class="price-main">${money(price.total)}</div>
    <div class="muted">Диапазон: ${money(price.min)} — ${money(price.max)}</div>
    <div class="muted">Работы: ${money(price.baseLabor)} · Материалы: ${money(price.materialCost)}</div>
  `;
}

function compactGeometryForPayload(geometry) {
  return {
    result_kind: geometry.result_kind,
    base_condition: geometry.base_condition,
    status: geometry.status,
    summary_rows: geometry.summary_rows || null,
    service_metrics: geometry.service_metrics || null,
    riser_count: geometry.riser_count,
    tread_count: geometry.tread_count,
    riser_height: geometry.riser_height,
    tread_depth: geometry.tread_depth,
    comfort_value: geometry.comfort_value,
    stair_angle_deg: geometry.stair_angle_deg,
    walking_line_length: geometry.walking_line_length || geometry.run_length,
    stringer_length: geometry.stringer_length,
    headroom_min: geometry.headroom_min,
    lower_march: geometry.lower_march,
    upper_march: geometry.upper_march,
    turn_node: geometry.turn_node
      ? {
          type: geometry.turn_node.type,
          direction: geometry.turn_node.direction,
          tread_count: geometry.turn_node.tread_count,
          element_length: geometry.turn_node.element_length
        }
      : null
  };
}

function buildCalculationPayload(config, geometry, materials = state.materials, price = state.price, requestMode = 'calculation') {
  const compactGeometry = compactGeometryForPayload(geometry);
  const warnings = geometry.status === 'invalid' ? geometry.blockers || [] : geometry.warnings || [];

  return {
    schema: 'tekstura.stair.phase1',
    request_mode: requestMode,
    base_condition: config.base_condition,
    baseCondition: BASE_CONDITION_LABELS[config.base_condition] || config.base_condition,
    selected_staircase_type: config.stair_type,
    staircaseType:
      config.base_condition === 'empty_opening' || config.base_condition === 'existing_metal_frame'
        ? getStairLabel(config, geometry)
        : BASE_CONDITION_LABELS[config.base_condition] || getStairLabel(config, geometry),
    status: geometry.status,
    warnings,
    input_dimensions: {
      floor_to_floor_height: config.floor_to_floor_height,
      slab_thickness: config.slab_thickness,
      finish_thickness_top: config.finish_thickness_top,
      finish_thickness_bottom: config.finish_thickness_bottom,
      opening_length: config.opening_length,
      opening_width: config.opening_width,
      march_width: config.march_width
    },
    dimensions: {
      floorHeight: config.floor_to_floor_height,
      openingLength: config.opening_length,
      openingWidth: config.opening_width,
      marchWidth: config.march_width
    },
    chosen_geometry_result: compactGeometry,
    geometryResult: compactGeometry,
    price_relevant_selections: {
      frame_material: config.frame_material,
      finish_level: config.finish_level,
      finish_material: config.finish_material,
      railing_option: config.railing_option,
      coating_option: config.coating_option,
      lighting_option: config.lighting_option,
      turn_direction: config.turn_direction,
      turn_type: config.turn_type
    },
    scenario_details: {
      metal_frame_condition: config.metal_frame_condition,
      existing_frame_notes: config.existing_frame_notes,
      concrete_step_count: config.concrete_step_count,
      concrete_stair_width: config.concrete_stair_width,
      concrete_tread_depth: config.concrete_tread_depth,
      concrete_base_condition: config.concrete_base_condition,
      finish_step_count: config.finish_step_count,
      finish_stair_width: config.finish_stair_width,
      finish_tread_depth: config.finish_tread_depth,
      finish_only_notes: config.finish_only_notes,
      consultation_notes: config.consultation_notes
    },
    materials: materials?.valid
      ? {
          type: materials.type,
          metrics: materials.metrics
        }
      : null,
    total: price?.total ? Math.round(price.total) : 0
  };
}

function saveCalculationPayload(payload) {
  state.payload = payload;

  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Calculation payload was not saved locally', error);
  }
}

function buildRequestUrl(payload, requestMode = 'calculation') {
  const nextPayload = { ...payload, request_mode: requestMode };
  const encoded = encodeURIComponent(JSON.stringify(nextPayload));
  return `/request.html?calc=${encoded}`;
}

function updateRequestLinks(payload) {
  const requestLink = $('requestLink');
  const reviewLink = $('engineerReviewLink');

  if (requestLink) requestLink.href = buildRequestUrl(payload, 'calculation');
  if (reviewLink) reviewLink.href = buildRequestUrl(payload, 'engineer_review');
}

function updateGeometryActions(geometry) {
  const calculateBtn = $('calculateBtn');
  const reviewLink = $('engineerReviewLink');
  const canContinue = geometry.valid && geometry.allow_continue !== false;

  if (calculateBtn) {
    calculateBtn.classList.toggle('hidden', !canContinue);
    calculateBtn.disabled = !canContinue;
    calculateBtn.textContent =
      geometry.status === 'warning'
        ? 'Продолжить с пометкой инженера'
        : 'Перейти к материалам и цене';
  }

  if (reviewLink) {
    reviewLink.classList.toggle('hidden', geometry.status === 'recommended' && canContinue);
  }
}

function runGeometryCalculation() {
  const config = getConfigFromForm();
  const geometry = calculateScenarioResult(config);
  state.config = config;
  state.geometry = geometry;
  state.materials = null;
  state.price = null;

  const payload = buildCalculationPayload(config, geometry, null, null);
  saveCalculationPayload(payload);
  updateRequestLinks(payload);
  renderGeometry(geometry);
  showStep(3);
}

function runConfigurator() {
  const config = getConfigFromForm();
  const geometry = calculateScenarioResult(config);
  state.config = config;
  state.geometry = geometry;
  state.materials = null;
  state.price = null;
  renderGeometry(geometry);

  if (!geometry.valid || geometry.allow_continue === false) {
    const payload = buildCalculationPayload(config, geometry, null, null, 'engineer_review');
    saveCalculationPayload(payload);
    updateRequestLinks(payload);
    showStep(3);
    return;
  }

  const materials = calculateMaterials(config, geometry);
  state.materials = materials;
  renderMaterials(materials);

  state.price = calculatePrice(config, geometry, materials);
  renderPrice(state.price);

  const payload = buildCalculationPayload(config, geometry, materials, state.price);
  saveCalculationPayload(payload);
  updateRequestLinks(payload);
  showStep(4);
}

async function loadSupabaseDictionaries() {
  if (!window.supabase || !window.SUPABASE_CONFIG) return;

  setStatus('Загрузка ценовых справочников...');
  try {
    const client = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.anonKey
    );

    const [defaultsRes, rulesRes] = await Promise.all([
      client
        .from('stair_defaults')
        .select('*')
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from('stair_material_rules')
        .select('*')
        .eq('active', true)
    ]);

    if (!defaultsRes.error && defaultsRes.data) {
      state.dictionaries.defaults = {
        ...state.dictionaries.defaults,
        ...defaultsRes.data
      };
    }

    if (!rulesRes.error && rulesRes.data) {
      state.dictionaries.materialRules = rulesRes.data;
    }

    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus('Ценовые справочники Supabase не загружены. Используются встроенные коэффициенты.');
  }
}

function init() {
  const baseConditionNode = $('baseCondition');
  const stairTypeNode = $('stairType');
  const calculateBtn = $('calculateBtn');
  const toResultsBtn = $('toResultsBtn');

  if (!stairTypeNode || !calculateBtn || !toResultsBtn) return;

  baseConditionNode?.addEventListener('change', updateScenarioFields);
  stairTypeNode.addEventListener('change', toggleTurnFields);
  calculateBtn.addEventListener('click', runConfigurator);
  toResultsBtn.addEventListener('click', runGeometryCalculation);

  updateScenarioFields();
  loadSupabaseDictionaries();
}

init();
