import { GEOMETRY_LIMITS, calculateStairGeometryEngine } from './stair-geometry-engine.js';
import { calculateMetalMaterials, calculateWoodMaterials, calculateConcreteMaterials } from './stair-materials.js';

const state = { geometry: null, materials: null, price: null, lastConfig: null, dictionaries: { defaults: { labor_rate_per_step: 2500, metal_rate_per_meter: 1800, wood_rate_per_m2: 16000, concrete_rate_per_m3: 14000, install_coef: 1.12, markup_coef: 1.08, delivery_rate_per_km: 110, installation_base: 18000 }, materialRules: [] } };

const LABELS = {
  base_condition: { empty_opening: 'Пустой проём', existing_metal_frame: 'Готовый металлокаркас', existing_concrete_base: 'Готовое бетонное основание', finish_only: 'Нужна только отделка / облицовка', consultation: 'Нужна консультация' },
  stair_type: { straight: 'Прямая', l_turn_landing: 'Г-образная с площадкой', l_turn_winders: 'Г-образная с забежными', u_turn_landing: 'П-образная с площадкой', u_turn_winders: 'П-образная с забежными' },
  frame_material: { metal: 'Металлокаркас', concrete: 'Бетонный каркас', wood: 'Деревянный каркас' },
  cladding: { none: 'Без облицовки', standard: 'Стандартная облицовка', premium: 'Премиальная облицовка' },
  railing: { none: 'Без ограждения', metal: 'Металлическое ограждение', glass: 'Стеклянное ограждение', wood: 'Деревянное ограждение' },
  finish_level: { basic: 'Базовый', standard: 'Стандарт', premium: 'Премиум' }
};
const EXTRA_LABELS = { lighting: 'Подсветка ступеней', painted_metal: 'Окраска металла', premium_coating: 'Премиум-покрытие', hidden_fasteners: 'Скрытый крепёж' };
const STAIR_TYPE_HINTS = { straight: { title: 'Прямая лестница', text: 'Подходит для длинных проёмов без поворотов.', invalidAdvice: 'Увеличьте длину проёма или рассмотрите поворотную схему.' }, l_turn_landing: { title: 'Г-образная с площадкой', text: 'Плавный поворот 90° с площадкой.', invalidAdvice: 'Проверьте длину/ширину проёма в зоне поворота.' }, l_turn_winders: { title: 'Г-образная с забежными', text: 'Компактный поворот для ограниченного пространства.', invalidAdvice: 'Чаще всего помогает увеличение ширины проёма.' }, u_turn_landing: { title: 'П-образная с площадкой', text: 'Разворот на 180° с площадкой.', invalidAdvice: 'Нужна достаточная ширина под два марша.' }, u_turn_winders: { title: 'П-образная с забежными', text: 'Компактный разворот 180°.', invalidAdvice: 'Для комфорта критична проверка по линии хода.' } };

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

function toggleTurnFields() { const stairType = $('stairType')?.value || 'straight'; const base = $('baseCondition')?.value || 'empty_opening'; const field = $('turnDirectionField'); const input = $('turnDirection'); if (!field || !input) return; const show = stairType !== 'straight' && base === 'empty_opening'; field.classList.toggle('hidden', !show); input.disabled = !show; }
function toggleScenarioFields() { const base = $('baseCondition')?.value || 'empty_opening'; const full = base === 'empty_opening'; $('stairTypeField')?.classList.toggle('hidden', !full); $('frameMaterialField')?.classList.toggle('hidden', base === 'consultation'); $('finishGrid')?.classList.toggle('hidden', base === 'consultation'); $('existingConditionField')?.classList.toggle('hidden', !(base === 'existing_metal_frame' || base === 'existing_concrete_base')); }

function renderStairTypeHint(target, stairType, geometry) { if (!target) return; const hint = STAIR_TYPE_HINTS[stairType] || STAIR_TYPE_HINTS.straight; const invalidHelp = geometry && !geometry.valid ? `<div class="stair-type-hint-invalid">${hint.invalidAdvice}</div>` : ''; target.innerHTML = `<div class="stair-type-hint-card"><div class="stair-type-hint-label">Подсказка по проёму</div><h3>${hint.title}</h3><p>${hint.text}</p>${invalidHelp}</div>`; }
function updateStairTypeHints(geometry = null) { const stairType = $('stairType')?.value || 'straight'; renderStairTypeHint($('stairTypeHint'), stairType, geometry); renderStairTypeHint($('geometryTypeHint'), stairType, geometry); }

function getConfigFromForm() {
  return {
    base_condition: $('baseCondition')?.value || 'empty_opening', stair_type: $('stairType')?.value || 'straight', turn_direction: $('turnDirection')?.value || 'left',
    floor_to_floor_height: Number($('floorHeight')?.value || 0), slab_thickness: Number($('slabThickness')?.value || 220), top_finish_thickness: Number($('topFinishThickness')?.value || 20), bottom_finish_thickness: Number($('bottomFinishThickness')?.value || 20),
    opening_length: Number($('openingLength')?.value || 0), opening_width: Number($('openingWidth')?.value || 0), march_width: Number($('marchWidth')?.value || 0),
    frame_material: $('frameMaterial')?.value || 'metal', finish_level: $('finishLevel')?.value || 'basic', cladding: $('claddingType')?.value || 'standard', railing: $('railingType')?.value || 'metal',
    delivery_distance: Number($('deliveryDistance')?.value || 20), existing_condition_notes: $('existingConditionNotes')?.value?.trim() || '',
    extras: [...document.querySelectorAll('input[name="extras"]:checked')].map((x) => x.value)
  };
}

function validateBase(config) { if (config.floor_to_floor_height <= 0) return 'Укажите корректную высоту этаж-этаж.'; if (config.opening_length <= 0) return 'Укажите корректную длину проёма.'; if (config.opening_width <= 0) return 'Укажите корректную ширину проёма.'; if (config.march_width <= 0) return 'Укажите корректную ширину марша.'; return null; }

function calculateGeometry(config) {
  if (config.base_condition === 'consultation') return { valid: true, status: 'warning', warnings: ['Мы подготовим индивидуальный сценарий после короткой консультации.'], geometrySummary: null, visualization: null };
  const err = validateBase(config); if (err) return { valid: false, status: 'invalid', warnings: [err], geometrySummary: null, visualization: null };
  if (config.base_condition !== 'empty_opening') {
    return { valid: true, status: 'warning', warnings: ['Сценарий с существующим основанием: расчёт выполняется как fit-check + отделка, с обязательной проверкой инженером.'], geometrySummary: { riser_count: 0, tread_count: 0, riser_height: 0, tread_depth: 0, comfort_value: 0, stair_angle_deg: 0, headroom_min: 0, score: 60 }, visualization: null };
  }
  return calculateStairGeometryEngine({ stairType: config.stair_type, floorHeight: config.floor_to_floor_height, slabThickness: config.slab_thickness, topFinish: config.top_finish_thickness, bottomFinish: config.bottom_finish_thickness, openingLength: config.opening_length, openingWidth: config.opening_width, marchWidth: config.march_width, turnDirection: config.turn_direction });
}

function renderGeometryVisuals(visualization) {
  const plan = $('geometryPlanSvg'); const elev = $('geometryElevationSvg'); if (!plan || !elev) return;
  if (!visualization) { plan.innerHTML = '<div class="muted">Визуализация будет показана после расчёта.</div>'; elev.innerHTML = '<div class="muted">Нет данных для бокового вида.</div>'; return; }
  const maxX = Math.max(visualization.opening.length, ...visualization.path.map((p) => p.x), 1);
  const maxY = Math.max(visualization.opening.width, ...visualization.path.map((p) => p.y), 1);
  const poly = visualization.path.map((p) => `${20 + (p.x / maxX) * 500},${20 + (p.y / maxY) * 200}`).join(' ');
  const warningDots = (visualization.warningZones || []).map((p) => `<circle cx="${20 + (p.x / maxX) * 500}" cy="${20 + (p.y / maxY) * 200}" r="4" fill="#ffb0b0"/>`).join('');
  plan.innerHTML = `<svg viewBox="0 0 540 240" class="geo-svg"><rect x="20" y="20" width="500" height="200" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.25)"/><polyline points="${poly}" fill="none" stroke="#ddb786" stroke-width="3"/>${warningDots}</svg>`;
  const n = Math.max(1, visualization.elevation.treadCount || 1); const stepW = 500 / n;
  const stairs = Array.from({ length: n }).map((_, i) => { const x = 20 + i * stepW; const y = 220 - ((i + 1) / n) * 160; return `<path d="M${x} 220 L${x} ${y} L${x + stepW} ${y}" stroke="#ddb786" fill="none" stroke-width="2"/>`; }).join('');
  const slabY = 220 - ((visualization.elevation.slabUnderside || 0) / Math.max(visualization.elevation.floorHeight || 1, 1)) * 180;
  elev.innerHTML = `<svg viewBox="0 0 540 240" class="geo-svg"><line x1="20" y1="${slabY}" x2="520" y2="${slabY}" stroke="#f5d98c" stroke-dasharray="6 6"/>${stairs}</svg>`;
}

function getInvalidGeometryGuidance(config) {
  const steps = ['Проверьте размеры после чистовой отделки.', 'Попробуйте уменьшить ширину марша на 50–100 мм.', 'Сохраните расчёт и отправьте размеры инженеру Tekstura.'];
  if (config.stair_type.startsWith('u_turn')) steps.push('Для П-образной схемы особенно важна ширина проёма под разворот.');
  return steps;
}

function renderGeometry(geometry) {
  const root = $('geometryResult'); const warnings = $('geometryWarnings'); const fallbackCta = $('geometryFallbackCta'); if (!root || !warnings) return;
  if (!geometry.valid || geometry.status === 'invalid') {
    const guidance = getInvalidGeometryGuidance(state.lastConfig || {});
    root.innerHTML = `<div class="warning-block invalid"><div class="warning-title">Не найдена безопасная и удобная конфигурация</div><div class="warning-text">Онлайн-подбор не дал корректный результат для текущих размеров.</div></div>`;
    warnings.innerHTML = `<div class="warning-block invalid"><div class="warning-text">${(geometry.warnings || []).join(' ')}</div><ul class="warning-list">${guidance.map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
    if (fallbackCta) fallbackCta.hidden = false; renderGeometryVisuals(null); setProceedAvailability(false); return;
  }

  const statusText = { recommended: 'Рекомендуем', warning: 'Требует проверки', invalid: 'Невалидно' };
  const summary = geometry.geometrySummary || {};
  const rows = [
    ['Сценарий', LABELS.base_condition[state.lastConfig.base_condition] || state.lastConfig.base_condition],
    ['Тип лестницы', LABELS.stair_type[state.lastConfig.stair_type] || state.lastConfig.stair_type],
    ['Статус', `<span class="badge ${geometry.status}">${statusText[geometry.status] || geometry.status}</span>`],
    ['Количество подъёмов', summary.riser_count || '—'],
    ['Количество проступей', summary.tread_count || '—'],
    ['Высота подступенка', `${summary.riser_height || '—'} мм`],
    ['Глубина проступи', `${summary.tread_depth || '—'} мм`],
    ['Формула 2h+b', `${summary.comfort_value || '—'} мм`],
    ['Угол', `${summary.stair_angle_deg || '—'}°`],
    ['Мин. просвет по линии хода', `${summary.headroom_min || '—'} мм`],
    ['Оценка кандидата', `${summary.score || '—'}/100`]
  ];
  root.innerHTML = `<table class="result-table"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;
  const warningList = [...(geometry.warnings || [])];
  if (geometry.status === 'warning') warningList.unshift('Вариант допустим, но перед запуском рекомендуем инженерную проверку Tekstura.');
  warnings.innerHTML = warningList.length ? warningList.map((w) => `<div class="warning-block"><div class="warning-text">${w}</div></div>`).join('') : '<div class="ok">Геометрия в рекомендованных пределах.</div>';
  if (fallbackCta) fallbackCta.hidden = geometry.status === 'recommended';
  renderGeometryVisuals(geometry.visualization);
  setProceedAvailability(true);
}

function calculateMaterials(config, geometry) { if (config.frame_material === 'wood') return calculateWoodMaterials(config, geometry.geometrySummary || geometry); if (config.frame_material === 'concrete') return calculateConcreteMaterials(config, geometry.geometrySummary || geometry); return calculateMetalMaterials(config, geometry.geometrySummary || geometry); }
function renderMaterials(materials) { const root = $('materialsResult'); if (!root) return; if (!materials.valid) { root.innerHTML = `<div class="warning">${materials.reason}</div>`; return; } root.innerHTML = `<table class="result-table"><tbody>${materials.items.map((i) => `<tr><th>${i.label}</th><td>${i.value}</td></tr>`).join('')}</tbody></table>`; }

function calculatePrice(config, geometry, materials) {
  if (!geometry.valid || !materials.valid) return null;
  const d = state.dictionaries.defaults;
  const baseFrame = (materials.metrics.profileTubeLengthM || 0) * d.metal_rate_per_meter + (materials.metrics.loadBearingWoodM3 || 0) * 32000 + (materials.metrics.concreteVolumeM3 || 0) * d.concrete_rate_per_m3;
  const stepsArea = (materials.metrics.treadAreaM2 || materials.metrics.claddingAreaM2 || 0);
  const claddingCost = stepsArea * (config.cladding === 'premium' ? 22000 : config.cladding === 'standard' ? 12500 : 0);
  const railingLen = (materials.metrics.railingLengthM || 0);
  const railingRates = { none: 0, metal: 9800, glass: 18700, wood: 13200 };
  const railingCost = railingLen * (railingRates[config.railing] || 0);
  const finishCost = baseFrame * (config.finish_level === 'premium' ? 0.16 : config.finish_level === 'standard' ? 0.08 : 0.04);
  const extrasMap = { lighting: 24000, painted_metal: 17500, premium_coating: 28000, hidden_fasteners: 19000 };
  const extrasCost = config.extras.reduce((sum, key) => sum + (extrasMap[key] || 0), 0);
  const installation = d.installation_base + ((geometry.geometrySummary?.tread_count || 0) * d.labor_rate_per_step);
  const delivery = Math.max(9000, config.delivery_distance * d.delivery_rate_per_km);
  const subtotal = (baseFrame + claddingCost + railingCost + finishCost + extrasCost + installation + delivery) * d.install_coef;
  const total = subtotal * d.markup_coef;
  return { total, min: total * 0.9, max: total * 1.14, breakdown: { baseFrame, claddingCost, railingCost, finishCost, extrasCost, installation, delivery } };
}

function money(v) { return `${new Intl.NumberFormat('ru-RU').format(Math.round(v || 0))} ₽`; }
function renderPrice(price) { const root = $('priceResult'); if (!root) return; if (!price) { root.innerHTML = '<div class="warning">Стоимость недоступна без валидной геометрии.</div>'; return; } const b = price.breakdown; root.innerHTML = `<div class="price-main">${money(price.total)}</div><div class="muted">Диапазон: ${money(price.min)} — ${money(price.max)}</div><table class="result-table"><tbody><tr><th>Каркас/основание</th><td>${money(b.baseFrame)}</td></tr><tr><th>Ступени и облицовка</th><td>${money(b.claddingCost)}</td></tr><tr><th>Ограждение</th><td>${money(b.railingCost)}</td></tr><tr><th>Финиш/покрытие</th><td>${money(b.finishCost)}</td></tr><tr><th>Доп. опции</th><td>${money(b.extrasCost)}</td></tr><tr><th>Монтаж</th><td>${money(b.installation)}</td></tr><tr><th>Доставка</th><td>${money(b.delivery)}</td></tr></tbody></table>`; const payload = buildRequestPayload(); try { sessionStorage.setItem('tekstura_calc_payload', encodeURIComponent(JSON.stringify(payload))); } catch {} const reqBtn = $('requestBtn'); if (reqBtn) reqBtn.href = `/request.html?calc=${encodeURIComponent(JSON.stringify(payload))}`; }

function buildRequestPayload() {
  const cfg = state.lastConfig || {};
  return {
    base_condition: cfg.base_condition,
    staircaseType: LABELS.stair_type[cfg.stair_type] || cfg.stair_type,
    inputDimensions: { floor_to_floor_height: cfg.floor_to_floor_height, opening_length: cfg.opening_length, opening_width: cfg.opening_width, march_width: cfg.march_width, slab_thickness: cfg.slab_thickness, top_finish_thickness: cfg.top_finish_thickness, bottom_finish_thickness: cfg.bottom_finish_thickness },
    geometrySummary: state.geometry?.geometrySummary || null,
    status: state.geometry?.status || 'invalid',
    warnings: state.geometry?.warnings || [],
    materialsSummary: { frame: LABELS.frame_material[cfg.frame_material], cladding: LABELS.cladding[cfg.cladding], railing: LABELS.railing[cfg.railing], finish: LABELS.finish_level[cfg.finish_level] },
    selectedExtras: (cfg.extras || []).map((x) => ({ code: x, label: EXTRA_LABELS[x] || x })),
    priceBreakdown: state.price?.breakdown || {},
    total: Math.round(state.price?.total || 0),
    existing_condition_notes: cfg.existing_condition_notes || ''
  };
}

function runGeometryCalculation() { const config = getConfigFromForm(); state.lastConfig = config; state.geometry = calculateGeometry(config); renderGeometry(state.geometry); updateStairTypeHints(state.geometry); setStatus(state.geometry.valid ? 'Геометрия рассчитана' : 'Проверьте параметры'); showStep(2); }
function runConfigurator() { const config = getConfigFromForm(); state.lastConfig = config; state.geometry = calculateGeometry(config); renderGeometry(state.geometry); updateStairTypeHints(state.geometry); if (!state.geometry.valid || state.geometry.status === 'invalid') { setStatus('Исправьте параметры геометрии, чтобы продолжить'); showStep(2); return; } state.materials = calculateMaterials(config, state.geometry); renderMaterials(state.materials); state.price = calculatePrice(config, state.geometry, state.materials); renderPrice(state.price); setStatus('Расчёт обновлён'); showStep(4); }

async function loadSupabaseDictionaries() { if (!window.supabase || !window.SUPABASE_CONFIG) return; try { const client = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey); const { data } = await client.from('stair_defaults').select('*').eq('active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle(); if (data) state.dictionaries.defaults = { ...state.dictionaries.defaults, ...data }; } catch { setStatus('Используются встроенные коэффициенты.'); } }

function init() {
  bindVisualSelectors();
  $('stairType')?.addEventListener('change', () => { toggleTurnFields(); updateStairTypeHints(); });
  $('baseCondition')?.addEventListener('change', () => { toggleScenarioFields(); toggleTurnFields(); });
  $('calculateBtn')?.addEventListener('click', runConfigurator);
  $('toResultsBtn')?.addEventListener('click', runGeometryCalculation);
  setProceedAvailability(false);
  toggleScenarioFields();
  toggleTurnFields();
  updateStairTypeHints();
  loadSupabaseDictionaries();
}
init();
