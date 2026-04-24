# Email setup checklist (Resend + Vercel)

Этот список покрывает только ручные шаги во внешних сервисах, которые нельзя завершить кодом из репозитория.

## 1) Подтвердить домен отправителя в Resend

1. В Resend откройте **Domains**.
2. Добавьте рабочий домен/поддомен для отправки (например, `mail.tekstura.shop`).
3. Примените DNS-записи (SPF/DKIM), дождитесь статуса **Verified**.
4. Подготовьте sender в формате `Tekstura <notify@your-domain>`.

> Пока используется `onboarding@resend.dev`, канал считается техническим и ограниченным для production.

## 2) Настроить переменные в Vercel

В Project → Settings → Environment Variables добавьте:

- `RESEND_API_KEY` — API ключ Resend.
- `NOTIFY_EMAIL_FROM` — подтверждённый sender, например `Tekstura <notify@mail.tekstura.shop>`.
- `NOTIFY_EMAIL_TO` — fallback адрес получателя, если `settings.notify_email` ещё пустой.

## 3) Перезапустить production

После обновления env vars выполните redeploy production в Vercel.

## 4) Сохранить рабочий email в админке

В админке заполните `settings.notify_email` (строка `id=1`) — это основной адрес получателя уведомлений.

## 5) Отправить тестовую заявку

1. Откройте `/request.html`.
2. Отправьте тестовую заявку.
3. Проверьте:
   - лид сохранён в `leads` / `calculator_requests`;
   - `/api/notify-lead` возвращает `emailChannelState` (`ready`/`degraded`/`blocked`);
   - при проблеме видны `emailError`, `senderConfigured`, `senderUsesResendDev`, `recipientResolved`.
