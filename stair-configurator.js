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
  $('pageStatus').textContent = message;
}

function toggleTurnFields() {
  const stairType = $('stairType').value;
  const turnDirection = $('turnDirectionField');
  const turnType = $('turnTypeField');

  turnDirection.classList.toggle('hidden', stairType !== 'l_turn');
  turnType.classList.toggle('hidden', stairType === 'straight');
}

function getConfigFromForm() {
  return {
    opening_type: $('openingType').value,
    stair_type: $('stairType').value,
    turn_direction: $('turnDirection').value,
    turn_type: $('turnType').value,
    floor_to_floor_height: Number($('floorHeight').value || 0),
    opening_length: Number($('openingLength').value || 0),
    opening_width: Number($('openingWidth').value || 0),
    march_width: Number($('marchWidth').value || 0),
    frame_material: $('frameMaterial').value,
    finish_level: $('finishLevel').value
  };
}

function splitLTurn(config) {
  const lowerLength = Math.max(config.opening_length * 0.52, 1800);
  const upperLength = Math.max(config.opening_length - lowerLength, 1600);
  return { lowerLength, upperLength };
}

function calculateLTurnGeometry(config) {
  const totalStraight = calculateStraightGeometry(config);
  if (!totalStraight.valid) return totalStraight;

  const risersForTurn = config.turn_type === 'winders' ? 3 : 1;
  const lowerRisers = Math.max(3, Math.floor((totalStraight.riser_count - risersForTurn) / 2));
  const upperRisers = totalStraight.riser_count - lowerRisers - risersForTurn;
  if (upperRisers < 3) {
    return {
      ...totalStraight,
      valid: false,
      status: 'invalid',
      reason: 'Недостаточно подъёмов для Г-образной лестницы. Увеличьте высоту или измените конфигурацию.'
    };
  }

  const split = splitLTurn(config);
  const lower = calculateStraightGeometry({
    floor_to_floor_height: lowerRisers * totalStraight.riser_height,
    opening_length: split.lowerLength,
    march_width: config.march_width
  });
  const upper = calculateStraightGeometry({
    floor_to_floor_height: upperRisers * totalStraight.riser_height,
    opening_length: split.upperLength,
    march_width: config.march_width
  });

  if (!lower.valid || !upper.valid) {
    return {
      ...totalStraight,
      valid: false,
      status: 'invalid',
      reason: 'Для Г-образной лестницы не удаётся подобрать допустимую геометрию маршей в заданном проёме.'
    };
  }

  const turnNodeLength = config.turn_type === 'landing'
    ? Math.max(config.march_width, 900)
    : Math.round(totalStraight.tread_depth * 3);

  return {
    ...totalStraight,
    turn_node: {
      type: config.turn_type,
      direction: config.turn_direction,
      element_length: turnNodeLength,
      risers_in_turn: risersForTurn
    },
    lower_march: lower,
    upper_march: upper,
    run_length: Math.round(lower.run_length + upper.run_length + turnNodeLength),
    stringer_length: Math.round(lower.stringer_length + upper.stringer_length + turnNodeLength),
    status: totalStraight.status,
    reason: totalStraight.reason
  };
}

function calculateGeometry(config) {
  if (config.stair_type === 'l_turn') {
    return calculateLTurnGeometry(config);
  }
  if (config.stair_type === 'u_turn') {
    return {
      valid: false,
      status: 'invalid',
      reason: 'П-образная лестница подготовлена в структуре, но расчёт будет добавлен на следующем этапе.'
    };
  }
  return calculateStraightGeometry(config);
}

function renderGeometry(geometry) {
  const root = $('geometryResult');
  const warnings = $('geometryWarnings');

  if (!geometry.valid) {
    root.innerHTML = '<div class="muted">Нет валидной геометрии.</div>';
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
  }

  root.innerHTML = `<table class="result-table"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;

  const warningList = [];
  if (geometry.status === 'too_steep') warningList.push('Лестница слишком крутая.');
  if (geometry.reason) warningList.push(geometry.reason);
  if (geometry.tread_depth < FORMULA_LIMITS.minTreadDepth) warningList.push('Проём недостаточен для рекомендуемой проступи.');

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
  if (!materials.valid) {
    root.innerHTML = `<div class="warning">${materials.reason}</div>`;
    return;
  }

  root.innerHTML = `<table class="result-table"><tbody>${materials.items
    .map((item) => `<tr><th>${item.label}</th><td>${item.value}</td></tr>`)
    .join('')}</tbody></table>`;
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

  const finishCoef = config.finish_level === 'premium' ? 1.2 : config.finish_level === 'standard' ? 1.08 : 1;
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

  showStep(4);
}

async function loadSupabaseDictionaries() {
  if (!window.supabase || !window.SUPABASE_CONFIG) return;

  setStatus('Загрузка инженерных справочников...');
  try {
    const client = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    const [defaultsRes, rulesRes] = await Promise.all([
      client.from('stair_defaults').select('*').eq('active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      client.from('stair_material_rules').select('*').eq('active', true)
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
  $('stairType').addEventListener('change', toggleTurnFields);
  $('calculateBtn').addEventListener('click', runConfigurator);
  $('toResultsBtn').addEventListener('click', () => showStep(3));

  toggleTurnFields();
  loadSupabaseDictionaries();
}

init();
 