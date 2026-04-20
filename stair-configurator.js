import { calculateStraightGeometry, FORMULA_LIMITS } from './stair-formulas.js';
import {
  calculateMetalMaterials,
  calculateWoodMaterials,
  calculateConcreteMaterials
} from './stair-materials.js';

const state = {
  geometry: null,
  materials: null,
  price: null,
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

const $ = (id) => document.getElementById(id);

function showStep(step) {
  document.querySelectorAll('.step').forEach((node) => node.classList.remove('active'));
  $(`step${step}`).classList.add('active');
}

window.nextStep = showStep;
window.prevStep = showStep;

function setStatus(message = '') {
  const statusNode = $('pageStatus');
  if (statusNode) statusNode.textContent = message;
}

function toggleTurnFields() {
  const stairTypeNode = $('stairType');
  const openingTypeNode = $('openingType');
  const turnDirection = $('turnDirectionField');
  const turnType = $('turnTypeField');
  const turnDirectionInput = $('turnDirection');
  const turnTypeInput = $('turnType');

  if (!stairTypeNode || !turnDirection || !turnType || !turnDirectionInput || !turnTypeInput) return;

  const stairType = stairTypeNode.value;
  if (openingTypeNode && openingTypeNode.value !== stairType) {
    openingTypeNode.value = stairType;
  }

  const showTurnDirection = stairType === 'l_turn';
  const showTurnType = stairType !== 'straight';

  turnDirection.classList.toggle('hidden', !showTurnDirection);
  turnDirectionInput.disabled = !showTurnDirection;

  turnType.classList.toggle('hidden', !showTurnType);
  turnTypeInput.disabled = !showTurnType;
}

function getConfigFromForm() {
  return {
    opening_type: $('openingType')?.value || 'straight',
    stair_type: $('stairType')?.value || 'straight',
    turn_direction: $('turnDirection')?.value || 'left',
    turn_type: $('turnType')?.value || 'landing',
    floor_to_floor_height: Number($('floorHeight')?.value || 0),
    opening_length: Number($('openingLength')?.value || 0),
    opening_width: Number($('openingWidth')?.value || 0),
    march_width: Number($('marchWidth')?.value || 0),
    frame_material: $('frameMaterial')?.value || 'metal',
    finish_level: $('finishLevel')?.value || 'basic'
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
  if (config.stair_type === 'l_turn') {
    return calculateLTurnGeometry(config);
  }

  if (config.stair_type === 'u_turn') {
    return buildInvalidGeometry('П-образная лестница пока не реализована в расчёте.');
  }

  return calculateStraightGeometry(config);
}

function renderGeometry(geometry) {
  const root = $('geometryResult');
  const warnings = $('geometryWarnings');

  if (!root || !warnings) return;

  if (!geometry.valid) {
    root.innerHTML = '<div class="warning">Расчёт геометрии недоступен для текущих параметров.</div>';
    warnings.innerHTML = `<div class="warning">${geometry.reason || 'Проверьте исходные параметры.'}</div>`;
    return;
  }

  const comfortClass = `badge ${geometry.status}`;
  const rows = [
    ['Статус удобства', `<span class="${comfortClass}">${geometry.status}</span>`],
    ['Количество подъёмов', `${geometry.riser_count}`],
    ['Высота подступенка', `${geometry.riser_height} мм`],
    ['Количество проступей', `${geometry.tread_count}`],
    ['Глубина проступи', `${geometry.tread_depth} мм`],
    ['Формула 2h + b', `${geometry.comfort_value} мм`],
    ['Угол наклона', `${geometry.stair_angle_deg}°`],
    ['Длина марша', `${geometry.run_length} мм`],
    ['Длина косоура/тетивы', `${geometry.stringer_length} мм`]
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

  root.innerHTML = `
    <table class="result-table">
      <tbody>
        ${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}
      </tbody>
    </table>
  `;

  const warningList = [];
  if (geometry.status === 'too_steep') warningList.push('Лестница слишком крутая.');
  if (geometry.reason) warningList.push(geometry.reason);
  if (geometry.tread_depth < FORMULA_LIMITS.minTreadDepth) {
    warningList.push('Проём недостаточен для рекомендуемой проступи.');
  }

  warnings.innerHTML = warningList.length
    ? warningList.map((item) => `<div class="warning">${item}</div>`).join('')
    : '<div class="ok">Геометрия находится в допустимых инженерных пределах.</div>';
}

function calculateMaterials(config, geometry) {
  if (config.frame_material === 'wood') return calculateWoodMaterials(config, geometry);
  if (config.frame_material === 'concrete') return calculateConcreteMaterials(config, geometry);
  return calculateMetalMaterials(config, geometry);
}

function renderMaterials(materials) {
  const root = $('materialsResult');
  if (!root) return;

  if (!materials.valid) {
    root.innerHTML = `<div class="warning">${materials.reason}</div>`;
    return;
  }

  root.innerHTML = `
    <table class="result-table">
      <tbody>
        ${materials.items
          .map((item) => `<tr><th>${item.label}</th><td>${item.value}</td></tr>`)
          .join('')}
      </tbody>
    </table>
  `;
}

function calculatePrice(config, geometry, materials) {
  if (!geometry.valid || !materials.valid) return null;

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

  const finishCoef =
    config.finish_level === 'premium'
      ? 1.2
      : config.finish_level === 'standard'
        ? 1.08
        : 1;

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

  setStatus('Загрузка инженерных справочников...');
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
    setStatus('Справочники Supabase не загружены. Используются встроенные коэффициенты.');
  }
}

function init() {
  const stairTypeNode = $('stairType');
  const openingTypeNode = $('openingType');
  const calculateBtn = $('calculateBtn');
  const toResultsBtn = $('toResultsBtn');

  if (!stairTypeNode || !calculateBtn || !toResultsBtn) return;

  stairTypeNode.addEventListener('change', toggleTurnFields);
  if (openingTypeNode) {
    openingTypeNode.addEventListener('change', () => {
      stairTypeNode.value = openingTypeNode.value;
      toggleTurnFields();
    });
  }
  calculateBtn.addEventListener('click', runConfigurator);
  toResultsBtn.addEventListener('click', runGeometryCalculation);

  toggleTurnFields();
  loadSupabaseDictionaries();
}

init();
