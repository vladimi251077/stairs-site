const SUPABASE_URL = "PASTE_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_SUPABASE_ANON_KEY_HERE";

const isConfigured = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabaseClient = isConfigured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const state = {
  user: null,
  profile: null,
  measurements: [],
  selected: null,
  photos: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  setupWarning: $("#setup-warning"),
  authView: $("#auth-view"),
  mainView: $("#main-view"),
  userRole: $("#user-role"),
  logoutBtn: $("#logout-btn"),
  loginBtn: $("#login-btn"),
  signupBtn: $("#signup-btn"),
  authMessage: $("#auth-message"),
  email: $("#email"),
  password: $("#password"),
  newBtn: $("#new-measurement-btn"),
  refreshBtn: $("#refresh-btn"),
  filter: $("#status-filter"),
  list: $("#measurements-list"),
  emptyDetail: $("#empty-detail"),
  form: $("#measurement-form"),
  formTitle: $("#form-title"),
  formStatus: $("#form-status"),
  formMessage: $("#form-message"),
  photosList: $("#photos-list"),
  photoType: $("#photo-type"),
  photoFile: $("#photo-file"),
  uploadPhotoBtn: $("#upload-photo-btn"),
  checkList: $("#check-list"),
  sendReviewBtn: $("#send-review-btn"),
  acceptBtn: $("#accept-btn"),
  archiveBtn: $("#archive-btn"),
  softDeleteBtn: $("#soft-delete-btn"),
  downloadJsonBtn: $("#download-json-btn"),
  downloadCsvBtn: $("#download-csv-btn"),
};

function setMessage(element, text, type = "") {
  element.textContent = text || "";
  element.className = `form-message ${type}`.trim();
}

function safeNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function makeMeasurementNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 900000 + 100000);
  return `KZN-ZM-${year}-${random}`;
}

function downloadTextFile(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function formToPayload() {
  const fd = new FormData(els.form);
  const client = {
    name: fd.get("client_name")?.toString().trim(),
    phone: fd.get("client_phone")?.toString().trim(),
    address: fd.get("address")?.toString().trim(),
    city: "Казань",
    created_by: state.user?.id,
  };

  const measurement = {
    status: fd.get("status") || "Черновик",
    object_type: "Частный дом",
    object_stage: fd.get("object_stage") || "Черновая",
    site_situation: fd.get("site_situation") || "Пустой проём",
    opening_type: fd.get("opening_type") || "Прямой",
    stair_direction: fd.get("stair_direction") || null,
    turn_type: fd.get("turn_type") || null,
    height_clean_to_clean_mm: safeNumber(fd.get("height_clean_to_clean_mm")),
    slab_thickness_mm: safeNumber(fd.get("slab_thickness_mm")),
    ceiling_height_1_mm: safeNumber(fd.get("ceiling_height_1_mm")),
    desired_flight_width_mm: safeNumber(fd.get("desired_flight_width_mm")),
    opening_length_mm: safeNumber(fd.get("opening_length_mm")),
    opening_width_mm: safeNumber(fd.get("opening_width_mm")),
    flight1_length_mm: safeNumber(fd.get("flight1_length_mm")),
    flight1_width_mm: safeNumber(fd.get("flight1_width_mm")),
    flight2_length_mm: safeNumber(fd.get("flight2_length_mm")),
    flight2_width_mm: safeNumber(fd.get("flight2_width_mm")),
    corner_zone_length_mm: safeNumber(fd.get("corner_zone_length_mm")),
    corner_zone_width_mm: safeNumber(fd.get("corner_zone_width_mm")),
    wall_material: fd.get("wall_material") || null,
    slab_material: fd.get("slab_material") || null,
    has_warm_floor: fd.get("has_warm_floor") || "Не знаю",
    has_pipes: fd.get("has_pipes") === "on",
    has_electricity: fd.get("has_electricity") === "on",
    has_ventilation: fd.get("has_ventilation") === "on",
    obstacles_comment: fd.get("obstacles_comment") || null,
    general_comment: fd.get("general_comment") || null,
    updated_at: new Date().toISOString(),
  };

  return { client, measurement };
}

function fillForm(measurement) {
  els.form.reset();
  const client = measurement.clients || {};
  els.form.client_name.value = client.name || "";
  els.form.client_phone.value = client.phone || "";
  els.form.address.value = client.address || "";

  const names = [
    "status",
    "object_stage",
    "site_situation",
    "opening_type",
    "stair_direction",
    "turn_type",
    "height_clean_to_clean_mm",
    "slab_thickness_mm",
    "ceiling_height_1_mm",
    "desired_flight_width_mm",
    "opening_length_mm",
    "opening_width_mm",
    "flight1_length_mm",
    "flight1_width_mm",
    "flight2_length_mm",
    "flight2_width_mm",
    "corner_zone_length_mm",
    "corner_zone_width_mm",
    "wall_material",
    "slab_material",
    "has_warm_floor",
    "obstacles_comment",
    "general_comment",
  ];

  names.forEach((name) => {
    if (els.form[name] && measurement[name] !== null && measurement[name] !== undefined) {
      els.form[name].value = measurement[name];
    }
  });

  els.form.has_pipes.checked = Boolean(measurement.has_pipes);
  els.form.has_electricity.checked = Boolean(measurement.has_electricity);
  els.form.has_ventilation.checked = Boolean(measurement.has_ventilation);

  els.formTitle.textContent = measurement.number || "Новый замер";
  els.formStatus.textContent = measurement.status || "Черновик";
}

function validateCurrent() {
  const fd = new FormData(els.form);
  const checks = [];
  const add = (type, text) => checks.push({ type, text });

  fd.get("client_name") ? add("ok", "Клиент заполнен") : add("error", "Не заполнен клиент");
  fd.get("client_phone") ? add("ok", "Телефон заполнен") : add("error", "Не заполнен телефон клиента");
  fd.get("address") ? add("ok", "Адрес заполнен") : add("error", "Не заполнен адрес");
  fd.get("opening_type") ? add("ok", "Тип проёма выбран") : add("error", "Не выбран тип проёма");
  fd.get("height_clean_to_clean_mm") ? add("ok", "Высота этажа заполнена") : add("error", "Не заполнена высота чистый-чистый");
  fd.get("opening_length_mm") ? add("ok", "Длина проёма заполнена") : add("error", "Не заполнена длина проёма");
  fd.get("opening_width_mm") ? add("ok", "Ширина проёма заполнена") : add("error", "Не заполнена ширина проёма");

  const photoTypes = state.photos.map((photo) => photo.photo_type);
  ["Общий вид снизу", "Проём сверху", "Место старта", "Место выхода"].forEach((required) => {
    photoTypes.includes(required) ? add("ok", `Фото “${required}” есть`) : add("error", `Нет фото: ${required}`);
  });

  if (fd.get("has_warm_floor") === "Да" && !fd.get("obstacles_comment")) {
    add("warn", "Есть тёплый пол — добавьте комментарий, где нельзя сверлить");
  }

  return checks;
}

function renderChecks() {
  const checks = validateCurrent();
  els.checkList.innerHTML = checks
    .map((check) => {
      const icon = check.type === "ok" ? "✓" : check.type === "warn" ? "!" : "×";
      return `<div class="check-item ${check.type}"><span class="check-icon">${icon}</span><span>${check.text}</span></div>`;
    })
    .join("");
  return checks;
}

function renderPhotos() {
  if (!state.selected) {
    els.photosList.innerHTML = "";
    return;
  }
  if (!state.photos.length) {
    els.photosList.innerHTML = `<p class="muted-text">Фото ещё не загружены.</p>`;
    return;
  }

  els.photosList.innerHTML = state.photos
    .map((photo) => {
      const publicHint = photo.file_url || "";
      return `<div class="photo-card">
        ${publicHint ? `<img src="${publicHint}" alt="${photo.photo_type}" />` : `<div style="aspect-ratio:4/3;display:grid;place-items:center;background:#e5e7eb;">Фото</div>`}
        <div><b>${photo.photo_type}</b><br>${photo.comment || photo.file_path}</div>
      </div>`;
    })
    .join("");
}

function renderStats() {
  const counts = {
    drafts: state.measurements.filter((m) => m.status === "Черновик").length,
    review: state.measurements.filter((m) => m.status === "На проверке").length,
    ready: state.measurements.filter((m) => m.status === "Готовый замер").length,
    archive: state.measurements.filter((m) => m.status === "Архив" || m.is_archived).length,
  };
  $("#stat-drafts").textContent = counts.drafts;
  $("#stat-review").textContent = counts.review;
  $("#stat-ready").textContent = counts.ready;
  $("#stat-archive").textContent = counts.archive;
}

function filteredMeasurements() {
  const filter = els.filter.value;
  if (filter === "all") return state.measurements.filter((m) => !m.is_deleted);
  if (filter === "active") return state.measurements.filter((m) => !m.is_deleted && !m.is_archived && m.status !== "Архив");
  return state.measurements.filter((m) => !m.is_deleted && m.status === filter);
}

function renderMeasurements() {
  renderStats();
  const items = filteredMeasurements();
  if (!items.length) {
    els.list.innerHTML = `<p class="muted-text">Замеров пока нет.</p>`;
    return;
  }

  els.list.innerHTML = items
    .map((m) => {
      const active = state.selected?.id === m.id ? "active" : "";
      const client = m.clients?.name || "Клиент не указан";
      const address = m.clients?.address || "Адрес не указан";
      return `<button class="measurement-item ${active}" data-id="${m.id}">
        <div class="number">${m.number}</div>
        <div>${client}</div>
        <div class="address">${address}</div>
        <div class="measurement-meta">
          <span class="small-chip">${m.status}</span>
          <span class="small-chip">${m.site_situation}</span>
          <span class="small-chip">${m.opening_type}</span>
        </div>
      </button>`;
    })
    .join("");

  $$(".measurement-item").forEach((button) => {
    button.addEventListener("click", () => selectMeasurement(button.dataset.id));
  });
}

async function loadPhotos(measurementId) {
  const { data, error } = await supabaseClient
    .from("measurement_photos")
    .select("*")
    .eq("measurement_id", measurementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  state.photos = data || [];
}

async function selectMeasurement(id) {
  state.selected = state.measurements.find((m) => m.id === id);
  if (!state.selected) return;
  await loadPhotos(id);
  els.emptyDetail.classList.add("hidden");
  els.form.classList.remove("hidden");
  fillForm(state.selected);
  renderMeasurements();
  renderPhotos();
  renderChecks();
}

async function loadMeasurements() {
  const { data, error } = await supabaseClient
    .from("measurements")
    .select("*, clients(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  state.measurements = data || [];
  renderMeasurements();
}

async function loadProfile() {
  const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", state.user.id).maybeSingle();
  if (profile) {
    state.profile = profile;
    return;
  }

  const fallbackName = state.user.email?.split("@")[0] || "Пользователь";
  const { data, error } = await supabaseClient
    .from("profiles")
    .insert({ id: state.user.id, full_name: fallbackName, role: "zamer" })
    .select("*")
    .single();
  if (error) throw error;
  state.profile = data;
}

function showApp(isAuthed) {
  els.authView.classList.toggle("hidden", isAuthed);
  els.mainView.classList.toggle("hidden", !isAuthed);
  els.logoutBtn.classList.toggle("hidden", !isAuthed);
  if (isAuthed) {
    els.userRole.textContent = `${state.profile?.full_name || state.user.email} · ${state.profile?.role || "user"}`;
  } else {
    els.userRole.textContent = "Не вошли";
  }
}

async function initAuth() {
  if (!isConfigured) {
    els.setupWarning.classList.remove("hidden");
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  state.user = data.session?.user || null;
  if (state.user) {
    await loadProfile();
    showApp(true);
    await loadMeasurements();
  } else {
    showApp(false);
  }
}

async function login() {
  setMessage(els.authMessage, "Вход...");
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: els.email.value,
    password: els.password.value,
  });
  if (error) {
    setMessage(els.authMessage, error.message, "error");
    return;
  }
  state.user = data.user;
  await loadProfile();
  showApp(true);
  await loadMeasurements();
  setMessage(els.authMessage, "");
}

async function signup() {
  setMessage(els.authMessage, "Создание пользователя...");
  const { data, error } = await supabaseClient.auth.signUp({
    email: els.email.value,
    password: els.password.value,
  });
  if (error) {
    setMessage(els.authMessage, error.message, "error");
    return;
  }
  setMessage(els.authMessage, "Пользователь создан. Если включено подтверждение email, подтвердите почту и войдите.", "ok");
  if (data.user) {
    state.user = data.user;
    await loadProfile();
    showApp(true);
    await loadMeasurements();
  }
}

function newMeasurement() {
  state.selected = {
    number: makeMeasurementNumber(),
    status: "Черновик",
    clients: {},
    site_situation: "Пустой проём",
    opening_type: "Прямой",
    object_stage: "Черновая",
    has_warm_floor: "Не знаю",
  };
  state.photos = [];
  els.emptyDetail.classList.add("hidden");
  els.form.classList.remove("hidden");
  fillForm(state.selected);
  renderPhotos();
  renderChecks();
}

async function saveMeasurement() {
  setMessage(els.formMessage, "Сохраняю...");
  const { client, measurement } = formToPayload();
  if (!client.name || !client.phone || !client.address) {
    setMessage(els.formMessage, "Заполните клиента, телефон и адрес.", "error");
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
    const oldStatus = state.selected.status;
    const { data, error } = await supabaseClient.from("measurements").update(payload).eq("id", state.selected.id).select("*, clients(*)").single();
    if (error) throw error;
    state.selected = data;
    if (oldStatus !== data.status) await addStatusHistory(data.id, oldStatus, data.status, "Изменение статуса");
  } else {
    const { data, error } = await supabaseClient
      .from("measurements")
      .insert({ ...payload, number: state.selected.number })
      .select("*, clients(*)")
      .single();
    if (error) throw error;
    state.selected = data;
    await addStatusHistory(data.id, null, data.status, "Создан замер");
  }

  await loadMeasurements();
  await selectMeasurement(state.selected.id);
  setMessage(els.formMessage, "Сохранено.", "ok");
  return state.selected;
}

async function addStatusHistory(measurementId, oldStatus, newStatus, comment) {
  await supabaseClient.from("status_history").insert({
    measurement_id: measurementId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: state.user.id,
    comment,
  });
}

async function updateSelectedStatus(status, extra = {}) {
  if (!state.selected?.id) await saveMeasurement();
  if (!state.selected?.id) return;
  const oldStatus = state.selected.status;
  const { data, error } = await supabaseClient
    .from("measurements")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", state.selected.id)
    .select("*, clients(*)")
    .single();
  if (error) throw error;
  await addStatusHistory(data.id, oldStatus, status, `Статус изменён на ${status}`);
  state.selected = data;
  await loadMeasurements();
  await selectMeasurement(data.id);
}

async function uploadPhoto() {
  if (!state.selected?.id) {
    const saved = await saveMeasurement();
    if (!saved) return;
  }

  const file = els.photoFile.files[0];
  if (!file) {
    setMessage(els.formMessage, "Выберите фото.", "error");
    return;
  }

  setMessage(els.formMessage, "Загружаю фото...");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${state.selected.number}/${Date.now()}_${els.photoType.value}.${ext}`;
  const { error: uploadError } = await supabaseClient.storage.from("measurement-photos").upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data: signed } = await supabaseClient.storage.from("measurement-photos").createSignedUrl(path, 60 * 60 * 24 * 7);

  const { error } = await supabaseClient.from("measurement_photos").insert({
    measurement_id: state.selected.id,
    photo_type: els.photoType.value,
    file_path: path,
    file_url: signed?.signedUrl || null,
    is_required: true,
    added_by: state.user.id,
  });
  if (error) throw error;

  els.photoFile.value = "";
  await loadPhotos(state.selected.id);
  renderPhotos();
  renderChecks();
  setMessage(els.formMessage, "Фото загружено.", "ok");
}

function downloadJson() {
  if (!state.selected) return;
  const data = { measurement: state.selected, photos: state.photos };
  downloadTextFile(`${state.selected.number}_data.json`, JSON.stringify(data, null, 2), "application/json");
}

function downloadCsv() {
  if (!state.selected) return;
  const m = state.selected;
  const c = m.clients || {};
  const headers = ["Номер", "Статус", "Клиент", "Телефон", "Адрес", "Ситуация", "Проём", "Высота", "Длина проёма", "Ширина проёма", "Комментарий"];
  const values = [m.number, m.status, c.name, c.phone, c.address, m.site_situation, m.opening_type, m.height_clean_to_clean_mm, m.opening_length_mm, m.opening_width_mm, m.general_comment];
  downloadTextFile(`${m.number}_data.csv`, `${headers.map(escapeCsv).join(",")}\n${values.map(escapeCsv).join(",")}`, "text/csv;charset=utf-8");
}

function bindEvents() {
  els.loginBtn.addEventListener("click", () => login().catch((e) => setMessage(els.authMessage, e.message, "error")));
  els.signupBtn.addEventListener("click", () => signup().catch((e) => setMessage(els.authMessage, e.message, "error")));
  els.logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    state.user = null;
    state.profile = null;
    state.measurements = [];
    state.selected = null;
    showApp(false);
  });

  els.newBtn.addEventListener("click", newMeasurement);
  els.refreshBtn.addEventListener("click", () => loadMeasurements().catch((e) => alert(e.message)));
  els.filter.addEventListener("change", renderMeasurements);

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveMeasurement().catch((e) => setMessage(els.formMessage, e.message, "error"));
  });

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const name = tab.dataset.tab;
      $$(".tab-panel").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== name));
      if (name === "check") renderChecks();
    });
  });

  els.uploadPhotoBtn.addEventListener("click", () => uploadPhoto().catch((e) => setMessage(els.formMessage, e.message, "error")));
  els.sendReviewBtn.addEventListener("click", async () => {
    const saved = await saveMeasurement();
    if (!saved) return;
    const errors = renderChecks().filter((check) => check.type === "error");
    if (errors.length) {
      setMessage(els.formMessage, `Нельзя отправить: ошибок ${errors.length}.`, "error");
      return;
    }
    await updateSelectedStatus("На проверке");
  });
  els.acceptBtn.addEventListener("click", () => updateSelectedStatus("Готовый замер", { checked_by: state.user.id, checked_at: new Date().toISOString() }).catch((e) => alert(e.message)));
  els.archiveBtn.addEventListener("click", () => updateSelectedStatus("Архив", { is_archived: true, archived_at: new Date().toISOString(), archived_by: state.user.id }).catch((e) => alert(e.message)));
  els.softDeleteBtn.addEventListener("click", async () => {
    if (!state.selected?.id) return;
    if (!confirm("Мягко удалить замер? Он пропадёт из рабочих списков.")) return;
    await updateSelectedStatus("Удалён", { is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: state.user.id, delete_comment: "Удалено из интерфейса" });
  });
  els.downloadJsonBtn.addEventListener("click", downloadJson);
  els.downloadCsvBtn.addEventListener("click", downloadCsv);

  els.form.addEventListener("input", () => renderChecks());
}

bindEvents();
initAuth().catch((error) => {
  console.error(error);
  if (els.authMessage) setMessage(els.authMessage, error.message, "error");
});
