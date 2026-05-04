# SEO статистика Яндекс Вебмастера в админке

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

## 2. Добавить переменные окружения в Netlify

В Netlify → Project configuration → Environment variables добавить:

```text
SUPABASE_SERVICE_ROLE_KEY=...
YANDEX_WEBMASTER_OAUTH_TOKEN=...
YANDEX_WEBMASTER_USER_ID=...   # необязательно, функция попробует получить сама
SEO_SYNC_SECRET=...             # любая длинная секретная строка
```

Важно: `SUPABASE_SERVICE_ROLE_KEY` и `YANDEX_WEBMASTER_OAUTH_TOKEN` нельзя хранить в браузере или в коде.

## 3. Где взять OAuth token Яндекса

Нужен OAuth-токен Яндекса с доступом к Яндекс Вебмастеру.
После добавления токена можно вручную проверить синхронизацию:

```text
/admin/api/seo-sync?secret=ВАШ_SEO_SYNC_SECRET
```

## 4. Автообновление

Файл:

```text
netlify/functions/seo-sync-scheduled.mjs
```

запускает синхронизацию каждый день в 03:15 UTC.

## 5. Админка

Открыть:

```text
/admin/seo
```

Войти тем же логином и паролем, что и в обычную админку.
