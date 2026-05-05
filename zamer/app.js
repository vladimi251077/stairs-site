const SUPABASE_URL = "https://rhmlykqqhwweaywjopvm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kzU8UDdLyl9WGvS-o5jFsw_xkg5-Sqv";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  user: null,
  profile: null,
  measurements: [],
  selected: null,
  photos: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function msg(el, text, type = "") {
  if (!el) return;
  el.textContent = text || "";
  el.className = `form-message ${type}`.trim();
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function makeNumber() {
  const y = new Date().getFullYear();
  const n = Math.floor(Math.random() * 900000 + 100000);
  return `KZN-ZM-${y}-${n}`;
}

function valuesFromForm() {
  const form = $("#measurement-form");
  const fd = new FormData(form);
  return {
    client: {
      name: String(fd.get("client_name") || "").trim(),
      phone: String(fd.get("client_phone") || "").trim(),
      address: String(fd.get("address") || "").trim(),
      city: "Казань",
      created_by: state.user?.id,
    },
    measurement: {
      status: fd.get("status") || "Черновик",
      object_type: "Частный дом",
      object_stage: fd.get("object_stage") || "Черновая",
      site_situation: fd.get("site_situation") || "Пустой проём",
      opening_type: fd.get("opening_type") || "Прямой",
      stair_direction: fd.get("stair_direction") || null,
      turn_type: fd.get("turn_type") || null,
      height_clean_to_clean_mm: numberOrNull(fd.get("height_clean_to_clean_mm")),
      slab_thickness_mm: numberOrNull(fd.get("slab_thickness_mm")),
      ceiling_height_1_mm: numberOrNull(fd.get("ceiling_height_1_mm")),
      desired_flight_width_mm: numberOrNull(fd.get("desired_flight_width_mm")),
      opening_length_mm: numberOrNull(fd.get("opening_length_mm")),
      opening_width_mm: numberOrNull(fd.get("opening_width_mm")),
      flight1_length_mm: numberOrNull(fd.get("flight1_length_mm")),
      flight1_width_mm: numberOrNull(fd.get("flight1_width_mm")),
      flight2_length_mm: numberOrNull(fd.get("flight2_length_mm")),
      flight2_width_mm: numberOrNull(fd.get("flight2_width_mm")),
      corner_zone_length_mm: numberOrNull(fd.get("corner_zone_length_mm")),
      corner_zone_width_mm: numberOrNull(fd.get("corner_zone_width_mm")),
      wall_material: fd.get("wall_material") || null,
      slab_material: fd.get("slab_material") || null,
      has_warm_floor: fd.get("has_warm_floor") || "Не знаю",
      has_pipes: fd.get("has_pipes") === "on",
      has_electricity: fd.get("has_electricity") === "on",
      has_ventilation: fd.get("has_ventilation") === "on",
      obstacles_comment: fd.get("obstacles_comment") || null,
      general_comment: fd.get("general_comment") || null,
      updated_at: new Date().toISOString(),
    },
  };
}

function show(isAuthed) {
  $("#auth-view").classList.toggle("hidden", isAuthed);
  $("#main-view").classList.toggle("hidden", !isAuthed);
  $("#logout-btn").classList.toggle("hidden", !isAuthed);
  $("#user-role").textContent = isAuthed ? `${state.profile?.full_name || state.user?.email} · ${state.profile?.role || "user"}` : "Не вошли";
}

async function loadProfile() {
  const { data } = await supabaseClient.from("profiles").select("*").eq("id", state.user.id).maybeSingle();
  if (data) {
    state.profile = data;
    return;
  }
  const fallbackName = state.user.email?.split("@")[0] || "Пользователь";
  const { data: created, error } = await supabaseClient
    .from("profiles")
    .insert({ id: state.user.id, full_name: fallbackName, role: "zamer" })
    .select("*")
    .single();
  if (error) throw error;
  state.profile = created;
}

async function init() {
  const { data } = await supabaseClient.auth.getSession();
  state.user = data.session?.user || null;
  if (!state.user) {
    show(false);
    return;
  }
  await loadProfile();
  show(true);
  await loadMeasurements();
}

async function login() {
  msg($("#auth-message"), "Вход...");
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: $("#email").value.trim(),
    password: $("#password").value,
  });
  if (error) return msg($("#auth-message"), error.message, "error");
  state.user = data.user;
  await loadProfile();
  show(true);
  await loadMeasurements();
  msg($("#auth-message"), "");
}

async function signup() {
  msg($("#auth-message"), "Создание пользователя...");
  const { data, error } = await supabaseClient.auth.signUp({
    email: $("#email").value.trim(),
    password: $("#password").value,
  });
  if (error) return msg($("#auth-message"), error.message, "error");
  msg($("#auth-message"), "Пользователь создан. Если нужно — подтвердите почту и войдите.", "ok");
  if (data.user) {
    state.user = data.user;
    await loadProfile();
    show(true);
    await loadMeasurements();
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  state.user = null;
  state.profile = null;
  state.measurements = [];
  state.selected = null;
  show(false);
}

async function loadMeasurements() {
  const { data, error } = await supabaseClient
    .from("measurements")
    .select("*, clients(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  state.measurements = data || [];
  renderList();
  renderStats();
}

function filteredMeasurements() {
  const filter = $("#status-filter").value;
  if (filter === "all") return state.measurements.filter((m) => !m.is_deleted);
  if (filter === "active") return state.measurements.filter((m) => !m.is_deleted && !m.is_archived && m.status !== "Архив");
  return state.measurements.filter((m) => !m.is_deleted && m.status === filter);
}

function renderStats() {
  $("#stat-drafts").textContent = state.measurements.filter((m) => m.status === "Черновик").length;
  $("#stat-review").textContent = state.measurements.filter((m) => m.status === "На проверке").length;
  $("#stat-ready").textContent = state.measurements.filter((m) => m.status === "Готовый замер").length;
  $("#stat-archive").textContent = state.measurements.filter((m) => m.status === "Архив" || m.is_archived).length;
}

function renderList() {
  const list = $("#measurements-list");
  const items = filteredMeasurements();
  if (!items.length) {
    list.innerHTML = `<p class="muted-text">Замеров пока нет.</p>`;
    return;
  }
  list.innerHTML = items.map((m) => {
    const client = m.clients || {};
    const active = state.selected?.id === m.id ? "active" : "";
    return `<button class="measurement-item ${active}" data-id="${m.id}">
      <div class="number">${m.number}</div>
      <div>${client.name || "Клиент не указан"}</div>
      <div class="address">${client.address || "Адрес не указан"}</div>
      <div class="measurement-meta">
        <span class="small-chip">${m.status}</span>
        <span class="small-chip">${m.site_situation}</span>
        <span class="small-chip">${m.opening_type}</span>
      </div>
    </button>`;
  }).join("");
  $$(".measurement-item").forEach((button) => button.addEventListener("click", () => selectMeasurement(button.dataset.id)));
}

async function selectMeasurement(id) {
  state.selected = state.measurements.find((m) => m.id === id);
  if (!state.selected) return;
  await loadPhotos(id);
  fillForm(state.selected);
  $("#empty-detail").classList.add("hidden");
  $("#measurement-form").classList.remove("hidden");
  renderList();
  renderPhotos();
  renderChecks();
}

function newMeasurement() {
  state.selected = {
    number: makeNumber(),
    status: "Черновик",
    clients: {},
    site_situation: "Пустой проём",
    opening_type: "Прямой",
    object_stage: "Черновая",
    has_warm_floor: "Не знаю",
  };
  state.photos = [];
  fillForm(state.selected);
  $("#empty-detail").classList.add("hidden");
  $("#measurement-form").classList.remove("hidden");
  renderPhotos();
  renderChecks();
}

function fillForm(m) {
  const form = $("#measurement-form");
  form.reset();
  const c = m.clients || {};
  form.client_name.value = c.name || "";
  form.client_phone.value = c.phone || "";
  form.address.value = c.address || "";
  ["status", "object_stage", "site_situation", "opening_type", "stair_direction", "turn_type", "height_clean_to_clean_mm", "slab_thickness_mm", "ceiling_height_1_mm", "desired_flight_width_mm", "opening_length_mm", "opening_width_mm", "flight1_length_mm", "flight1_width_mm", "flight2_length_mm", "flight2_width_mm", "corner_zone_length_mm", "corner_zone_width_mm", "wall_material", "slab_material", "has_warm_floor", "obstacles_comment", "general_comment"].forEach((name) => {
    if (form[name] && m[name] !== null && m[name] !== undefined) form[name].value = m[name];
  });
  form.has_pipes.checked = Boolean(m.has_pipes);
  form.has_electricity.checked = Boolean(m.has_electricity);
  form.has_ventilation.checked = Boolean(m.has_ventilation);
  $("#form-title").textContent = m.number || "Новый замер";
  $("#form-status").textContent = m.status || "Черновик";
}

async function saveMeasurement() {
  msg($("#form-message"), "Сохраняю...");
  const { client, measurement } = valuesFromForm();
  if (!client.name || !client.phone || !client.address) {
    msg($("#form-message"), "Заполните клиента, телефон и адрес.", "error");
    return null;
  }

  let clientId = state.selected?.client_id;
  if (clientId) {
    const { error } = await supabaseClient.from("clients").update(client).eq("id", clientId);
    if (error) throw error;
  } else {
    const { data, error } = await supabaseClient.from("clients").insert(client).select("*").single();
    if (error) throw error;
    clientId = data.id;
  }

  const payload = {
    ...measurement,
    client_id: clientId,
    created_by: state.selected?.created_by || state.user.id,
    measurer_id: state.selected?.measurer_id || state.user.id,
  };

  if (state.selected?.id) {
    const { data, error } = await supabaseClient.from("measurements").update(payload).eq("id", state.selected.id).select("*, clients(*)").single();
    if (error) throw error;
    state.selected = data;
  } else {
    const { data, error } = await supabaseClient.from("measurements").insert({ ...payload, number: state.selected.number }).select("*, clients(*)").single();
    if (error) throw error;
    state.selected = data;
  }
  await loadMeasurements();
  await selectMeasurement(state.selected.id);
  msg($("#form-message"), "Сохранено.", "ok");
  return state.selected;
}

async function setStatus(status, extra = {}) {
  if (!state.selected?.id) await saveMeasurement();
  if (!state.selected?.id) return;
  const { data, error } = await supabaseClient
    .from("measurements")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", state.selected.id)
    .select("*, clients(*)")
    .single();
  if (error) throw error;
  state.selected = data;
  await loadMeasurements();
  await selectMeasurement(data.id);
}

async function loadPhotos(measurementId) {
  const { data, error } = await supabaseClient.from("measurement_photos").select("*").eq("measurement_id", measurementId).order("created_at", { ascending: false });
  if (error) throw error;
  state.photos = data || [];
}

function renderPhotos() {
  const box = $("#photos-list");
  if (!state.selected) return box.innerHTML = "";
  if (!state.photos.length) return box.innerHTML = `<p class="muted-text">Фото ещё не загружены.</p>`;
  box.innerHTML = state.photos.map((p) => `<div class="photo-card"><div style="aspect-ratio:4/3;display:grid;place-items:center;background:#e5e7eb;">Фото</div><div><b>${p.photo_type}</b><br>${p.file_path}</div></div>`).join("");
}

async function uploadPhoto() {
  if (!state.selected?.id) {
    const saved = await saveMeasurement();
    if (!saved) return;
  }
  const file = $("#photo-file").files[0];
  if (!file) return msg($("#form-message"), "Выберите фото.", "error");
  msg($("#form-message"), "Загружаю фото...");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${state.selected.number}/${Date.now()}_${$("#photo-type").value}.${ext}`;
  const { error: uploadError } = await supabaseClient.storage.from("measurement-photos").upload(path, file);
  if (uploadError) throw uploadError;
  const { error } = await supabaseClient.from("measurement_photos").insert({ measurement_id: state.selected.id, photo_type: $("#photo-type").value, file_path: path, is_required: true, added_by: state.user.id });
  if (error) throw error;
  $("#photo-file").value = "";
  await loadPhotos(state.selected.id);
  renderPhotos();
  renderChecks();
  msg($("#form-message"), "Фото загружено.", "ok");
}

function checkItems() {
  const { client, measurement } = valuesFromForm();
  const items = [];
  const add = (type, text) => items.push({ type, text });
  client.name ? add("ok", "Клиент заполнен") : add("error", "Не заполнен клиент");
  client.phone ? add("ok", "Телефон заполнен") : add("error", "Не заполнен телефон");
  client.address ? add("ok", "Адрес заполнен") : add("error", "Не заполнен адрес");
  measurement.height_clean_to_clean_mm ? add("ok", "Высота заполнена") : add("error", "Не заполнена высота этажа");
  measurement.opening_length_mm ? add("ok", "Длина проёма заполнена") : add("error", "Не заполнена длина проёма");
  measurement.opening_width_mm ? add("ok", "Ширина проёма заполнена") : add("error", "Не заполнена ширина проёма");
  const photoTypes = state.photos.map((p) => p.photo_type);
  ["Общий вид снизу", "Проём сверху", "Место старта", "Место выхода"].forEach((t) => photoTypes.includes(t) ? add("ok", `Фото есть: ${t}`) : add("error", `Нет фото: ${t}`));
  if (measurement.has_warm_floor === "Да" && !measurement.obstacles_comment) add("warn", "Есть тёплый пол — добавьте комментарий");
  return items;
}

function renderChecks() {
  const items = checkItems();
  $("#check-list").innerHTML = items.map((i) => `<div class="check-item ${i.type}"><span class="check-icon">${i.type === "ok" ? "✓" : i.type === "warn" ? "!" : "×"}</span><span>${i.text}</span></div>`).join("");
  return items;
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson() {
  if (!state.selected) return;
  downloadText(`${state.selected.number}_data.json`, JSON.stringify({ measurement: state.selected, photos: state.photos }, null, 2), "application/json");
}

function downloadCsv() {
  if (!state.selected) return;
  const m = state.selected;
  const c = m.clients || {};
  downloadText(`${m.number}_data.csv`, `Номер;Статус;Клиент;Телефон;Адрес\n${m.number};${m.status};${c.name || ""};${c.phone || ""};${c.address || ""}`, "text/csv;charset=utf-8");
}

function bind() {
  $("#login-btn").addEventListener("click", () => login().catch((e) => msg($("#auth-message"), e.message, "error")));
  $("#signup-btn").addEventListener("click", () => signup().catch((e) => msg($("#auth-message"), e.message, "error")));
  $("#logout-btn").addEventListener("click", logout);
  $("#new-measurement-btn").addEventListener("click", newMeasurement);
  $("#refresh-btn").addEventListener("click", () => loadMeasurements().catch((e) => alert(e.message)));
  $("#status-filter").addEventListener("change", renderList);
  $("#measurement-form").addEventListener("submit", (e) => { e.preventDefault(); saveMeasurement().catch((err) => msg($("#form-message"), err.message, "error")); });
  $("#upload-photo-btn").addEventListener("click", () => uploadPhoto().catch((e) => msg($("#form-message"), e.message, "error")));
  $("#send-review-btn").addEventListener("click", async () => {
    const saved = await saveMeasurement();
    if (!saved) return;
    const errors = renderChecks().filter((i) => i.type === "error");
    if (errors.length) return msg($("#form-message"), `Нельзя отправить: ошибок ${errors.length}.`, "error");
    await setStatus("На проверке");
  });
  $("#accept-btn").addEventListener("click", () => setStatus("Готовый замер", { checked_by: state.user.id, checked_at: new Date().toISOString() }).catch((e) => alert(e.message)));
  $("#archive-btn").addEventListener("click", () => setStatus("Архив", { is_archived: true, archived_at: new Date().toISOString(), archived_by: state.user.id }).catch((e) => alert(e.message)));
  $("#soft-delete-btn").addEventListener("click", () => setStatus("Удалён", { is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: state.user.id }).catch((e) => alert(e.message)));
  $("#download-json-btn").addEventListener("click", downloadJson);
  $("#download-csv-btn").addEventListener("click", downloadCsv);
  $("#measurement-form").addEventListener("input", renderChecks);
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    $$(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== tab.dataset.tab));
    if (tab.dataset.tab === "check") renderChecks();
  }));
}

bind();
init().catch((e) => {
  console.error(e);
  msg($("#auth-message"), e.message, "error");
});
