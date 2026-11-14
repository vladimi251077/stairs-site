import { glassRailingClientPricePerMeter, readStepwisePricingSettings, saveStepwisePricingSettings,
  stepwiseRailingOptions, stepwiseTreadMaterials, useSharedStepwisePricingSettings } from './calculator-preview-pricing.js';
import { loadSharedPricing } from './calculator-pricing-store.js';

const supabaseConfig = window.SUPABASE_CONFIG;
const sharedPricingConfigured = Boolean(supabaseConfig?.url && supabaseConfig?.anonKey);
const previewClient = sharedPricingConfigured && window.supabase
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  : null;
let sharedPricingAvailable = false;
if (previewClient) {
  try {
    useSharedStepwisePricingSettings((await loadSharedPricing(previewClient)).settings);
    sharedPricingAvailable = true;
  } catch {
    // A configured shared source must be reachable before generating a quote.
  }
}

const byId = (id) => document.getElementById(id);
const app = document.querySelector('.calculator-app');
const form = byId('step1').parentElement;
const scenario = byId('step1');
const dimensions = byId('step2');
const review = byId('step3');
const result = byId('step4');
const shape = makeStep('stepwiseShape', 'Как будет идти лестница?');
const details = makeStep('stepwiseDetails', 'Подробности основания');
const materials = makeStep('stepwiseMaterials', 'Материалы и отделка');
const railing = makeStep('stepwiseRailing', 'Ограждение');
const stages = [
  [scenario], [shape], [dimensions], [details], [materials], [railing], [review, result]
];
const assetRoot = '/docs/assets/calculator-preview/';

function makeStep(id, title) {
  const section = document.createElement('section');
  section.id = id;
  section.className = 'step';
  const heading = document.createElement('h2');
  heading.textContent = title;
  section.append(heading);
  return section;
}

function moveField(id, destination) {
  destination.append(byId(id).closest('.field'));
}

function makeGrid(parent) {
  const grid = document.createElement('div');
  grid.className = 'grid';
  parent.append(grid);
  return grid;
}

function heading(section, title) {
  const h2 = section.querySelector('h2');
  if (title) h2.textContent = title;
  h2.tabIndex = -1;
  return h2;
}

function button(text, primary, action) {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = primary ? 'btn-primary' : 'btn-secondary';
  control.textContent = text;
  control.addEventListener('click', action);
  return control;
}

function navigation(section, back, next) {
  const actions = document.createElement('div');
  actions.className = 'actions';
  if (back) actions.append(button('Назад', false, back));
  if (next) actions.append(button('Далее', true, next));
  section.append(actions);
}

function show(section) {
  form.querySelectorAll('.step.active').forEach((item) => item.classList.remove('active'));
  section.classList.add('active');
}

function isReadyBase() {
  return byId('baseCondition').value === 'ready_base';
}

function updateSelect(id, value) {
  const select = byId(id);
  if (select.value === value) return;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function buildScenarioCards() {
  const grid = document.createElement('div');
  grid.className = 'stepwise-scenarios';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Основание лестницы');
  for (const [title, file, subtype] of [
    ['Пустой проём', 'opening-empty-card.webp', ''],
    ['Готовый металлокаркас', 'ready-metal-frame-card.webp', 'existing_metal_frame'],
    ['Бетонное основание', 'concrete-base-card.webp', 'existing_concrete_base']
  ]) {
    const card = button(title, false, () => {
      if (subtype) updateSelect('baseSubtype', subtype);
      updateSelect('baseCondition', subtype ? 'ready_base' : 'empty_opening');
    });
    card.className = 'stepwise-scenario';
    const image = document.createElement('img');
    image.src = assetRoot + file;
    image.alt = '';
    card.prepend(image);
    function syncCard() {
      const selected = subtype ? isReadyBase() && byId('baseSubtype').value === subtype : !isReadyBase();
      card.setAttribute('aria-pressed', String(selected));
    }
    byId('baseCondition').addEventListener('change', syncCard);
    byId('baseSubtype').addEventListener('change', syncCard);
    syncCard();
    grid.append(card);
  }
  heading(scenario).after(grid);
}

app.classList.add('stepwise-app');
const skin = document.createElement('link');
skin.rel = 'stylesheet';
skin.href = '/calculator-stepwise.css';
document.head.append(skin);
app.querySelector('h1').textContent = 'Калькулятор лестницы';
app.querySelector('.top p').textContent = 'Выберите конфигурацию, введите размеры и получите предварительный расчёт.';
app.querySelector('.calc-orientation').hidden = true;

const progress = document.createElement('p');
progress.className = 'stepwise-progress';
progress.setAttribute('aria-live', 'polite');
form.prepend(progress);
heading(scenario, 'Что у вас сейчас?');
heading(dimensions, 'Основные размеры');
heading(review, 'Проверка размеров');
heading(result, 'Предварительный расчёт');
for (const section of [shape, details, materials, railing]) heading(section);

// The existing engine owns the form controls and IDs. Moving them preserves its
// scenario visibility, select options, dimensions, and submission payload.
const shapeGrid = makeGrid(shape);
for (const id of ['openingType', 'stairType', 'readyBaseShape', 'turnDirection', 'turnType']) {
  moveField(id, shapeGrid);
}
const extraFields = [
  'landingToggleField', 'landingLengthField', 'landingWidthField', 'landingAreaField',
  'winderToggleField', 'winderCountField'
];
const extraGrid = makeGrid(details);
for (const id of extraFields) extraGrid.append(byId(id));
byId('existingFrameNotes').closest('.field').remove();
details.append(byId('existingMetalGroup'), byId('existingConcreteGroup'));
const finishScopeSelect = byId('finishScope');
const finishScope = finishScopeSelect.closest('.field');
const serviceOptions = byId('serviceOptionsGroup');
serviceOptions.prepend(finishScope);
for (const id of ['sheetCountField', 'sheetSizeField']) {
  byId(id).remove();
}
byId('materialsResult').closest('.result-box').hidden = true;
result.querySelector('.post-submit-info').hidden = true;
const underStairDoor = document.createElement('input');
underStairDoor.type = 'checkbox';
underStairDoor.id = 'stepwiseUnderStairDoor';
const doorLabel = document.createElement('label');
doorLabel.className = 'stepwise-budget-option';
doorLabel.append(underStairDoor, ' Нужна дверка под лестницей');
serviceOptions.append(doorLabel);
function populatePreviewSelect(id, choices) {
  const select = byId(id);
  select.dataset.stepwiseOptions = 'true';
  select.replaceChildren(...Object.entries(choices).map(([value, label]) => new Option(label, value)));
  return select;
}

const treadMaterial = populatePreviewSelect('finishMaterial', stepwiseTreadMaterials);
document.querySelector('label[for="finishMaterial"]').textContent = 'Материал ступеней';
const treadField = treadMaterial.closest('.field');
const treadGrid = document.createElement('div');
treadGrid.className = 'grid';
treadGrid.append(treadField);

const railingGrid = makeGrid(railing);
const railingOption = populatePreviewSelect('railingOption', stepwiseRailingOptions);
const glassHint = document.createElement('p');
glassHint.className = 'field-help';
glassHint.textContent = 'Стеклянное ограждение от ' + glassRailingClientPricePerMeter.toLocaleString('ru-RU') + ' ₽/м.';
function syncGlassHint() {
  glassHint.hidden = railingOption.value !== 'glass';
}
railingOption.addEventListener('change', syncGlassHint);
syncGlassHint();
railingOption.after(glassHint);
moveField('railingOption', railingGrid);
const railingLength = byId('readyFrameStraightRailingLength').closest('.field');
railingLength.querySelector('label').textContent = 'Дополнительное ограждение, м';
railingLength.querySelector('input').placeholder = 'Например, 1';
railingLength.querySelector('p').textContent = 'Укажите длину ограждения на этаже или площадке. Длина вдоль ступеней считается автоматически.';
railingGrid.append(railingLength);
const pricingInputs = byId('pricingInputGroup');
const currentRegionField = byId('pricingRegion').closest('.field');
currentRegionField.hidden = true;
const previewRegionField = document.createElement('div');
previewRegionField.className = 'field';
const regionLabel = document.createElement('label');
regionLabel.htmlFor = 'stepwisePricingRegion';
regionLabel.textContent = 'Регион работ';
const regionSelect = document.createElement('select');
regionSelect.id = regionLabel.htmlFor;
function refreshRegions(regions) {
  const previous = regionSelect.value;
  regionSelect.replaceChildren(...regions.map(({ name, code }) => new Option(name, code)));
  if (regions.some(({ code }) => code === previous)) regionSelect.value = previous;
}
refreshRegions(readStepwisePricingSettings().regions);
previewRegionField.append(regionLabel, regionSelect);
pricingInputs.append(previewRegionField);
if (!sharedPricingConfigured) materials.append(buildPricingSettings());
if (sharedPricingConfigured && !sharedPricingAvailable) {
  const notice = document.createElement('p');
  notice.setAttribute('role', 'status');
  notice.textContent = 'Цены с сервера недоступны. Обновите страницу перед расчётом.';
  materials.append(notice);
}
materials.append(pricingInputs, treadGrid, serviceOptions);

function buildPricingSettings() {
  const settings = readStepwisePricingSettings();
  const panel = document.createElement('details');
  panel.className = 'stepwise-pricing-settings';
  const title = document.createElement('summary');
  title.textContent = 'Настройки цены для теста';
  const settingsForm = document.createElement('form');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const hint = document.createElement('p');
  hint.textContent = 'Настройки сохраняются в этом браузере. Новые расчёты используют выбранный город.';

  function field(label, value, options) {
    const wrapper = document.createElement('label');
    wrapper.textContent = label;
    const input = document.createElement('input');
    Object.assign(input, options, { value, required: true });
    wrapper.append(input);
    return wrapper;
  }

  const expenses = field('Прочие расходы, %', settings.otherExpensesPercent, {
    type: 'number', min: '0', max: '100', step: '0.001'
  });
  const cities = document.createElement('div');
  const editors = [];
  function addCity({ code, name, turnkeyCoefficient }) {
    const row = document.createElement('div');
    row.className = 'grid';
    const city = field('Город или регион', name, { type: 'text', maxLength: 80 });
    const rate = field('Коэффициент', turnkeyCoefficient, { type: 'number', min: '1', max: '20', step: '0.01' });
    row.append(city, rate);
    editors.push({ code, city: city.querySelector('input'), rate: rate.querySelector('input') });
    cities.append(row);
    return city.querySelector('input');
  }
  settings.regions.forEach(addCity);
  const add = button('Добавить город', false, () => {
    addCity({ code: 'city-' + crypto.randomUUID(), name: '', turnkeyCoefficient: '' }).focus();
  });
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'btn-primary';
  save.textContent = 'Сохранить настройки';
  settingsForm.append(hint, expenses, cities, add, save, status);
  settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const updated = saveStepwisePricingSettings({
        otherExpensesPercent: expenses.querySelector('input').valueAsNumber,
        regions: editors.map(({ code, city, rate }) => ({ code, name: city.value, turnkeyCoefficient: rate.valueAsNumber }))
      });
      refreshRegions(updated.regions);
      status.textContent = 'Настройки сохранены.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Настройки не удалось сохранить.';
    }
  });
  panel.append(title, settingsForm);
  return panel;
}
function syncReadyBaseFields() {
  finishScope.hidden = !isReadyBase();
  railingLength.hidden = !isReadyBase();
  doorLabel.hidden = !isReadyBase() || finishScopeSelect.value !== 'full_cladding';
  underStairDoor.disabled = doorLabel.hidden;
  if (doorLabel.hidden) underStairDoor.checked = false;
}
byId('baseCondition').addEventListener('change', syncReadyBaseFields);
finishScopeSelect.addEventListener('change', syncReadyBaseFields);
syncReadyBaseFields();
const calculateGeometry = byId('toResultsBtn');
const oldDimensionActions = calculateGeometry.closest('.actions');
const geometryActions = document.createElement('div');
geometryActions.className = 'actions';
geometryActions.append(button('Назад', false, () => show(materials)), calculateGeometry);
railing.append(geometryActions);

function editBackLink(section, action) {
  const original = section.querySelector('[data-prev-step]');
  original.replaceWith(button('Назад', false, action));
}

scenario.querySelector('.actions').remove();
oldDimensionActions.remove();
navigation(scenario, null, () => show(shape));
navigation(shape, () => show(scenario), () => show(dimensions));
navigation(dimensions, () => show(shape), () => show(isReadyBase() ? details : materials));
navigation(details, () => show(dimensions), () => show(materials));
navigation(materials, () => show(isReadyBase() ? details : dimensions), () => {
  if (sharedPricingConfigured && !sharedPricingAvailable) return;
  show(railing);
});
editBackLink(review, () => show(railing));
editBackLink(result, () => show(review));
const quoteDetails = document.createElement('details');
quoteDetails.className = 'stepwise-pricing-settings';
const quoteSummary = document.createElement('summary');
quoteSummary.textContent = 'Что вошло в расчёт';
const quoteValues = document.createElement('p');
quoteDetails.append(quoteSummary, quoteValues);
byId('priceResult').after(quoteDetails);
for (const id of ['engineerReviewLink', 'requestLink']) {
  byId(id).addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const destination = new URL(event.currentTarget.href);
    const payload = destination.searchParams.get('calc');
    if (!payload) return;
    // Full calculation URLs can exceed the proxy's request-line limit.
    try {
      const ref = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem('tekstura_stepwise_request', JSON.stringify({ ref, payload, savedAt: Date.now() }));
      destination.searchParams.delete('calc');
      destination.searchParams.set('calc_ref', ref);
      event.preventDefault();
      location.assign(destination);
    } catch {
      // Keep the existing link available when the browser blocks session storage.
    }
  });
}
form.insertBefore(shape, dimensions);
for (const section of [details, materials, railing]) form.insertBefore(section, review);

buildScenarioCards();
const photoPath = document.createElement('details');
photoPath.className = 'stepwise-pricing-settings';
const photoTitle = document.createElement('summary');
photoTitle.textContent = 'У меня есть фото лестницы';
const photoHint = document.createElement('p');
photoHint.textContent = 'Откройте фото рядом с расчётом. Для цены понадобятся хотя бы примерные размеры. Если их нет, можно обратиться к инженеру.';
const photoInput = document.createElement('input');
photoInput.type = 'file';
photoInput.accept = 'image/*';
photoInput.setAttribute('aria-label', 'Фото лестницы');
const photo = document.createElement('img');
photo.className = 'stepwise-photo';
photo.alt = 'Выбранное фото лестницы';
photo.hidden = true;
const photoStatus = document.createElement('p');
photoStatus.setAttribute('role', 'status');
const engineer = document.createElement('a');
engineer.href = '/request.html?source=stair_photo';
engineer.textContent = 'Обратиться к инженеру';
let photoUrl;
photoInput.addEventListener('change', () => {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photo.hidden = true;
  photo.removeAttribute('src');
  photoStatus.textContent = '';
  const file = photoInput.files[0];
  if (!file) return;
  photoUrl = URL.createObjectURL(file);
  photo.src = photoUrl;
  photo.hidden = false;
  photoStatus.textContent = 'Фото открыто в браузере.';
});
photo.addEventListener('error', () => {
  photo.hidden = true;
  photoStatus.textContent = 'Фото не открылось. Попробуйте выбрать JPG или PNG.';
});
photoPath.append(photoTitle, photoHint, photoInput, photoStatus, engineer);
scenario.querySelector('.stepwise-scenarios').after(photoPath);
app.querySelector('.top').after(photo);
const originalScenarioGrid = byId('baseCondition').closest('.grid');
originalScenarioGrid.hidden = true;

let lastActive;
function syncProgress() {
  const active = form.querySelector('.step.active');
  if (!active || active === lastActive) return;
  const available = isReadyBase() ? stages : stages.filter(([section]) => section !== details);
  const index = available.findIndex((sections) => sections.includes(active));
  if (index === -1) return;
  progress.textContent = `Шаг ${index + 1} из ${available.length}`;
  if (active === result) {
    try {
      const payload = JSON.parse(new URL(byId('requestLink').href).searchParams.get('calc'));
      const d = payload.scenario_details || {};
      const dims = payload.input_dimensions || {};
      const parts = [
        payload.staircaseType,
        d.ready_frame_step_count ? `${d.ready_frame_step_count} ступ. · ${d.ready_frame_march_width} × ${d.ready_frame_tread_depth} мм · подступенок ${d.ready_frame_riser_height} мм` : '',
        !d.ready_frame_step_count && dims.floor_to_floor_height ? `высота ${dims.floor_to_floor_height} мм` : '',
        d.finish_scope_label,
        treadMaterial.selectedOptions[0]?.textContent,
        railingOption.selectedOptions[0]?.textContent,
        d.railing_length_m ? `ограждение ${d.railing_length_m} м` : '',
        d.under_stair_door ? 'дверка под лестницей' : '',
        payload.pricing_region?.name
      ];
      quoteValues.textContent = parts.filter(Boolean).join(' · ');
    } catch {
      quoteValues.textContent = '';
    }
  }
  if (lastActive) heading(active).focus();
  lastActive = active;
}
const observer = new MutationObserver(syncProgress);
for (const section of stages.flat()) observer.observe(section, { attributeFilter: ['class'] });
syncProgress();
