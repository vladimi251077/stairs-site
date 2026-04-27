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

  function scopeInput(value) {
    return document.querySelector(`input[name="scopeWork"][value="${value}"]`);
  }

  function extraInput(value) {
    return document.querySelector(`input[name="extras"][value="${value}"]`);
  }

  function checkedScope() {
    return [...document.querySelectorAll('input[name="scopeWork"]:checked')].map((input) => input.value);
  }

  function checkedExtras() {
    return [...document.querySelectorAll('input[name="extras"]:checked')].map((input) => input.value);
  }

  function getClosureType() {
    return $('stairClosureType')?.value || 'open';
  }

  function setFieldVisible(controlId, visible) {
    const control = $(controlId);
    const field = control?.closest('.field');
    if (!field) return;
    field.classList.toggle('preview-choice-hidden', !visible);
  }

  function setLabelVisible(input, visible) {
    const label = input?.closest('label');
    if (label) label.classList.toggle('preview-choice-hidden', !visible);
  }

  function ensureClosureSelector() {
    if ($('stairClosureType')) return;
    const scopeField = document.querySelector('#readyFlowFields .field--wide:has(input[name="scopeWork"])');
    if (!scopeField) return;

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
      updateClosureButtons(button.dataset.closure);
      applyClosureToHiddenScope();
      applyChoiceVisibility();
      refreshPreviewPrice();
    });
  }

  function updateClosureButtons(value) {
    document.querySelectorAll('[data-closure]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.closure === value);
    });
  }

  function applyClosureToHiddenScope() {
    const closure = getClosureType();
    const stepsOnly = scopeInput('steps_only');
    const stepsRisers = scopeInput('steps_risers');
    if (stepsOnly) stepsOnly.checked = closure === 'open';
    if (stepsRisers) stepsRisers.checked = closure === 'closed';
    updateClosureButtons(closure);
  }

  function normalizeLabels() {
    const scopeField = document.querySelector('#readyFlowFields .field--wide:has(input[name="scopeWork"])');
    if (scopeField) {
      const label = scopeField.querySelector(':scope > label');
      if (label) label.textContent = 'Дополнительные работы по основанию';
    }

    const extrasField = $('extrasField');
    const extrasLabel = extrasField?.querySelector(':scope > label');
    if (extrasLabel) extrasLabel.textContent = 'Дополнительные опции финиша';
  }

  function applyChoiceVisibility() {
    const ready = isReadyFrame();
    const scope = checkedScope();
    const hasRailing = scope.includes('railing');
    const hasCladding = scope.includes('frame_cladding');
    const hasLighting = scope.includes('lighting');

    // These two technical checkboxes are now controlled only by the Open/Closed selector.
    setLabelVisible(scopeInput('steps_only'), false);
    setLabelVisible(scopeInput('steps_risers'), false);

    // Ready-frame has its own railing selector; hide the duplicated general railing select.
    setFieldVisible('readyRailingType', ready && hasRailing);
    setFieldVisible('topFloorRailingLength', ready && hasRailing);
    setFieldVisible('railingType', !ready);

    // Cladding details are shown only when cladding work is selected.
    setFieldVisible('claddingType', !ready || hasCladding);

    // Lighting is selected in the work scope for ready frame, so hide duplicated extras lighting item.
    const extrasLighting = extraInput('lighting');
    setLabelVisible(extrasLighting, !ready);
    if (ready && extrasLighting) extrasLighting.checked = false;

    // Keep lighting cost controlled by scopeWork in ready frame.
    if (hasLighting && extrasLighting) extrasLighting.checked = false;

    // If railing is not selected, keep cost selector neutral.
    if (ready && !hasRailing && $('readyRailingType')) $('readyRailingType').value = 'none';
  }

  function enableVisibleControls() {
    ['deliveryDistance', 'claddingType', 'railingType', 'finishLevel', 'readyRailingType', 'topFloorRailingLength'].forEach((id) => {
      const control = $(id);
      if (control) control.disabled = false;
    });
    document.querySelectorAll('#extrasField input, #extrasField select, #extrasField button').forEach((control) => {
      control.disabled = false;
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
    const scope = checkedScope();
    const extras = checkedExtras();
    const closure = getClosureType();
    const railing = ready ? ($('readyRailingType')?.value || 'none') : ($('railingType')?.value || 'metal');
    const frame = $('frameMaterial')?.value || 'metal';
    const distance = numberValue('deliveryDistance', 20);
    const topRailM = scope.includes('railing') ? numberValue('topFloorRailingLength', 0) / 1000 : 0;

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

    const stepsCost = steps * (stepRates[material] || stepRates.ash);
    const risersCost = closure === 'closed' ? steps * 4500 : 0;
    const frameCost = ready ? 0 : (frameRates[frame] || frameRates.metal);
    const claddingCost = scope.includes('frame_cladding') ? 45000 : 0;
    const railingLength = Math.max(ready ? steps * 0.32 : steps * 0.28, 2.5) + topRailM;
    const railingCost = scope.includes('railing') || !ready ? railingLength * (railingRates[railing] || 0) : 0;
    const installCost = (scope.includes('installation') || !ready) ? 18000 + steps * 2600 : 0;
    const lightingCost = scope.includes('lighting') ? steps * 2200 : 0;
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
        ['Подсветка', lightingCost],
        ['Финишные опции', paintCost + coatingCost + hiddenFastenersCost],
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
      normalizeLabels();
      applyClosureToHiddenScope();
      enableVisibleControls();
      applyChoiceVisibility();
      refreshPreviewPrice();
    }, 140);
  }

  window.addEventListener('DOMContentLoaded', () => {
    refresh();
    document.addEventListener('click', refresh);
    document.addEventListener('input', refresh);
    document.addEventListener('change', refresh);
  });
})();
