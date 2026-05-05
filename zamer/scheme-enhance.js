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
      .se-card{background:#fff;border:1px solid #d8dee8;border-radius:10px;padding:16px}
      .se-controls{display:grid;gap:10px;margin-bottom:12px}
      .se-switch{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .se-switch-label{min-width:130px;font-weight:600;color:#243447}
      .se-switch-group{display:flex;gap:8px;flex-wrap:wrap}
      .se-btn{border:1px solid #b9c3d1;background:#f8fafc;padding:8px 12px;border-radius:999px;cursor:pointer}
      .se-btn[aria-pressed="true"]{background:#1f3c88;color:#fff;border-color:#1f3c88}
      .se-scheme-wrap{position:relative;border:1px solid #d8dee8;border-radius:8px;background:#fbfcfe;padding:16px;min-height:430px}
      .se-svg{width:100%;height:380px}
      .se-note{font-size:12px;color:#5a6778;margin-top:8px}
      .se-required h3{margin:0 0 10px;font-size:16px}
      .se-required ul{margin:0;padding-left:18px;display:grid;gap:6px}
      .se-hidden-legacy{display:none !important}
      @media (max-width:980px){#${ROOT_ID}{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function getOrCreateField(name) {
    let input = document.querySelector(`[name="${name}"]`);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      document.body.appendChild(input);
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

    const scheme = [];
    scheme.push('<rect x="40" y="40" width="520" height="300" fill="none" stroke="#1e2a39" stroke-width="2"/>');
    scheme.push('<text x="50" y="28" font-size="14" fill="#1e2a39">' + key + '</text>');
    if (isL) scheme.push('<path d="M100 300 L100 100 L320 100" fill="none" stroke="#2f5aa8" stroke-width="18"/>');
    if (isP) scheme.push('<path d="M90 300 L90 100 L290 100 L290 300" fill="none" stroke="#2f5aa8" stroke-width="18"/>');
    if (key.startsWith('straight')) scheme.push('<path d="M100 300 L450 300" fill="none" stroke="#2f5aa8" stroke-width="18"/>');

    if (isWinder) {
      scheme.push('<polygon points="95,105 130,105 95,140" fill="#7aa2e3" stroke="#1e2a39"/>');
      scheme.push('<polygon points="130,105 165,105 130,140" fill="#7aa2e3" stroke="#1e2a39"/>');
      scheme.push('<polygon points="165,105 200,105 165,140" fill="#7aa2e3" stroke="#1e2a39"/>');
    } else {
      scheme.push('<rect x="95" y="95" width="110" height="45" fill="#9ec5fe" stroke="#1e2a39"/>');
    }

    svg.innerHTML = scheme.join('');
  }

  function hideLegacyGrids() {
    document.querySelectorAll('.sizes-grid, .dimensions-grid, .zamer-grid, [data-sizes-grid], [data-dim-grid]').forEach((el) => {
      el.classList.add('se-hidden-legacy');
    });
  }

  function init() {
    const tabRoot = document.querySelector('[data-tab="sizes"], #tab-sizes, .tab-sizes, .sizes-tab') || document.body;
    if (document.getElementById(ROOT_ID)) return;

    injectStyle();
    hideLegacyGrids();

    const state = { openingType: 'opening', shape: 'straight', variant: 'landing', side: 'left' };

    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="se-card">
        <div class="se-controls"></div>
        <div class="se-scheme-wrap"><svg class="se-svg" viewBox="0 0 600 380"></svg><div class="se-note"></div></div>
      </div>
      <aside class="se-card se-required">
        <h3>Что обязательно замерить</h3>
        <ul>
          <li>Высота от чистового пола до чистового пола.</li>
          <li>Габариты проёма (длина и ширина).</li>
          <li>Толщина перекрытия и отметки уровней.</li>
          <li>Ширина марша и желаемый просвет.</li>
          <li>Привязка к стенам, дверям и инженерным узлам.</li>
        </ul>
      </aside>`;

    const controls = root.querySelector('.se-controls');
    const svg = root.querySelector('.se-svg');
    const note = root.querySelector('.se-note');

    function makeSwitch(key, label, options) {
      const row = document.createElement('div');
      row.className = 'se-switch';
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

    const shapeRow = makeSwitch('shape', 'Форма', CONFIG.shape);
    const variantRow = makeSwitch('variant', 'Вариант', CONFIG.variant);
    const sideRow = makeSwitch('side', 'Поворот', CONFIG.side);
    makeSwitch('openingType', 'Основание', CONFIG.openingType);

    function render() {
      sideRow.style.display = state.shape === 'l' ? '' : 'none';
      variantRow.style.display = state.shape === 'straight' ? 'none' : '';

      controls.querySelectorAll('.se-switch').forEach((row) => {
        const key = row.querySelector('.se-switch-group .se-btn')?.parentElement?.parentElement === row ? null : null;
        row.querySelectorAll('.se-btn').forEach((btn) => {
          const parentLabel = row.querySelector('.se-switch-label').textContent;
          const stateKey = parentLabel === 'Основание' ? 'openingType' : parentLabel === 'Форма' ? 'shape' : parentLabel === 'Вариант' ? 'variant' : 'side';
          btn.setAttribute('aria-pressed', String(state[stateKey] === btn.dataset.value));
        });
      });

      const key = resolveTemplate(state);
      drawTemplate(svg, key);
      note.textContent = (CONFIG.templates[key] || {}).title || key;

      setLegacyValue('openingType', state.openingType);
      setLegacyValue('shape', state.shape);
      setLegacyValue('variant', state.variant);
      setLegacyValue('side', state.side);
      setLegacyValue('templateKey', key);
    }

    tabRoot.prepend(root);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
