(() => {
  const DETAILS_MARKER_START = "\n\n--- ОГРАЖДЕНИЯ И ДЕТАЛИ ---\n";
  const DETAILS_MARKER_END = "\n--- КОНЕЦ ОГРАЖДЕНИЙ И ДЕТАЛЕЙ ---";

  function $(selector) {
    return document.querySelector(selector);
  }

  function createField(label, name, type = "number", placeholder = "") {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <label>${label}</label>
      <input name="${name}" type="${type}" placeholder="${placeholder}" />
    `;
    return wrap;
  }

  function addDetailsTab() {
    const tabs = document.querySelector(".tabs");
    const form = $("#measurement-form");
    if (!tabs || !form || document.querySelector('[data-tab="details"]')) return;

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab";
    tab.dataset.tab = "details";
    tab.textContent = "Ограждения";

    const photosTab = document.querySelector('[data-tab="photos"]');
    tabs.insertBefore(tab, photosTab || null);

    const panel = document.createElement("div");
    panel.className = "tab-panel hidden";
    panel.dataset.panel = "details";
    panel.innerHTML = `
      <div class="grid four">
        <div><label>Балясины, шт</label><input name="detail_balusters_qty" type="number" placeholder="35" /></div>
        <div><label>Столбы, шт</label><input name="detail_posts_qty" type="number" placeholder="6" /></div>
        <div><label>Поручень, мм</label><input name="detail_handrail_mm" type="number" placeholder="760" /></div>
        <div><label>Балюстрада, мм</label><input name="detail_balustrade_mm" type="number" placeholder="1038" /></div>
      </div>
      <div class="grid four">
        <div><label>Подбалясник, мм</label><input name="detail_base_rail_mm" type="number" placeholder="500" /></div>
        <div><label>Ступени 1 марш, шт</label><input name="detail_steps_1_qty" type="number" placeholder="7" /></div>
        <div><label>Ступени 2 марш, шт</label><input name="detail_steps_2_qty" type="number" placeholder="8" /></div>
        <div><label>Забежные, шт</label><input name="detail_winder_steps_qty" type="number" placeholder="3" /></div>
      </div>
      <div class="grid three">
        <div><label>Материал ступеней</label><input name="detail_step_material" type="text" placeholder="ясень / MDF / бетон" /></div>
        <div><label>Материал ограждения</label><input name="detail_railing_material" type="text" placeholder="стекло / металл / дерево" /></div>
        <div><label>Отделка</label><input name="detail_finish" type="text" placeholder="эмаль / лак / масло" /></div>
      </div>
      <label>Свободные дополнительные размеры</label>
      <textarea name="detail_extra_sizes" placeholder="Например: окно 760 мм, косоур 1050 мм, угол 33°, толщина проёма 430 мм..."></textarea>
      <label>Комментарий по ограждениям и деталям</label>
      <textarea name="detail_comment" placeholder="Что важно для конструктора: где балюстрада, где столбы, что мешает, что уточнить..."></textarea>
      <p class="muted-text">Этот блок временно сохраняется в поле “Комментарий замерщика”, чтобы не менять базу данных. Позже вынесем в отдельные таблицы.</p>
    `;

    const photosPanel = document.querySelector('[data-panel="photos"]');
    form.insertBefore(panel, photosPanel || form.querySelector(".form-actions"));

    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== "details"));
    });
  }

  function buildDetailsText() {
    const form = $("#measurement-form");
    if (!form) return "";
    const fd = new FormData(form);
    const rows = [
      ["Балясины, шт", fd.get("detail_balusters_qty")],
      ["Столбы, шт", fd.get("detail_posts_qty")],
      ["Поручень, мм", fd.get("detail_handrail_mm")],
      ["Балюстрада, мм", fd.get("detail_balustrade_mm")],
      ["Подбалясник, мм", fd.get("detail_base_rail_mm")],
      ["Ступени 1 марш, шт", fd.get("detail_steps_1_qty")],
      ["Ступени 2 марш, шт", fd.get("detail_steps_2_qty")],
      ["Забежные, шт", fd.get("detail_winder_steps_qty")],
      ["Материал ступеней", fd.get("detail_step_material")],
      ["Материал ограждения", fd.get("detail_railing_material")],
      ["Отделка", fd.get("detail_finish")],
      ["Дополнительные размеры", fd.get("detail_extra_sizes")],
      ["Комментарий", fd.get("detail_comment")],
    ].filter(([, value]) => String(value || "").trim());

    if (!rows.length) return "";
    return DETAILS_MARKER_START + rows.map(([label, value]) => `${label}: ${String(value).trim()}`).join("\n") + DETAILS_MARKER_END;
  }

  function stripOldDetails(text) {
    const source = String(text || "");
    const start = source.indexOf(DETAILS_MARKER_START);
    if (start === -1) return source.trim();
    const end = source.indexOf(DETAILS_MARKER_END, start);
    if (end === -1) return source.slice(0, start).trim();
    return (source.slice(0, start) + source.slice(end + DETAILS_MARKER_END.length)).trim();
  }

  function attachSaveHook() {
    const form = $("#measurement-form");
    if (!form || form.dataset.detailsHook === "1") return;
    form.dataset.detailsHook = "1";

    form.addEventListener(
      "submit",
      () => {
        const comment = form.querySelector('[name="general_comment"]');
        if (!comment) return;
        const base = stripOldDetails(comment.value);
        const details = buildDetailsText();
        comment.value = [base, details].filter(Boolean).join("\n");
      },
      true
    );

    const saveButtons = Array.from(form.querySelectorAll('button[type="submit"], #send-review-btn'));
    saveButtons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const comment = form.querySelector('[name="general_comment"]');
          if (!comment) return;
          const base = stripOldDetails(comment.value);
          const details = buildDetailsText();
          comment.value = [base, details].filter(Boolean).join("\n");
        },
        true
      );
    });
  }

  function initEnhancement() {
    addDetailsTab();
    attachSaveHook();
  }

  const observer = new MutationObserver(initEnhancement);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("load", initEnhancement);
  document.addEventListener("click", () => setTimeout(initEnhancement, 100));
  initEnhancement();
})();
