/* ============ SETTINGS PAGE ============
   Opened from the gear in the top bar (or ","), not a tab: editable exercise levels
   (add, remove, colour), then the Data list (storage, backup, restore, erase) and the
   About list. Settings changes apply at once, like the theme — no Save. */
function levelRowHtml(l, i) {
  const label = l.id + " · " + l.name;
  const swatches = COLOURS.map(
    (c) =>
      '<button type="button" class="swatch tag-' +
      c +
      (c === l.color ? " on" : "") +
      '" data-lvl-i="' +
      i +
      '" data-lvl-colour="' +
      c +
      '" title="' +
      c +
      '" aria-label="' +
      esc(l.name) +
      ": " +
      c +
      '" aria-pressed="' +
      (c === l.color) +
      '"></button>',
  ).join("");
  return (
    '<li class="opt-row"><span class="opt-name"><span class="pill tag-' +
    l.color +
    '">' +
    esc(label) +
    '</span></span><span class="swatches" role="group" aria-label="' +
    esc(l.name) +
    ' colour">' +
    swatches +
    '</span><button type="button" class="iconbtn opt-del" data-lvl-del="' +
    i +
    '" title="Remove ' +
    esc(l.name) +
    '" aria-label="Remove ' +
    esc(l.name) +
    '">✕</button></li>'
  );
}
function levelCardHtml() {
  const levels = state.settings.levels;
  const rows = levels.map((l, i) => levelRowHtml(l, i)).join("");
  return (
    '<div class="card"><div class="stat-t">Exercise levels <span class="opt-count">' +
    levels.length +
    '</span></div><p class="hint">The level pills on Workout, Plan and Log. Pick a colour for ' +
    "each. Removing one keeps it on exercises that already use it.</p>" +
    '<ul class="opt-list">' +
    rows +
    "</ul>" +
    '<form class="opt-add" id="lvl-add"><input id="lvl-new" placeholder="New level" ' +
    'aria-label="New level" maxlength="40"><button type="submit" class="btn">Add</button></form>' +
    "</div>"
  );
}
function syncSettingsMeta() {
  const count = $("#sec-settings .opt-count");
  if (count) count.textContent = String(state.settings.levels.length);
  const sub = $("#sec-settings .set-list .set-row:first-child .set-tx span");
  if (sub) sub.innerHTML = storageLine();
}
function reindexLevelRows() {
  document.querySelectorAll("#sec-settings .opt-list > .opt-row").forEach((row, idx) => {
    row.querySelectorAll("[data-lvl-i]").forEach((b) => {
      b.dataset.lvlI = String(idx);
    });
    const del = row.querySelector("[data-lvl-del]");
    if (del) del.dataset.lvlDel = String(idx);
  });
}
function renderSettings() {
  $("#sec-settings").innerHTML = levelCardHtml() + dataListHtml() + aboutListHtml();
}
function setLevelColour(i, colour) {
  const l = state.settings.levels[i];
  if (!l || !COLOURS.includes(colour)) return;
  l.color = colour;
  saveState();
  const row = document.querySelectorAll("#sec-settings .opt-list > .opt-row")[i];
  if (!row) return renderSettings();
  const pill = row.querySelector(".opt-name .pill");
  if (pill) pill.className = "pill tag-" + colour;
  row.querySelectorAll("[data-lvl-colour]").forEach((b) => {
    const on = b.dataset.lvlColour === colour;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  syncSettingsMeta();
}
async function removeLevel(i) {
  const l = state.settings.levels[i];
  if (!l) return;
  const used = (state.exercises || []).filter((x) => (x.level || 0) === l.id).length;
  const msg =
    "Remove “" + l.name + "”?\n\n" + plural(used, "exercise") + " use it and keep it.";
  if (used && !(await ask(msg, "Remove", true))) return;
  const idx = state.settings.levels.indexOf(l);
  if (idx < 0) return;
  state.settings.levels.splice(idx, 1);
  saveState();
  const row = document.querySelectorAll("#sec-settings .opt-list > .opt-row")[idx];
  if (!row) return renderSettings();
  row.classList.remove("opt-row");
  reindexLevelRows();
  syncSettingsMeta();
  removeAnimated(row);
}
function addLevel(name) {
  const levels = state.settings.levels;
  if (!name) return;
  if (levels.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
    tell("“" + name + "” is already in the list.");
    return;
  }
  const maxId = Math.max(
    -1,
    ...levels.map((l) => l.id),
    ...(state.exercises || []).map((x) => x.level || 0),
  );
  // the first colour no level uses yet, so a new one stands apart
  const color = COLOURS.find((c) => c !== "gray" && !levels.some((l) => l.color === c)) || "gray";
  const lvl = { id: maxId + 1, name, color };
  levels.push(lvl);
  saveState();
  const list = $("#sec-settings .opt-list");
  if (!list) return renderSettings();
  const row = htmlToEl(levelRowHtml(lvl, levels.length - 1));
  list.appendChild(row);
  animateIn(row);
  syncSettingsMeta();
  const inp = $("#lvl-new");
  if (inp) {
    inp.value = "";
    inp.focus({ preventScroll: true });
  }
}
function openSettings() {
  if (modalOpen()) return; // a dialog is modal: the page stays put until it closes
  ui.tab = "settings";
  render();
}

/* ---- Data and About lists: storage, backup, restore, erase; version, help ----
   Data lives only in this device's localStorage. A backup is the one way to move it: in Delta
   Chat (window.webxdc) it is shared into the chat, where downloads do nothing; in a browser
   it downloads. Syncing with the vault through the chat comes later (references/webxdc.md §5). */
/* Every localStorage key this app writes. Erase clears exactly these; a new key joins here. */
const APP_KEYS = () => [LS, LS_STRAY, COLS_KEY, THEME_KEY, TIMERS_KEY];
/* localStorage holds about 5 MB per origin, and Chrome and Arc give every file:// page the
   same origin, so free space counts every app opened from disk. Sizes are in characters,
   which is what browsers count against the quota. */
const STORAGE_QUOTA = 5 * 1024 * 1024;
const SET_ICONS = {
  saved:
    '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" />',
  backup:
    '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />',
  restore:
    '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />',
  erase: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />',
  offline:
    '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.8M14.5 10.4A10 10 0 0 1 19 13" />' +
    '<path d="M2 9.5a14.5 14.5 0 0 1 4.2-2.7M10.6 5.6A14.5 14.5 0 0 1 22 9.5M12 20h.01" />',
  help:
    '<path d="M2.5 9L12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11M21.5 9v5" />',
};
function setIcon(name) {
  return (
    '<span class="set-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    SET_ICONS[name] +
    "</svg></span>"
  );
}
/* One row of a settings list: a button (with a chevron) when it has an id, else plain text. */
function setRow({ id = "", icon = "", lead = "", title, sub, danger = false }) {
  const tag = id ? "button" : "div";
  return (
    "<" +
    tag +
    (id ? ' type="button" id="' + id + '"' : "") +
    ' class="set-row' +
    (danger ? " danger" : "") +
    '">' +
    (lead || setIcon(icon)) +
    '<span class="set-tx"><b>' +
    esc(title) +
    "</b><span>" +
    sub +
    "</span></span>" +
    (id
      ? '<svg class="set-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M9 6l6 6-6 6" /></svg>'
      : "") +
    "</" +
    tag +
    ">"
  );
}
function fmtSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}
function storageUse() {
  const mine = APP_KEYS();
  let app = 0;
  let all = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    const n = k.length + (localStorage.getItem(k) || "").length;
    all += n;
    if (mine.includes(k)) app += n;
  }
  return { app: app, all: all };
}
function sessionCount(s) {
  return s.cycles.reduce((n, c) => n + (c.sessions || []).length, 0);
}
function storageLine() {
  let use;
  try {
    use = storageUse();
  } catch (e) {
    return "Storage size unavailable: " + esc(e.message || String(e));
  }
  const free = Math.max(0, STORAGE_QUOTA - use.all);
  const line =
    plural(state.exercises.length, "exercise") +
    " · " +
    plural(state.templates.length, "plan") +
    " · " +
    plural(state.cycles.length, "cycle") +
    " · " +
    plural(sessionCount(state), "session") +
    "<br>" +
    fmtSize(use.app) +
    " used · " +
    fmtSize(free) +
    " available";
  return use.all / STORAGE_QUOTA < 0.7
    ? line
    : line + '<br><span class="warn">Almost full: back up, then erase old records.</span>';
}
function dataListHtml() {
  return (
    '<div class="stat-t set-group">Data</div><div class="card set-list">' +
    setRow({ icon: "saved", title: "Safely saved on this device", sub: storageLine() }) +
    setRow({
      id: "dt-backup",
      icon: "backup",
      title: "Make a backup",
      sub: "All your exercises, plans, cycles, sessions and settings in one file.",
    }) +
    setRow({
      id: "dt-restore",
      icon: "restore",
      title: "Restore a backup",
      sub: "Bring back your workouts from a backup file.",
    }) +
    setRow({
      id: "dt-erase",
      icon: "erase",
      title: "Erase everything",
      sub: "Deletes every exercise, plan and session on this device.",
      danger: true,
    }) +
    '</div><input id="dt-import" type="file" accept=".json,application/json" hidden>'
  );
}
function aboutListHtml() {
  return (
    '<div class="stat-t set-group">About</div><div class="card set-list">' +
    setRow({
      id: "dt-about",
      lead: '<img class="set-app" src="icon.png" alt="">',
      title: "Workout Tracker",
      sub: "Version " + esc(APP_VERSION) + " · what it does, your data, what's new",
    }) +
    setRow({
      id: "dt-help",
      icon: "help",
      title: "Help",
      sub: "A quick guide to using the app.",
    }) +
    "</div>"
  );
}
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function makeBackup() {
  const name = "workout-tracker-backup-" + today() + ".json";
  const text = JSON.stringify(state, null, 2);
  if (!window.webxdc) {
    download(name, text, "application/json");
    return;
  }
  try {
    await window.webxdc.sendToChat({
      file: { name: name, plainText: text },
      text: "Workout Tracker backup · " + today(),
    });
  } catch (e) {
    tell("Backup failed: " + (e && e.message ? e.message : e));
  }
}
async function restoreBackup() {
  if (!window.webxdc) {
    $("#dt-import").click(); // its change handler reads the picked file
    return;
  }
  try {
    const [file] = await window.webxdc.importFiles({ extensions: [".json"] });
    if (file) await importBackup(await file.text());
  } catch (e) {
    tell("Restore failed: " + (e && e.message ? e.message : e));
  }
}
async function importBackup(text) {
  let p = null;
  try {
    p = JSON.parse(String(text || ""));
  } catch (err) {
    tell("Restore failed: the file is not a JSON backup (" + err.message + ").");
    return;
  }
  if (!p || !Array.isArray(p.templates) || !Array.isArray(p.cycles)) {
    tell("Restore failed: not a Workout Tracker backup (no plans or cycles).");
    return;
  }
  const msg =
    "Replace everything on this device with this backup?\n\n" +
    plural(p.templates.length, "plan") +
    " · " +
    plural(p.cycles.length, "cycle") +
    " · " +
    plural(sessionCount(p), "session") +
    "\n\nThis cannot be undone.";
  if (!(await ask(msg, "Replace", true))) return;
  state = upgrade(keepPersonal(p, state.personal)); // a backup without body data keeps this one
  saveState();
  render();
}
async function eraseEverything() {
  const msg =
    "Erase everything?\n\n" +
    "Every exercise, plan, cycle and session, your body data, settings, display choices " +
    "and a running workout timer are deleted from this device. " +
    "Make a backup first if you may want them back.\n\nThis cannot be undone.";
  if (!(await ask(msg, "Erase", true))) return;
  try {
    APP_KEYS().forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    tell("Erase failed: " + (e && e.message ? e.message : e));
    return;
  }
  location.reload(); // start clean: data/seed.js, default layout and theme
}
function bindSettings() {
  $("#settings-btn").addEventListener("click", openSettings);
  const sec = $("#sec-settings");
  sec.addEventListener("submit", (e) => {
    if (e.target.id !== "lvl-add") return;
    e.preventDefault();
    addLevel($("#lvl-new").value.trim());
  });
  const actions = {
    "dt-backup": makeBackup,
    "dt-restore": restoreBackup,
    "dt-erase": eraseEverything,
    "dt-about": () => openInfo("about"),
    "dt-help": () => openInfo("help"),
  };
  sec.addEventListener("click", (e) => {
    const el = e.target;
    const sw = el.closest("[data-lvl-colour]");
    const del = el.closest("[data-lvl-del]");
    const row = el.closest("button.set-row");
    if (sw) setLevelColour(+sw.dataset.lvlI, sw.dataset.lvlColour);
    else if (del) removeLevel(+del.dataset.lvlDel);
    else if (row && actions[row.id]) actions[row.id](); // inside the click: pickers need it
  });
  sec.addEventListener("change", (e) => {
    if (e.target.id !== "dt-import" || !e.target.files[0]) return;
    const r = new FileReader();
    r.onload = () => {
      e.target.value = ""; // allow re-picking the same file
      importBackup(r.result);
    };
    r.readAsText(e.target.files[0]);
  });
}
