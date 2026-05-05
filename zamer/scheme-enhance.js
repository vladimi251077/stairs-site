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
    flight1Width: ['flight1_width_mm', 'desired_flight_width_mm'],
    flight2Width: ['flight2_width_mm'],
    steps1: ['visual_steps_1'],
    steps2: ['visual_steps_2'],
    riser: ['visual_riser_mm', 'riser_height_mm'],
    tread: ['visual_tread_mm', 'tread_depth_mm'],
    landing: ['visual_landing', 'corner_zone_length_mm', 'corner_zone_width_mm'],
    turnAngle: ['visual_turn_angle'],
    balustrade: ['visual_balustrade']
  };

  const BASE_FIELDS = [
    { key: 'height', label: 'Общая высота', value: '3267', unit: 'мм' },
    { key: 'flight1Width', label: 'Ширина марша 1', value: '826', unit: 'мм' },
    { key: 'flight2Width', label: 'Ширина марша 2', value: '941', unit: 'мм' },
    { key: 'steps1', label: 'Ступени марш 1', value: '8', unit: 'шт' },
    { key: 'steps2', label: 'Ступени марш 2', value: '4', unit: 'шт' },
    { key: 'riser', label: 'Подъём ступени', value: '180', unit: 'мм' },
    { key: 'tread', label: 'Глубина проступи', value: '280', unit: 'мм' },
    { key: 'landing', label: 'Площадка', value: '1200', unit: 'мм' },
    { key: 'turnAngle', label: 'Угол поворота', value: '90', unit: '°' },
    { key: 'balustrade', label: 'Балюстрада', value: 'Да', unit: '' }
  ];

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{display:grid;grid-template-columns:minmax(660px,1fr) 300px;gap:18px;margin:14px 0 22px;align-items:start}
      #${ROOT_ID} *{box-sizing:border-box}
      .se-main,.se-required{background:#fff;border:1px solid #d9e2ef;border-radius:22px;box-shadow:0 18px 45px rgba(15,23,42,.055)}
      .se-main{padding:18px;display:grid;gap:16px}
      .se-required{padding:18px;position:sticky;top:16px}
      .se-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .se-kicker{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;font-weight:900}
      .se-title{margin:3px 0 0;font-size:18px;line-height:1.2;color:#071432;font-weight:950}
      .se-sub{margin:6px 0 0;max-width:620px;color:#52667f;font-size:13px;font-weight:700;line-height:1.35}
      .se-side-toggle{display:flex;gap:8px;flex:0 0 auto;background:#f3f6fa;border:1px solid #dbe4ef;border-radius:999px;padding:4px}
      .se-side-toggle button{height:34px;border:0;border-radius:999px;background:transparent;padding:0 14px;color:#334155;font-weight:900;cursor:pointer}
      .se-side-toggle button[aria-pressed="true"]{background:#071432;color:#fff;box-shadow:0 6px 16px rgba(7,20,50,.16)}
      .se-opening-card,.se-base-card{border:1px solid #d9e2ef;border-radius:20px;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%);padding:16px}
      .se-opening-card{display:grid;grid-template-columns:220px 1fr;gap:16px;align-items:center}
      .se-opening-mini{height:140px;border:1px solid #dce5f1;border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:center}
      .se-opening-mini svg{width:170px;height:110px}
      .se-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .se-chip{display:inline-flex;align-items:center;border-radius:999px;border:1px solid #d8e2ef;background:#eef5ff;color:#1e3a5f;padding:7px 11px;font-size:12px;font-weight:900}
      .se-base-card{display:grid;gap:14px}
      .se-blueprint{height:360px;border:1px solid #dce5f1;border-radius:18px;background:#fff;overflow:hidden}
      .se-svg{width:100%;height:100%;display:block}
      .se-fields{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:10px;padding-top:2px}
      .se-field{display:block;border:1px solid #d9e2ef;border-radius:16px;background:#fff;padding:10px 11px;box-shadow:0 8px 20px rgba(15,23,42,.045)}
      .se-field-label{display:block;margin-bottom:7px;font-size:12px;line-height:1.15;font-weight:900;color:#1f385a}
      .se-input-wrap{display:flex;align-items:center;gap:6px}
      .se-input{width:100%;min-width:0;height:38px;border:1px solid #cfd9e8;border-radius:12px;background:#fff;text-align:center;font-size:15px;font-weight:900;color:#071432}
      .se-unit{font-size:12px;font-style:normal;font-weight:900;color:#405773;flex:0 0 auto}
      .se-note{border-radius:16px;background:#eef5ff;color:#24476f;padding:11px 13px;font-size:13px;font-weight:800;line-height:1.35}
      .se-required h3{margin:0 0 12px;font-size:17px;color:#071432}
      .se-required-list{list-style:none;margin:0;padding:0;display:grid;gap:9px}
      .se-required-list li{display:flex;align-items:center;gap:8px;color:#334155;font-size:13.5px;font-weight:700;line-height:1.25}
      .se-required-list li:before{content:'✓';display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:#eef5ff;color:#071432;font-size:11px;font-weight:900;flex:0 0 auto}
      .se-help{margin-top:16px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;color:#475569;font-size:13px;font-weight:700;line-height:1.35}
      .se-hidden-legacy{display:none !important}
      @media (max-width:1180px){#${ROOT_ID}{grid-template-columns:1fr}.se-required{position:static}.se-fields{grid-template-columns:repeat(3,minmax(120px,1fr))}}
      @media (max-width:760px){#${ROOT_ID}{margin:10px 0}.se-main{padding:12px}.se-section-head{display:grid}.se-opening-card{grid-template-columns:1fr}.se-blueprint{height:300px}.se-fields{grid-template-columns:repeat(2,minmax(120px,1fr))}}
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
    for (const name of FIELD_ALIASES[key] || []) {
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
      <label class="se-field">
        <span class="se-field-label">${field.label}</span>
        <span class="se-input-wrap">
          <input class="se-input" data-se-field="${field.key}" value="${value}" />
          ${field.unit ? `<em class="se-unit">${field.unit}</em>` : ''}
        </span>
      </label>
    `;
  }

  function openingSvg(side) {
    const mirror = side === 'right' ? 'translate(180 0) scale(-1 1)' : '';
    return `
      <svg viewBox="0 0 180 120" aria-label="Форма пустого проёма">
        <g transform="${mirror}" fill="none" stroke="#071432" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M42 96 V38 H132"/>
        </g>
        <text x="90" y="18" text-anchor="middle" fill="#334155" font-size="12" font-weight="900">форма проёма</text>
      </svg>
    `;
  }

  function baseSvg(side) {
    const mirror = side === 'right' ? 'translate(760 0) scale(-1 1)' : '';
    return `
      <svg class="se-svg" viewBox="0 0 760 360" role="img" aria-label="Размеры готового основания">
        <defs>
          <marker id="seArrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#607496"/></marker>
          <filter id="softShadow" x="-15%" y="-15%" width="130%" height="130%"><feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.10"/></filter>
        </defs>
        <rect x="18" y="18" width="724" height="324" rx="16" fill="#ffffff" stroke="#d8e2ef" stroke-width="2"/>
        <text x="36" y="45" font-size="15" font-weight="950" fill="#071432">Готовое основание: размеры маршей и площадки</text>
        <g transform="${mirror}" filter="url(#softShadow)">
          <rect x="218" y="174" width="76" height="124" fill="#071432" rx="2"/>
          ${Array.from({ length: 7 }).map((_, i) => `<line x1="218" y1="${191 + i * 14}" x2="294" y2="${191 + i * 14}" stroke="#8ca5cc" stroke-width="1.4"/>`).join('')}
          <rect x="218" y="96" width="126" height="86" fill="#e8f1ff" stroke="#071432" stroke-width="4" rx="6"/>
          <rect x="344" y="102" width="210" height="70" fill="#071432" rx="2"/>
          ${Array.from({ length: 6 }).map((_, i) => `<line x1="${374 + i * 31}" y1="102" x2="${374 + i * 31}" y2="172" stroke="#8ca5cc" stroke-width="1.4"/>`).join('')}
          <text x="281" y="146" text-anchor="middle" font-size="16" font-weight="950" fill="#071432">Площадка</text>
          <line x1="225" y1="318" x2="288" y2="318" stroke="#607496" stroke-width="3" marker-end="url(#seArrow)"/>
          <text x="224" y="338" font-size="14" font-weight="900" fill="#263b5a">Старт</text>
          <line x1="554" y1="137" x2="638" y2="137" stroke="#607496" stroke-width="3" marker-end="url(#seArrow)"/>
          <text x="642" y="142" font-size="14" font-weight="900" fill="#263b5a">Выход</text>
          <line x1="205" y1="174" x2="205" y2="298" stroke="#607496" stroke-width="2" marker-start="url(#seArrow)" marker-end="url(#seArrow)"/>
          <text x="185" y="238" transform="rotate(-90 185 238)" font-size="12" font-weight="900" fill="#263b5a">марш 1</text>
          <line x1="344" y1="88" x2="554" y2="88" stroke="#607496" stroke-width="2" marker-start="url(#seArrow)" marker-end="url(#seArrow)"/>
          <text x="449" y="78" text-anchor="middle" font-size="12" font-weight="900" fill="#263b5a">марш 2</text>
        </g>
      </svg>
    `;
  }

  function init() {
    const panel = findSizesPanel();
    if (!panel || document.getElementById(ROOT_ID)) return;

    injectStyle();

    const state = { side: getFirstAliasValue('side', 'left') === 'right' ? 'right' : 'left' };
    setAliases('openingType', 'ready_base');
    setAliases('shape', 'l');
    setAliases('variant', 'landing');
    setAliases('side', state.side);
    setAliases('templateKey', `l_landing_${state.side}_ready_base`);

    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="se-main">
        <div class="se-section-head">
          <div>
            <div class="se-kicker">Раздел размеров</div>
            <h3 class="se-title">Пустой проём отдельно, готовое основание отдельно</h3>
            <p class="se-sub">Форма проёма показана только как ориентир. Поля размеров ниже относятся к готовому основанию: маршам, площадке, подъёму и проступи.</p>
          </div>
          <div class="se-side-toggle" aria-label="Поворот лестницы"><button type="button" data-side="left">Левая</button><button type="button" data-side="right">Правая</button></div>
        </div>
        <div class="se-opening-card">
          <div class="se-opening-mini"></div>
          <div>
            <div class="se-kicker">Пустой проём</div>
            <h3 class="se-title">Только форма проёма</h3>
            <p class="se-sub">Здесь не вводим размеры маршей и площадки. Это только выбор/понимание формы: Г-образный, левая или правая сторона.</p>
            <div class="se-chips"><span class="se-chip">Г-образный</span><span class="se-chip">с площадкой</span><span class="se-chip se-side-label">Левая</span></div>
          </div>
        </div>
        <div class="se-base-card">
          <div>
            <div class="se-kicker">Готовое основание</div>
            <h3 class="se-title">Размеры по готовому основанию</h3>
          </div>
          <div class="se-blueprint"></div>
          <div class="se-fields">${BASE_FIELDS.map(fieldHtml).join('')}</div>
          <div class="se-note">Размеры проёма здесь не собираем. Вводим только то, что относится к готовому основанию: ширина маршей, количество ступеней, подъём, проступь, площадка, угол и балюстрада.</div>
        </div>
      </div>
      <aside class="se-required">
        <h3>Что обязательно замерить</h3>
        <ul class="se-required-list">${BASE_FIELDS.map((item) => `<li>${item.label}</li>`).join('')}</ul>
        <div class="se-help">Если объект — пустой проём, сначала фиксируем только его форму. Подробные размеры в этой схеме относятся к готовому основанию.</div>
      </aside>
    `;

    const openingMini = root.querySelector('.se-opening-mini');
    const blueprint = root.querySelector('.se-blueprint');
    const sideLabel = root.querySelector('.se-side-label');
    const sideButtons = root.querySelectorAll('[data-side]');

    function renderSide(nextSide) {
      state.side = nextSide;
      openingMini.innerHTML = openingSvg(state.side);
      blueprint.innerHTML = baseSvg(state.side);
      sideLabel.textContent = state.side === 'right' ? 'Правая' : 'Левая';
      sideButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.side === state.side)));
      setAliases('side', state.side);
      setAliases('templateKey', `l_landing_${state.side}_ready_base`);
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
