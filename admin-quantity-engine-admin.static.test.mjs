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
  'confirm(\'Удалить ограждение окончательно?',
  'width:min(100%, 1440px)',
  'qe-admin-card-list',
  'qe-admin-card',
  'qe-card-actions',
  'flex-wrap:wrap',
  'white-space:normal',
  'aria-label="Материалы и расходники"',
  'aria-label="Ограждения"',
  'Новый расчёт / Цена под ключ',
  'Служебный модуль: Quantity Engine',
  'Новые материалы появятся в справочнике. Чтобы они начали участвовать в автоматической формуле калькулятора, их код должен использоваться движком расчёта или быть подключён отдельным правилом.',
  'Новые виды ограждений можно хранить в справочнике. Чтобы они появились в клиентском выборе и участвовали в расчёте, может потребоваться сопоставление в калькуляторе.',
  '<label>Код материала<input data-k="code"',
  '<label class="qe-card-span-2">Название<input data-k="name"',
  'priceLabelForUnit(unit)',
  'Цена за лист',
  'Цена за м²',
  'Цена за литр',
  'Цена за кг',
  'Цена за комплект',
  'Цена за тубу',
  'Цена за единицу',
  '<label>Единица расчёта<input data-k="unit"',
  '<label>Категория<input data-k="category"',
  'data-k="base_cost"',
  '<label>Отходы, %<input data-k="waste_percent"',
  '<label>Цена за метр<input data-k="price_per_meter"',
  '<label class="qe-card-span-2">Описание<textarea data-k="description"',
  '<label>Активен<input data-k="active"',
  '<label>Активно<input data-k="active"',
  '<label>Показывать клиенту<input data-k="visible_to_client"',
  'Порядок отображения<input data-k="sort_order"'
]) {
  assert.ok(adminHtml.includes(needle), `admin/index.html should include ${needle}`);
}

for (const forbidden of [
  'min-width:920px',
  "document.createElement(\'tr\')",
  '<table class="qe-admin-table"',
  "querySelector('tbody')"
]) {
  assert.equal(adminHtml.includes(forbidden), false, `admin/index.html should not include ${forbidden}`);
}


for (const forbiddenLabel of [
  'price_per_meter',
  'visible_to_client',
  'sort_order',
  'base_cost',
  'waste_percent'
]) {
  const labelTextPattern = new RegExp(String.raw`<label[^>]*>\s*${forbiddenLabel}\s*(?:<input|<textarea)`);
  assert.equal(labelTextPattern.test(adminHtml), false, `admin/index.html should not expose ${forbiddenLabel} as visible label text`);
}

for (const [path, text] of clientFiles) {
  for (const forbidden of ['Коэффициент turnkey', 'материалы и расходники × коэффициент', 'Модель:']) {
    assert.equal(text.includes(forbidden), false, `${path} should not expose ${forbidden}`);
  }
}

console.log('Admin Quantity Engine static checks passed.');
