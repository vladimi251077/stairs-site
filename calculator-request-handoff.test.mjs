import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');

const calculator = read('./stair-configurator.js');
const requestScript = [...read('./request.html').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1]).find((script) => script.includes('function parseCalc()'));
const notificationScript = read('./api/notify-lead.js');
const draft = {
  schema: 'tekstura.stair.phase1',
  staircaseType: 'Прямая',
  input_dimensions: { floor_to_floor_height: 3000 },
  chosen_geometry_result: { tread_depth: 280 },
  total: 350000
};

function calculatorLinks(baseCondition) {
  const links = { requestLink: {}, engineerReviewLink: {} };
  const scenario = calculator.slice(
    calculator.indexOf('function normalizeBaseConditionValue('),
    calculator.indexOf('function normalizeOpeningTypeValue(')
  );
  const handoff = calculator.slice(
    calculator.indexOf('function buildRequestUrl('),
    calculator.indexOf('function updateGeometryActions(')
  );
  runInContext(scenario + handoff + '\nupdateRequestLinks(draft);', createContext({
    draft: { ...draft, base_condition: baseCondition },
    $: (id) => links[id]
  }));
  return links;
}

async function submitTestRequest(href) {
  const elements = new Map();
  let storedLead;
  let notification;
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, { value: id === 'phone' ? 'test-phone' : '', textContent: '',
          classList: { remove() {}, toggle() {} } });
      }
      return elements.get(id);
    }
  };
  const client = {
    from: () => ({
      insert: async ([lead]) => {
        storedLead = lead;
        return { error: null };
      }
    })
  };
  const context = createContext({
    document,
    window: {
      location: new URL(href, 'https://test.invalid'),
      SUPABASE_CONFIG: { url: 'test', anonKey: 'test' },
      supabase: { createClient: () => client }
    },
    fetch: async (url, options) => {
      assert.equal(url, '/api/notify-lead');
      notification = JSON.parse(options.body).lead;
      return { ok: true, json: async () => ({ deliveryResults: { email: { ok: true } } }) };
    }
  });
  await runInContext(requestScript + '\nsendRequest();', context);
  const output = runInContext(notificationScript + '\n[formatLeadMessage(lead), formatLeadEmailHtml(lead)];',
    createContext({ module: { exports: {} }, lead: notification }));
  return { storedLead, output, summary: document.getElementById('calcData').textContent };
}

test('ready-base request retains the engineering review through display, storage and notification', async () => {
  const links = calculatorLinks('existing_concrete_base');
  const { storedLead, output, summary } = await submitTestRequest(links.requestLink.href);
  assert.match(summary, /инженерная проверка/iu);
  assert.equal(storedLead.options_json.meta.request_source, 'calculator');
  assert.equal(storedLead.options_json.meta.request_mode, 'engineer_review');
  assert.equal(storedLead.dimensions_json.floor_to_floor_height, 3000);
  assert.equal(storedLead.calculated_price, 350000);
  for (const message of output) assert.match(message, /инженерная проверка/iu);
});

test('explicit review, regular calculation and manual request stay distinct', async () => {
  const links = calculatorLinks('empty_opening');
  const review = await submitTestRequest(links.engineerReviewLink.href);
  assert.equal(review.storedLead.options_json.meta.request_mode, 'engineer_review');
  const regular = await submitTestRequest(links.requestLink.href);
  const manual = await submitTestRequest('/request.html');
  assert.equal(regular.storedLead.options_json.meta.request_source, 'calculator');
  assert.equal(manual.storedLead.options_json.meta.request_source, 'manual');
  for (const result of [regular, manual]) {
    assert.equal(result.storedLead.options_json.meta.request_mode, undefined);
    for (const message of result.output) assert.doesNotMatch(message, /тип заявки.*инженерная проверка/iu);
  }
});
