(() => {
  const $ = (id) => document.getElementById(id);
  const numberValue = (id, fallback = 0) => Number($(id)?.value || fallback || 0);
  const rub = (value) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;

  function currentType() {
    return $('stairType')?.value || 'straight';
  }

  function isReadyFrame() {
    return $('baseCondition')?.value === 'ready_frame';
  }

  function getStepCount() {
    if (isReadyFrame()) return Math.max(1, numberValue('stepCount', 15));
    const height = numberValue('floorHeight', 2800);
    return Math.max(12, Math.round(height / 170));
  }

  function getTreadCount() {
    return Math.max(1, getStepCount() - 1);
  }

  function getClosureType() {
    return $('stairClosureType')?.value || (document.querySelector('input[name="scopeWork"][value="steps_risers"]')?.checked ? 'closed' : 'open');
  }

  function ensureClosureSelector() {
    if ($('stairClosureType')) return;
    const scopeField = document.querySelector('#readyFlowFields .field--wide:has(input[name="scopeWork"])');
    const readyFields = $('readyFlowFields');
    if (!readyFields || !scopeField) return;

    const field = document.createElement('div');
    field.className = 'field field--wide closure-field';
    field.innerHTML = `
      <label>Тип исполнения ступеней</label>
      <div class="closure-options" role="radiogroup" aria-label="Тип исполнения ступеней">
        <button type="button" class="closure-option is-active" data-closure="open">
          <span>Открытая</span>
          <small>Только ступени, без подступенков</small>
        </button>
        <button type="button" class="closure-option" data-closure="closed">
          <span>Закрытая</span>
          <small>Ступени + подступенки / закрытый вид</small>
        </button>
      </div>
      <input type="hidden" id="stairClosureType" value="open">
    `;
    scopeField.parentNode.insertBefore(field, scopeField);

    field.addEventListener('click', (event) => {
      const button = event.target.closest('[data-closure]');
      if (!button) return;
      $('stairClosureType').value = button.dataset.closure;
      field.querySelectorAll('[data-closure]').forEach((item) => item.classList.toggle('is-active', item === button));
      syncClosureWithScope(button.dataset.closure);
      refreshPreviewPrice();
    });
  }

  function syncClosureWithScope(closure) {
    const stepsOnly = document.querySelector('input[name="scopeWork"][value="steps_only"]');
    const stepsRisers = document.querySelector('input[name="scopeWork"][value="steps_risers"]');
    if (!stepsOnly || !stepsRisers) return;

    if (closure === 'closed') {
      stepsOnly.checked = false;
      stepsRisers.checked = true;
      stepsOnly.closest('label')?.classList.add('is-hidden-by-scope');
      return;
    }

    stepsOnly.checked = true;
    stepsRisers.checked = false;
    document.querySelectorAll('input[name="scopeWork"]').forEach((input) => {
      if (!['steps_only', 'installation'].includes(input.value)) input.checked = false;
    });
    stepsOnly.closest('label')?.classList.remove('is-hidden-by-scope');
  }

  function syncScopeWithClosure(eventTarget = null) {
    ensureClosureSelector();
    const hidden = $('stairClosureType');
    if (!hidden) return;
    const stepsOnly = document.querySelector('input[name="scopeWork"][value="steps_only"]');
    const stepsRisers = document.querySelector('input[name="scopeWork"][value="steps_risers"]');
    const advanced = [...document.querySelectorAll('input[name="scopeWork"]')]
      .filter((input) => !['steps_only', 'installation'].includes(input.value));
    const advancedSelected = advanced.some((input) => input.checked);

    if (eventTarget === stepsOnly && stepsOnly.checked) {
      hidden.value = 'open';
      updateClosureButtons('open');
      return;
    }

    if (stepsRisers?.checked || advancedSelected) {
      hidden.value = 'closed';
      stepsOnly.checked = false;
      stepsOnly.closest('label')?.classList.add('is-hidden-by-scope');
      updateClosureButtons('closed');
    } else {
      hidden.value = 'open';
      stepsOnly.closest('label')?.classList.remove('is-hidden-by-scope');
      updateClosureButtons('open');
    }
  }

  function updateClosureButtons(value) {
    document.querySelectorAll('[data-closure]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.closure === value);
    });
  }

  function complexityCoef(type) {
    return {
      straight: 1,
      l_turn_landing: 1.12,
      l_turn_winders: 1.2,
      u_turn_landing: 1.18,
      u_turn_winders: 1.28
    }[type] || 1.1;
  }

  function estimatePrice() {
    const type = currentType();
    const steps = getTreadCount();
    const ready = isReadyFrame();
    const material = $('readyMaterial')?.value || 'ash';
    const finishLevel = $('finishLevel')?.value || 'basic';
    const railing = ready ? ($('readyRailingType')?.value || 'none') : ($('railingType')?.value || 'metal');
    const frame = $('frameMaterial')?.value || 'metal';
    const closure = getClosureType();
    const distance = numberValue('deliveryDistance', 20);
    const topRailM = numberValue('topFloorRailingLength', 0) / 1000;

    const stepRates = { pine: 9000, ash: 18000, oak: 26000, mdf: 11000 };
    const frameRates = { metal: 170000, concrete: 190000, wood: 145000 };
    const finishCoef = { basic: 1, standard: 1.12, premium: 1.28 };
    const railingRates = {
      none: 0,
      metal: 9500,
      round_tube_16mm: 9500,
      glass: 18000,
      wood: 12000,
      mdf: 11000,
      pattern_2d: 15000,
      custom: 19000
    };

    const scope = [...document.querySelectorAll('input[name="scopeWork"]:checked')].map((input) => input.value);
    const extras = [...document.querySelectorAll('input[name="extras"]:checked')].map((input) => input.value);

    const stepsCost = steps * (stepRates[material] || stepRates.ash);
    const risersCost = closure === 'closed' || scope.includes('steps_risers') ? steps * 4500 : 0;
    const frameCost = ready ? 0 : (frameRates[frame] || frameRates.metal);
    const claddingCost = scope.includes('frame_cladding') ? 45000 : 0;
    const railingLength = Math.max(ready ? steps * 0.32 : steps * 0.28, 2.5) + topRailM;
    const railingCost = scope.includes('railing') || !ready ? railingLength * (railingRates[railing] || 0) : 0;
    const installCost = (scope.includes('installation') || !ready) ? 18000 + steps * 2600 : 0;
    const lightingCost = (scope.includes('lighting') || extras.includes('lighting')) ? steps * 2200 : 0;
    const paintCost = extras.includes('painted_metal') ? 22000 : 0;
    const coatingCost = extras.includes('premium_coating') ? 28000 : 0;
    const hiddenFastenersCost = extras.includes('hidden_fasteners') ? steps * 950 : 0;
    const deliveryCost = distance * 110;

    const subtotal = frameCost + stepsCost + risersCost + claddingCost + railingCost + installCost + lightingCost + paintCost + coatingCost + hiddenFastenersCost + deliveryCost;
    const total = Math.round(subtotal * (finishCoef[finishLevel] || 1) * complexityCoef(type) / 1000) * 1000;
    return {
      total,
      min: Math.round(total * 0.9 / 1000) * 1000,
      max: Math.round(total * 1.18 / 1000) * 1000,
      rows: [
        ['Ступени', stepsCost],
        ['Подступенки / закрытый вид', risersCost],
        ['Каркас / основание', frameCost],
        ['Обшивка основания', claddingCost],
        ['Ограждение', railingCost],
        ['Монтаж', installCost],
        ['Опции', lightingCost + paintCost + coatingCost + hiddenFastenersCost],
        ['Доставка', deliveryCost]
      ].filter(([, price]) => price > 0)
    };
  }

  function ensurePriceBox() {
    let box = $('previewPriceEstimate');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'previewPriceEstimate';
    box.className = 'result-box preview-price-box';
    const visuals = document.querySelector('.geometry-visuals');
    if (visuals) visuals.insertAdjacentElement('afterend', box);
    return box;
  }

  function ensureStep1PriceMini() {
    let box = $('previewStep1PriceMini');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'previewStep1PriceMini';
    box.className = 'preview-price-mini';
    document.querySelector('.actions--primary')?.insertAdjacentElement('beforebegin', box);
    return box;
  }

  function refreshPreviewPrice() {
    ensureClosureSelector();
    const estimate = estimatePrice();
    const closureLabel = getClosureType() === 'closed' ? 'Закрытая' : 'Открытая';
    const box = ensurePriceBox();
    if (box) {
      box.innerHTML = `
        <h3>Примерная стоимость</h3>
        <div class="preview-price-main">${rub(estimate.min)} – ${rub(estimate.max)}</div>
        <p class="muted">Предварительный диапазон по выбранным материалам и составу работ. Финальная смета после замера Tekstura.</p>
        <div class="preview-price-breakdown">
          ${estimate.rows.map(([label, price]) => `<div><span>${label}</span><b>${rub(price)}</b></div>`).join('')}
        </div>
        <div class="preview-price-note">Исполнение: ${closureLabel}</div>
      `;
    }

    const mini = ensureStep1PriceMini();
    if (mini) {
      mini.innerHTML = `<span>Ориентир по текущему выбору</span><b>${rub(estimate.min)} – ${rub(estimate.max)}</b><small>Финально после замера</small>`;
    }
  }

  function refresh() {
    window.setTimeout(() => {
      ensureClosureSelector();
      syncScopeWithClosure();
      refreshPreviewPrice();
    }, 120);
  }

  window.addEventListener('DOMContentLoaded', () => {
    refresh();
    document.addEventListener('click', refresh);
    document.addEventListener('input', refresh);
    document.addEventListener('change', (event) => {
      if (event.target?.matches?.('input[name="scopeWork"]')) syncScopeWithClosure(event.target);
      refresh();
    });
  });
})();
