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
details.append(byId('existingMetalGroup'), byId('existingConcreteGroup'));
const finishScopeSelect = byId('finishScope');
const finishScope = finishScopeSelect.closest('.field');
const serviceOptions = byId('serviceOptionsGroup');
serviceOptions.prepend(finishScope);
const sheetFields = document.createElement('fieldset');
const sheetLegend = document.createElement('legend');
sheetLegend.textContent = 'МДФ 10 мм на всю обшивку, включая подступенки';
sheetFields.append(sheetLegend);
const sheetInputs = ['claddingSheetCount', 'claddingSheetWidth', 'claddingSheetHeight'].map(byId);
for (const input of sheetInputs) {
  input.value = '';
  input.min = '1';
  input.step = '1';
}
for (const id of ['sheetCountField', 'sheetSizeField']) {
  const field = byId(id);
  field.classList.remove('hidden');
  field.removeAttribute('id');
  sheetFields.append(field);
}
serviceOptions.append(sheetFields);
const railingGrid = makeGrid(railing);
moveField('railingOption', railingGrid);
const railingLength = byId('readyFrameStraightRailingLength').closest('.field');
railingGrid.append(railingLength);
materials.append(byId('pricingInputGroup'), serviceOptions);
function syncReadyBaseFields() {
  finishScope.hidden = !isReadyBase();
  railingLength.hidden = !isReadyBase();
  sheetFields.hidden = !isReadyBase() || finishScopeSelect.value !== 'full_cladding';
  sheetInputs.forEach((input) => { input.disabled = sheetFields.hidden; });
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
  const required = !sheetFields.hidden && sheetInputs.some((input) => input.value !== '');
  for (const input of sheetInputs) input.required = required;
  if (sheetInputs.every((input) => input.reportValidity())) show(railing);
});
editBackLink(review, () => show(railing));
editBackLink(result, () => show(review));
for (const id of ['engineerReviewLink', 'requestLink']) {
  byId(id).addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const destination = new URL(event.currentTarget.href);
    const payload = destination.searchParams.get('calc');
    if (!payload) return;
    // Full calculation URLs can exceed the proxy's request-line limit.
    try {
      const ref = crypto.randomUUID();
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
  if (lastActive) heading(active).focus();
  lastActive = active;
}
const observer = new MutationObserver(syncProgress);
for (const section of stages.flat()) observer.observe(section, { attributeFilter: ['class'] });
syncProgress();
