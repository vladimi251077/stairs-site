# Tekstura SVG preview cards source map

Экспорт создан из реального SVG-конструктора замеров Tekstura: `vladimi251077/tekstura-zamery/drawing-bridge.js`. В этом репозитории сохранён переносимый экспортёр `svg-constructor/export-tekstura-preview-cards.mjs`; он меняет только фон, цвета ступеней/контуров и рамку карточки. Геометрия маршей, поворотной зоны, площадки, делений ступеней и забежных полигонов взята из функций конструктора замеров.

Общий скриншот визуального результата: `docs/assets/calculator-preview/screenshots/tekstura-svg-preview-cards-overview.png`.

| Карточка | SVG | Скриншот SVG | Функция/ветка | Подтверждение геометрии |
| --- | --- | --- | --- | --- |
| `stair-straight-card` | `docs/assets/calculator-preview/svg/stair-straight-card.svg` | `docs/assets/calculator-preview/screenshots/stair-straight-card.png` | `buildGeometry → ready_straight` | Прямая лестница: один прямой марш flight1 с делениями ступеней по всей длине. |
| `stair-turn-90-card` | `docs/assets/calculator-preview/svg/stair-turn-90-card.svg` | `docs/assets/calculator-preview/screenshots/stair-turn-90-card.png` | `buildGeometry → ready_l_right_landing` | Г-образная лестница с площадкой: два перпендикулярных марша и прямоугольная поворотная площадка turn. |
| `stair-turn-180-card` | `docs/assets/calculator-preview/svg/stair-turn-180-card.svg` | `docs/assets/calculator-preview/screenshots/stair-turn-180-card.png` | `buildGeometry → ready_u_landing_left` | П-образная лестница с площадкой: два параллельных марша flight1/flight2 и общий разворотный прямоугольник turn между ними. |
| `stair-landing-card` | `docs/assets/calculator-preview/svg/stair-landing-card.svg` | `docs/assets/calculator-preview/screenshots/stair-landing-card.png` | `buildGeometry → ready_l_right_winder → buildWinderPolygons` | Г-образная лестница с забежными: два перпендикулярных марша и 5 клиновидных winder-step полигонов в углу. |
| `stair-winder-card` | `docs/assets/calculator-preview/svg/stair-winder-card.svg` | `docs/assets/calculator-preview/screenshots/stair-winder-card.png` | `buildGeometry → ready_u_winder_left → buildWinderPolygons` | П-образная лестница с забежными: два параллельных марша и 6 клиновидных winder-step полигонов разворота 180° без прямоугольной площадки. |

## Найденные функции в источнике замеров

- `VARIANTS`: содержит ready-варианты прямой, Г-образной с площадкой/забежными и П-образной с площадкой/забежными.
- `buildGeometry`: строит прямоугольники `flight1`, `flight2`, `turn` и деления ступеней.
- `addTreadsVertical` / `addTreadsHorizontal`: генерируют линии ступеней по количеству ступеней марша.
- `buildWinderPolygons`: генерирует веер забежных ступеней внутри поворотной зоны.
- `renderSvg`, `renderRect`, `renderLine`, `renderWinder`: собирают итоговый SVG-план сверху без 3D, стрелок и видимого текста внутри изображения.
