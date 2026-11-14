import { validateSettings } from './calculator-preview-pricing.js';

const table = 'stepwise_pricing_settings';
const columns = 'revision,other_expenses_percent,regions';

function fromRow(row) {
  if (!row || !Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new Error('Настройки цены на сервере недоступны.');
  }
  return {
    revision: row.revision,
    settings: validateSettings({ otherExpensesPercent: Number(row.other_expenses_percent), regions: row.regions })
  };
}

export async function loadSharedPricing(client) {
  const { data, error } = await client.from(table).select(columns).eq('id', 1)
    .abortSignal(AbortSignal.timeout(5000)).single();
  if (error) throw new Error('Не удалось загрузить настройки цены с сервера.', { cause: error });
  return fromRow(data);
}

export async function saveSharedPricing(client, revision, settings) {
  const { otherExpensesPercent, regions } = validateSettings(settings);
  const { data, error } = await client.from(table)
    .update({ other_expenses_percent: otherExpensesPercent, regions, revision: revision + 1 })
    .eq('id', 1).eq('revision', revision).select(columns).maybeSingle();
  if (error) throw new Error('Не удалось сохранить настройки цены.', { cause: error });
  if (!data) throw new Error('Настройки были изменены или у вас нет прав на запись. Обновите страницу.');
  return fromRow(data);
}
