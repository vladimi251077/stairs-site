#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = 'docs/assets/calculator-preview/svg';
const SCREENSHOT_DIR = 'docs/assets/calculator-preview/screenshots';
const OVERVIEW_SCREENSHOT_PATH = `${SCREENSHOT_DIR}/tekstura-svg-preview-cards-overview.png`;
const REPORT_PATH = 'docs/reports/tekstura-svg-preview-cards.md';
const HTML_REPORT_PATH = 'docs/reports/tekstura-svg-preview-cards.html';

// Extracted from Tekstura measurement repository vladimi251077/tekstura-zamery,
// drawing-bridge.js. Only the presentation palette/card frame is adapted here;
// the stair footprints, flights, landing zones, winder fan and tread divisions
// follow the measurement constructor logic.
const VIEWPORT = { w: 1100, h: 760 };
const VARIANTS = [
  { key: 'ready_straight', mode: 'ready', label: 'Прямая лестница', opening: 'straight', turn: '' },
  { key: 'ready_l_right_landing', mode: 'ready', label: 'Г-образная правая с площадкой', opening: 'l_right', turn: 'landing' },
  { key: 'ready_l_right_winder', mode: 'ready', label: 'Г-образная правая с забежными', opening: 'l_right', turn: 'winder' },
  { key: 'ready_u_landing_left', mode: 'ready', label: 'П-образная с площадкой, старт слева', opening: 'u', turn: 'landing', side: 'left' },
  { key: 'ready_u_winder_left', mode: 'ready', label: 'П-образная с забежными, старт слева', opening: 'u', turn: 'winder', side: 'left' },
];

const CARD_PRESETS = [
  {
    file: 'stair-straight-card.svg',
    card: 'stair-straight-card',
    variant: 'ready_straight',
    functionName: 'buildGeometry → ready_straight',
    confirmation: 'Прямая лестница: один прямой марш flight1 с делениями ступеней по всей длине.',
    params: { firstFlightLength: 3000, firstFlightWidth: 900, firstFlightSteps: 12 },
  },
  {
    file: 'stair-turn-90-card.svg',
    card: 'stair-turn-90-card',
    variant: 'ready_l_right_landing',
    functionName: 'buildGeometry → ready_l_right_landing',
    confirmation: 'Г-образная лестница с площадкой: два перпендикулярных марша и прямоугольная поворотная площадка turn.',
    params: { firstFlightLength: 2100, firstFlightWidth: 850, secondFlightLength: 1900, secondFlightWidth: 850, turnLength: 900, turnWidth: 900, firstFlightSteps: 8, secondFlightSteps: 7 },
  },
  {
    file: 'stair-turn-180-card.svg',
    card: 'stair-turn-180-card',
    variant: 'ready_u_landing_left',
    functionName: 'buildGeometry → ready_u_landing_left',
    confirmation: 'П-образная лестница с площадкой: два параллельных марша flight1/flight2 и общий разворотный прямоугольник turn между ними.',
    params: { firstFlightLength: 2200, firstFlightWidth: 850, secondFlightLength: 2200, secondFlightWidth: 850, turnLength: 1900, turnWidth: 900, firstFlightSteps: 8, secondFlightSteps: 8 },
  },
  {
    file: 'stair-landing-card.svg',
    card: 'stair-landing-card',
    variant: 'ready_l_right_winder',
    functionName: 'buildGeometry → ready_l_right_winder → buildWinderPolygons',
    confirmation: 'Г-образная лестница с забежными: два перпендикулярных марша и 5 клиновидных winder-step полигонов в углу.',
    params: { firstFlightLength: 2050, firstFlightWidth: 850, secondFlightLength: 1900, secondFlightWidth: 850, turnLength: 900, turnWidth: 900, firstFlightSteps: 7, secondFlightSteps: 7, winderSteps: 5 },
  },
  {
    file: 'stair-winder-card.svg',
    card: 'stair-winder-card',
    variant: 'ready_u_winder_left',
    functionName: 'buildGeometry → ready_u_winder_left → buildWinderPolygons',
    confirmation: 'П-образная лестница с забежными: два параллельных марша и 6 клиновидных winder-step полигонов разворота 180° без прямоугольной площадки.',
    params: { firstFlightLength: 2200, firstFlightWidth: 850, secondFlightLength: 2200, secondFlightWidth: 850, turnLength: 1900, turnWidth: 900, firstFlightSteps: 8, secondFlightSteps: 8, winderSteps: 6 },
  },
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function variant(key) {
  return VARIANTS.find((item) => item.key === key) || VARIANTS[0];
}

function makeRect(id, x, y, w, h, zone, kind = 'flight') {
  return { id, x, y, w: Math.max(1, w), h: Math.max(1, h), zone, kind };
}

function buildGeometry(v, p) {
  const m1 = Math.max(1, p.firstFlightLength || p.openingLength || 2500);
  const b1 = Math.max(1, p.firstFlightWidth || p.openingWidth || 1000);
  const m2 = Math.max(1, p.secondFlightLength || 2000);
  const b2 = Math.max(1, p.secondFlightWidth || b1 || 1000);
  const zl = Math.max(1, p.turnLength || Math.max(b1, b2, 1000));
  const zw = Math.max(1, p.turnWidth || Math.max(b1, b2, 1000));
  const n1 = Math.max(1, p.firstFlightSteps || 10);
  const n2 = Math.max(1, p.secondFlightSteps || 8);
  const zn = Math.max(1, p.winderSteps || 3);
  const rects = [];
  const lines = [];
  const winders = [];
  let outer = { x: 0, y: 0, w: m1, h: b1 };

  const visualTreadCount = (count, fallback) => Math.max(1, Math.round(Number(count) || fallback));
  const addTreadsVertical = (rect, count, fallback = 8) => {
    const steps = visualTreadCount(count, fallback);
    for (let i = 1; i < steps; i += 1) lines.push({ start: { x: rect.x, y: rect.y + rect.h * i / steps }, end: { x: rect.x + rect.w, y: rect.y + rect.h * i / steps }, kind: 'tread' });
  };
  const addTreadsHorizontal = (rect, count, fallback = 10) => {
    const steps = visualTreadCount(count, fallback);
    for (let i = 1; i < steps; i += 1) lines.push({ start: { x: rect.x + rect.w * i / steps, y: rect.y }, end: { x: rect.x + rect.w * i / steps, y: rect.y + rect.h }, kind: 'tread' });
  };

  if (v.key === 'ready_straight') {
    const f1 = makeRect('flight1', 0, 0, m1, b1, 'flight1');
    rects.push(f1);
    outer = { x: 0, y: 0, w: m1, h: b1 };
    addTreadsHorizontal(f1, n1);
  } else if (v.opening === 'l_right') {
    const turn = makeRect('turn', m2, 0, zl, zw, 'turn', 'turn');
    const f1 = makeRect('flight1', m2 + zl - b1, zw, b1, m1, 'flight1');
    const f2 = makeRect('flight2', 0, 0, m2, b2, 'flight2');
    rects.push(f1, turn, f2);
    outer = { x: 0, y: 0, w: m2 + zl, h: zw + m1 };
    addTreadsVertical(f1, n1);
    addTreadsHorizontal(f2, n2);
    if (v.turn === 'winder') {
      const pivot = { x: turn.x, y: turn.y + turn.h };
      winders.push(...buildWinderPolygons(turn, pivot, -Math.PI / 2, 0, zn, 'l'));
    }
  } else {
    const side = v.side || 'left';
    const totalW = Math.max(zl, b1 + b2 + 120);
    const turn = makeRect('turn', 0, 0, totalW, zw, 'turn', 'turn');
    const f1 = side === 'left' ? makeRect('flight1', 0, zw, b1, m1, 'flight1') : makeRect('flight1', totalW - b1, zw, b1, m1, 'flight1');
    const f2 = side === 'left' ? makeRect('flight2', totalW - b2, zw, b2, m2, 'flight2') : makeRect('flight2', 0, zw, b2, m2, 'flight2');
    rects.push(turn, f1, f2);
    outer = { x: 0, y: 0, w: totalW, h: zw + Math.max(m1, m2) };
    addTreadsVertical(f1, n1);
    addTreadsVertical(f2, n2);
    if (v.turn === 'winder') {
      const pivot = { x: turn.x + turn.w / 2, y: turn.y + turn.h };
      const leftToRight = side === 'left';
      winders.push(...buildWinderPolygons(turn, pivot, leftToRight ? Math.PI : Math.PI * 2, leftToRight ? Math.PI * 2 : Math.PI, zn, 'u'));
    }
  }

  return { rects, lines, winders, outer, variant: v };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rayRectIntersection(pivot, angle, rect) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const candidates = [];
  const minX = rect.x;
  const maxX = rect.x + rect.w;
  const minY = rect.y;
  const maxY = rect.y + rect.h;
  if (Math.abs(dx) > 0.0001) {
    [minX, maxX].forEach((x) => {
      const t = (x - pivot.x) / dx;
      const y = pivot.y + t * dy;
      if (t > 0.0001 && y >= minY - 0.0001 && y <= maxY + 0.0001) candidates.push({ t, point: { x, y: clamp(y, minY, maxY) } });
    });
  }
  if (Math.abs(dy) > 0.0001) {
    [minY, maxY].forEach((y) => {
      const t = (y - pivot.y) / dy;
      const x = pivot.x + t * dx;
      if (t > 0.0001 && x >= minX - 0.0001 && x <= maxX + 0.0001) candidates.push({ t, point: { x: clamp(x, minX, maxX), y } });
    });
  }
  candidates.sort((a, b) => a.t - b.t);
  return candidates[0]?.point || pivot;
}

function buildWinderPolygons(rect, pivot, startAngle, endAngle, count, idPrefix) {
  const steps = Math.max(1, Math.round(count));
  const hits = Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps;
    return rayRectIntersection(pivot, startAngle + (endAngle - startAngle) * ratio, rect);
  });
  const result = [{ id: `${idPrefix}-envelope`, kind: 'envelope', points: [pivot, ...hits] }];
  for (let i = 0; i < steps; i += 1) {
    result.push({ id: `${idPrefix}-${i + 1}`, kind: 'step', number: i + 1, points: [pivot, hits[i], hits[i + 1]] });
  }
  return result;
}

function fitTransform(geometry, viewport = VIEWPORT) {
  const points = [];
  geometry.rects.forEach((r) => points.push({ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }));
  geometry.winders.forEach((poly) => poly.points.forEach((point) => points.push(point)));
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const margin = { top: 84, right: 84, bottom: 84, left: 84 };
  const innerW = Math.max(1, viewport.w - margin.left - margin.right);
  const innerH = Math.max(1, viewport.h - margin.top - margin.bottom);
  const scale = Math.min(innerW / width, innerH / height);
  const x0 = margin.left + (innerW - width * scale) / 2 - minX * scale;
  const y0 = margin.top + (innerH - height * scale) / 2 - minY * scale;
  return {
    map: (point) => ({ x: Number((x0 + point.x * scale).toFixed(2)), y: Number((y0 + point.y * scale).toFixed(2)) }),
    rect: (r) => {
      const a = { x: Number((x0 + r.x * scale).toFixed(2)), y: Number((y0 + r.y * scale).toFixed(2)) };
      return { x: a.x, y: a.y, w: Number((r.w * scale).toFixed(2)), h: Number((r.h * scale).toFixed(2)) };
    },
  };
}

function shouldRenderRect(r, geometry) {
  return !(geometry.variant.turn === 'winder' && r.zone === 'turn');
}

function renderRect(r, tr, geometry) {
  if (!shouldRenderRect(r, geometry)) return '';
  const box = tr.rect(r);
  const className = r.zone === 'turn' ? 'zone turn' : 'zone';
  return `<rect class="${className}" data-zone="${r.zone}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/>`;
}

function renderLine(line, tr) {
  const a = tr.map(line.start);
  const b = tr.map(line.end);
  return `<line class="${line.kind || 'tread'}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
}

function renderWinder(poly, tr) {
  const points = poly.points.map((point) => tr.map(point));
  const d = points.map((point) => `${point.x},${point.y}`).join(' ');
  if (poly.kind === 'envelope') return `<polygon class="winder-envelope" data-zone="turn" points="${d}"/>`;
  return `<polygon class="winder-step" data-zone="turn" points="${d}"/>`;
}

function renderSvg(card, geometry) {
  const tr = fitTransform(geometry);
  const rects = geometry.rects.map((r) => renderRect(r, tr, geometry)).join('');
  const winders = geometry.winders.map((poly) => renderWinder(poly, tr)).join('');
  const lines = geometry.lines.map((line) => renderLine(line, tr)).join('');
  return `<svg class="tekstura-preview-card" viewBox="0 0 ${VIEWPORT.w} ${VIEWPORT.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(card.card)}">
  <defs>
    <linearGradient id="card-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#17120d"/><stop offset="1" stop-color="#26201a"/></linearGradient>
  </defs>
  <style>
    .tekstura-preview-card{background:#17120d}.frame{fill:url(#card-bg);stroke:#6f5a3f;stroke-width:2}.zone{fill:#2f2419;stroke:#ddb786;stroke-width:4;vector-effect:non-scaling-stroke}.turn{fill:#3a2d1d}.tread{stroke:#f1d3a5;stroke-width:2.2;vector-effect:non-scaling-stroke}.winder-envelope{fill:#332617;stroke:#ddb786;stroke-width:4;vector-effect:non-scaling-stroke}.winder-step{fill:#4a351f;stroke:#f1d3a5;stroke-width:2.4;vector-effect:non-scaling-stroke}
  </style>
  <rect class="frame" x="12" y="12" width="1076" height="736" rx="34"/>
  <g>${rects}${winders}${lines}</g>
</svg>`;
}

function reportRows(results) {
  return results.map((result) => {
    const screenshot = `${SCREENSHOT_DIR}/${result.file.replace(/\.svg$/, '.png')}`;
    return `| \`${result.card}\` | \`${OUT_DIR}/${result.file}\` | \`${screenshot}\` | \`${result.functionName}\` | ${result.confirmation} |`;
  }).join('\n');
}

function htmlFigures() {
  return CARD_PRESETS.map((card) => `<figure><img src="../assets/calculator-preview/svg/${card.file}" alt="${card.card}"><figcaption>${card.card}</figcaption></figure>`).join('\n    ');
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const results = [];
  for (const card of CARD_PRESETS) {
    const v = variant(card.variant);
    const geometry = buildGeometry(v, card.params);
    const svg = renderSvg(card, geometry);
    const outPath = path.join(OUT_DIR, card.file);
    await writeFile(outPath, svg, 'utf8');
    results.push({ ...card, outPath, geometry });
    console.log(`${outPath} ← ${card.functionName}`);
  }

  const report = `# Tekstura SVG preview cards source map\n\nЭкспорт создан из реального SVG-конструктора замеров Tekstura: \`vladimi251077/tekstura-zamery/drawing-bridge.js\`. В этом репозитории сохранён переносимый экспортёр \`svg-constructor/export-tekstura-preview-cards.mjs\`; он меняет только фон, цвета ступеней/контуров и рамку карточки. Геометрия маршей, поворотной зоны, площадки, делений ступеней и забежных полигонов взята из функций конструктора замеров.\n\nОбщий скриншот визуального результата: \`${OVERVIEW_SCREENSHOT_PATH}\`.\n\n| Карточка | SVG | Скриншот SVG | Функция/ветка | Подтверждение геометрии |\n| --- | --- | --- | --- | --- |\n${reportRows(results)}\n\n## Найденные функции в источнике замеров\n\n- \`VARIANTS\`: содержит ready-варианты прямой, Г-образной с площадкой/забежными и П-образной с площадкой/забежными.\n- \`buildGeometry\`: строит прямоугольники \`flight1\`, \`flight2\`, \`turn\` и деления ступеней.\n- \`addTreadsVertical\` / \`addTreadsHorizontal\`: генерируют линии ступеней по количеству ступеней марша.\n- \`buildWinderPolygons\`: генерирует веер забежных ступеней внутри поворотной зоны.\n- \`renderSvg\`, \`renderRect\`, \`renderLine\`, \`renderWinder\`: собирают итоговый SVG-план сверху без 3D, стрелок и видимого текста внутри изображения.\n`;
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, report, 'utf8');

  const html = `<!doctype html>\n<html lang="ru">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Tekstura SVG preview cards</title>\n  <style>\n    body{margin:0;padding:24px;background:#120f0b;color:#f5e4c9;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}\n    h1{margin:0 0 18px;font-size:28px}\n    .grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}\n    figure{margin:0;padding:14px;border:1px solid rgba(221,183,134,.28);border-radius:18px;background:#1a1510}\n    img{display:block;width:100%;height:auto;border-radius:12px}\n    figcaption{margin-top:10px;font-weight:800}\n  </style>\n</head>\n<body>\n  <h1>SVG preview-карточки из конструктора замеров Tekstura</h1>\n  <section class="grid">\n    ${htmlFigures()}\n  </section>\n</body>\n</html>\n`;
  await writeFile(HTML_REPORT_PATH, html, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
