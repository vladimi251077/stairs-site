# PR74 calculator smoke checklist

Этот PR берёт калькулятор из PR #74 как основу и добавляет payload guard для перехода в заявку.

## Scope

Входит:
- clean Step 1 из PR #74;
- карточки сценария / типа лестницы / поворота;
- скрытый блок схем через `<details>`;
- `scopeWork` для готового основания;
- `extras` для дополнительных опций;
- поля `landingLength`, `landingWidth`, `winderCount`;
- preview UI/price scripts из PR #74;
- `calculator-critical-fixes.js` для сохранения partial payload в `request.html`.

Не входит:
- merge PR #46;
- merge PR #49;
- merge PR #72;
- merge PR #73;
- engine refactor;
- Supabase schema changes;
- `request.html` rewrite.

## Commands

```bash
npm run check
```

## Calculator scenarios

### Empty opening

- Пустой проём + прямая
- Пустой проём + Г-образная с площадкой
- Пустой проём + Г-образная с забежными
- Пустой проём + П-образная с площадкой
- Пустой проём + П-образная с забежными

Проверить:
- поля поворота появляются только для Г/П;
- поля площадки появляются для `С площадкой`;
- поле количества забежных появляется для `С забежными`;
- `Рассчитать геометрию` не даёт console error;
- `Отправить размеры на инженерную проверку` передаёт payload в `/request.html`.

### Ready frame / ready base

- Готовое основание + металлокаркас
- Готовое основание + бетонное основание
- Прямая / Г / П
- С площадкой / с забежными
- Открытая / закрытая
- Только ступени
- Ступени + подступенки
- Ограждение
- Обшивка основания
- Подсветка
- Монтаж
- Материал ступеней: ясень / дуб / сосна / MDF

Проверить:
- реальные значения по умолчанию стоят в `value`, а не только placeholder;
- disabled controls не мешают цене;
- preview price меняется при опциях;
- штатный payload после `Перейти к заявке` не теряет цену, если основной configurator её сформировал.

## Request payload

Проверить переходы:

1. `Не знаю / нужна помощь инженера`.
2. `Не знаю размеры — отправить заявку`.
3. `Отправить размеры на инженерную проверку` после invalid geometry.
4. `Перейти к заявке` после полноценного расчёта.

Во всех случаях `/request.html` должен показывать сводку расчёта или хотя бы partial engineering payload, а не пустой ручной lead без контекста.

## Console

На `/calculator.html` и `/request.html`:
- нет `Uncaught TypeError`;
- нет `addEventListener` на `null`;
- нет 404 на `calculator-ui-preview.css`;
- нет 404 на `calculator-ui-preview.js`;
- нет 404 на `calculator-price-options-preview.js`;
- нет 404 на `calculator-critical-fixes.js`.

## Mobile widths

Проверить:
- 360px;
- 390px;
- 430px;
- 768px;
- 1024px;
- desktop.

На каждой ширине:
- нет horizontal scroll;
- карточки не слипаются;
- текст не обрезается;
- CTA видны;
- форма готового основания помещается;
- footer не ломает страницу.
