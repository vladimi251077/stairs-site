const DEFAULT_WHATSAPP_API_URL = 'https://graph.facebook.com';

function parseSenderEmail(senderValue) {
  const value = String(senderValue || '').trim();
  if (!value) return '';
  const bracketMatch = value.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) return bracketMatch[1].trim().toLowerCase();
  return value.toLowerCase();
}

function isResendDevSender(senderValue) {
  const email = parseSenderEmail(senderValue);
  return email.endsWith('@resend.dev');
}

function buildEmailPreflight(notifyEmail) {
  const apiKeyConfigured = Boolean((process.env.RESEND_API_KEY || '').trim());
  const senderRaw = (process.env.NOTIFY_EMAIL_FROM || '').trim();
  const sender = senderRaw || 'Tekstura <onboarding@resend.dev>';
  const senderConfigured = Boolean(senderRaw);
  const senderUsesResendDev = isResendDevSender(sender);
  const recipientResolved = Boolean((notifyEmail?.recipient || '').trim());
  const recipientSource = notifyEmail?.source || 'missing-recipient';
  const recipientViaFallbackEnv = recipientSource === 'fallback-env';

  const errors = [];
  const warnings = [];

  if (!apiKeyConfigured) {
    errors.push('missing-resend-api-key');
  }
  if (!recipientResolved) {
    errors.push('missing-recipient');
  }
  if (!senderConfigured) {
    warnings.push('missing-notify-email-from');
  }
  if (senderUsesResendDev) {
    warnings.push('sender-uses-resend-dev');
  }
  if (recipientViaFallbackEnv) {
    warnings.push('recipient-from-fallback-env');
  }
  if (notifyEmail?.warning) {
    warnings.push(`recipient-resolution:${notifyEmail.warning}`);
  }

  const emailChannelState = errors.length
    ? 'blocked'
    : warnings.length
      ? 'degraded'
      : 'ready';

  return {
    sender,
    senderConfigured,
    senderUsesResendDev,
    recipientResolved,
    recipientSource,
    recipientViaFallbackEnv,
    apiKeyConfigured,
    warnings,
    errors,
    emailChannelState,
    emailError: errors[0] || null
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const CONFIGURATION_LABELS = { straight: 'Прямая', l_shaped: 'Г-образная', u_shaped: 'П-образная' };
const TURN_TYPE_LABELS = { landing: 'Площадка', winders: 'Забежные' };

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 'не рассчитана';
  return `${number.toLocaleString('ru-RU')} ₽`;
}

function toHumanText(value, fallback = 'не указано') {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : fallback;
}


function hasMeaningfulObjectData(obj = {}) {
  if (!obj || typeof obj !== 'object') return false;
  return Object.values(obj).some((value) => {
    if (value == null) return false;
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return hasMeaningfulObjectData(value);
    return false;
  });
}

function collectSelectedOptions(optionsJson = {}) {
  const selected = Array.isArray(optionsJson?.selected) ? optionsJson.selected : [];
  const labels = Array.isArray(optionsJson?.labels) ? optionsJson.labels : [];
  const candidates = [...selected, ...labels];
  const prepared = candidates
    .map((item) => (typeof item === 'string' ? item : (item?.label || item?.code || '')))
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return [...new Set(prepared)];
}

function resolveLeadContext(lead = {}) {
  const dimensions = lead?.dimensions_json && typeof lead.dimensions_json === 'object' ? lead.dimensions_json : {};
  const materials = lead?.materials_json && typeof lead.materials_json === 'object' ? lead.materials_json : {};
  const options = lead?.options_json && typeof lead.options_json === 'object' ? lead.options_json : {};
  const selectedOptions = collectSelectedOptions(options);

  const baseCondition = dimensions.base_condition || dimensions.scenario || lead.base_condition || '';
  const scenario = baseCondition === 'ready_frame'
    ? 'Готовый каркас'
    : (baseCondition === 'empty_opening' ? 'Пустой проём' : 'Не указан');

  const configuration = dimensions.configuration_type || dimensions.configuration || lead.configuration_type || '';
  const turnType = dimensions.turn_type || lead.turn_type || '';
  const turnDirection = dimensions.turn_direction || lead.turn_direction || '';

  const calculatedPrice = Number(lead?.calculated_price || 0);
  const explicitSource = options?.meta?.request_source;
  const inferredCalculatorData = Boolean(
    lead?.staircase_type ||
    calculatedPrice > 0 ||
    hasMeaningfulObjectData(dimensions) ||
    hasMeaningfulObjectData(materials) ||
    selectedOptions.length
  );
  const hasCalculatorData = explicitSource
    ? explicitSource === 'calculator'
    : inferredCalculatorData;
  const source = hasCalculatorData ? 'Заявка из калькулятора' : 'Ручная заявка без расчёта';

  const leadId = String(lead?.id || '').trim();
  const projectContext = dimensions?.project_context && typeof dimensions.project_context === 'object'
    ? dimensions.project_context
    : null;
  const projectPriceText = projectContext
    ? formatCurrency(projectContext.price || 0) !== 'не рассчитана'
      ? formatCurrency(projectContext.price || 0)
      : (projectContext.price_from ? `от ${Number(projectContext.price_from).toLocaleString('ru-RU')} ₽` : 'по запросу')
    : '';

  return {
    source,
    isCalculatorLead: hasCalculatorData,
    leadIdText: leadId || 'Lead ID будет доступен в админке / базе',
    customer: {
      name: toHumanText(lead?.name, 'не указано'),
      phone: toHumanText(lead?.phone, 'не указан'),
      messenger: toHumanText(lead?.messenger, 'не указан'),
      city: toHumanText(lead?.city, 'не указан'),
      comment: toHumanText(lead?.comment, 'без комментария')
    },
    staircase: {
      type: toHumanText(lead?.staircase_type, 'Тип лестницы не выбран'),
      scenario,
      configuration: toHumanText(CONFIGURATION_LABELS[configuration] || configuration, 'не указана'),
      turnType: toHumanText(TURN_TYPE_LABELS[turnType] || turnType, 'не указан'),
      turnDirection: turnDirection === 'left' ? 'Левый' : (turnDirection === 'right' ? 'Правый' : 'не указано'),
      marchWidth: dimensions.march_width || dimensions.ready_march_width || '',
      floorHeight: dimensions.floor_to_floor_height || '',
      stepCount: dimensions.step_count || dimensions.riser_count || '',
      riserHeight: dimensions.riser_height || '',
      treadDepth: dimensions.tread_depth || ''
    },
    materials: {
      frame: materials.frame || materials.frame_material || '',
      cladding: materials.cladding || '',
      finish: materials.finish || materials.finish_level || '',
      railing: materials.railing || materials.ready_railing_type || '',
      readyMaterial: materials.ready_material || ''
    },
    selectedOptions,
    calculatedPriceText: formatCurrency(calculatedPrice),
    projectContext: projectContext
      ? {
          projectId: toHumanText(projectContext.id, 'не указан'),
          title: toHumanText(projectContext.title, 'не указан'),
          priceText: projectPriceText,
          materials: toHumanText(projectContext.materials, 'не указаны'),
          staircaseType: toHumanText(projectContext.staircase_type, 'не указан'),
          category: toHumanText(projectContext.category, 'не указана'),
          leadTime: toHumanText(projectContext.lead_time, 'не указан')
        }
      : null
  };
}

function formatLeadMessage(lead) {
  const ctx = resolveLeadContext(lead);
  const staircase = ctx.staircase;
  const materials = ctx.materials;
  const optionsText = ctx.selectedOptions.length ? ctx.selectedOptions.join(', ') : 'не выбраны';
  const project = ctx.projectContext;

  const lines = [
    'Новая заявка Tekstura',
    `Источник: ${ctx.source}`,
    '',
    `Имя: ${ctx.customer.name}`,
    `Телефон: ${ctx.customer.phone}`,
    `Мессенджер: ${ctx.customer.messenger}`,
    `Город: ${ctx.customer.city}`,
    `Комментарий: ${ctx.customer.comment}`,
    '',
    `Тип лестницы: ${staircase.type}`,
    `Сценарий: ${staircase.scenario}`,
    `Конфигурация: ${staircase.configuration}`,
    `Тип поворота: ${staircase.turnType}`,
    `Направление поворота: ${staircase.turnDirection}`,
    `Ширина марша: ${staircase.marchWidth ? `${staircase.marchWidth} мм` : 'не указана'}`,
    `Высота этаж-этаж: ${staircase.floorHeight ? `${staircase.floorHeight} мм` : 'не указана'}`,
    `Количество ступеней: ${staircase.stepCount || 'не указано'}`,
    `Подступенок: ${staircase.riserHeight ? `${staircase.riserHeight} мм` : 'не указан'}`,
    `Проступь: ${staircase.treadDepth ? `${staircase.treadDepth} мм` : 'не указана'}`,
    '',
    `Материал каркаса: ${toHumanText(materials.frame, 'не указан')}`,
    `Облицовка: ${toHumanText(materials.cladding, 'не указана')}`,
    `Финиш: ${toHumanText(materials.finish, 'не указан')}`,
    `Ограждение: ${toHumanText(materials.railing, 'не указано')}`,
    `Материал ступеней: ${toHumanText(materials.readyMaterial, 'не указан')}`,
    `Выбранные опции: ${optionsText}`,
    `Рассчитанная цена: ${ctx.calculatedPriceText}`,
    `Lead ID: ${ctx.leadIdText}`
  ];

  if (project) {
    lines.push(
      '',
      `Заявка по проекту: ${project.title}`,
      `Project ID: ${project.projectId}`,
      `Ориентир проекта: ${project.priceText}`,
      `Материалы: ${project.materials}`,
      `Тип: ${project.staircaseType}`,
      `Категория: ${project.category}`,
      `Срок: ${project.leadTime}`
    );
  }

  if (!ctx.isCalculatorLead) {
    lines.push('', 'Расчёт не прикреплён. Требуется ручной созвон и уточнение параметров.');
  }

  return lines.join('\n');
}

function formatLeadEmailHtml(lead) {
  const ctx = resolveLeadContext(lead);
  const staircase = ctx.staircase;
  const materials = ctx.materials;
  const optionsText = ctx.selectedOptions.length ? ctx.selectedOptions.join(', ') : 'не выбраны';
  const project = ctx.projectContext;

  const customerRows = [
    ['Имя', ctx.customer.name],
    ['Телефон', ctx.customer.phone],
    ['Мессенджер', ctx.customer.messenger],
    ['Город', ctx.customer.city],
    ['Комментарий', ctx.customer.comment]
  ];

  const projectRows = [
    ['Источник заявки', ctx.source],
    ['Тип лестницы', staircase.type],
    ['Сценарий', staircase.scenario],
    ['Конфигурация', staircase.configuration],
    ['Тип поворота', staircase.turnType],
    ['Направление поворота', staircase.turnDirection],
    ['Ширина марша', staircase.marchWidth ? `${staircase.marchWidth} мм` : 'не указана'],
    ['Высота этаж-этаж', staircase.floorHeight ? `${staircase.floorHeight} мм` : 'не указана'],
    ['Количество ступеней', staircase.stepCount || 'не указано'],
    ['Подступенок', staircase.riserHeight ? `${staircase.riserHeight} мм` : 'не указан'],
    ['Проступь', staircase.treadDepth ? `${staircase.treadDepth} мм` : 'не указана']
  ];

  const materialRows = [
    ['Материал каркаса', toHumanText(materials.frame, 'не указан')],
    ['Облицовка', toHumanText(materials.cladding, 'не указана')],
    ['Финиш', toHumanText(materials.finish, 'не указан')],
    ['Ограждение', toHumanText(materials.railing, 'не указано')],
    ['Материал ступеней', toHumanText(materials.readyMaterial, 'не указан')],
    ['Выбранные опции', optionsText],
    ['Рассчитанная цена', ctx.calculatedPriceText],
    ['Lead ID', ctx.leadIdText]
  ];
  const projectRowsExtra = project
    ? [
        ['Заявка по проекту', project.title],
        ['Project ID', project.projectId],
        ['Ориентир проекта', project.priceText],
        ['Материалы', project.materials],
        ['Тип', project.staircaseType],
        ['Категория', project.category],
        ['Срок', project.leadTime]
      ]
    : [];

  const tableRows = (rows) => rows
    .map(([label, value]) => `<tr><td style="padding:8px;border:1px solid #ddd;width:38%;"><b>${escapeHtml(label)}</b></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(value)}</td></tr>`)
    .join('');

  const manualNote = ctx.isCalculatorLead
    ? ''
    : '<p style="margin:14px 0 0;color:#7b5c35;"><b>Расчёт не прикреплён.</b> Требуется ручной созвон и уточнение параметров.</p>';

  return `
    <div style="font-family:Arial,sans-serif;color:#211a15;line-height:1.45;">
      <h2 style="margin:0 0 12px;">Новая заявка Tekstura</h2>

      <h3 style="margin:16px 0 8px;">Контакты клиента</h3>
      <table style="border-collapse:collapse;width:100%;max-width:780px;margin-bottom:10px;">${tableRows(customerRows)}</table>

      <h3 style="margin:16px 0 8px;">Параметры проекта</h3>
      <table style="border-collapse:collapse;width:100%;max-width:780px;margin-bottom:10px;">${tableRows(projectRows)}</table>

      <h3 style="margin:16px 0 8px;">Материалы и стоимость</h3>
      <table style="border-collapse:collapse;width:100%;max-width:780px;">${tableRows(materialRows)}</table>
      ${projectRowsExtra.length ? `<h3 style="margin:16px 0 8px;">Контекст проекта</h3><table style="border-collapse:collapse;width:100%;max-width:780px;">${tableRows(projectRowsExtra)}</table>` : ''}

      ${manualNote}
    </div>
  `;
}

async function sendTelegram(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return { ok: false, skipped: true, error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID' };
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    return { ok: false, error: payload?.description || `Telegram API ${response.status}` };
  }

  return { ok: true };
}

async function resolveNotifyEmailRecipient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fallback = (process.env.NOTIFY_EMAIL_TO || '').trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      recipient: fallback,
      source: fallback ? 'fallback-env' : 'missing-config',
      warning: 'missing-supabase-config'
    };
  }

  try {
    const baseUrl = supabaseUrl.replace(/\/$/, '');
    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    };
    const response = await fetch(`${baseUrl}/rest/v1/settings?select=id,notify_email&id=eq.1&limit=1`, {
      headers
    });

    const rowsResponse = await fetch(`${baseUrl}/rest/v1/settings?select=id&order=id.asc&limit=10`, {
      headers: {
        ...headers
      }
    });
    let extraRowsDetected = false;
    if (rowsResponse.ok) {
      const rowsPayload = await rowsResponse.json().catch(() => []);
      extraRowsDetected = Array.isArray(rowsPayload) && rowsPayload.some((row) => Number(row?.id) !== 1);
      if (extraRowsDetected) {
        console.warn('[notify-lead] settings table contains non-canonical rows; only id=1 is used');
      }
    }

    if (!response.ok) {
      console.error('[notify-lead] failed to load settings.notify_email', { status: response.status });
      return {
        recipient: fallback,
        source: fallback ? 'fallback-env' : 'missing-recipient',
        warning: 'settings-fetch-failed'
      };
    }

    const payload = await response.json().catch(() => []);
    const fromSettings = payload?.[0]?.notify_email;
    const settingsRecipient = (fromSettings || '').trim();
    if (settingsRecipient) {
      return {
        recipient: settingsRecipient,
        source: 'settings.id=1',
        warning: extraRowsDetected ? 'extra-settings-rows-detected' : null
      };
    }
    return {
      recipient: fallback,
      source: fallback ? 'fallback-env' : 'missing-recipient',
      warning: 'settings-notify-email-empty'
    };
  } catch (error) {
    console.error('[notify-lead] settings notify_email fetch error', error?.message || error);
    return {
      recipient: fallback,
      source: fallback ? 'fallback-env' : 'missing-recipient',
      warning: 'settings-fetch-exception'
    };
  }
}

async function sendEmail(html, recipientEmail, preflight = null) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (recipientEmail || '').trim();
  const from = process.env.NOTIFY_EMAIL_FROM || 'Tekstura <onboarding@resend.dev>';

  if (preflight?.emailChannelState === 'blocked') {
    return {
      ok: false,
      skipped: true,
      error: preflight.emailError || 'email-channel-blocked',
      reason: 'preflight-blocked'
    };
  }

  if (!to) {
    return { ok: false, skipped: true, error: 'missing-recipient', reason: 'preflight-recipient-check' };
  }

  if (!apiKey) {
    return { ok: false, skipped: true, error: 'missing-resend-api-key', reason: 'preflight-api-key-check' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Новая заявка Tekstura',
      html
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      error: payload?.message || `Resend API ${response.status}`,
      reason: `resend-http-${response.status}`
    };
  }

  return { ok: true, reason: 'sent' };
}

async function sendWhatsApp(message) {
  const apiUrl = process.env.WHATSAPP_API_URL || DEFAULT_WHATSAPP_API_URL;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const to = process.env.WHATSAPP_TO;

  if (!accessToken || !phoneNumberId || !to) {
    return {
      ok: false,
      skipped: true,
      error: 'Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TO'
    };
  }

  const url = `${apiUrl.replace(/\/$/, '')}/v22.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message.slice(0, 4000) }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false, error: payload?.error?.message || `WhatsApp API ${response.status}` };
  }

  return { ok: true };
}

async function persistNotificationLog(leadId, channel, status, errorMessage) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || !leadId) return;

  try {
    await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/lead_notification_logs`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        lead_id: String(leadId),
        channel,
        status,
        error_message: errorMessage || null,
        delivered_at: status === 'sent' ? new Date().toISOString() : null
      })
    });
  } catch (error) {
    console.error('Failed to persist notification log', { leadId, channel, error: error?.message || error });
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lead = req.body?.lead;

  if (!lead || !lead.phone) {
    return res.status(400).json({ error: 'lead payload with phone is required' });
  }

  const message = formatLeadMessage(lead);
  const emailHtml = formatLeadEmailHtml(lead);
  const notifyEmail = await resolveNotifyEmailRecipient();
  const notifyEmailTo = notifyEmail.recipient;
  const emailPreflight = buildEmailPreflight(notifyEmail);
  if (notifyEmail.warning) {
    console.warn('[notify-lead] email recipient resolution warning', {
      warning: notifyEmail.warning,
      source: notifyEmail.source,
      recipient: notifyEmailTo || null
    });
  }

  if (emailPreflight.emailChannelState !== 'ready') {
    console.warn('[notify-lead] email preflight state', {
      leadId: lead.id,
      state: emailPreflight.emailChannelState,
      errors: emailPreflight.errors,
      warnings: emailPreflight.warnings,
      recipientSource: emailPreflight.recipientSource,
      senderConfigured: emailPreflight.senderConfigured,
      senderUsesResendDev: emailPreflight.senderUsesResendDev
    });
  }

  const deliveryResults = {
    telegram: await sendTelegram(message),
    email: await sendEmail(emailHtml, notifyEmailTo, emailPreflight),
    whatsapp: await sendWhatsApp(message)
  };

  for (const [channel, result] of Object.entries(deliveryResults)) {
    const status = result.ok ? 'sent' : (result.skipped ? 'skipped' : 'failed');
    const errorMessage = result.error || null;

    if (!result.ok) {
      console.error(`[notify-lead] ${channel} delivery issue`, {
        leadId: lead.id,
        channel,
        status,
        error: errorMessage,
        recipientSource: channel === 'email' ? notifyEmail.source : undefined,
        recipient: channel === 'email' ? (notifyEmailTo || null) : undefined
      });
    }

    const enrichedErrorMessage = channel === 'email' && !result.ok
      ? [errorMessage, `recipient_source=${notifyEmail.source}`, notifyEmail.warning ? `recipient_warning=${notifyEmail.warning}` : null]
        .filter(Boolean)
        .join(' | ')
      : errorMessage;
    await persistNotificationLog(lead.id, channel, status, enrichedErrorMessage);
  }

  return res.status(200).json({
    ok: true,
    leadSaved: true,
    deliveryResults,
    notifyRecipient: {
      recipient: notifyEmailTo || null,
      source: notifyEmail.source,
      warning: notifyEmail.warning || null
    },
    senderConfigured: emailPreflight.senderConfigured,
    senderUsesResendDev: emailPreflight.senderUsesResendDev,
    recipientResolved: emailPreflight.recipientResolved,
    emailChannelState: emailPreflight.emailChannelState,
    emailError: deliveryResults.email?.ok
      ? null
      : (deliveryResults.email?.error || emailPreflight.emailError || 'email-delivery-failed')
  });
};
