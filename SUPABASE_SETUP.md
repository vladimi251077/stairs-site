# Supabase подключение для stairs-site

## 1) Подготовка базы
1. Открой Supabase проект: `https://rhnlykqqhwweaywjopvm.supabase.co`.
2. В SQL Editor выполни файл `supabase/schema.sql`.
3. В Authentication → Users создай администратора (email + password).

## 2) Что уже подключено в коде
В `index.html` и `admin/index.html` уже зашиты:
- `SUPABASE_URL = https://rhnlykqqhwweaywjopvm.supabase.co`
- `SUPABASE_ANON_KEY = sb_publishable_kzUBUDdLy1gWGvs-o5jFsw_xkg5-Sqv`

## 3) Структура данных
- `settings` — телефон, мессенджеры, заголовки/тексты hero, logo, heroImage.
- `services` — услуги (title, description, sort_order).
- `projects` — проекты (title, description, image, price).

## 4) Как это работает
- `index.html` загружает контент динамически из Supabase.
- `admin/index.html` даёт вход и редактирование всех сущностей.
- Изображения загружаются в Supabase Storage bucket `site-assets`.
- На сайте включено автообновление через Supabase Realtime (settings/services/projects).
