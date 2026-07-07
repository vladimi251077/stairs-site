#!/usr/bin/env node
/**
 * calculator-benchmark audit scaffold.
 * If Playwright is available, extend this file to run automated browser checks.
 */
const fs = require('fs');
const path = require('path');

const REPORT_DIR = path.resolve(__dirname, 'reports');
const MD_PATH = path.resolve(REPORT_DIR, 'calculator-benchmark-audit.md');
const JSON_PATH = path.resolve(REPORT_DIR, 'calculator-benchmark-audit.json');
const CSV_PATH = path.resolve(REPORT_DIR, 'calculator-benchmark-audit.csv');

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function writeFallbackReport() {
  ensureDir(REPORT_DIR);
  const payload = {
    status: 'playwright_unavailable',
    message: 'Playwright is not installed in this environment. Install playwright to run automated benchmark audit.',
    targetPrice: 290000,
    benchmark: {
      base: 'existing_metal_frame',
      shape: 'u_turn_landing',
      stepsTotal: 16,
      widthMm: 900,
      landing: '900x2000',
      railing: 'metal (proxy for 16mm tubes)',
      upperBalustradeMm: 1100,
      finishMaterial: 'MDF (not available in UI)',
      coating: 'enamel (not available in UI)',
      cladding: 'full'
    },
    requiredToggles: [
      'railing none/metal',
      'upper balustrade 0/1100',
      'MDF no enamel / MDF enamel (currently unavailable as direct options)',
      'partial/full cladding',
      'u_turn_landing vs straight 16 steps',
      'landing 900x900 vs 900x2000'
    ]
  };

  fs.writeFileSync(JSON_PATH, JSON.stringify(payload, null, 2));
  fs.writeFileSync(CSV_PATH, 'status,message,targetPrice\nplaywright_unavailable,"Install playwright to run this audit",290000\n');

  const md = [
    '# Calculator benchmark audit (scaffold)',
    '',
    '- Status: Playwright unavailable in current environment.',
    '- Action: install Playwright and rerun `node tools/audit-calculator-benchmark.js`.',
    '',
    '## Target benchmark',
    '- Target price: **290 000 ₽**',
    '- Scenario: metal frame, U-turn with landing, 16 steps, width 900 mm, landing 900×2000, metal railing, upper balustrade 1100 mm, full cladding.',
    '- Missing direct UI options: MDF, enamel, 16mm tubes.',
    '',
    '## This script currently does',
    '- Writes JSON and CSV placeholders with benchmark metadata.',
    '- Does **not** alter pricing or formulas.',
  ].join('\n');
  fs.writeFileSync(MD_PATH, md);

  console.log('Playwright unavailable. Wrote scaffold reports:');
  console.log('-', JSON_PATH);
  console.log('-', CSV_PATH);
  console.log('-', MD_PATH);
}

try {
  require.resolve('playwright');
  console.log('Playwright detected. Please implement automation steps in this script for your CI/runtime.');
  writeFallbackReport();
} catch (_) {
  writeFallbackReport();
}
