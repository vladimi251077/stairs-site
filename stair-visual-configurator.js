const $ = (id) => document.getElementById(id);

const PLAN_LABELS = {
  openingLength: 'Длина проёма',
  openingWidth: 'Ширина проёма',
  marchWidth: 'Ширина марша',
  landingLength: 'Длина площадки',
  landingWidth: 'Ширина площадки',
  floorHeight: 'Высота этаж-этаж',
  slabThickness: 'Толщина плиты',
  riserHeight: 'Высота подступенка',
  treadDepth: 'Глубина проступи',
  stepCount: 'Количество ступеней',
  winderCount: 'Забежные ступени',
  turnDirection: 'Направление поворота'
};

let activeTarget = '';

function getMode() {
  return $('baseCondition')?.value || 'empty_opening';
}

function getPlanType() {
  if (getMode() === 'ready_frame') {
    const cfg = $('configurationType')?.value || 'straight';
    const turn = $('turnType')?.value || 'landing';
    if (cfg === 'straight') return 'straight';
    if (cfg === 'l_shaped') return turn === 'winders' ? 'l_turn_winders' : 'l_turn_landing';
    return turn === 'winders' ? 'u_turn_winders' : 'u_turn_landing';
  }
  return $('stairType')?.value || 'straight';
}

function getFieldId(name) {
  const ready = getMode() === 'ready_frame';
  const map = {
    openingLength: ready ? 'landingLength' : 'openingLength',
    openingWidth: ready ? 'landingWidth' : 'openingWidth',
    marchWidth: ready ? 'readyMarchWidth' : 'marchWidth',
    landingLength: 'landingLength',
    landingWidth: 'landingWidth',
    floorHeight: 'floorHeight',
    slabThickness: 'slabThickness',
    riserHeight: 'riserHeight',
    treadDepth: 'treadDepth',
    stepCount: 'stepCount',
    winderCount: 'winderCount',
    turnDirection: ready ? 'readyTurnDirection' : 'turnDirection'
  };
  return map[name];
}

function valueOf(name) {
  const id = getFieldId(name);
  const el = id ? $(id) : null;
  if (!el) return getMode() === 'ready_frame' && name === 'floorHeight' ? 'по факту' : '—';
  if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || el.value;
  return el.value || '—';
}

function numericOf(name, fallback = 0) {
  const id = getFieldId(name);
  const raw = Number($(id)?.value || 0);
  return raw > 0 ? raw : fallback;
}

function approxStepCount() {
  if (getMode() === 'ready_frame') return numericOf('stepCount', 15);
  return Math.max(12, Math.round(numericOf('floorHeight', 3000) / 175));
}

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badge(labelKey, value, x, y, tx, ty) {
  const target = getFieldId(labelKey);
  const active = activeTarget === target ? ' active' : '';
  const width = 128;
  return `<line class="sv-line" x1="${x}" y1="${y}" x2="${tx}" y2="${ty}"/><circle class="sv-anchor" cx="${x}" cy="${y}" r="3"/><g class="sv-hit" data-target="${target || ''}"><rect class="sv-badge${active}" x="${tx - width / 2}" y="${ty - 18}" rx="11" ry="11" width="${width}" height="36"></rect><text class="sv-label" x="${tx}" y="${ty - 4}" text-anchor="middle">${esc(PLAN_LABELS[labelKey])}</text><text class="sv-value" x="${tx}" y="${ty + 10}" text-anchor="middle">${esc(value)}</text></g>`;
}

function planShapes(type) {
  switch (type) {
    case 'straight':
      return {
        shapes: `<rect class="sv-shape" x="120" y="90" width="300" height="70" rx="8"></rect>`,
        labels: [
          ['marchWidth', `${valueOf('marchWidth')} мм`, 120, 125, 70, 125],
          ['openingLength', `${valueOf('openingLength')} мм`, 270, 170, 270, 214],
          ['openingWidth', `${valueOf('openingWidth')} мм`, 424, 125, 468, 125]
        ]
      };
    case 'l_turn_landing':
      return {
        shapes: `<rect class="sv-shape" x="80" y="150" width="170" height="58" rx="8"></rect><rect class="sv-landing" x="250" y="94" width="84" height="114" rx="8"></rect><rect class="sv-shape" x="250" y="40" width="58" height="54" rx="8"></rect>`,
        labels: [
          ['marchWidth', `${valueOf('marchWidth')} мм`, 82, 178, 60, 178],
          ['landingLength', `${valueOf('landingLength')} мм`, 292, 92, 292, 38],
          ['landingWidth', `${valueOf('landingWidth')} мм`, 336, 144, 462, 144],
          ['openingLength', `${valueOf('openingLength')} мм`, 210, 210, 210, 238],
          ['openingWidth', `${valueOf('openingWidth')} мм`, 42, 124, 42, 52],
          ['turnDirection', `${valueOf('turnDirection')}`, 250, 92, 400, 42]
        ]
      };
    case 'l_turn_winders':
      return {
        shapes: `<rect class="sv-shape" x="80" y="150" width="170" height="58" rx="8"></rect><polygon class="sv-winder" points="250,150 322,150 322,92 278,92"></polygon><polygon class="sv-winder" points="250,150 278,92 250,40 220,94"></polygon><rect class="sv-shape" x="250" y="40" width="58" height="54" rx="8"></rect>`,
        labels: [
          ['marchWidth', `${valueOf('marchWidth')} мм`, 82, 178, 60, 178],
          ['winderCount', `${valueOf('winderCount')} шт`, 278, 110, 430, 46],
          ['openingLength', `${valueOf('openingLength')} мм`, 206, 210, 206, 238],
          ['openingWidth', `${valueOf('openingWidth')} мм`, 42, 124, 42, 52],
          ['turnDirection', `${valueOf('turnDirection')}`, 250, 92, 402, 82]
        ]
      };
    case 'u_turn_landing':
      return {
        shapes: `<rect class="sv-shape" x="76" y="40" width="60" height="168" rx="8"></rect><rect class="sv-landing" x="136" y="150" width="240" height="58" rx="8"></rect><rect class="sv-shape" x="376" y="40" width="60" height="168" rx="8"></rect>`,
        labels: [
          ['marchWidth', `${valueOf('marchWidth')} мм`, 74, 124, 40, 124],
          ['landingLength', `${valueOf('landingLength')} мм`, 256, 148, 256, 224],
          ['landingWidth', `${valueOf('landingWidth')} мм`, 440, 124, 494, 124],
          ['openingLength', `${valueOf('openingLength')} мм`, 256, 210, 256, 242],
          ['openingWidth', `${valueOf('openingWidth')} мм`, 256, 40, 256, 16],
          ['turnDirection', `${valueOf('turnDirection')}`, 376, 150, 468, 200]
        ]
      };
    default:
      return {
        shapes: `<rect class="sv-shape" x="76" y="40" width="60" height="168" rx="8"></rect><polygon class="sv-winder" points="136,150 220,150 190,112 136,112"></polygon><polygon class="sv-winder" points="322,112 376,112 376,150 290,150"></polygon><rect class="sv-shape" x="376" y="40" width="60" height="168" rx="8"></rect>`,
        labels: [
          ['marchWidth', `${valueOf('marchWidth')} мм`, 74, 124, 40, 124],
          ['winderCount', `${valueOf('winderCount')} шт`, 256, 96, 256, 18],
          ['openingLength', `${valueOf('openingLength')} мм`, 256, 210, 256, 242],
          ['openingWidth', `${valueOf('openingWidth')} мм`, 256, 40, 256, 16],
          ['turnDirection', `${valueOf('turnDirection')}`, 376, 150, 468, 200]
        ]
      };
  }
}

function renderPlan() {
  const mount = $('visualPlanMount');
  if (!mount) return;
  const type = getPlanType();
  const { shapes, labels } = planShapes(type);
  mount.innerHTML = `<svg viewBox="0 0 520 260" role="img" aria-label="Схема размеров, вид сверху"><rect x="12" y="12" width="496" height="236" rx="18" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.12)"></rect>${shapes}${labels.map((item) => badge(...item)).join('')}</svg>`;
}

function renderSide() {
  const mount = $('visualSideMount');
  if (!mount) return;
  const mode = getMode();
  const count = approxStepCount();
  const width = 320;
  const baseX = 90;
  const baseY = 206;
  const stepW = width / count;
  const stairHeight = 132;
  const stepH = stairHeight / count;
  const steps = Array.from({ length: count }).map((_, i) => {
    const x = baseX + i * stepW;
    const y = baseY - (i + 1) * stepH;
    return `<path class="sv-shape" d="M${x} ${baseY} L${x} ${y} L${x + stepW} ${y}"></path>`;
  }).join('');
  const labels = mode === 'ready_frame'
    ? [
        badge('riserHeight', `${valueOf('riserHeight')} мм`, baseX + 64, baseY - 72, 46, 44),
        badge('treadDepth', `${valueOf('treadDepth')} мм`, baseX + 180, baseY - 108, 250, 34),
        badge('stepCount', `${valueOf('stepCount')} шт`, baseX + width, baseY - stairHeight, 432, 68)
      ].join('')
    : [
        badge('floorHeight', `${valueOf('floorHeight')} мм`, baseX - 20, 72, 54, 72),
        badge('slabThickness', `${valueOf('slabThickness')} мм`, baseX + width + 16, 48, 446, 36),
        badge('openingLength', `${valueOf('openingLength')} мм`, baseX + width / 2, baseY + 2, 258, 236)
      ].join('');
  mount.innerHTML = `<svg viewBox="0 0 520 260" role="img" aria-label="Схема размеров, вид сбоку"><rect x="12" y="12" width="496" height="236" rx="18" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.12)"></rect><line class="sv-line" x1="70" y1="206" x2="456" y2="206"></line><line class="sv-line" x1="70" y1="42" x2="456" y2="42"></line>${steps}${labels}</svg>`;
}

function bindClicks(rootId) {
  const root = $(rootId);
  if (!root || root.dataset.bound === '1') return;
  root.addEventListener('click', (event) => {
    const hit = event.target.closest('[data-target]');
    if (!hit) return;
    const targetId = hit.getAttribute('data-target');
    if (!targetId) return;
    const target = $(targetId);
    if (!target) return;
    activeTarget = targetId;
    target.focus();
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    render();
  });
  root.dataset.bound = '1';
}

function render() {
  renderPlan();
  renderSide();
  bindClicks('visualPlanMount');
  bindClicks('visualSideMount');
}

function attach() {
  const watched = [
    'baseCondition','stairType','configurationType','turnType','turnDirection','readyTurnDirection','openingLength','openingWidth','marchWidth','landingLength','landingWidth','floorHeight','slabThickness','topFinishThickness','bottomFinishThickness','readyMarchWidth','riserHeight','treadDepth','stepCount','winderCount'
  ];
  watched.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
    el.addEventListener('focus', () => { activeTarget = id; render(); });
  });
  document.querySelectorAll('.visual-card').forEach((card) => card.addEventListener('click', () => setTimeout(render, 0)));
  render();
}

attach();
