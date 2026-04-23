const $ = (id) => document.getElementById(id);

const LABELS = {
  openingLength: 'Длина проёма',
  openingWidth: 'Ширина проёма',
  marchWidth: 'Ширина марша',
  landingLength: 'Длина площадки',
  landingWidth: 'Ширина площадки',
  floorHeight: 'Высота этаж-этаж',
  slabThickness: 'Толщина плиты',
  topFinishThickness: 'Финиш сверху',
  bottomFinishThickness: 'Финиш снизу',
  riserHeight: 'Высота подступенка',
  treadDepth: 'Глубина проступи',
  stepCount: 'Количество ступеней',
  winderCount: 'Забежные ступени',
  turnDirection: 'Направление поворота'
};

let activeTarget = '';
let activeView = 'plan';

function getMode() {
  return $('baseCondition')?.value || 'empty_opening';
}

function syncEmptyOpeningType() {
  const shape = $('shapeType')?.value || 'straight';
  const turn = $('shapeTurnMode')?.value || 'landing';
  const stairType = $('stairType');
  const turnField = $('shapeTurnField');
  if (turnField) turnField.classList.toggle('hidden', shape === 'straight');
  if (!stairType) return;
  const next = shape === 'straight'
    ? 'straight'
    : shape === 'l'
      ? (turn === 'winders' ? 'l_turn_winders' : 'l_turn_landing')
      : (turn === 'winders' ? 'u_turn_winders' : 'u_turn_landing');
  if (stairType.value !== next) {
    stairType.value = next;
    stairType.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function getPlanType() {
  syncEmptyOpeningType();
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
  return {
    openingLength: ready ? 'landingLength' : 'openingLength',
    openingWidth: ready ? 'landingWidth' : 'openingWidth',
    marchWidth: ready ? 'readyMarchWidth' : 'marchWidth',
    landingLength: 'landingLength',
    landingWidth: 'landingWidth',
    floorHeight: ready ? 'riserHeight' : 'floorHeight',
    slabThickness: 'slabThickness',
    topFinishThickness: 'topFinishThickness',
    bottomFinishThickness: 'bottomFinishThickness',
    riserHeight: 'riserHeight',
    treadDepth: 'treadDepth',
    stepCount: 'stepCount',
    winderCount: 'winderCount',
    turnDirection: ready ? 'readyTurnDirection' : 'turnDirection'
  }[name];
}

function originalField(key) {
  const id = getFieldId(key);
  return id ? $(id) : null;
}

function esc(text) {
  return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function numericOf(key, fallback = 0) {
  const field = originalField(key);
  const value = Number(field?.value || 0);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function approxStepCount() {
  if (getMode() === 'ready_frame') return numericOf('stepCount', 15);
  return Math.max(12, Math.round(numericOf('floorHeight', 3000) / 175));
}

function dimGroup(targetKey, x1, y1, x2, y2, label, tx, ty) {
  const targetId = getFieldId(targetKey);
  const active = activeTarget === targetId ? ' sv-dim-active' : '';
  return `<g class="sv-dim-hit${active}" data-target="${esc(targetId || '')}"><line class="sv-measure" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle class="sv-anchor" cx="${x1}" cy="${y1}" r="3"></circle><circle class="sv-anchor" cx="${x2}" cy="${y2}" r="3"></circle><text class="sv-text" x="${tx}" y="${ty}" text-anchor="middle">${esc(label)}</text></g>`;
}

function turnArrow(left = true) {
  return left
    ? `<path class="sv-measure" d="M92 286 C56 286 42 304 42 328" fill="none"/><path class="sv-measure" d="M42 328 l-8 -12 l16 0 z" fill="#d4ab70"/>`
    : `<path class="sv-measure" d="M42 286 C78 286 92 304 92 328" fill="none"/><path class="sv-measure" d="M92 328 l-8 -12 l16 0 z" fill="#d4ab70"/>`;
}

function buildPlanScene(type) {
  const turnLeft = (originalField('turnDirection')?.value || 'left') === 'left';
  switch (type) {
    case 'straight':
      return {
        svg: `<rect class="sv-shape" x="132" y="154" width="360" height="80" rx="12"></rect>${dimGroup('marchWidth',132,194,70,194,LABELS.marchWidth,70,182)}${dimGroup('openingLength',188,258,438,258,LABELS.openingLength,314,282)}${dimGroup('openingWidth',510,154,510,234,LABELS.openingWidth,510,144)}<text class="sv-muted" x="312" y="146" text-anchor="middle">Прямая лестница</text>`,
        overlays: [
          { key: 'marchWidth', x: '15%', y: '48%', width: '150px' },
          { key: 'openingLength', x: '50%', y: '79%', width: '154px' },
          { key: 'openingWidth', x: '85%', y: '49%', width: '154px' }
        ]
      };
    case 'l_turn_landing':
      return {
        svg: `<rect class="sv-shape" x="88" y="214" width="198" height="64" rx="12"></rect><rect class="sv-landing" x="286" y="146" width="118" height="132" rx="12"></rect><rect class="sv-shape" x="286" y="52" width="64" height="94" rx="12"></rect>${dimGroup('marchWidth',88,246,40,246,LABELS.marchWidth,44,230)}${dimGroup('landingLength',286,132,404,132,LABELS.landingLength,346,120)}${dimGroup('landingWidth',420,146,420,278,LABELS.landingWidth,470,212)}${dimGroup('openingLength',144,300,384,300,LABELS.openingLength,266,324)}${dimGroup('openingWidth',66,214,66,52,LABELS.openingWidth,66,40)}<text class="sv-muted" x="96" y="326">${turnLeft ? 'Левый поворот' : 'Правый поворот'}</text>${turnArrow(turnLeft)}`,
        overlays: [
          { key: 'marchWidth', x: '14%', y: '60%', width: '148px' },
          { key: 'landingLength', x: '54%', y: '16%', width: '156px' },
          { key: 'landingWidth', x: '86%', y: '47%', width: '150px' },
          { key: 'openingLength', x: '50%', y: '83%', width: '154px' },
          { key: 'openingWidth', x: '14%', y: '17%', width: '148px' },
          { key: 'turnDirection', x: '12%', y: '88%', width: '142px' }
        ]
      };
    case 'l_turn_winders':
      return {
        svg: `<rect class="sv-shape" x="88" y="214" width="198" height="64" rx="12"></rect><polygon class="sv-winder" points="286,214 372,214 352,164 286,164"></polygon><polygon class="sv-winder" points="286,214 352,164 318,104 256,166"></polygon><rect class="sv-shape" x="286" y="52" width="64" height="94" rx="12"></rect>${dimGroup('marchWidth',88,246,40,246,LABELS.marchWidth,44,230)}${dimGroup('winderCount',318,164,412,112,LABELS.winderCount,470,92)}${dimGroup('openingLength',144,300,384,300,LABELS.openingLength,266,324)}${dimGroup('openingWidth',66,214,66,52,LABELS.openingWidth,66,40)}<text class="sv-muted" x="96" y="326">${turnLeft ? 'Левый поворот' : 'Правый поворот'}</text>${turnArrow(turnLeft)}`,
        overlays: [
          { key: 'marchWidth', x: '14%', y: '60%', width: '148px' },
          { key: 'winderCount', x: '84%', y: '20%', width: '150px' },
          { key: 'openingLength', x: '50%', y: '83%', width: '154px' },
          { key: 'openingWidth', x: '14%', y: '17%', width: '148px' },
          { key: 'turnDirection', x: '12%', y: '88%', width: '142px' }
        ]
      };
    case 'u_turn_landing':
      return {
        svg: `<rect class="sv-shape" x="122" y="66" width="72" height="224" rx="12"></rect><rect class="sv-landing" x="194" y="224" width="236" height="66" rx="12"></rect><rect class="sv-shape" x="430" y="66" width="72" height="224" rx="12"></rect>${dimGroup('marchWidth',122,178,58,178,LABELS.marchWidth,58,164)}${dimGroup('landingLength',194,208,430,208,LABELS.landingLength,312,194)}${dimGroup('landingWidth',520,66,520,290,LABELS.landingWidth,520,54)}${dimGroup('openingLength',224,314,400,314,LABELS.openingLength,312,338)}${dimGroup('openingWidth',194,48,430,48,LABELS.openingWidth,312,34)}<text class="sv-muted" x="104" y="326">${turnLeft ? 'Левый разворот' : 'Правый разворот'}</text>${turnArrow(turnLeft)}`,
        overlays: [
          { key: 'marchWidth', x: '13%', y: '43%', width: '148px' },
          { key: 'landingLength', x: '50%', y: '20%', width: '156px' },
          { key: 'landingWidth', x: '86%', y: '43%', width: '150px' },
          { key: 'openingLength', x: '50%', y: '86%', width: '154px' },
          { key: 'openingWidth', x: '50%', y: '8%', width: '154px' },
          { key: 'turnDirection', x: '12%', y: '88%', width: '142px' }
        ]
      };
    default:
      return {
        svg: `<rect class="sv-shape" x="122" y="66" width="72" height="224" rx="12"></rect><polygon class="sv-winder" points="194,224 282,224 246,178 194,178"></polygon><polygon class="sv-winder" points="430,178 378,178 344,224 430,224"></polygon><rect class="sv-shape" x="430" y="66" width="72" height="224" rx="12"></rect>${dimGroup('marchWidth',122,178,58,178,LABELS.marchWidth,58,164)}${dimGroup('winderCount',310,176,310,98,LABELS.winderCount,310,84)}${dimGroup('openingLength',224,314,400,314,LABELS.openingLength,312,338)}${dimGroup('openingWidth',194,48,430,48,LABELS.openingWidth,312,34)}<text class="sv-muted" x="104" y="326">${turnLeft ? 'Левый разворот' : 'Правый разворот'}</text>${turnArrow(turnLeft)}`,
        overlays: [
          { key: 'marchWidth', x: '13%', y: '43%', width: '148px' },
          { key: 'winderCount', x: '50%', y: '14%', width: '150px' },
          { key: 'openingLength', x: '50%', y: '86%', width: '154px' },
          { key: 'openingWidth', x: '50%', y: '8%', width: '154px' },
          { key: 'turnDirection', x: '12%', y: '88%', width: '142px' }
        ]
      };
  }
}

function buildSideScene() {
  const mode = getMode();
  const stepsCount = approxStepCount();
  const baseX = 116;
  const baseY = 306;
  const totalW = 340;
  const totalH = 186;
  const stepW = totalW / stepsCount;
  const stepH = totalH / stepsCount;
  const stairs = Array.from({ length: stepsCount }).map((_, index) => {
    const x = baseX + index * stepW;
    const y = baseY - (index + 1) * stepH;
    return `<path class="sv-shape" d="M${x} ${baseY} L${x} ${y} L${x + stepW} ${y}"></path>`;
  }).join('');
  const shared = `<line class="sv-line" x1="82" y1="306" x2="500" y2="306"></line><line class="sv-line" x1="82" y1="92" x2="500" y2="92"></line>${stairs}`;
  if (getMode() === 'ready_frame') {
    return {
      svg: `${shared}${dimGroup('riserHeight',356,212,356,168,LABELS.riserHeight,448,172)}${dimGroup('treadDepth',326,234,382,234,LABELS.treadDepth,468,234)}${dimGroup('stepCount',430,120,470,120,LABELS.stepCount,470,104)}<text class="sv-muted" x="92" y="332">Удалённый замер существующего основания</text>`,
      overlays: [
        { key: 'riserHeight', x: '84%', y: '24%', width: '150px' },
        { key: 'treadDepth', x: '84%', y: '52%', width: '150px' },
        { key: 'stepCount', x: '84%', y: '79%', width: '150px' }
      ]
    };
  }
  return {
    svg: `${shared}${dimGroup('floorHeight',90,306,90,92,LABELS.floorHeight,90,80)}${dimGroup('slabThickness',454,92,454,58,LABELS.slabThickness,454,46)}${dimGroup('topFinishThickness',402,114,446,114,LABELS.topFinishThickness,470,114)}${dimGroup('bottomFinishThickness',122,306,162,306,LABELS.bottomFinishThickness,182,330)}<text class="sv-muted" x="312" y="332">Ввод по проектному проёму и чистовым отметкам</text>`,
      overlays: [
        { key: 'floorHeight', x: '12%', y: '36%', width: '154px' },
        { key: 'slabThickness', x: '84%', y: '12%', width: '148px' },
        { key: 'topFinishThickness', x: '84%', y: '36%', width: '148px' },
        { key: 'bottomFinishThickness', x: '12%', y: '84%', width: '148px' }
      ]
    };
  };
}

function renderSvg(mountId, scene, ariaLabel) {
  const mount = $(mountId);
  if (!mount) return;
  mount.innerHTML = `<svg viewBox="0 0 620 380" role="img" aria-label="${esc(ariaLabel)}"><rect x="16" y="16" width="588" height="348" rx="24" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.12)"></rect>${scene.svg}</svg>`;
}

function overlayControl(def) {
  const targetId = getFieldId(def.key);
  const original = targetId ? $(targetId) : null;
  if (!targetId || !original) return '';
  const isSelect = original.tagName === 'SELECT';
  const active = activeTarget === targetId ? ' active' : '';
  const style = `left:${def.x};top:${def.y};width:${def.width || '150px'}`;
  if (isSelect) {
    const options = [...original.options].map((option) => `<option value="${esc(option.value)}" ${option.value === original.value ? 'selected' : ''}>${esc(option.text)}</option>`).join('');
    return `<div class="visual-overlay${active}" data-target="${esc(targetId)}" style="${style}"><label>${esc(LABELS[def.key])}</label><select data-sync-target="${esc(targetId)}">${options}</select></div>`;
  }
  const type = original.type === 'number' ? 'number' : 'text';
  const step = original.step ? ` step="${esc(original.step)}"` : '';
  return `<div class="visual-overlay${active}" data-target="${esc(targetId)}" style="${style}"><label>${esc(LABELS[def.key])}</label><input type="${type}" data-sync-target="${esc(targetId)}" value="${esc(original.value || '')}"${step}></div>`;
}

function renderOverlays(containerId, overlays) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = overlays.map(overlayControl).join('');
  container.querySelectorAll('[data-sync-target]').forEach((input) => {
    const targetId = input.getAttribute('data-sync-target');
    const original = $(targetId);
    if (!original) return;
    const sync = () => {
      original.value = input.value;
      original.dispatchEvent(new Event('input', { bubbles: true }));
      original.dispatchEvent(new Event('change', { bubbles: true }));
    };
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    input.addEventListener('focus', () => {
      activeTarget = targetId;
      render();
    });
  });
}

function bindSvgClicks(rootId) {
  const root = $(rootId);
  if (!root || root.dataset.bound === '1') return;
  root.addEventListener('click', (event) => {
    const hit = event.target.closest('[data-target]');
    if (!hit) return;
    const targetId = hit.getAttribute('data-target');
    if (!targetId) return;
    activeTarget = targetId;
    render();
    setTimeout(() => document.querySelector(`.visual-overlay[data-target="${CSS.escape(targetId)}"] input, .visual-overlay[data-target="${CSS.escape(targetId)}"] select`)?.focus(), 0);
  });
  root.dataset.bound = '1';
}

function bindTabGroups() {
  document.querySelectorAll('[data-tab-target]').forEach((group) => {
    if (group.dataset.bound === '1') return;
    const hiddenId = group.getAttribute('data-tab-target');
    const hidden = $(hiddenId);
    const update = (value) => {
      if (!hidden) return;
      hidden.value = value;
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
      group.querySelectorAll('[data-value]').forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-value') === value));
      if (hiddenId === 'shapeType' || hiddenId === 'shapeTurnMode') syncEmptyOpeningType();
      render();
    };
    group.querySelectorAll('[data-value]').forEach((button) => button.addEventListener('click', () => update(button.getAttribute('data-value') || '')));
    update(hidden?.value || group.querySelector('[data-value]')?.getAttribute('data-value') || '');
    group.dataset.bound = '1';
  });
}

function bindViewSwitches() {
  document.querySelectorAll('[data-visual-view]').forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.addEventListener('click', () => {
      activeView = button.getAttribute('data-visual-view') || 'plan';
      updateViewState();
    });
    button.dataset.bound = '1';
  });
}

function updateViewState() {
  document.querySelectorAll('[data-visual-view]').forEach((button) => button.classList.toggle('active', button.getAttribute('data-visual-view') === activeView));
  document.querySelectorAll('[data-visual-stage]').forEach((card) => card.classList.toggle('active', card.getAttribute('data-visual-stage') === activeView));
}

function render() {
  syncEmptyOpeningType();
  const planScene = buildPlanScene(getPlanType());
  renderSvg('visualPlanMount', planScene, 'Интерактивная схема размеров, вид сверху');
  renderOverlays('visualPlanOverlays', planScene.overlays);
  const sideScene = buildSideScene();
  renderSvg('visualSideMount', sideScene, 'Интерактивная схема размеров, вид сбоку');
  renderOverlays('visualSideOverlays', sideScene.overlays);
  bindSvgClicks('visualPlanMount');
  bindSvgClicks('visualSideMount');
  bindViewSwitches();
  bindTabGroups();
  updateViewState();
}

function attachWatchers() {
  ['baseCondition','baseSubtype','stairType','shapeType','shapeTurnMode','configurationType','turnType','turnDirection','readyTurnDirection','openingLength','openingWidth','marchWidth','landingLength','landingWidth','floorHeight','slabThickness','topFinishThickness','bottomFinishThickness','readyMarchWidth','riserHeight','treadDepth','stepCount','winderCount'].forEach((id) => {
    const element = $(id);
    if (!element) return;
    element.addEventListener('input', render);
    element.addEventListener('change', render);
    element.addEventListener('focus', () => {
      activeTarget = id;
      render();
    });
  });
  document.querySelectorAll('.visual-card').forEach((card) => card.addEventListener('click', () => setTimeout(render, 0)));
}

attachWatchers();
render();
