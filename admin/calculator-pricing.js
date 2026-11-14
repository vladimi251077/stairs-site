import { loadSharedPricing, saveSharedPricing } from '../calculator-pricing-store.js';

export async function showPricingEditor(client, user) {
  const panel = document.getElementById('stepwiseSharedPricing');
  const form = panel.querySelector('[data-pricing-form]');
  const status = panel.querySelector('[data-pricing-status]');
  const cities = panel.querySelector('[data-pricing-cities]');
  const add = panel.querySelector('[data-pricing-add]');
  const save = form.querySelector('[type="submit"]');
  let revision;
  const canEdit = user.app_metadata?.calculator_pricing_admin === true;
  form.hidden = true;
  save.disabled = add.disabled = false;
  status.textContent = 'Загружаем настройки…';

  function field(caption, input) {
    const label = document.createElement('label');
    label.textContent = caption;
    label.append(input);
    return label;
  }

  function addCity(region) {
    const row = document.createElement('div');
    row.className = 'grid two';
    row.dataset.cityCode = region.code;
    const city = document.createElement('input');
    Object.assign(city, { name: 'city', required: true, maxLength: 80, value: region.name, readOnly: !canEdit });
    const coefficient = document.createElement('input');
    Object.assign(coefficient, {
      name: 'coefficient', required: true, type: 'number', min: '1', max: '20', step: '0.01',
      value: region.turnkeyCoefficient, readOnly: !canEdit
    });
    row.append(field('Город или регион', city), field('Коэффициент', coefficient));
    cities.append(row);
    return city;
  }

  function render(result) {
    revision = result.revision;
    form.elements.overhead.value = result.settings.otherExpensesPercent;
    cities.replaceChildren();
    result.settings.regions.forEach(addCity);
  }

  try {
    render(await loadSharedPricing(client));
  } catch (error) {
    status.textContent = error.message;
    return;
  }
  form.elements.overhead.readOnly = !canEdit;
  add.hidden = save.hidden = !canEdit;
  form.hidden = false;
  status.textContent = canEdit ? '' : 'Для сохранения требуется право редактировать тарифы.';
  add.onclick = () => addCity({ code: 'city-' + crypto.randomUUID(), name: '', turnkeyCoefficient: '' }).focus();
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!canEdit || save.disabled) return;
    save.disabled = add.disabled = true;
    try {
      const settings = {
        otherExpensesPercent: form.elements.overhead.valueAsNumber,
        regions: Array.from(cities.children, (row) => ({
          code: row.dataset.cityCode,
          name: row.querySelector('[name="city"]').value,
          turnkeyCoefficient: row.querySelector('[name="coefficient"]').valueAsNumber
        }))
      };
      render(await saveSharedPricing(client, revision, settings));
      status.textContent = 'Сохранено. Новые расчёты используют эти настройки.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      save.disabled = add.disabled = false;
    }
  };
}
