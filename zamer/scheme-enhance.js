(() => {
  const ROOT_ID = 'scheme-enhance-root';
  const STYLE_ID = 'scheme-enhance-style';

  const FIELD_ALIASES = {
    openingType: ['measurement_section', 'opening_type', 'object_type', 'zamer_opening_type'],
    shape: ['stair_shape', 'stair_type', 'shape_type', 'zamer_shape'],
    variant: ['stair_variant', 'turn_variant', 'turn_type', 'platform_or_winder', 'zamer_variant'],
    side: ['stair_side', 'turn_side', 'rotation_side', 'l_turn_side', 'zamer_side'],
    templateKey: ['scheme_template', 'scheme_key', 'zamer_scheme_template'],
    height: ['height_clean_to_clean_mm'],
    openingLength: ['opening_length_mm'],
    openingWidth: ['opening_width_mm'],
    slabThickness: ['slab_thickness_mm'],
    flight1Width: ['flight1_width_mm', 'desired_flight_width_mm'],
    flight2Width: ['flight2_width_mm'],
    steps1: ['visual_steps_1'],
    steps2: ['visual_steps_2'],
    landing: ['visual_landing', 'corner_zone_length_mm', 'corner_zone_width_mm'],
    turnAngle: ['visual_turn_angle'],
    balustrade: ['visual_balustrade']
  };

  const FIELDS = [
    { key: 'openingLength', label: 'Длина проёма', value: '2223', unit: 'мм', cls: 'pos-top' },
    { key: 'height', label: 'Высота', value: '3267', unit: 'мм', cls: 'pos-left' },
    { key: 'openingWidth', label: 'Ширина проёма', value: '2223', unit: 'мм', cls: 'pos-right' },
    { key: 'slabThickness', label: 'Толщина проёма', value: '120', unit: 'мм', cls: 'pos-thickness' },
    { key: 'flight1Width', label: 'Ширина марша 1', value: '826', unit: 'мм', cls: 'pos-bottom-1' },
    { key: 'flight2Width', label: 'Ширина марша 2', value: '941', unit: 'мм', cls: 'pos-bottom-2' },
    { key: 'steps1', label: 'Ступени марш 1', value: '8', unit: 'шт', cls: 'pos-bottom-3' },
    { key: 'steps2', label: 'Ступени марш 2', value: '4', unit: 'шт', cls: 'pos-bottom-4' },
    { key: 'landing', label: 'Площадка', value: '1200', unit: 'мм', cls: 'pos-landing' },
    { key: 'turnAngle', label: 'Угол поворота', value: '90', unit: '°', cls: 'pos-angle' },
    { key: 'balustrade', label: 'Балюстрада', value: 'Да', unit: '', cls: 'pos-balustrade' }
  ];

  const REQUIRED = FIELDS.map((field) => field.label);

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{display:grid;grid-template-columns:minmax(640px,1fr) 310px;gap:18px;margin:14px 0 22px;align-items:start}
      #${ROOT_ID} *{box-sizing:border-box}
      .se-main,.se-required{background:#fff;border:1px solid #d9e2ef;border-radius:22px;box-shadow:0 18px 45px rgba(15,23,42,.055)}
      .se-main{padding:18px}
      .se-required{padding:18px;position:sticky;top:16px}
      .se-controls{display:grid;gap:11px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #eef2f7}
      .se-switch{display:grid;grid-template-columns:112px 1fr;gap:10px;align-items:center}
      .se-switch-label{font-size:14px;font-weight:900;color:#071432}
      .se-switch-group{display:flex;gap:8px;flex-wrap:wrap}
      .se-btn{height:40px;border:1px solid #c4cedd;background:#fff;padding:0 16px;border-radius:999px;cursor:pointer;font-weight:900;color:#071432;box-shadow:0 3px 10px rgba(15,23,42,.035)}
      .se-btn[aria-pressed="true"]{background:#071432;color:#fff;border-color:#071432}
      .se-btn:disabled{cursor:not-allowed;background:#f2f5f9;color:#9aa7b8;border-color:#dce3ed;box-shadow:none}
      .se-btn small{font-weight:700;color:inherit;opacity:.68;margin-left:4px}
      .se-title-row{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}
      .se-title-row h3{margin:0;font-size:16px;color:#071432}
      .se-title-row span{border-radius:999px;background:#eef5ff;color:#24476f;padding:7px 10px;font-size:12px;font-weight:900}
      .se-drawing{position:relative;min-height:610px;border:1px solid #d9e2ef;border-radius:20px;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%);overflow:hidden}
      .se-blueprint{position:absolute;left:16px;right:16px;top:54px;height:360px;border:1px solid #e2e8f0;border-radius:18px;background:#fff}
      .se-svg{width:100%;height:100%;display:block}
      .se-field{position:absolute;z-index:5;display:block;width:142px}
      .se-field-label{display:block;margin-bottom:5px;font-size:12px;line-height:1.15;font-weight:900;color:#1f385a}
      .se-input-wrap{display:flex;align-items:center;gap:6px}
      .se-input{width:104px;height:42px;border:1px solid #cfd9e8;border-radius:13px;background:#fff;text-align:center;font-size:15px;font-weight:900;color:#071432;box-shadow:0 10px 22px rgba(15,23,42,.07)}
      .se-unit{font-size:12px;font-style:normal;font-weight:900;color:#405773}
      .pos-top{left:50%;top:14px;transform:translateX(-50%);text-align:center}
      .pos-left{left:22px;top:228px}
      .pos-right{right:12px;top:228px}
      .pos-thickness{right:22px;top:426px}
      .pos-landing{left:50%;top:214px;transform:translateX(-50%);text-align:center}
      .pos-angle{left:50%;top:426px;transform:translateX(-50%);text-align:center}
      .pos-balustrade{left:22px;top:426px}
      .pos-bottom-1{left:22px;bottom:18px}
      .pos-bottom-2{left:184px;bottom:18px}
      .pos-bottom-3{left:346px;bottom:18px}
      .pos-bottom-4{left:508px;bottom:18px}
      .se-note{position:absolute;left:18px;right:18px;bottom:78px;border-radius:16px;background:#eef5ff;color:#24476f;padding:12px 14px;font-size:13px;font-weight:800;line-height:1.35}
      .se-required h3{margin:0 0 12px;font-size:17px;color:#071432}
      .se-required-list{list-style:none;margin:0;padding:0;display:grid;gap:9px}
      .se-required-list li{display:flex;align-items:center;gap:8px;color:#334155;font-size:13.5px;font-weight:700;line-height:1.25}
      .se-required-list li:before{content:'✓';display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:#eef5ff;color:#071432;font-size:11px;font-weight:900;flex:0 0 auto}
      .se-help{margin-top:16px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;color:#475569;font-size:13px;font-weight:700;line-height:1.35}
      .se-hidden-legacy{display:none !important}
      @media (max-width:1100px){#${ROOT_ID}{grid-template-columns:1fr}.se-required{position:static}.se-drawing{min-height:680px}.pos-bottom-1{left:22px}.pos-bottom-2{left:184px}.pos-bottom-3{left:346px}.pos-bottom-4{left:22px;bottom:72px}}
      @media (max-width:760px){#${ROOT_ID}{margin:10px 0}.se-main{padding:12px}.se-switch{grid-template-columns:1fr}.se-drawing{min-height:auto;padding-bottom:14px}.se-blueprint{position:relative;left:auto;right:auto;top:auto;height:320px;margin-top:12px}.se-field{position:static;display:inline-block;margin:8px 6px 0 0;vertical-align:top}.se-note{position:static;margin-top:12px}.se-title-row{display:block}.se-title-row span{display:inline-block;margin-top:8px}}
    `;
    document.head.appendChild(style);
  }

  function getForm() {
    return document.querySelector('#measurement-form') || document.body;
  }

  function findSizesPanel() {
    return document.querySelector('[data-panel="sizes"]') || document.querySelector('#tab-sizes') || document.querySelector('.tab-sizes');
  }

  function getFirstAliasValue(key, fallback = '') {
    const form = getForm();
    const aliases = FIELD_ALIASES[key] || [];
    for (const name of aliases) {
      const field = form.querySelector(`[name="${name}"]`);
      if (field && field.value) return field.value;
    }
    return fallback;
  }

  function getOrCreateField(name) {
    const form = getForm();
    let input = form.querySelector(`[name="${name}"]`);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    return input;
  }

  function setAliases(key, value) {
    (FIELD_ALIASES[key] || []).forEach((name) => {
      const input = getOrCreateField(name);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function hideLegacyGrids() {
    const panel = findSizesPanel();
    if (!panel) return;
    Array.from(panel.children).forEach((el) => {
      if (el.id !== ROOT_ID) el.classList.add('se-hidden-legacy');
    });
  }

  function fieldHtml(field) {
    const value = getFirstAliasValue(field.key, field.value);
    return `
      <label class="se-field ${field.cls}">
        <span class="se-field-label">${field.label}</span>
        <span class="se-input-wrap">
          <input class="se-input" data-se-field="${field.key}" value="${value}" />
          ${field.unit ? `<em class="se-unit">${field.unit}</em>` : ''}
        </span>
      </label>
    `;
  }

  function drawSvg(side) {
    const mirror = side === 'right' ? 'translate(760 0) scale(-1 1)' : '';
    return `
      <svg class="se-svg" viewBox="0 0 760 360" role="img" aria-label="Схема Г-образной лестницы с площадкой">
        <defs>
          <marker id="seArrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#607496"/></marker>
          <filter id="softShadow" x="-15%" y="-15%" width="130%" height="130%"><feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.10"/></filter>
        </defs>
        <rect x="18" y="18" width="724" height="324" rx="16" fill="#ffffff" stroke="#d8e2ef" stroke-width="2"/>
        <line x1="180" y1="52" x2="580" y2="52" stroke="#607496" stroke-width="2" marker-start="url(#seArrow)" marker-end="url(#seArrow)"/>
        <text x="380" y="42" text-anchor="middle" font-size="14" font-weight="900" fill="#263b5a">длина проёма</text>
        <line x1="80" y1="90" x2="80" y2="286" stroke="#607496" stroke-width="2" marker-start="url(#seArrow)" marker-end="url(#seArrow)"/>
        <text x="58" y="190" text-anchor="middle" transform="rotate(-90 58 190)" font-size="14" font-weight="900" fill="#263b5a">высота</text>
        <line x1="680" y1="90" x2="680" y2="286" stroke="#607496" stroke-width="2" marker-start="url(#seArrow)" marker-end="url(#seArrow)"/>
        <text x="704" y="190" text-anchor="middle" transform="rotate(90 704 190)" font-size="14" font-weight="900" fill="#263b5a">ширина проёма</text>

        <g transform="${mirror}" filter="url(#softShadow)">
          <rect x="220" y="170" width="72" height="120" fill="#071432" rx="2"/>
          ${Array.from({ length: 7 }).map((_, i) => `<line x1="220" y1="${187 + i * 14}" x2="292" y2="${187 + i * 14}" stroke="#8ca5cc" stroke-width="1.5"/>`).join('')}
          <rect x="220" y="96" width="120" height="84" fill="#e8f1ff" stroke="#071432" stroke-width="4" rx="6"/>
          <rect x="340" y="96" width="196" height="72" fill="#071432" rx="2"/>
          ${Array.from({ length: 5 }).map((_, i) => `<line x1="${372 + i * 33}" y1="96" x2="${372 + i * 33}" y2="168" stroke="#8ca5cc" stroke-width="1.5"/>`).join('')}
          <text x="280" y="144" text-anchor="middle" font-size="16" font-weight="900" fill="#071432">Площадка</text>
          <path d="M256 292 C255 320 292 324 315 302" fill="none" stroke="#607496" stroke-width="3" marker-end="url(#seArrow)"/>
          <text x="230" y="320" font-size="14" font-weight="900" fill="#263b5a">Старт</text>
          <path d="M530 132 L610 132" fill="none" stroke="#607496" stroke-width="3" marker-end="url(#seArrow)"/>
          <text x="616" y="138" font-size="14" font-weight="900" fill="#263b5a">Выход</text>
        </g>
      </svg>
    `;
  }

  function init() {
    const panel = findSizesPanel();
    if (!panel || document.getElementById(ROOT_ID)) return;

    injectStyle();

    const state = { side: 'left' };
    setAliases('openingType', 'empty_opening');
    setAliases('shape', 'l');
    setAliases('variant', 'landing');
    setAliases('side', state.side);
    setAliases('templateKey', 'l_landing_left_opening');

    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="se-main">
        <div class="se-controls">
          <div class="se-switch"><div class="se-switch-label">Основание</div><div class="se-switch-group"><button type="button" class="se-btn" aria-pressed="true">Пустой проём</button><button type="button" class="se-btn" disabled>Готовый каркас <small>скоро</small></button></div></div>
          <div class="se-switch"><div class="se-switch-label">Форма</div><div class="se-switch-group"><button type="button" class="se-btn" disabled>Прямая <small>скоро</small></button><button type="button" class="se-btn" aria-pressed="true">Г-образная</button><button type="button" class="se-btn" disabled>П-образная <small>скоро</small></button></div></div>
          <div class="se-switch"><div class="se-switch-label">Вариант</div><div class="se-switch-group"><button type="button" class="se-btn" aria-pressed="true">С площадкой</button><button type="button" class="se-btn" disabled>Забежная <small>скоро</small></button></div></div>
          <div class="se-switch"><div class="se-switch-label">Поворот</div><div class="se-switch-group"><button type="button" class="se-btn" data-side="left" aria-pressed="true">Левая</button><button type="button" class="se-btn" data-side="right" aria-pressed="false">Правая</button></div></div>
        </div>
        <div class="se-title-row"><h3>Схема: пустой проём · Г-образная · с площадкой</h3><span>Площадка и забежные не смешиваются</span></div>
        <div class="se-drawing">
          <div class="se-blueprint"></div>
          ${FIELDS.map(fieldHtml).join('')}
          <div class="se-note">Заполняйте размеры прямо возле схемы. Сейчас включён первый рабочий шаблон: пустой проём, Г-образная лестница с площадкой, левая/правая сторона.</div>
        </div>
      </div>
      <aside class="se-required">
        <h3>Что обязательно замерить</h3>
        <ul class="se-required-list">${REQUIRED.map((item) => `<li>${item}</li>`).join('')}</ul>
        <div class="se-help">Остальные сценарии временно отключены, чтобы сначала довести до нормального вида один рабочий шаблон.</div>
      </aside>
    `;

    const blueprint = root.querySelector('.se-blueprint');
    const sideButtons = root.querySelectorAll('[data-side]');

    function renderSide(nextSide) {
      state.side = nextSide;
      blueprint.innerHTML = drawSvg(state.side);
      sideButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.side === state.side)));
      setAliases('side', state.side);
      setAliases('templateKey', `l_landing_${state.side}_opening`);
    }

    sideButtons.forEach((button) => button.addEventListener('click', () => renderSide(button.dataset.side)));

    root.querySelectorAll('[data-se-field]').forEach((input) => {
      input.addEventListener('input', () => setAliases(input.dataset.seField, input.value));
      setAliases(input.dataset.seField, input.value);
    });

    panel.prepend(root);
    hideLegacyGrids();
    renderSide(state.side);
  }

  const observer = new MutationObserver(init);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
