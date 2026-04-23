import { calculateStairGeometryEngine } from './stair-geometry-engine.js';

const $ = (id) => document.getElementById(id);

const LABELS = {
  base_condition: { empty_opening: 'Пустой проём', ready_frame: 'Готовый каркас' },
  base_subtype: { existing_metal_frame: 'Готовый металлокаркас', existing_concrete_base: 'Готовое бетонное основание' },
  stair_type: { straight: 'Прямая', l_turn_landing: 'Г-образная с площадкой', l_turn_winders: 'Г-образная с забежными', u_turn_landing: 'П-образная с площадкой', u_turn_winders: 'П-образная с забежными' },
  configuration_type: { straight: 'Прямая', l_shaped: 'Г-образная', u_shaped: 'П-образная' },
  turn_type: { landing: 'С площадкой', winders: 'С забежными' }
};

let premiumBusy = false;

function ensureStyles() {
  if (document.getElementById('tgPremiumStepStyles')) return;
  const style = document.createElement('style');
  style.id = 'tgPremiumStepStyles';
  style.textContent = `
    .tg-premium-step{display:grid;gap:16px}
    .tg-premium-hero{padding:18px;border:1px solid rgba(232,200,162,.16);border-radius:22px;background:linear-gradient(180deg,rgba(17,13,10,.98),rgba(9,7,5,.98));box-shadow:0 18px 30px rgba(0,0,0,.18)}
    .tg-premium-header h3{margin:0;font-size:18px;color:#f7ead9}
    .tg-premium-sub{margin-top:4px;color:#d5c2aa;font-size:13px}
    .tg-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .tg-chip{padding:9px 13px;border-radius:999px;border:1px solid rgba(232,200,162,.18);background:rgba(255,255,255,.03);color:#f0dcc0;font-size:13px;font-weight:600}
    .tg-chip.is-active{background:linear-gradient(180deg,#e7c08b,#d2a66d);color:#1f140e;border-color:transparent}
    .tg-variants{padding:16px;border-radius:20px;border:1px solid rgba(232,200,162,.12);background:rgba(255,255,255,.02)}
    .tg-variants-title{margin:0 0 10px;color:#f7ead9;font-size:16px}
    .tg-table{width:100%;border-collapse:collapse;overflow:hidden;border-radius:14px;border:1px solid rgba(232,200,162,.14)}
    .tg-table th,.tg-table td{padding:12px 10px;text-align:center;border-bottom:1px solid rgba(232,200,162,.1);border-right:1px solid rgba(232,200,162,.08)}
    .tg-table th:last-child,.tg-table td:last-child{border-right:none}
    .tg-table th{font-size:12px;color:#d9c2a1;font-weight:600;background:rgba(255,255,255,.02)}
    .tg-table td{color:#f7ead9;font-size:15px}
    .tg-table tr.is-current td{background:rgba(205,146,60,.24)}
    .tg-table tr:last-child td{border-bottom:none}
    .tg-star{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:#d7a85e;color:#1b130d;font-size:15px;font-weight:700}
    .tg-recommended{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;margin-top:14px;padding:16px;border-radius:18px;border:1px solid rgba(232,200,162,.16);background:linear-gradient(90deg,rgba(205,146,60,.14),rgba(255,255,255,.02))}
    .tg-rec-left{display:flex;gap:12px;align-items:flex-start}.tg-rec-left .tg-star{width:40px;height:40px;font-size:18px}
    .tg-rec-title{color:#f7ead9;font-size:15px;font-weight:700;margin:0}.tg-rec-copy{margin:4px 0 0;color:#d6c5b2;font-size:13px;line-height:1.45}
    .tg-rec-meta{padding-left:14px;border-left:1px solid rgba(232,200,162,.14);color:#f0dcc0;text-align:right;font-size:13px}.tg-rec-meta b{display:block;font-size:22px;color:#f6d6aa;margin:3px 0}
    .tg-engine-grid{display:grid;gap:16px}
    .tg-engine-card{padding:16px;border:1px solid rgba(232,200,162,.16);border-radius:20px;background:linear-gradient(180deg,rgba(17,13,10,.95),rgba(11,8,6,.96))}
    .tg-engine-card h4{margin:0 0 14px;color:#f7ead9;font-size:17px}
    .tg-plan-wrap,.tg-elev-wrap{display:grid;grid-template-columns:136px 1fr;gap:14px;align-items:start}
    .tg-dim-list{display:grid;gap:10px}.tg-dim{padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(232,200,162,.1)}
    .tg-dim b{display:block;color:#f4d6a5;font-size:18px}.tg-dim span{display:block;color:#cdb89b;font-size:12px;margin-top:4px}
    .tg-svg-shell{padding:12px;border-radius:16px;border:1px solid rgba(232,200,162,.1);background:rgba(255,255,255,.02)}
    .tg-svg-shell svg{width:100%;height:auto;display:block}.tg-svg-shell .outline{fill:none;stroke:#d7ae73;stroke-width:2}.tg-svg-shell .landing{fill:rgba(111,76,36,.22);stroke:#d7ae73;stroke-width:2}.tg-svg-shell .winder{fill:rgba(193,152,90,.18);stroke:#d7ae73;stroke-width:2}.tg-svg-shell .dimline{stroke:#d7ae73;stroke-width:1.5}.tg-svg-shell .muted{fill:#d8c1a2;font-size:11px}.tg-svg-shell .stepnum{fill:#f7ead9;font-size:11px}
    .tg-summary{padding:16px;border:1px solid rgba(232,200,162,.16);border-radius:20px;background:rgba(255,255,255,.02)}
    .tg-summary-row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:10px 0;border-bottom:1px solid rgba(232,200,162,.08)}
    .tg-summary-row:last-child{border-bottom:none}.tg-summary-label{color:#f0dcc0}.tg-summary-value{color:#cfdc9d}.tg-summary-value.warning{color:#f0d28a}.tg-summary-value.invalid{color:#ef9a9a}
    .tg-step2-note{margin-top:12px;color:#d7c6b1;font-size:13px;line-height:1.45}
    @media (max-width:760px){.tg-recommended{grid-template-columns:1fr}.tg-rec-meta{text-align:left;padding-left:0;border-left:none;border-top:1px solid rgba(232,200,162,.14);padding-top:12px}.tg-plan-wrap,.tg-elev-wrap{grid-template-columns:1fr}.tg-dim-list{grid-template-columns:repeat(2,minmax(0,1fr))}.tg-table th,.tg-table td{padding:10px 7px;font-size:12px}.tg-table td{font-size:14px}}
  `;
  document.head.appendChild(style);
}

function getConfigFromDom() {
  const baseCondition = $('baseCondition')?.value || 'empty_opening';
  const readyFlow = baseCondition === 'ready_frame';
  const scope_of_work = [...document.querySelectorAll('input[name="scopeWork"]:checked')].map((x) => x.value);
  const stairTypeFromReady = (() => {
    const cfg = $('configurationType')?.value || 'straight';
    const turn = $('turnType')?.value || 'landing';
    if (cfg === 'straight') return 'straight';
    if (cfg === 'l_shaped') return turn === 'winders' ? 'l_turn_winders' : 'l_turn_landing';
    if (cfg === 'u_shaped') return turn === 'winders' ? 'u_turn_winders' : 'u_turn_landing';
    return 'straight';
  })();
  return {
    base_condition: baseCondition,
    base_subtype: $('baseSubtype')?.value || 'existing_metal_frame',
    stair_type: readyFlow ? stairTypeFromReady : ($('stairType')?.value || 'straight'),
    configuration_type: $('configurationType')?.value || 'straight',
    turn_type: $('turnType')?.value || 'landing',
    turn_direction: baseCondition === 'empty_opening' ? ($('turnDirection')?.value || 'left') : ($('readyTurnDirection')?.value || 'left'),
    floor_to_floor_height: Number($('floorHeight')?.value || 0),
    slab_thickness: Number($('slabThickness')?.value || 220),
    top_finish_thickness: Number($('topFinishThickness')?.value || 20),
    bottom_finish_thickness: Number($('bottomFinishThickness')?.value || 20),
    opening_length: Number($('openingLength')?.value || 0),
    opening_width: Number($('openingWidth')?.value || 0),
    march_width: Number($('marchWidth')?.value || 0),
    step_count: Number($('stepCount')?.value || 0),
    riser_height: Number($('riserHeight')?.value || 0),
    tread_depth: Number($('treadDepth')?.value || 0),
    ready_march_width: Number($('readyMarchWidth')?.value || 0),
    landing_length: Number($('landingLength')?.value || 0),
    landing_width: Number($('landingWidth')?.value || 0),
    winder_count: Number($('winderCount')?.value || 0),
    scope_of_work: readyFlow ? scope_of_work : []
  };
}

function validateBase(config) {
  if (config.base_condition === 'ready_frame') {
    if (config.step_count <= 0) return false;
    if (config.ready_march_width <= 0) return false;
    if (config.riser_height <= 0) return false;
    if (config.tread_depth <= 0) return false;
    if (config.configuration_type !== 'straight' && config.turn_type === 'landing' && (config.landing_length <= 0 || config.landing_width <= 0)) return false;
    if (config.configuration_type !== 'straight' && config.turn_type === 'winders' && config.winder_count <= 0) return false;
    if (!config.scope_of_work.length) return false;
    return true;
  }
  return config.floor_to_floor_height > 0 && config.opening_length > 0 && config.opening_width > 0 && config.march_width > 0;
}

function calculateGeometry(config) {
  if (!validateBase(config)) return null;
  if (config.base_condition === 'ready_frame') {
    return calculateStairGeometryEngine({
      mode: 'ready_frame',
      stairType: config.stair_type,
      turnType: config.turn_type,
      turnDirection: config.turn_direction,
      stepCount: config.step_count,
      riserHeight: config.riser_height,
      treadDepth: config.tread_depth,
      marchWidth: config.ready_march_width,
      landingLength: config.landing_length,
      landingWidth: config.landing_width,
      winderCount: config.winder_count,
      slabThickness: config.slab_thickness,
      topFinish: config.top_finish_thickness,
      bottomFinish: config.bottom_finish_thickness
    });
  }
  return calculateStairGeometryEngine({
    stairType: config.stair_type,
    floorHeight: config.floor_to_floor_height,
    slabThickness: config.slab_thickness,
    topFinish: config.top_finish_thickness,
    bottomFinish: config.bottom_finish_thickness,
    openingLength: config.opening_length,
    openingWidth: config.opening_width,
    marchWidth: config.march_width,
    turnDirection: config.turn_direction
  });
}

function asText(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function statusText(status) {
  return status === 'recommended' ? 'Хороший' : status === 'warning' ? 'Требует проверки' : 'Нужна проверка';
}

function getChips(config) {
  const chips = [];
  if (config.base_condition === 'ready_frame') {
    chips.push(LABELS.configuration_type[config.configuration_type] || config.configuration_type);
    if (config.configuration_type !== 'straight') chips.push(LABELS.turn_type[config.turn_type] || config.turn_type);
    chips.push(LABELS.base_condition.ready_frame);
  } else {
    chips.push(LABELS.stair_type[config.stair_type] || config.stair_type);
    chips.push(LABELS.base_condition.empty_opening);
  }
  return chips;
}

function buildVariantRows(geometry, config) {
  const floorHeight = Number(geometry?.visualization?.dimensions?.floorHeight || config.floor_to_floor_height || config.step_count * config.riser_height || 0);
  const current = {
    isCurrent: true,
    riserCount: geometry?.geometrySummary?.riser_count || config.step_count || 0,
    riserHeight: geometry?.geometrySummary?.riser_height || Math.round(floorHeight / Math.max(1, geometry?.geometrySummary?.riser_count || config.step_count || 1)),
    treadDepth: geometry?.geometrySummary?.tread_depth || config.tread_depth || 0,
    angleDeg: geometry?.geometrySummary?.stair_angle_deg || 0,
    score: geometry?.geometrySummary?.score || 0
  };
  current.comfort = geometry?.geometrySummary?.comfort_value || (current.riserHeight * 2 + current.treadDepth);
  const alts = (geometry?.alternatives || []).slice(0, 2).map((item) => {
    const riserCount = item.riserCount || item.riser_count || 0;
    const riserHeight = item.riserHeight || item.riser_height || Math.round(floorHeight / Math.max(1, riserCount));
    const treadDepth = item.treadDepth || item.tread_depth || 0;
    return {
      isCurrent: false,
      riserCount,
      riserHeight,
      treadDepth,
      comfort: item.comfortValue || item.comfort_value || riserHeight * 2 + treadDepth,
      angleDeg: item.angleDeg || item.angle_deg || 0,
      score: item.score || 0
    };
  });
  return [current, ...alts].sort((a, b) => a.riserCount - b.riserCount);
}

function renderPlanSvg(geometry, config) {
  const visualization = geometry?.visualization;
  if (!visualization) return '<div class="muted">Нет данных для плана.</div>';
  const polygons = visualization.planPolygons || [];
  const allPoints = [...polygons.flatMap((poly) => poly.points || []), ...(visualization.walkline || [])];
  const maxX = Math.max(visualization.opening?.length || 0, ...allPoints.map((p) => p.x || 0), 1);
  const maxY = Math.max(visualization.opening?.width || 0, ...allPoints.map((p) => p.y || 0), 1);
  const minY = Math.min(0, ...allPoints.map((p) => p.y || 0));
  const rangeY = Math.max(1, maxY - minY);
  const px = (x) => 46 + (x / maxX) * 440;
  const py = (y) => 34 + ((y - minY) / rangeY) * 220;
  const polys = polygons.map((poly) => {
    const pts = (poly.points || []).map((p) => `${px(p.x)},${py(p.y)}`).join(' ');
    const cls = poly.type === 'landing' ? 'landing' : poly.type === 'winders' ? 'winder' : 'outline';
    const fillTag = poly.type === 'landing' ? 'landing' : poly.type === 'winders' ? 'winder' : 'outline';
    return `<polygon points="${pts}" class="${fillTag}"/>`;
  }).join('');
  const walk = (visualization.walkline || []).map((p) => `${px(p.x)},${py(p.y)}`).join(' ');
  const samples = (visualization.walkingSamples || []).slice(0, 14).map((p, idx) => `<circle cx="${px(p.x)}" cy="${py(p.y)}" r="2.5" fill="${p.clearance < 1900 ? '#ef9a9a' : '#f6d6aa'}"></circle>`).join('');
  const dims = visualization.dimensions || {};
  const labels = [
    { x: 46, y: 18, t: `A = ${dims.openingLength || config.opening_length || config.landing_length || 0} мм` },
    { x: 508, y: 146, t: `B = ${dims.openingWidth || config.opening_width || config.landing_width || 0} мм` },
    { x: 62, y: 276, t: `S = ${dims.marchWidth || config.march_width || config.ready_march_width || 0} мм` }
  ];
  return `<div class="tg-plan-wrap"><div class="tg-dim-list"><div class="tg-dim"><b>A = ${dims.openingLength || config.opening_length || config.landing_length || 0} мм</b><span>длина зоны</span></div><div class="tg-dim"><b>B = ${dims.openingWidth || config.opening_width || config.landing_width || 0} мм</b><span>ширина зоны</span></div><div class="tg-dim"><b>S = ${dims.marchWidth || config.march_width || config.ready_march_width || 0} мм</b><span>ширина марша</span></div></div><div class="tg-svg-shell"><svg viewBox="0 0 540 300" role="img" aria-label="Вид сверху"><rect x="32" y="26" width="470" height="240" rx="18" fill="rgba(255,255,255,.02)" stroke="rgba(232,200,162,.12)"></rect>${polys}<polyline points="${walk}" fill="none" stroke="#f6d6aa" stroke-width="2.2" stroke-dasharray="6 4"></polyline>${samples}${labels.map((l) => `<text x="${l.x}" y="${l.y}" class="muted">${asText(l.t)}</text>`).join('')}</svg></div></div>`;
}

function renderElevationSvg(geometry, config) {
  const visualization = geometry?.visualization;
  if (!visualization) return '<div class="muted">Нет данных для профиля.</div>';
  const profile = visualization.elevationProfile || [];
  const floorHeight = Number(visualization.dimensions?.floorHeight || config.floor_to_floor_height || config.step_count * config.riser_height || 1);
  const totalLen = Math.max(1, profile.reduce((acc, seg) => acc + (seg.length || 0), 0));
  let cursor = 56;
  const stairs = profile.map((seg) => {
    const width = ((seg.length || 0) / totalLen) * 360;
    if (seg.type === 'landing') {
      const y = 244 - ((seg.startHeight || 0) / floorHeight) * 168;
      const out = `<line x1="${cursor}" y1="${y}" x2="${cursor + width}" y2="${y}" stroke="#d7ae73" stroke-width="3"></line>`;
      cursor += width;
      return out;
    }
    const steps = Math.max(1, seg.steps || 1);
    const stepW = width / steps;
    const riser = seg.riserHeight || 0;
    const color = '#d7ae73';
    const paths = Array.from({ length: steps }).map((_, idx) => {
      const x = cursor + idx * stepW;
      const y = 244 - (((seg.startHeight || 0) + (idx + 1) * riser) / floorHeight) * 168;
      return `<path d="M${x} 244 L${x} ${y} L${x + stepW} ${y}" stroke="${color}" fill="none" stroke-width="2"></path>`;
    }).join('');
    cursor += width;
    return paths;
  }).join('');
  const rise = geometry?.geometrySummary?.riser_height || config.riser_height || 0;
  const tread = geometry?.geometrySummary?.tread_depth || config.tread_depth || 0;
  const angle = geometry?.geometrySummary?.stair_angle_deg || 0;
  return `<div class="tg-elev-wrap"><div class="tg-dim-list"><div class="tg-dim"><b>${floorHeight} мм</b><span>высота этажа</span></div><div class="tg-dim"><b>${tread} мм</b><span>проступь</span></div><div class="tg-dim"><b>${rise} мм</b><span>подъём</span></div><div class="tg-dim"><b>${angle}°</b><span>угол</span></div></div><div class="tg-svg-shell"><svg viewBox="0 0 520 280" role="img" aria-label="Вид сбоку"><rect x="30" y="24" width="460" height="224" rx="18" fill="rgba(255,255,255,.02)" stroke="rgba(232,200,162,.12)"></rect><line x1="44" y1="244" x2="478" y2="244" stroke="rgba(232,200,162,.18)"></line>${stairs}<text x="52" y="54" class="muted">Высота этажа ${floorHeight} мм</text><text x="352" y="94" class="muted">Проступь ${tread} мм</text><text x="352" y="126" class="muted">Подъём ${rise} мм</text><text x="352" y="158" class="muted">Угол ${angle}°</text></svg></div></div>`;
}

function renderSummary(geometry, config) {
  const diagnostics = geometry?.diagnostics || {};
  const rows = [
    ['Комфорт', diagnostics.comfort?.status || geometry.status || 'warning', diagnostics.comfort?.message || statusText(diagnostics.comfort?.status || geometry.status)],
    ['Headroom (просвет)', diagnostics.headroom?.status || 'ok', diagnostics.headroom?.message || 'В норме'],
    ['Вписываемость', diagnostics.fit?.status || geometry.status || 'warning', diagnostics.fit?.message || 'Предварительно подходит'],
    ['Комментарий инженера', 'ok', geometry.scenarioSummary || 'Финальные размеры подтверждаются после замера Tekstura.']
  ];
  return `<div class="tg-summary">${rows.map(([label, status, value]) => `<div class="tg-summary-row"><div class="tg-summary-label">${asText(label)}</div><div class="tg-summary-value ${status === 'ok' || status === 'recommended' ? '' : status}">${asText(value)}</div></div>`).join('')}</div>`;
}

function hideDefaultStepTwo(hide) {
  $('geometryWarnings')?.classList.toggle('hidden', hide);
  $('geometryAlternatives')?.classList.toggle('hidden', hide);
  $('geometryPlanSvg')?.closest('.result-box')?.classList.toggle('hidden', hide);
  $('geometryElevationSvg')?.closest('.result-box')?.classList.toggle('hidden', hide);
}

function renderPremiumStepTwo() {
  if (premiumBusy) return;
  premiumBusy = true;
  try {
    const root = $('geometryResult');
    if (!root || !$('step2')?.classList.contains('active')) return;
    const config = getConfigFromDom();
    const geometry = calculateGeometry(config);
    if (!geometry || !geometry.valid || geometry.status === 'invalid') {
      hideDefaultStepTwo(false);
      return;
    }
    ensureStyles();
    hideDefaultStepTwo(true);
    const chips = getChips(config);
    const rows = buildVariantRows(geometry, config);
    const current = rows.find((row) => row.isCurrent) || rows[0];
    root.innerHTML = `<div class="tg-premium-step"><section class="tg-premium-hero"><div class="tg-premium-header"><h3>Инженерная геометрия Tekstura</h3><div class="tg-premium-sub">Подбор вариантов по удобству, углу, линии хода и вписываемости.</div></div><div class="tg-chip-row">${chips.map((chip, idx) => `<span class="tg-chip ${idx === 0 ? 'is-active' : ''}">${asText(chip)}</span>`).join('')}</div><div class="tg-variants"><h4 class="tg-variants-title">Варианты</h4><table class="tg-table"><thead><tr><th>Подъёмы</th><th>Подъём, мм</th><th>Проступь, мм</th><th>Шаг, мм</th><th>Угол</th><th></th></tr></thead><tbody>${rows.map((row) => `<tr class="${row.isCurrent ? 'is-current' : ''}"><td>${row.riserCount}</td><td>${row.riserHeight}</td><td>${row.treadDepth}</td><td>${row.comfort}</td><td>${row.angleDeg}°</td><td>${row.isCurrent ? '<span class="tg-star">★</span>' : ''}</td></tr>`).join('')}</tbody></table><div class="tg-recommended"><div class="tg-rec-left"><span class="tg-star">★</span><div><p class="tg-rec-title">Рекомендуемый вариант</p><p class="tg-rec-copy">Наиболее сбалансированное решение по удобству, углу и вписываемости для текущих размеров.</p></div></div><div class="tg-rec-meta">Шаг<b>${current.comfort} мм</b>Угол ${current.angleDeg}°</div></div></div></section><section class="tg-engine-grid"><article class="tg-engine-card"><h4>Вид сверху</h4>${renderPlanSvg(geometry, config)}</article><article class="tg-engine-card"><h4>Вид сбоку</h4>${renderElevationSvg(geometry, config)}</article></section>${renderSummary(geometry, config)}<div class="tg-step2-note">${asText(geometry.status === 'recommended' ? 'Геометрия выглядит рабочей для предварительной оценки.' : 'Вариант строится, но перед запуском рекомендуем инженерное подтверждение на объекте.')}</div></div>`;
  } finally {
    premiumBusy = false;
  }
}

function scheduleRender() {
  setTimeout(renderPremiumStepTwo, 80);
}

function init() {
  ensureStyles();
  $('toResultsBtn')?.addEventListener('click', scheduleRender);
  ['baseCondition','baseSubtype','stairType','shapeType','shapeTurnMode','configurationType','turnType','turnDirection','readyTurnDirection','openingLength','openingWidth','marchWidth','landingLength','landingWidth','floorHeight','slabThickness','topFinishThickness','bottomFinishThickness','readyMarchWidth','riserHeight','treadDepth','stepCount','winderCount'].forEach((id) => {
    $(id)?.addEventListener('change', () => { if ($('step2')?.classList.contains('active')) scheduleRender(); });
  });
}

init();
