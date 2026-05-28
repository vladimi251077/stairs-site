import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adminHtml = readFileSync('admin/index.html', 'utf8');
const clientFiles = ['calculator.html', 'stair-configurator.js'].map((path) => [path, readFileSync(path, 'utf8')]);

for (const needle of [
  'materials_catalog',
  'railing_types',
  'quantity_engine_settings',
  'Добавить материал',
  'Добавить ограждение',
  'active: false',
  'confirm(\'Удалить материал окончательно?',
  'confirm(\'Удалить ограждение окончательно?'
]) {
  assert.ok(adminHtml.includes(needle), `admin/index.html should include ${needle}`);
}

for (const [path, text] of clientFiles) {
  for (const forbidden of ['Коэффициент turnkey', 'материалы и расходники × коэффициент', 'Модель:']) {
    assert.equal(text.includes(forbidden), false, `${path} should not expose ${forbidden}`);
  }
}

console.log('Admin Quantity Engine static checks passed.');
