(() => {
  const ROOT_ID = 'scheme-enhance-root';
  const STYLE_ID = 'scheme-enhance-style';

  const CONFIG = {
    openingType: [
      { value: 'opening', label: 'Пустой проём' },
      { value: 'frame', label: 'Готовый каркас' },
    ],
    shape: [
      { value: 'straight', label: 'Прямая' },
      { value: 'l', label: 'Г-образная' },
      { value: 'p', label: 'П-образная' },
    ],
    variant: [
      { value: 'landing', label: 'С площадкой' },
      { value: 'winder', label: 'Без площадки / Забежная' },
    ],
    side: [
      { value: 'left', label: 'Левая' },
      { value: 'right', label: 'Правая' },
    ],
    templates: {
      straight_opening: { title: 'Прямая • Пустой проём', key: 'straight_opening' },
      l_landing_left: { title: 'Г-образная • Площадка • Левая', key: 'l_landing_left' },
      l_landing_right: { title: 'Г-образная • Площадка • Правая', key: 'l_landing_right' },
      l_winder_left: { title: 'Г-образная • Забежная • Левая', key: 'l_winder_left' },
      l_winder_right: { title: 'Г-образная • Забежная • Правая', key: 'l_winder_right' },
      p_landing: { title: 'П-образная • Площадка', key: 'p_landing' },
      p_winder: { title: 'П-образная • Забежная', key: 'p_winder' },
      straight_frame: { title: 'Прямая • Готовый каркас', key: 'straight_frame' },
      l_frame_landing_left: { title: 'Г-образная • Каркас • Площадка • Левая', key: 'l_frame_landing_left' },
      l_frame_landing_right: { title: 'Г-образная • Каркас • Площадка • Правая', key: 'l_frame_landing_right' },
      l_frame_winder_left: { title: 'Г-образная • Каркас • Забежная • Левая', key: 'l_frame_winder_left' },
      l_frame_winder_right: { title: 'Г-образная • Каркас • Забежная • Правая', key: 'l_frame_winder_right' },
      p_frame_landing: { title: 'П-образная • Каркас • Площадка', key: 'p_frame_landing' },
      p_frame_winder: { title: 'П-образная • Каркас • Забежная', key: 'p_frame_winder' },
    }
  };

  const FIELD_ALIASES = {
    openingType: ['opening_type', 'object_type', 'zamer_opening_type'],
    shape: ['stair_shape', 'stair_type', 'shape_type', 'zamer_shape'],
    variant: ['turn_variant', 'turn_type', 'platform_or_winder', 'zamer_variant'],
    side: ['turn_side', 'rotation_side', 'l_turn_side', 'zamer_side'],
    templateKey: ['scheme_template', 'scheme_key', 'zamer_scheme_template']
  };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{display:grid;grid-template-columns:minmax(520px,1fr) 320px;gap:20px;margin:16px 0}
      .se-card{background:#fff;border:1px solid #d8dee8;border-radius:20px;padding:16px;box-shadow:0 18px 45px rgba(15,23,42,.06)}
      .se-controls{display:grid;gap:10px;margin-bottom:12px}
      .se-switch{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .se-switch-label{min-width:130px;font-weight:800;color:#0b1736}
      .se-switch-group{display:flex;gap:8px;flex-wrap:wrap}
      .se-btn{border:1px solid #b9c3d1;background:#f8fafc;padding:9px 13px;border-radius:999px;cursor:pointer;font-weight:800;color:#0b1736}
      .se-btn[aria-pressed="true"]{background:#071432;color:#fff;border-color:#071432}
      .se-scheme-wrap{position:relative;border:1px solid #d8dee8;border-radius:18px;background:#fbfcfe;padding:16px;min-height:430px}
      .se-svg{width:100%;height:380px}
      .se-note{font-size:13px;color:#30496f;margin-top:8px;border-radius:14px;background:#f1f6ff;padding:10px 12px;font-weight:700}
      .se-required h3{margin:0 0 10px;font-size:16px;color:#0b1736}
      .se-required ul{margin:0;padding-left:18px;display:grid;gap:8px;color:#334155;font-size:13px}
      .se-hidden-legacy{display:none !important}
      @media (max-width:980px){#${ROOT_ID}{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function getForm() {
    return document.querySelector('#measurement-form') || document.body;
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

  function setLegacyValue(aliasKey, value) {
    (FIELD_ALIASES[aliasKey] || []).forEach((name) => {
      const field = getOrCreateField(name);
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function resolveTemplate(state) {
    if (state.shape === 'straight') return state.openingType === 'frame' ? 'straight_frame' : 'straight_opening';
    if (state.shape === 'p') return `${state.openingType === 'frame' ? 'p_frame' : 'p'}_${state.variant}`;
    return `${state.openingType === 'frame' ? 'l_frame' : 'l'}_${state.variant}_${state.side}`;
  }

  function drawTemplate(svg, key) {
    const isWinder = key.includes('winder');
    const isL = key.startsWith('l_');
    const isP = key.startsWith('p_');
    const isRight = key.includes('_right');
    const isStraight = key.startsWith('straight');

    const transform = isRight && isL ? 'translate(600 0) scale(-1 1)' : '';
    const scheme = [];
    scheme.push('<rect x="35" y="34" width="530" height="310" rx="12" fill="none" stroke="#d8dee8" stroke-width="2"/>');
    scheme.push('<text x="50" y="28" font-size="14" font-weight="800" fill="#0b1736">' + (CONFIG.templates[key]?.title || key) + '</text>');
    scheme.push(`<g transform="${transform}">`);

    if (isL) {
      scheme.push('<path d="M120 300 L120 120 L340 120" fill="none" stroke="#071432" stroke-width="22" stroke-linecap="square"/>');
      if (isWinder) {
        scheme.push('<polygon points="109,109 170,109 109,170" fill="#dbeafe" stroke="#071432" stroke-width="2"/>');
        scheme.push('<polygon points="170,109 232,109 109,232" fill="#e8f1ff" stroke="#071432" stroke-width="2"/>');
        scheme.push('<polygon points="109,170 109,232 232,109" fill="#f2f7ff" stroke="#071432" stroke-width="2"/>');
      } else {
        scheme.push('<rect x="98" y="98" width="115" height="68" rx="4" fill="#dbeafe" stroke="#071432" stroke-width="3"/>');
        scheme.push('<text x="123" y="138" font-size="13" font-weight="800" fill="#071432">Площадка</text>');
      }
    } else if (isP) {
      scheme.push('<path d="M110 300 L110 115 L300 115 L300 300" fill="none" stroke="#071432" stroke-width="22" stroke-linecap="square"/>');
      if (isWinder) {
        scheme.push('<path d="M112 116 L300 116 L300 210 L112 210 Z" fill="#e8f1ff" stroke="#071432" stroke-width="2"/>');
        scheme.push('<line x1="112" y1="116" x2="300" y2="210" stroke="#071432" stroke-width="2"/>');
        scheme.push('<line x1="300" y1="116" x2="112" y2="210" stroke="#071432" stroke-width="2"/>');
      } else {
        scheme.push('<rect x="100" y="100" width="210" height="62" rx="4" fill="#dbeafe" stroke="#071432" stroke-width="3"/>');
        scheme.push('<text x="174" y="137" font-size="13" font-weight="800" fill="#071432">Площадка</text>');
      }
    } else if (isStraight) {
      scheme.push('<path d="M105 245 L475 245" fill="none" stroke="#071432" stroke-width="24" stroke-linecap="square"/>');
    }

    const stairLines = isStraight
      ? Array.from({ length: 9 }).map((_, i) => `<line x1="${130 + i * 35}" y1="230" x2="${130 + i * 35}" y2="260" stroke="#8aa0c5"/>`).join('')
      : Array.from({ length: 7 }).map((_, i) => `<line x1="104" y1="${275 - i * 23}" x2="136" y2="${275 - i * 23}" stroke="#8aa0c5"/>`).join('') +
        Array.from({ length: 5 }).map((_, i) => `<line x1="${230 + i * 29}" y1="104" x2="${230 + i * 29}" y2="136" stroke="#8aa0c5"/>`).join('');
    scheme.push(stairLines);
    scheme.push('</g>');

    scheme.push('<line x1="70" y1="360" x2="530" y2="360" stroke="#7386aa" stroke-width="1.5" marker-end="url(#arrow)"/>');
    scheme.push('<text x="70" y="374" font-size="12" font-weight="800" fill="#33466f">Старт</text>');
    scheme.push('<text x="500" y="374" font-size="12" font-weight="800" fill="#33466f">Выход</text>');

    svg.innerHTML = `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#7386aa"></path></marker></defs>` + scheme.join('');
  }

  function hideLegacyGrids() {
    const panel = document.querySelector('[data-panel="sizes"]');
    if (!panel) return;
    Array.from(panel.children).forEach((el) => {
      if (el.id !== ROOT_ID) el.classList.add('se-hidden-legacy');
    });
  }

  function findSizesPanel() {
    return document.querySelector('[data-panel="sizes"]') || document.querySelector('#tab-sizes') || document.querySelector('.tab-sizes');
  }

  function init() {
    const tabRoot = findSizesPanel();
    if (!tabRoot || document.getElementById(ROOT_ID)) return;

    injectStyle();

    const state = { openingType: 'opening', shape: 'l', variant: 'landing', side: 'left' };

    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="se-card">
        <div class="se-controls"></div>
        <div class="se-scheme-wrap"><svg class="se-svg" viewBox="0 0 600 390"></svg><div class="se-note"></div></div>
      </div>
      <aside class="se-card se-required">
        <h3>Что обязательно замерить</h3>
        <ul class="se-required-list"></ul>
      </aside>`;

    const controls = root.querySelector('.se-controls');
    const svg = root.querySelector('.se-svg');
    const note = root.querySelector('.se-note');
    const requiredList = root.querySelector('.se-required-list');

    function makeSwitch(key, label, options) {
      const row = document.createElement('div');
      row.className = 'se-switch';
      row.dataset.switchKey = key;
      row.innerHTML = `<div class="se-switch-label">${label}</div><div class="se-switch-group"></div>`;
      const group = row.querySelector('.se-switch-group');
      options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'se-btn';
        btn.textContent = opt.label;
        btn.dataset.value = opt.value;
        btn.addEventListener('click', () => {
          state[key] = opt.value;
          render();
        });
        group.appendChild(btn);
      });
      controls.appendChild(row);
      return row;
    }

    makeSwitch('openingType', 'Основание', CONFIG.openingType);
    makeSwitch('shape', 'Форма', CONFIG.shape);
    const variantRow = makeSwitch('variant', 'Вариант', CONFIG.variant);
    const sideRow = makeSwitch('side', 'Поворот', CONFIG.side);

    function renderRequired(key) {
      const base = key.includes('frame')
        ? ['Общая высота', 'Ширина маршей', 'Ступени по маршам', 'Подъём ступени', 'Глубина проступи']
        : ['Высота', 'Длина проёма', 'Ширина проёма', 'Толщина проёма', 'Ширина марша'];
      const extra = key.includes('landing') ? ['Размер площадки'] : key.includes('winder') ? ['Количество забежных ступеней'] : [];
      const side = key.startsWith('l') ? ['Левая/правая сторона'] : [];
      requiredList.innerHTML = [...base, ...extra, ...side, 'Комментарий по ограничениям'].map((item) => `<li>${item}</li>`).join('');
    }

    function render() {
      sideRow.style.display = state.shape === 'l' ? '' : 'none';
      variantRow.style.display = state.shape === 'straight' ? 'none' : '';

      controls.querySelectorAll('.se-switch').forEach((row) => {
        const stateKey = row.dataset.switchKey;
        row.querySelectorAll('.se-btn').forEach((btn) => {
          btn.setAttribute('aria-pressed', String(state[stateKey] === btn.dataset.value));
        });
      });

      const key = resolveTemplate(state);
      drawTemplate(svg, key);
      note.textContent = `${CONFIG.templates[key]?.title || key}. Для каждого варианта показывается отдельная схема: площадка и забежные не смешиваются.`;
      renderRequired(key);

      setLegacyValue('openingType', state.openingType);
      setLegacyValue('shape', state.shape);
      setLegacyValue('variant', state.variant);
      setLegacyValue('side', state.side);
      setLegacyValue('templateKey', key);
    }

    tabRoot.prepend(root);
    hideLegacyGrids();
    render();
  }

  const observer = new MutationObserver(init);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
