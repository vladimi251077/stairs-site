(function () {
  const STORAGE_KEY = 'tekstura_calc_payload';

  const $ = (id) => document.getElementById(id);
  const getValue = (id) => {
    const element = $(id);
    if (!element) return '';
    return typeof element.value === 'string' ? element.value.trim() : element.value;
  };
  const getNumber = (id) => {
    const value = Number(getValue(id));
    return Number.isFinite(value) ? value : 0;
  };
  const getActiveValue = (groupName, fallback = '') => (
    document.querySelector(`[data-step1-group="${groupName}"] .segmented__item.is-active`)?.dataset?.value || fallback
  );
  const getCheckedValues = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((item) => item.value);

  const LABELS = {
    base_condition: { empty_opening: 'Пустой проём', ready_frame: 'Готовое основание' },
    base_subtype: { existing_metal_frame: 'Готовый металлокаркас', existing_concrete_base: 'Готовое бетонное основание' },
    configuration_type: { straight: 'Прямая', l_shaped: 'Г-образная', u_shaped: 'П-образная' },
    turn_type: { landing: 'Площадка', winders: 'Забежные' },
    ready_material: { ash: 'Ясень', oak: 'Дуб', pine: 'Сосна', mdf: 'MDF' },
    ready_railing_type: { none: 'Без ограждения', round_tube_16mm: 'Труба круглая 16 мм', mdf: 'MDF', glass: 'Стекло', pattern_2d: 'Узор 2D', custom: 'Индивидуальное' },
    frame_material: { metal: 'Металлокаркас', concrete: 'Бетонный каркас', wood: 'Деревянный каркас' },
    cladding: { none: 'Без облицовки', standard: 'Стандартная облицовка', premium: 'Премиальная облицовка' },
    railing: { none: 'Без ограждения', metal: 'Металлическое ограждение', glass: 'Стеклянное ограждение', wood: 'Деревянное ограждение' },
    finish_level: { basic: 'Базовый', standard: 'Стандарт', premium: 'Премиум' }
  };

  function getConfigurationType() {
    const family = getActiveValue('stairFamily', 'straight');
    if (family === 'l-shaped') return 'l_shaped';
    if (family === 'u-shaped') return 'u_shaped';
    return 'straight';
  }

  function getStaircaseType() {
    const family = getActiveValue('stairFamily', 'straight');
    const turnMode = getActiveValue('turnMode', 'landing');
    if (family === 'l-shaped') return turnMode === 'winders' ? 'l_turn_winders' : 'l_turn_landing';
    if (family === 'u-shaped') return turnMode === 'winders' ? 'u_turn_winders' : 'u_turn_landing';
    return 'straight';
  }

  function buildPreliminaryGeometrySummary(baseCondition) {
    if (baseCondition !== 'ready_frame') return null;
    const stepCount = getNumber('stepCount');
    const riserHeight = getNumber('riserHeight');
    const treadDepth = getNumber('treadDepth');
    return {
      riser_count: stepCount || null,
      tread_count: stepCount || null,
      riser_height: riserHeight || null,
      tread_depth: treadDepth || null,
      comfort_value: riserHeight && treadDepth ? (2 * riserHeight) + treadDepth : null,
      stair_angle_deg: riserHeight && treadDepth ? Number((Math.atan(riserHeight / treadDepth) * 180 / Math.PI).toFixed(2)) : null,
      headroom_min: null,
      score: null,
      preliminary: true
    };
  }

  function buildDimensions() {
    return {
      floor_to_floor_height: getNumber('floorHeight'),
      opening_length: getNumber('openingLength'),
      opening_width: getNumber('openingWidth'),
      march_width: getNumber('marchWidth'),
      slab_thickness: getNumber('slabThickness'),
      top_finish_thickness: getNumber('topFinishThickness'),
      bottom_finish_thickness: getNumber('bottomFinishThickness'),
      step_count: getNumber('stepCount'),
      ready_march_width: getNumber('readyMarchWidth'),
      riser_height: getNumber('riserHeight'),
      tread_depth: getNumber('treadDepth'),
      landing_length: getNumber('landingLength'),
      landing_width: getNumber('landingWidth'),
      winder_count: getNumber('winderCount'),
      top_floor_railing_length: getNumber('topFloorRailingLength')
    };
  }

  function buildMaterialsSummary(baseCondition) {
    const readyMaterial = getValue('readyMaterial') || 'ash';
    const readyRailing = getValue('readyRailingType') || 'none';
    const frameMaterial = getValue('frameMaterial') || 'metal';
    const cladding = getValue('claddingType') || 'standard';
    const railing = getValue('railingType') || 'metal';
    const finish = getValue('finishLevel') || 'basic';
    const scopeOfWork = getCheckedValues('scopeWork');

    if (baseCondition === 'ready_frame') {
      return {
        base: LABELS.base_subtype[getValue('baseSubtype')] || LABELS.base_condition.ready_frame,
        turn_type: getConfigurationType() === 'straight' ? 'Не требуется' : (LABELS.turn_type[getActiveValue('turnMode', 'landing')] || getActiveValue('turnMode', 'landing')),
        ready_material: LABELS.ready_material[readyMaterial] || readyMaterial,
        ready_railing_type: LABELS.ready_railing_type[readyRailing] || readyRailing,
        scope_of_work: scopeOfWork
      };
    }

    return {
      frame: LABELS.frame_material[frameMaterial] || frameMaterial,
      cladding: LABELS.cladding[cladding] || cladding,
      railing: LABELS.railing[railing] || railing,
      finish: LABELS.finish_level[finish] || finish
    };
  }

  function buildSelectedExtras() {
    return getCheckedValues('extras').map((code) => ({ code, label: code }));
  }

  function buildDraftPayload(reason = 'draft_request') {
    const baseCondition = getValue('baseCondition') || getActiveValue('scenario', 'empty_opening');
    const configurationType = getConfigurationType();
    const turnType = getActiveValue('turnMode', 'landing');
    const turnDirection = baseCondition === 'ready_frame'
      ? (getValue('readyTurnDirection') || 'left')
      : (getValue('turnDirection') || 'left');

    return {
      payload_version: 'pr74-stage1-v1',
      request_source: reason,
      source: 'calculator',
      status: reason === 'engineering_fallback' ? 'engineering_review_requested' : 'draft_request',
      base_condition: baseCondition,
      base_subtype: getValue('baseSubtype') || 'existing_metal_frame',
      staircaseType: getStaircaseType(),
      configuration_type: configurationType,
      turn_type: configurationType === 'straight' ? '' : turnType,
      turn_direction: configurationType === 'straight' ? '' : turnDirection,
      dimensions: buildDimensions(),
      geometrySummary: buildPreliminaryGeometrySummary(baseCondition),
      materialsSummary: buildMaterialsSummary(baseCondition),
      selectedExtras: buildSelectedExtras(),
      priceBreakdown: {},
      total: 0,
      warnings: [
        reason === 'engineering_fallback'
          ? 'Онлайн-геометрия не прошла проверку. Размеры переданы инженеру Tekstura для ручной проверки.'
          : 'Переход в заявку выполнен до финального расчёта. Инженер Tekstura уточнит параметры вручную.'
      ],
      existing_condition_notes: getValue('existingConditionNotes'),
      created_at: new Date().toISOString()
    };
  }

  function encodePayload(payload) {
    return encodeURIComponent(JSON.stringify(payload));
  }

  function saveDraftPayload(reason) {
    const payload = buildDraftPayload(reason);
    const encoded = encodePayload(payload);
    try {
      sessionStorage.setItem(STORAGE_KEY, encoded);
    } catch (error) {
      console.warn('[Tekstura calculator] Unable to save calculator payload in sessionStorage', error);
    }
    return encoded;
  }

  function hydrateRequestLink(link, reason) {
    if (!link) return;
    const encoded = saveDraftPayload(reason);
    link.href = `/request.html?calc=${encoded}`;
    link.dataset.calcPayloadReady = 'true';
    const status = $('pageStatus');
    if (status && reason === 'engineering_fallback') {
      status.textContent = 'Размеры сохранены для инженерной заявки.';
    }
  }

  function bindEngineeringFallback() {
    const link = document.querySelector('#geometryFallbackCta a');
    if (!link) return;
    ['pointerdown', 'focus', 'click'].forEach((eventName) => {
      link.addEventListener(eventName, () => hydrateRequestLink(link, 'engineering_fallback'));
    });
  }

  function bindConsultationLinks() {
    document.querySelectorAll('a[href="/request.html"]').forEach((link) => {
      if (link.id === 'requestBtn') return;
      if (link.closest('#geometryFallbackCta')) return;
      const text = String(link.textContent || '').toLowerCase();
      if (text.includes('не знаю') || text.includes('инженер') || text.includes('заявк')) {
        ['pointerdown', 'focus', 'click'].forEach((eventName) => {
          link.addEventListener(eventName, () => hydrateRequestLink(link, 'draft_request'));
        });
      }
    });
  }

  function bindRequestButtonGuard() {
    const requestBtn = $('requestBtn');
    if (!requestBtn) return;
    requestBtn.addEventListener('click', () => {
      const href = requestBtn.getAttribute('href') || '';
      let hasStoredPayload = false;
      try {
        hasStoredPayload = Boolean(sessionStorage.getItem(STORAGE_KEY));
      } catch (error) {
        hasStoredPayload = false;
      }
      if (!href.includes('calc=') && !hasStoredPayload) {
        hydrateRequestLink(requestBtn, 'draft_request');
      }
    }, true);
  }

  function init() {
    bindEngineeringFallback();
    bindConsultationLinks();
    bindRequestButtonGuard();
    window.TeksturaCalculatorPayloadFallback = {
      buildDraftPayload,
      saveDraftPayload
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
