const DEFAULT_WHATSAPP_API_URL = 'https://graph.facebook.com';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatLeadMessage(lead) {
  const optionsLabels = Array.isArray(lead?.options_json?.labels)
    ? lead.options_json.labels.map((option) => option?.label || option).filter(Boolean)
    : [];
  const selectedOptions = lead?.options_json?.extras || [];

  return [
    'Новая заявка Tekstura',
    `Имя: ${lead?.name || '-'}`,
    `Телефон: ${lead?.phone || '-'}`,
    `Мессенджер: ${lead?.messenger || '-'}`,
    `Город: ${lead?.city || '-'}`,
    `Комментарий: ${lead?.comment || '-'}`,
    `Тип лестницы: ${lead?.staircase_type || '-'}`,
    `Рассчитанная цена: ${lead?.calculated_price || 0} ₽`,
    `Опции: ${optionsLabels.join(', ') || 'нет'}`,
    `Выбранные опции: ${JSON.stringify(selectedOptions)}`,
    `Материалы: ${JSON.stringify(lead?.materials_json?.summary || {})}`,
    `Геометрия: ${JSON.stringify(lead?.dimensions_json?.geometry || {})}`
  ].join('\n');
}

function formatLeadEmailHtml(lead) {
  const optionsLabels = Array.isArray(lead?.options_json?.labels)
    ? lead.options_json.labels.map((option) => option?.label || option).filter(Boolean)
    : [];
  const selectedOptions = lead?.options_json?.extras || [];

  const rows = [
    ['Имя', lead?.name || '-'],
    ['Телефон', lead?.phone || '-'],
    ['Мессенджер', lead?.messenger || '-'],
    ['Город', lead?.city || '-'],
    ['Комментарий', lead?.comment || '-'],
    ['Тип лестницы', lead?.staircase_type || '-'],
    ['Рассчитанная цена', `${lead?.calculated_price || 0} ₽`],
    ['Опции', optionsLabels.join(', ') || 'нет'],
    ['Выбранные опции', JSON.stringify(selectedOptions)],
    ['Материалы', JSON.stringify(lead?.materials_json?.summary || {})],
    ['Геометрия', JSON.stringify(lead?.dimensions_json?.geometry || {})]
  ];

  const tableRows = rows
    .map(([label, value]) => `<tr><td style="padding:8px;border:1px solid #ddd;"><b>${escapeHtml(label)}</b></td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(value)}</td></tr>`)
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#211a15;">
      <h2>Новая заявка Tekstura</h2>
      <table style="border-collapse:collapse;width:100%;max-width:760px;">${tableRows}</table>
      <p style="margin-top:16px;color:#666;">Lead ID: ${escapeHtml(lead?.id || '')}</p>
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

  if (!supabaseUrl || !serviceRoleKey) {
    return process.env.NOTIFY_EMAIL_TO || '';
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/settings?select=notify_email&id=eq.1&limit=1`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      }
    });

    if (!response.ok) {
      console.error('[notify-lead] failed to load settings.notify_email', { status: response.status });
      return process.env.NOTIFY_EMAIL_TO || '';
    }

    const payload = await response.json().catch(() => []);
    const fromSettings = payload?.[0]?.notify_email;
    return (fromSettings || process.env.NOTIFY_EMAIL_TO || '').trim();
  } catch (error) {
    console.error('[notify-lead] settings notify_email fetch error', error?.message || error);
    return process.env.NOTIFY_EMAIL_TO || '';
  }
}

async function sendEmail(html, recipientEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (recipientEmail || '').trim();
  const from = process.env.NOTIFY_EMAIL_FROM || 'Tekstura <onboarding@resend.dev>';

  if (!to) {
    return { ok: false, skipped: true, error: 'email-not-configured' };
  }

  if (!apiKey) {
    return { ok: false, skipped: true, error: 'Missing RESEND_API_KEY' };
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
    return { ok: false, error: payload?.message || `Resend API ${response.status}` };
  }

  return { ok: true };
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
  const notifyEmailTo = await resolveNotifyEmailRecipient();

  const deliveryResults = {
    telegram: await sendTelegram(message),
    email: await sendEmail(emailHtml, notifyEmailTo),
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
        error: errorMessage
      });
    }

    await persistNotificationLog(lead.id, channel, status, errorMessage);
  }

  return res.status(200).json({
    ok: true,
    leadSaved: true,
    deliveryResults
  });
};
