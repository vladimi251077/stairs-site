(() => {
  const variants = [
    "Прямая",
    "Г-образная левая",
    "Г-образная правая",
    "П-образная с площадкой",
    "П-образная с забежными",
    "Винтовая",
  ];

  const emptyFields = [
    ["height_clean_to_clean_mm", "Высота", "3267", "мм"],
    ["opening_length_mm", "Длина проёма", "2223", "мм"],
    ["opening_width_mm", "Ширина проёма", "2223", "мм"],
    ["slab_thickness_mm", "Толщина проёма", "120", "мм"],
    ["flight1_width_mm", "Ширина марша 1", "826", "мм"],
    ["flight2_width_mm", "Ширина марша 2", "941", "мм"],
    ["visual_steps_1", "Ступени марш 1", "8", "шт"],
    ["visual_steps_2", "Ступени марш 2", "4", "шт"],
    ["visual_turn_steps", "Забежные / площадка", "5", "шт"],
    ["visual_turn_angle", "Угол поворота", "90", "°"],
    ["visual_balustrade", "Балюстрада", "Да", ""],
  ];

  const frameFields = [
    ["height_clean_to_clean_mm", "Высота", "3267", "мм"],
    ["flight1_width_mm", "Ширина марша 1", "826", "мм"],
    ["flight2_width_mm", "Ширина марша 2", "941", "мм"],
    ["visual_steps_1", "Ступени марш 1", "8", "шт"],
    ["visual_steps_2", "Ступени марш 2", "4", "шт"],
    ["visual_platform", "Размер площадки / забежных", "1389 × 941", "мм"],
    ["visual_riser", "Подступёнок", "180", "мм"],
    ["visual_tread", "Глубина проступи", "275", "мм"],
    ["visual_turn_angle", "Угол", "90", "°"],
    ["visual_balustrade", "Ограждение", "Да", ""],
    ["visual_start", "Старт", "Снизу", ""],
    ["visual_finish", "Финиш", "Справа", ""],
  ];

  function $(selector) {
    return document.querySelector(selector);
  }

  function getForm() {
    return $("#measurement-form");
  }

  function getInputValue(name, fallback) {
    const input = getForm()?.querySelector(`[name="${name}"]`);
    return input?.value || fallback || "";
  }

  function setFormValue(name, value) {
    const form = getForm();
    const input = form?.querySelector(`[name="${name}"]`);
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    let hidden = form?.querySelector(`[data-visual-hidden="${name}"]`);
    if (!hidden && form) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.dataset.visualHidden = name;
      hidden.name = name;
      form.appendChild(hidden);
    }
    if (hidden) hidden.value = value;
  }

  function fieldBox(name, label, fallback, unit, cls) {
    const value = getInputValue(name, fallback);
    return `
      <label class="scheme-field ${cls || ""}" data-field="${name}">
        <span>${label}</span>
        <div class="scheme-input-row">
          <input data-scheme-input="${name}" value="${value}" />
          ${unit ? `<em>${unit}</em>` : ""}
        </div>
      </label>
    `;
  }

  function fieldSummary(fields) {
    return fields
      .slice(0, 10)
      .map(([name, label, fallback, unit]) => {
        const value = getInputValue(name, fallback);
        return `<div><span>${label}</span><b>${value}${unit ? ` ${unit}` : ""}</b></div>`;
      })
      .join("");
  }

  function renderScheme(mode = "empty") {
    const fields = mode === "frame" ? frameFields : emptyFields;
    const title = mode === "frame" ? "Что проверить по каркасу" : "Что обязательно замерить";
    const hint = mode === "frame"
      ? "Проверяем фактический каркас: ширины маршей, ступени, подступёнок, проступь, старт и финиш."
      : "Заполняйте только размеры пустого проёма. Поля меняются по выбранной схеме, лишние скрыты.";

    return `
      <section class="visual-measure-card" data-mode="${mode}">
        <div class="visual-mode-switch">
          <button type="button" data-visual-mode="empty" class="${mode === "empty" ? "active" : ""}">Пустой проём</button>
          <button type="button" data-visual-mode="frame" class="${mode === "frame" ? "active" : ""}">Готовый каркас</button>
        </div>

        <div class="visual-top-row">
          <label class="variant-select">
            <span>Вариант лестницы</span>
            <select id="visual-stair-variant">
              ${variants.map((item) => `<option ${item === "Г-образная левая" ? "selected" : ""}>${item}</option>`).join("")}
            </select>
          </label>
          <div class="visual-hint">Поля и схема меняются от выбранного раздела и варианта. Лишние поля скрыты.</div>
        </div>

        <div class="visual-workspace">
          <div class="scheme-canvas">
            <div class="scheme-title">${mode === "frame" ? "Схема готового каркаса" : "Схема пустого проёма"}</div>
            <svg viewBox="0 0 620 520" role="img" aria-label="Схема лестницы" class="stair-svg">
              <defs>
                <marker id="arrow-end" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#7386aa"></path>
                </marker>
              </defs>
              <rect x="190" y="80" width="270" height="44" fill="none" stroke="#0b1736" stroke-width="4" />
              <rect x="190" y="120" width="84" height="250" fill="none" stroke="#0b1736" stroke-width="4" />
              <path d="M274 120 L360 120 L360 250 L274 250" fill="none" stroke="#0b1736" stroke-width="4" />
              <path d="M274 120 L360 250 M310 120 L360 250 M340 120 L360 250 M274 155 L360 250 M274 190 L360 250 M274 225 L360 250" stroke="#8aa0c5" stroke-width="1.4" />
              ${Array.from({ length: 8 }).map((_, i) => `<line x1="190" y1="${150 + i * 27}" x2="274" y2="${150 + i * 27}" stroke="#8aa0c5" stroke-width="1.4" />`).join("")}
              ${Array.from({ length: 4 }).map((_, i) => `<line x1="${235 + i * 45}" y1="80" x2="${235 + i * 45}" y2="124" stroke="#8aa0c5" stroke-width="1.4" />`).join("")}
              <path d="M225 390 C240 420 280 420 300 392" fill="none" stroke="#7386aa" stroke-width="2" marker-end="url(#arrow-end)" />
              <line x1="150" y1="80" x2="150" y2="370" stroke="#7386aa" stroke-width="1.5" marker-end="url(#arrow-end)" />
              <line x1="150" y1="370" x2="150" y2="80" stroke="#7386aa" stroke-width="1.5" marker-end="url(#arrow-end)" />
              <line x1="190" y1="50" x2="460" y2="50" stroke="#7386aa" stroke-width="1.5" marker-end="url(#arrow-end)" />
              <line x1="460" y1="50" x2="190" y2="50" stroke="#7386aa" stroke-width="1.5" marker-end="url(#arrow-end)" />
              <line x1="510" y1="80" x2="510" y2="370" stroke="#7386aa" stroke-width="1.5" marker-end="url(#arrow-end)" />
              <line x1="510" y1="370" x2="510" y2="80" stroke="#7386aa" stroke-width="1.5" marker-end="url(#arrow-end)" />
              <text x="205" y="398" fill="#33466f" font-size="18" font-weight="700">Старт</text>
              <text x="410" y="70" fill="#33466f" font-size="18" font-weight="700">Выход</text>
            </svg>

            ${fieldBox("height_clean_to_clean_mm", "Высота", "3267", "мм", "pos-height")}
            ${mode === "empty" ? fieldBox("opening_length_mm", "Длина проёма", "2223", "мм", "pos-top") : fieldBox("flight2_width_mm", "Ширина марша 2", "941", "мм", "pos-top")}
            ${mode === "empty" ? fieldBox("opening_width_mm", "Ширина проёма", "2223", "мм", "pos-right") : fieldBox("visual_steps_2", "Ступени марш 2", "4", "шт", "pos-right")}
            ${mode === "empty" ? fieldBox("slab_thickness_mm", "Толщина проёма", "120", "мм", "pos-thickness") : fieldBox("visual_platform", "Размер площадки / забежных", "1389 × 941", "мм", "pos-thickness")}
            ${fieldBox("flight1_width_mm", "Ширина марша 1", "826", "мм", "pos-bottom")}
            ${fieldBox("visual_steps_1", "Ступени марш 1", "8", "шт", "pos-steps1")}
            ${mode === "empty" ? fieldBox("visual_turn_steps", "Забежные / площадка", "5", "шт", "pos-center") : fieldBox("visual_riser", "Подступёнок", "180", "мм", "pos-center")}
            ${mode === "frame" ? fieldBox("visual_tread", "Глубина проступи", "275", "мм", "pos-tread") : ""}
            ${fieldBox("visual_turn_angle", "Угол", "90", "°", "pos-angle")}
            ${fieldBox("visual_balustrade", mode === "frame" ? "Ограждение" : "Балюстрада", "Да", "", "pos-balustrade")}
          </div>

          <aside class="visual-summary">
            <h3>${title}</h3>
            <div class="summary-list">${fieldSummary(fields)}</div>
            <p>${hint}</p>
          </aside>
        </div>
      </section>
    `;
  }

  function injectVisualStyles() {
    if ($("#visual-scheme-styles")) return;
    const style = document.createElement("style");
    style.id = "visual-scheme-styles";
    style.textContent = `
      .visual-measure-card { margin-bottom: 22px; border: 1px solid #dbe3ef; border-radius: 28px; background: #fff; padding: 18px; box-shadow: 0 18px 45px rgba(15,23,42,.07); }
      .visual-mode-switch { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #d5deeb; border-radius: 16px; overflow: hidden; margin-bottom: 18px; }
      .visual-mode-switch button { height: 48px; border: 0; background: #fff; color: #0b1736; font-weight: 800; cursor: pointer; }
      .visual-mode-switch button.active { background: #071432; color: #fff; }
      .visual-top-row { display: flex; align-items: end; gap: 18px; margin-bottom: 18px; flex-wrap: wrap; }
      .variant-select span { display: block; margin-bottom: 6px; font-size: 13px; color: #344563; font-weight: 800; }
      .variant-select select { min-width: 240px; height: 44px; border: 1px solid #d5deeb; border-radius: 14px; padding: 0 14px; font-weight: 800; color: #0b1736; background: #fff; }
      .visual-hint { max-width: 430px; border-radius: 16px; background: #f1f6ff; color: #30496f; padding: 12px 14px; font-size: 13px; font-weight: 700; }
      .visual-workspace { display: grid; grid-template-columns: minmax(520px, 1fr) 300px; gap: 18px; align-items: stretch; }
      .scheme-canvas { position: relative; min-height: 620px; border: 1px solid #dbe3ef; border-radius: 24px; background: linear-gradient(180deg, #fff, #f8fbff); overflow: hidden; }
      .scheme-title { position: absolute; top: 18px; left: 22px; z-index: 3; font-weight: 900; color: #0b1736; }
      .stair-svg { position: absolute; inset: 48px 24px 70px 24px; width: calc(100% - 48px); height: calc(100% - 118px); }
      .scheme-field { position: absolute; z-index: 5; min-width: 126px; display: block; }
      .scheme-field span { display: block; margin-bottom: 5px; font-size: 12px; font-weight: 900; color: #274060; }
      .scheme-input-row { display: flex; align-items: center; gap: 6px; }
      .scheme-input-row input { width: 100px; height: 42px; border: 1px solid #d5deeb; border-radius: 12px; background: #fff; text-align: center; font-weight: 900; color: #0b1736; box-shadow: 0 6px 18px rgba(15,23,42,.06); }
      .scheme-input-row em { font-style: normal; font-size: 12px; color: #375274; font-weight: 800; }
      .pos-height { left: 20px; top: 285px; }
      .pos-top { left: 42%; top: 24px; transform: translateX(-50%); }
      .pos-right { right: 18px; top: 250px; }
      .pos-thickness { right: 18px; bottom: 118px; }
      .pos-bottom { left: 38%; bottom: 82px; transform: translateX(-50%); }
      .pos-steps1 { left: 36%; bottom: 20px; transform: translateX(-50%); }
      .pos-center { left: 52%; top: 300px; transform: translateX(-50%); }
      .pos-tread { left: 52%; top: 390px; transform: translateX(-50%); }
      .pos-angle { left: 54%; bottom: 18px; }
      .pos-balustrade { left: 20px; bottom: 80px; }
      .visual-summary { border: 1px solid #dbe3ef; border-radius: 24px; padding: 18px; background: #fff; }
      .visual-summary h3 { margin: 0 0 14px; color: #0b1736; }
      .summary-list { display: grid; gap: 10px; }
      .summary-list div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #eef2f7; padding-bottom: 8px; font-size: 13px; color: #42526e; }
      .summary-list b { color: #0b1736; white-space: nowrap; }
      .visual-summary p { margin-top: 18px; border-radius: 16px; background: #f1f6ff; color: #30496f; padding: 12px; font-size: 13px; font-weight: 700; }
      .sizes-grid-hidden-by-visual { display: none !important; }
      @media (max-width: 1050px) { .visual-workspace { grid-template-columns: 1fr; } .scheme-canvas { min-height: 650px; } }
      @media (max-width: 720px) { .scheme-canvas { min-height: 760px; } .scheme-field { position: static; margin: 8px; display: inline-block; } .stair-svg { position: relative; inset: auto; width: 100%; height: 420px; margin-top: 40px; } }
    `;
    document.head.appendChild(style);
  }

  function syncModeToForm(mode) {
    const situation = getForm()?.querySelector('[name="site_situation"]');
    if (situation) situation.value = mode === "frame" ? "Готовый металлокаркас" : "Пустой проём";
  }

  function bindInputs(root) {
    root.querySelectorAll("[data-scheme-input]").forEach((input) => {
      input.addEventListener("input", () => {
        setFormValue(input.dataset.schemeInput, input.value);
        updateSummary(root);
      });
    });
  }

  function updateSummary(root) {
    const card = root.closest(".visual-measure-card");
    const mode = card?.dataset.mode || "empty";
    const fields = mode === "frame" ? frameFields : emptyFields;
    const list = card?.querySelector(".summary-list");
    if (list) list.innerHTML = fieldSummary(fields);
  }

  function createVisualScheme(mode = "empty") {
    const holder = document.createElement("div");
    holder.id = "visual-scheme-holder";
    holder.innerHTML = renderScheme(mode);
    bindInputs(holder);

    holder.querySelectorAll("[data-visual-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.visualMode;
        syncModeToForm(nextMode);
        holder.innerHTML = renderScheme(nextMode);
        bindInputs(holder);
      });
    });

    return holder;
  }

  function enhanceSizesTab() {
    injectVisualStyles();
    const panel = document.querySelector('[data-panel="sizes"]');
    const form = getForm();
    if (!panel || !form || $("#visual-scheme-holder")) return;

    const situation = form.querySelector('[name="site_situation"]')?.value || "Пустой проём";
    const mode = situation.includes("каркас") || situation.includes("металлокаркас") ? "frame" : "empty";
    const visual = createVisualScheme(mode);
    panel.prepend(visual);

    panel.querySelectorAll(":scope > .grid, :scope > label, :scope > textarea").forEach((node) => {
      if (!node.closest("#visual-scheme-holder")) node.classList.add("sizes-grid-hidden-by-visual");
    });
  }

  const observer = new MutationObserver(enhanceSizesTab);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("load", enhanceSizesTab);
  document.addEventListener("click", () => setTimeout(enhanceSizesTab, 100));
  enhanceSizesTab();
})();
