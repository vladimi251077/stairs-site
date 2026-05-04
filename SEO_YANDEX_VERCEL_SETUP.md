# SEO статистика Яндекс Вебмастера в админке на Vercel

Добавлен закрытый раздел:

```text
/admin/seo
```

Он работает через текущий вход Supabase Auth и показывает:

- показы;
- клики;
- CTR;
- среднюю позицию;
- группу “Деревянные лестницы Казань”;
- новые / неотслеживаемые запросы;
- историю синхронизации.

## Что нужно сделать после merge

### 1. Применить миграцию Supabase

В Supabase SQL Editor выполнить файл:

```text
supabase/migrations/20260504_seo_yandex_webmaster_stats.sql
```

Он создаёт таблицы:

```text
seo_sync_runs
seo_query_stats
seo_tracked_queries
```

### 2. Добавить переменные окружения в Vercel

Vercel → Project → Settings → Environment Variables:

```text
SUPABASE_SERVICE_ROLE_KEY=...
YANDEX_WEBMASTER_OAUTH_TOKEN=...
SEO_SYNC_SECRET=...
CRON_SECRET=...                 # можно тот же секрет, что и SEO_SYNC_SECRET
YANDEX_WEBMASTER_USER_ID=...    # необязательно, функция попробует получить сама
```

Важно: `SUPABASE_SERVICE_ROLE_KEY` и `YANDEX_WEBMASTER_OAUTH_TOKEN` нельзя хранить в браузере или в коде.

### 3. Проверить ручную синхронизацию

После деплоя открыть:

```text
https://tekstura.shop/api/seo-sync?secret=ВАШ_SEO_SYNC_SECRET
```

Если всё настроено правильно, появится JSON с `ok: true`.

### 4. Открыть админку

```text
https://tekstura.shop/admin/seo
```

Войти тем же логином и паролем, что и в обычную админку.

### 5. Автообновление

В `vercel.json` добавлен cron:

```text
15 3 * * *
```

Это ежедневная синхронизация в 03:15 UTC.
