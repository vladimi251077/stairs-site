(() => {
  const $ = (id) => document.getElementById(id);
  const value = (id, fallback = 0) => Number($(id)?.value || fallback || 0);
  const round = (number, digits = 1) => Number(Number(number || 0).toFixed(digits));

  const labelByType = {
    straight: 'Прямая',
    l_turn_landing: 'Г-образная с площадкой',
    l_turn_winders: 'Г-образная с забежными',
    u_turn_landing: 'П-образная с площадкой',
    u_turn_winders: 'П-образная с забежными'
  };

  function currentType() {
    return $('stairType')?.value || 'straight';
  }

  function getPreviewGeometry() {
    const type = currentType();
    const ready = $('baseCondition')?.value === 'ready_frame';
    const marchW = ready ? value('readyMarchWidth', 1000) : value('marchWidth', 1000);
    const risers = ready ? value('stepCount', 15) : Math.max(14, Math.round(value('floorHeight', 2800) / 170));
    const riser = ready ? value('riserHeight', 170) : round(value('floorHeight', 2800) / risers);
    const tread = ready ? value('treadDepth', 280) : 280;
    const winderCount = Math.max(2, value('winderCount', 3));
    const landingL = value('landingLength', marchW);
    const landingW = value('landingWidth', marchW);
    const turnType = type.includes('winders') ? 'winders' : (type === 'straight' ? 'straight' : 'landing');
    const split = splitByType(type, risers, winderCount);
    const footprint = footprintByType(type, tread, marchW, split, landingL, landingW);
    const comfort = round(2 * riser + tread);
    const angle = round(Math.atan(riser / Math.max(1, tread)) * 180 / Math.PI, 1);
    return { type, ready, marchW, risers, riser, tread, winderCount, landingL, landingW, turnType, split, footprint, comfort, angle };
  }

  function splitByType(type, risers, winderCount) {
    if (type === 'straight') return { lower: Math.max(1, risers - 1), upper: 0, turn: 0, winder: 0 };
    const turn = type.includes('winders') ? winderCount : 1;
    const rest = Math.max(4, risers - 1 - turn);
    const lower = Math.max(2, Math.ceil(rest / 2));
    const upper = Math.max(2, rest - lower);
    return { lower, upper, turn, winder: type.includes('winders') ? winderCount : 0 };
  }

  function footprintByType(type, tread, marchW, split, landingL, landingW) {
    if (type === 'straight') return { length: split.lower * tread, width: marchW };
    if (type.startsWith('l_turn')) {
      const blockL = type.includes('landing') ? Math.max(landingL, marchW) : marchW;
      const blockW = type.includes('landing') ? Math.max(landingW, marchW) : marchW;
      return { length: split.lower * tread + blockL, width: split.upper * tread + blockW };
    }
    const blockL = type.includes('landing') ? Math.max(landingL, marchW) : marchW;
    const rowLength = Math.max(split.lower, split.upper) * tread;
    return { length: rowLength + blockL, width: marchW * 2 };
  }

  function polar(cx, cy, r, angleDeg) {
    const angle = angleDeg * Math.PI / 180;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  }

  function wedgePath(cx, cy, innerR, outerR, startAngle, endAngle) {
    const p1 = polar(cx, cy, innerR, startAngle);
    const p2 = polar(cx, cy, outerR, startAngle);
    const p3 = polar(cx, cy, outerR, endAngle);
    const p4 = polar(cx, cy, innerR, endAngle);
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`;
  }

  function stepNumber(x, y, number) {
    return `<text x="${x}" y="${y}" fill="#f2dec6" font-size="8" text-anchor="middle" dominant-baseline="middle">${number}</text>`;
  }

  function drawPlan(geom) {
    const scale = Math.min(450 / Math.max(geom.footprint.length, 1), 230 / Math.max(geom.footprint.width, 1));
    const offX = 48;
    const offY = 38;
    const tx = (x) => offX + x * scale;
    const ty = (y) => offY + y * scale;
    const stepFill = 'rgba(221,183,134,.22)';
    const stepStroke = '#ddb786';
    const landingFill = 'rgba(100,160,220,.14)';
    const landingStroke = '#85caff';
    let svg = `<svg viewBox="0 0 560 330" class="geo-svg geo-svg--preview" aria-label="Preview вид сверху">`;
    svg += `<rect x="18" y="18" width="524" height="282" rx="16" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.13)"/>`;
    svg += `<rect x="${tx(0)}" y="${ty(0)}" width="${geom.footprint.length * scale}" height="${geom.footprint.width * scale}" rx="8" fill="rgba(221,183,134,.05)" stroke="rgba(221,183,134,.42)" stroke-dasharray="6 5"/>`;

    if (geom.type === 'straight') {
      for (let index = 0; index < geom.split.lower; index += 1) {
        const x = index * geom.tread;
        svg += `<rect x="${tx(x)}" y="${ty(0)}" width="${Math.max(2, geom.tread * scale - 1)}" height="${geom.marchW * scale}" rx="2" fill="${stepFill}" stroke="${stepStroke}" stroke-width="1"/>`;
      }
    } else if (geom.type.startsWith('l_turn')) {
      svg += drawLTurnPlan(geom, tx, ty, scale, stepFill, stepStroke, landingFill, landingStroke);
    } else {
      svg += drawUTurnPlan(geom, tx, ty, scale, stepFill, stepStroke, landingFill, landingStroke);
    }

    svg += `<text x="30" y="316" fill="#b9a58d" font-size="12">${labelByType[geom.type] || geom.type} · пятно ${round(geom.footprint.length)} × ${round(geom.footprint.width)} мм</text>`;
    svg += `</svg>`;
    return svg;
  }

  function drawLTurnPlan(geom, tx, ty, scale, stepFill, stepStroke, landingFill, landingStroke) {
    let svg = '';
    const lowerRun = geom.split.lower * geom.tread;
    const turnDir = $('readyTurnDirection')?.value || $('turnDirection')?.value || 'left';
    const left = turnDir === 'left';
    const baseY = left ? geom.footprint.width - geom.marchW : 0;
    const upperY = left ? 0 : geom.marchW;
    for (let index = 0; index < geom.split.lower; index += 1) {
      const x = index * geom.tread;
      svg += `<rect x="${tx(x)}" y="${ty(baseY)}" width="${Math.max(2, geom.tread * scale - 1)}" height="${geom.marchW * scale}" rx="2" fill="${stepFill}" stroke="${stepStroke}" stroke-width="1"/>`;
      svg += stepNumber(tx(x + geom.tread / 2), ty(baseY + geom.marchW / 2), index + 1);
    }
    if (geom.type.includes('winders')) {
      const cx = tx(lowerRun);
      const cy = ty(left ? baseY : geom.marchW);
      const start = left ? 0 : -90;
      const end = left ? 90 : 0;
      for (let index = 0; index < geom.split.winder; index += 1) {
        const a1 = start + ((end - start) * index) / geom.split.winder;
        const a2 = start + ((end - start) * (index + 1)) / geom.split.winder;
        svg += `<path d="${wedgePath(cx, cy, 12, geom.marchW * scale, a1, a2)}" fill="rgba(231,192,139,.25)" stroke="${stepStroke}" stroke-width="1"/>`;
      }
    } else {
      svg += `<rect x="${tx(lowerRun)}" y="${ty(baseY)}" width="${Math.max(geom.landingL, geom.marchW) * scale}" height="${Math.max(geom.landingW, geom.marchW) * scale}" rx="4" fill="${landingFill}" stroke="${landingStroke}" stroke-width="1.2"/>`;
    }
    for (let index = 0; index < geom.split.upper; index += 1) {
      const y = upperY + index * geom.tread;
      svg += `<rect x="${tx(lowerRun)}" y="${ty(y)}" width="${geom.marchW * scale}" height="${Math.max(2, geom.tread * scale - 1)}" rx="2" fill="${stepFill}" stroke="${stepStroke}" stroke-width="1"/>`;
      svg += stepNumber(tx(lowerRun + geom.marchW / 2), ty(y + geom.tread / 2), geom.split.lower + geom.split.turn + index + 1);
    }
    return svg;
  }

  function drawUTurnPlan(geom, tx, ty, scale, stepFill, stepStroke, landingFill, landingStroke) {
    let svg = '';
    const lowerRun = geom.split.lower * geom.tread;
    const upperRun = geom.split.upper * geom.tread;
    const turnX = Math.max(lowerRun, upperRun);
    const bottomY = geom.marchW;
    const topY = 0;

    // Первый марш идёт слева направо по нижней линии.
    for (let index = 0; index < geom.split.lower; index += 1) {
      const x = index * geom.tread;
      svg += `<rect x="${tx(x)}" y="${ty(bottomY)}" width="${Math.max(2, geom.tread * scale - 1)}" height="${geom.marchW * scale}" rx="2" fill="${stepFill}" stroke="${stepStroke}" stroke-width="1"/>`;
      svg += stepNumber(tx(x + geom.tread / 2), ty(bottomY + geom.marchW / 2), index + 1);
    }

    // Второй марш возвращается справа налево по верхней линии — так П-образная читается как разворот, а не две параллельные прямые.
    for (let index = 0; index < geom.split.upper; index += 1) {
      const x = Math.max(0, turnX - (index + 1) * geom.tread);
      svg += `<rect x="${tx(x)}" y="${ty(topY)}" width="${Math.max(2, geom.tread * scale - 1)}" height="${geom.marchW * scale}" rx="2" fill="${stepFill}" stroke="${stepStroke}" stroke-width="1"/>`;
      svg += stepNumber(tx(x + geom.tread / 2), ty(topY + geom.marchW / 2), geom.split.lower + geom.split.turn + index + 1);
    }

    if (geom.type.includes('winders')) {
      const cx = tx(turnX);
      const cy = ty(geom.marchW);
      for (let index = 0; index < geom.split.winder; index += 1) {
        const a1 = -90 + (180 * index) / geom.split.winder;
        const a2 = -90 + (180 * (index + 1)) / geom.split.winder;
        svg += `<path d="${wedgePath(cx, cy, 12, geom.marchW * scale, a1, a2)}" fill="rgba(231,192,139,.25)" stroke="${stepStroke}" stroke-width="1"/>`;
      }
    } else {
      svg += `<rect x="${tx(turnX)}" y="${ty(0)}" width="${Math.max(geom.landingL, geom.marchW) * scale}" height="${geom.marchW * 2 * scale}" rx="4" fill="${landingFill}" stroke="${landingStroke}" stroke-width="1.2"/>`;
      svg += `<text x="${tx(turnX + Math.max(geom.landingL, geom.marchW) / 2)}" y="${ty(geom.marchW)}" fill="#e8d0b0" font-size="10" text-anchor="middle" dominant-baseline="middle">площадка</text>`;
    }

    return svg;
  }

  function drawElevation(geom) {
    const steps = Math.max(1, geom.split.lower + geom.split.upper + geom.split.turn);
    const run = steps * geom.tread;
    const rise = Math.max(geom.risers * geom.riser, 1);
    const sx = 450 / Math.max(run, 1);
    const sy = 210 / rise;
    const ox = 48;
    const oy = 252;
    const tx = (x) => ox + x * sx;
    const ty = (y) => oy - y * sy;
    let svg = `<svg viewBox="0 0 560 330" class="geo-svg geo-svg--preview" aria-label="Preview боковой вид">`;
    svg += `<rect x="18" y="18" width="524" height="282" rx="16" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.13)"/>`;
    let x = 0;
    for (let index = 0; index < steps; index += 1) {
      svg += `<path d="M${tx(x)} ${ty(index * geom.riser)} L${tx(x)} ${ty((index + 1) * geom.riser)} L${tx(x + geom.tread)} ${ty((index + 1) * geom.riser)}" stroke="#ddb786" stroke-width="2" fill="none"/>`;
      x += geom.tread;
    }
    svg += `<line x1="${tx(0)}" y1="${ty(0)}" x2="${tx(run)}" y2="${ty(rise)}" stroke="#f97316" stroke-width="2" stroke-dasharray="6 4" opacity=".78"/>`;
    svg += `<text x="30" y="316" fill="#b9a58d" font-size="12">h=${geom.riser} мм · b=${geom.tread} мм · угол ${geom.angle}° · 2h+b=${geom.comfort} мм</text>`;
    svg += `</svg>`;
    return svg;
  }

  function paintPreviewGraphics() {
    const plan = $('geometryPlanSvg');
    const elevation = $('geometryElevationSvg');
    if (!plan || !elevation) return;
    const geom = getPreviewGeometry();
    // For preview we deliberately replace the old line-only renderer too, so U-turns and winders are shown consistently.
    plan.innerHTML = drawPlan(geom);
    elevation.innerHTML = drawElevation(geom);
    const cta = $('geometryFallbackCta');
    if (cta) cta.hidden = false;
  }

  function replaceDisabledPriceButton() {
    const button = $('calculateBtn');
    if (!button) return;
    let fallback = $('previewEngineerRequestBtn');
    if (!fallback) {
      fallback = document.createElement('a');
      fallback.id = 'previewEngineerRequestBtn';
      fallback.className = 'btn-primary preview-engineer-request';
      fallback.href = '/request.html';
      fallback.textContent = 'Оставить заявку на инженерную проверку';
      button.insertAdjacentElement('afterend', fallback);
    }
    const disabled = button.disabled || button.getAttribute('aria-disabled') === 'true';
    button.classList.toggle('preview-hidden-disabled', disabled);
    fallback.hidden = !disabled;
  }

  function enableReadyPricingControls() {
    ['deliveryDistance', 'claddingType', 'railingType', 'finishLevel'].forEach((id) => {
      const control = $(id);
      if (control) control.disabled = false;
    });
    document.querySelectorAll('#extrasField input, #extrasField select, #extrasField button').forEach((control) => {
      control.disabled = false;
    });
  }

  function syncScopeOptions(event = null) {
    const stepsOnly = document.querySelector('input[name="scopeWork"][value="steps_only"]');
    if (!stepsOnly) return;
    const stepsOnlyLabel = stepsOnly.closest('label');
    const advanced = [...document.querySelectorAll('input[name="scopeWork"]')]
      .filter((input) => !['steps_only', 'installation'].includes(input.value));
    const advancedSelected = advanced.some((input) => input.checked);

    if (event?.target === stepsOnly && stepsOnly.checked) {
      advanced.forEach((input) => { input.checked = false; });
      stepsOnlyLabel?.classList.remove('is-hidden-by-scope');
      return;
    }

    if (advancedSelected) {
      stepsOnly.checked = false;
      stepsOnlyLabel?.classList.add('is-hidden-by-scope');
    } else {
      stepsOnlyLabel?.classList.remove('is-hidden-by-scope');
    }
  }

  function refreshAfterCalculation() {
    window.setTimeout(() => {
      enableReadyPricingControls();
      syncScopeOptions();
      paintPreviewGraphics();
      replaceDisabledPriceButton();
    }, 80);
  }

  window.addEventListener('DOMContentLoaded', () => {
    $('toResultsBtn')?.addEventListener('click', refreshAfterCalculation);
    $('calculateBtn')?.addEventListener('click', refreshAfterCalculation);
    document.addEventListener('click', refreshAfterCalculation);
    document.addEventListener('input', refreshAfterCalculation);
    document.addEventListener('change', (event) => {
      if (event.target?.matches?.('input[name="scopeWork"]')) syncScopeOptions(event);
      refreshAfterCalculation();
    });
    refreshAfterCalculation();
  });
})();
