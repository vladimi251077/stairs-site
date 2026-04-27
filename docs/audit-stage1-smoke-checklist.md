# Tekstura audit stage 1 smoke checklist

Этот чек-лист нужен для маленького PR с critical payload safeguard. Он не заменяет полный QA калькулятора и не разрешает merge PR #46/#49/#73/#74.

## Что изменено в stage 1

- `calculator-critical-fixes.js` сохраняет черновой payload калькулятора перед переходом в заявку, если штатный payload ещё не сформирован.
- Engineering fallback `Отправить размеры на инженерную проверку` теперь должен передавать partial payload через `sessionStorage` и `?calc=`.
- `request.html` остаётся без изменения и читает payload старым способом: сначала `?calc=`, затем `sessionStorage`.
- Добавлен минимальный `package.json` с `npm run check` для синтаксиса JS-файлов.

## Обязательные проверки перед merge stage 1

### Syntax

```bash
npm run check
```

### Calculator → request

1. Открыть `/calculator.html`.
2. Выбрать `Пустой проём`.
3. Заполнить ключевые размеры так, чтобы геометрия не прошла онлайн-подбор.
4. Нажать `Рассчитать геометрию`.
5. Нажать `Отправить размеры на инженерную проверку`.
6. Проверить `/request.html`: блок `Сводка расчёта` не должен быть пустым, должен показывать тип лестницы/размеры/статус инженерной проверки.

### Draft request guard

1. Открыть `/calculator.html`.
2. Не проходить полный расчёт до конца.
3. Если кнопка `Перейти к заявке` доступна из состояния страницы, нажать её.
4. Проверить, что в `request.html` приходит draft payload или заявка остаётся ручной без JS-ошибки.

### Existing production flow

1. Пройти валидный сценарий `Пустой проём + прямая`.
2. Нажать `Рассчитать материалы и стоимость`.
3. Нажать `Перейти к заявке`.
4. Проверить, что штатный payload с ценой не потерян.

### Browser console

На `/calculator.html` и `/request.html` проверить:

- нет `Uncaught TypeError`;
- нет `addEventListener` на `null`;
- нет syntax/module errors;
- нет 404 на `calculator-critical-fixes.js`.

## Что не входит в этот PR

- Не стабилизируется geometry engine.
- Не внедряется PR #72.
- Не добавляется UI scope/extras.
- Не переписывается `request.html`.
- Не меняется Supabase schema.
- Не трогаются preview PR #46/#49/#73/#74.
