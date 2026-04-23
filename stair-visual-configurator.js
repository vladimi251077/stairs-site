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
    ? `<path class="sv-measure" d="M94 316 C56 316 42 334 42 356" fill="none"/><path class="sv-measure" d="M42 356 l-8 -12 l16 0 z" fill="#d4ab70"/>`
    : `<path class="sv-measure" d="M42 316 C80 316 94 334 94 356" fill="none"/><path class="sv-measure" d="M94 356 l-8 -12 l16 0 z" fill="#d4ab70"/>`;
}

function buildPlanScene(type) {
  const turnLeft = (originalField('turnDirection')?.value || 'left') === 'left';
  switch (type) {
    case 'straight':
      return {
        svg: `<rect class="sv-shape" x="130" y="168" width="360" height="78" rx="10"></rect>${dimGroup('marchWidth',130,207,66,207,LABELS.marchWidth,68,190)}${dimGroup('openingLength',194,280,428,280,LABELS.openingLength,312,304)}${dimGroup('openingWidth',510,168,510,246,LABELS.openingWidth,510,154)}<text class="sv-muted" x="312" y="154" text-anchor="middle">Прямая лестница</text>`,
        overlays: [
          { key: 'marchWidth', x: '16%', y: '48%', width: '150px' },
          { key: 'openingLength', x: '50%', y: '80%', width: '154px' },
          { key: 'openingWidth', x: '85%', y: '49%', width: '154px' }
        ]
      };
    case 'l_turn_landing':
      return {
        svg: `<rect class="sv-shape" x="96" y="224" width="188" height="60" rx="10"></rect><rect class="sv-landing" x="284" y="150" width="122" height="134" rx="10"></rect><rect class="sv-shape" x="284" y="64" width="60" height="86" rx="10"></rect>${dimGroup('marchWidth',96,254,44,254,LABELS.marchWidth,44,236)}${dimGroup('landingLength',284,136,406,136,LABELS.landingLength,346,122)}${dimGroup('landingWidth',424,150,424,284,LABELS.landingWidth,488,206)}${dimGroup('openingLength',160,306,388,306,LABELS.openingLength,274,332)}${dimGroup('openingWidth',78,224,78,64,LABELS.openingWidth,78,48)}<text class="sv-muted" x="100" y="344">${turnLeft ? 'Левый поворот' : 'Правый поворот'}</text>${turnArrow(turnLeft)}`,
        overlays: [
          { key: 'marchWidth', x: '16%', y: '60%', width: '148px' },
          { key: 'landingLength', x: '54%', y: '15%', width: '156px' },
          { key: 'landingWidth', x: '85%', y: '46%', width: '150px' },
          { key: 'openingLength', x: '50%', y: '82%', width: '154px' },
          { key: 'openingWidth', x: '15%', y: '14%', width: '148px' },
          { key: 'turnDirection', x: '14%', y: '88%', width: '142px' }
        ]
      };
    case 'l_turn_winders':
      return {
        svg: `<rect class="sv-shape" x="96" y="224" width="188" height="60" rx="10"></rect><polygon class="sv-winder" points="284,224 374,224 350,166 284,166"></polygon><polygon class="sv-winder" points="284,224 350,166 316,108 252,166"></polygon><rect class="sv-shape" x="284" y="64" width="60" height="86" rx="10"></rect>${dimGroup('marchWidth',96,254,44,254,LABELS.marchWidth,44,236)}${dimGroup('winderCount',320,166,412,118,LABELS.winderCount,484,96)}${dimGroup('openingLength',160,306,388,306,LABELS.openingLength,274,332)}${dimGroup('openingWidth',78,224,78,64,LABELS.openingWidth,78,48)}<text class="sv-muted" x="100" y="344">${turnLeft ? 'Левый поворот' : 'Правый поворот'}</text>${turnArrow(turnLeft)}`,
        overlays: [
          { key: 'marchWidth', x: '16%', y: '60%', width: '148px' },
          { key: 'winderCount', x: '84%', y: '20%', width: '150px' },
          { key: 'openingLength', x: '50%', y: '82%', width: '154px' },
          { key: 'openingWidth', x: '15%', y: '14%', width: '148px' },
          { key: 'turnDirection', x: '14%', y: '88%', width: '142px' }
        ]
      };
    case 'u_turn_landing':
      return {
        svg: `<rect class="sv-shape" x="122" y="70" width="70" height="232" rx="10"></rect><rect class="sv-landing" x="192" y="236" width="238" height="66" rx="10"></rect><rect class="sv-shape" x="430" y="70" width="70" height="232" rx="10"></rect>${dimGroup('marchWidth',122,186,56,186,LABELS.marchWidth,56,170)}${dimGroup('landingLength',192,220,430,220,LABELS.landingLength,312,204)}${dimGroup('landingWidth',516,70,516,302,LABELS.landingWidth,516,56)}${dimGroup('openingLength',220,328,404,328,LABELS.openingLength,312,350)}${dimGroup('openingWidth',192,52,430,52,LABELS.openingWidth,312,36)}<text class="sv-muted" x="106" y="344">${turnLeft ? 'Левый разворот' : 'Правый разворот'}</text>${turnArrow(turnLeft)}`,
        overlays: [
          { key: 'marchWidth', x: '14%', y: '43%', width: '148px' },
          { key: 'landingLength', x: '50%', y: '19%', width: '156px' },
          { key: 'landingWidth', x: '86%', y: '43%', width: '150px' },
          { key: 'openingLength', x: '50%', y: '87%', width: '154px' },
          { key: 'openingWidth', x: '50%', y: '8%', width: '154px' },
          { key: 'turnDirection', x: '14%', y: '88%', width: '142px' }
        ]
      };
    default:
      return {
        svg: `<rect class="sv-shape" x="122" y="70" width="70" height="232" rx="10"></rect><polygon class="sv-winder" points="192,236 282,236 246,188 192,188"></polygon><polygon class="sv-winder" points="430,188 376,188 342,236 430,236"></polygon><rect class="sv-shape" x="430" y="70" width="70" height="232" rx="10"></rect>${dimGroup('marchWidth',122,186,56,186,LABELS.marchWidth,56,170)}${dimGroup('winderCount',312,188,312,110,LABELS.winderCount,312,92)}${dimGroup('openingLength',220,328,404,328,LABELS.openingLength,312,350)}${dimGroup('openingWidth',192,52,430,52,LABELS.openingWidth,312,36)}<text class="sv-muted" x="106" y="344">${turnLeft ? 'Левый разворот' : 'Правый разворот'}</text>${turnArrow(turnLeft)}`,
        overlays: [
          { key: 'marchWidth', x: '14%', y: '43%', width: '148px' },
          { key: 'winderCount', x: '50%', y: '14%', width: '150px' },
          { key: 'openingLength', x: '50%', y: '87%', width: '154px' },
          { key: 'openingWidth', x: '50%', y: '8%', width: '154px' },
          { key: 'turnDirection', x: '14%', y: '88%', width: '142px' }
        ]
      };
  }
}

function buildSideScene() {
  const stepsCount = approxStepCount();
  const baseX = 118;
  const baseY = 318;
  const totalW = 332;
  const totalH = 188;
  const stepW = totalW / stepsCount;
  const stepH = totalH / stepsCount;
  const stairs = Array.from({ length: stepsCount }).map((_, index) => {
    const x = baseX + index * stepW;
    const y = baseY - (index + 1) * stepH;
    return `<path class="sv-shape" d="M${x} ${baseY} L${x} ${y} L${x + stepW} ${y}"></path>`;
  }).join('');
  const shared = `<line class="sv-line" x1="86" y1="318" x2="500" y2="318"></line><line class="sv-line" x1="86" y1="96" x2="500" y2="96"></line>${stairs}`;
  if (getMode() === 'ready_frame') {
    return {
      svg: `${shared}${dimGroup('riserHeight',360,220,360,176,LABELS.riserHeight,466,172)}${dimGroup('treadDepth',330,244,386,244,LABELS.treadDepth,470,244)}${dimGroup('stepCount',432,126,470,126,LABELS.stepCount,470,110)}<text class="sv-muted" x="96" y="344">Удалённый замер существующего основания</text>`,
      overlays: [
        { key: 'riserHeight', x: '84%', y: '24%', width: '150px' },
        { key: 'treadDepth', x: '84%', y: '52%', width: '150px' },
        { key: 'stepCount', x: '84%', y: '79%', width: '150px' }
      ]
    };
  }
  return {
    svg: `${shared}${dimGroup('floorHeight',92,318,92,96,LABELS.floorHeight,92,82)}${dimGroup('slabThickness',454,96,454,60,LABELS.slabThickness,454,46)}${dimGroup('topFinishThickness',402,120,448,120,LABELS.topFinishThickness,476,120)}${dimGroup('bottomFinishThickness',124,318,164,318,LABELS.bottomFinishThickness,188,344)}<text class="sv-muted" x="312" y="344">Ввод по проектному проёму и чистовым отметкам</text>`,
      overlays: [
        { key: 'floorHeight', x: '12%', y: '36%', width: '154px' },
        { key: 'slabThickness', x: '84%', y: '12%', width: '148px' },
        { key: 'topFinishThickness', x: '84%', y: '36%', width: '148px' },
        { key: 'bottomFinishThickness', x: '12%', y: '84%', width: '148px' }
      ]
    };
  }
}

function renderSvg(mountId, scene, ariaLabel) {
  const mount = $(mountId);
  if (!mount) return;
  mount.innerHTML = `<svg viewBox="0 0 620 390" role="img" aria-label="${esc(ariaLabel)}"><rect x="16" y="16" width="588" height="358" rx="24" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.12)"></rect>${scene.svg}</svg>`;
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

function setTabGroupValue(group, hiddenId, value, shouldRender = true) {
  const hidden = $(hiddenId);
  if (!hidden) return;
  hidden.value = value;
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
  group.querySelectorAll('[data-value]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-value') === value);
  });
  if (hiddenId === 'shapeType' || hiddenId === 'shapeTurnMode') syncEmptyOpeningType();
  if (shouldRender) render();
}

function bindTabGroups() {
  document.querySelectorAll('[data-tab-target]').forEach((group) => {
    const hiddenId = group.getAttribute('data-tab-target');
    if (!hiddenId) return;
    if (group.dataset.bound === '1') {
      const currentValue = $(hiddenId)?.value;
      if (currentValue) {
        group.querySelectorAll('[data-value]').forEach((btn) => {
          btn.classList.toggle('active', btn.getAttribute('data-value') === currentValue);
        });
      }
      return;
    }
    group.dataset.bound = '1';
    group.querySelectorAll('[data-value]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.getAttribute('data-value') || '';
        setTabGroupValue(group, hiddenId, value, true);
      });
    });
    const initialValue = $(hiddenId)?.value || group.querySelector('[data-value]')?.getAttribute('data-value') || '';
    setTabGroupValue(group, hiddenId, initialValue, false);
  });
}

function render() {
  syncEmptyOpeningType();
  bindTabGroups();
  const planScene = buildPlanScene(getPlanType());
  renderSvg('visualPlanMount', planScene, 'Интерактивная схема размеров, вид сверху');
  renderOverlays('visualPlanOverlays', planScene.overlays);
  const sideScene = buildSideScene();
  renderSvg('visualSideMount', sideScene, 'Интерактивная схема размеров, вид сбоку');
  renderOverlays('visualSideOverlays', sideScene.overlays);
  bindSvgClicks('visualPlanMount');
  bindSvgClicks('visualSideMount');
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
