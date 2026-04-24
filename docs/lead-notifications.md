# Lead notifications setup (Tekstura)

## What is implemented

1. `request.html` still writes leads to `calculator_requests` from frontend.
2. After successful save, frontend calls `/api/notify-lead`.
3. `/api/notify-lead` sends notifications to Telegram, Email, and WhatsApp (official API path structure).
4. Delivery result per channel is persisted to `lead_notification_logs`.
5. If one channel fails or is not configured, the lead still remains saved.

## Required environment variables

### Existing Supabase variables
- `SUPABASE_URL` (server-side URL for REST writes to logs)
- `SUPABASE_SERVICE_ROLE_KEY` (server-side key to write notification logs)

### Telegram
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

### Email (Resend)
- `RESEND_API_KEY`
- `NOTIFY_EMAIL_TO` (fallback, если `settings.notify_email` не заполнен)
- `NOTIFY_EMAIL_FROM` (optional, default: `Tekstura <onboarding@resend.dev>`)

## Логика адресата email

1. Основной получатель: `settings.notify_email` (из таблицы `settings`, запись `id=1`).
2. Fallback: `NOTIFY_EMAIL_TO`.
3. Если оба пустые, лид сохраняется как обычно, email канал отмечается как `skipped` с ошибкой `email-not-configured`.
4. В ответе `/api/notify-lead` возвращается `emailRecipientResolution` (`recipient`, `source`, `reason`) для диагностики.

### WhatsApp (Meta Cloud API)
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TO`
- `WHATSAPP_API_URL` (optional, default: `https://graph.facebook.com`)

## Notes on WhatsApp provisioning

The code uses the official Cloud API endpoint shape:
`POST {WHATSAPP_API_URL}/v22.0/{WHATSAPP_PHONE_NUMBER_ID}/messages`

Actual delivery requires a properly provisioned Meta/WhatsApp Business account,
valid access token, and approved messaging setup. If env vars are missing or API rejects,
this channel is logged as `skipped`/`failed` while Telegram/Email continue.
