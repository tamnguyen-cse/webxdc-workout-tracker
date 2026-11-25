/* ============ PAGE SHELL — render, modal root, dialog frame ============ */
/* ---- modal root + render dispatch ---- */
let modalEl = null;
function modalRoot() {
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "modal-root";
    document.body.appendChild(modalEl);
  }
  return modalEl;
}
function closeModal() {
  const back = (tplUI || cycUI || exUI) && editFromView;
  tplUI = null;
  cycUI = null;
  exUI = null;
  pdUI = null;
  helpUI = false;
  infoUI = "";
  viewUI = null;
  editFromView = null;
  if (back && viewItem(back)) {
    viewUI = back; // an editor opened from a view goes back to it, unless the item was deleted
    render();
    return;
  }
  render();
  refocusRow();
}
/* Unsaved edits in the open editor (the views and the shortcut list have none). */
function editorDirty() {
  if (tplUI) return tplDirty();
  if (pdUI) return pdDirty();
  if (cycUI) {
    const c = cycById(cycUI.id);
    return !!c && cycUI.name.trim() !== c.name;
  }
  if (!exUI) return false;
  const d = exUI.draft;
  const x = exUI.id && exById(exUI.id);
  if (!x) return !!(d.name.trim() || d.notes.trim() || d.video || d.by === "time" || d.bw);
  return (
    d.name.trim() !== x.name ||
    d.notes !== (x.notes || "") ||
    d.video !== (x.video || "") ||
    +d.level !== (x.level || 0) ||
    (d.by || "reps") !== (x.by || "reps") ||
    !!d.bw !== !!x.bw
  );
}
/* Esc, ✕ and the backdrop cancel: unsaved edits are dropped, after asking. */
async function cancelModal() {
  if (editorDirty() && !(await ask("Discard unsaved changes?", "Discard", true))) return;
  closeModal();
}
const PAGES = {
  log: "Log",
  plan: "Plan",
  workout: "Workout",
  personal: "Personal",
  stats: "Analytics",
  settings: "Settings",
};
/* Each tab's heading tile has its own colour: a tag colour class, so both themes are covered. */
const PAGE_TINT = {
  log: "blue",
  plan: "green",
  workout: "orange",
  personal: "pink",
  stats: "purple",
  settings: "gray",
};
/* The line under the page title: a short live summary of the active tab. */
function pageSummary() {
  if (ui.tab === "log") {
    const cs = live(state.cycles);
    const archived = state.cycles.length - cs.length;
    if (!cs.length && !archived) return "Start a cycle from your default plan";
    const sess = cs.reduce((n, c) => n + (c.sessions || []).length, 0);
    const dates = cs.flatMap((c) => (c.sessions || []).map((s) => s.date)).sort();
    const last = dates[dates.length - 1];
    return (
      plural(cs.length, "cycle") +
      (sess ? " · " + plural(sess, "session") : "") +
      (last ? " · latest " + last : "") +
      (archived ? " · " + archived + " archived" : "")
    );
  }
  if (ui.tab === "plan") {
    const ts = live(state.templates);
    const archived = state.templates.length - ts.length;
    if (!ts.length && !archived) return "Reusable sets of days and exercises";
    const dt = defaultTpl();
    return (
      plural(ts.length, "plan") +
      (dt ? " · default: " + dt.name : "") +
      (archived ? " · " + archived + " archived" : "")
    );
  }
  if (ui.tab === "workout") {
    const xs = live(state.exercises || []);
    const archived = (state.exercises || []).length - xs.length;
    if (!xs.length && !archived) return "Your exercise library";
    return plural(xs.length, "exercise") + (archived ? " · " + archived + " archived" : "");
  }
  if (ui.tab === "personal") {
    const r = personalResults(state.personal);
    const parts = [];
    if (r.bmi) parts.push("BMI " + r.bmi.toFixed(1) + " (" + bmiCategory(r.bmi)[0].toLowerCase() + ")");
    if (r.tdee) parts.push("TDEE " + r.tdee + " kcal/day");
    else if (r.bmr) parts.push("BMR " + r.bmr + " kcal/day");
    return parts.length ? parts.join(" · ") : "Body metrics, BMI, BMR & TDEE calculators";
  }
  if (ui.tab === "stats") {
    const flat = rangeSessions();
    const label = rangeLabel(ui.statRange);
    if (!flat.length) return label + " · no sessions";
    return (
      label +
      " · " +
      plural(flat.length, "session") +
      " · latest " +
      flat[flat.length - 1].s.date
    );
  }
  return "Exercise levels, data on this device, about";
}
/* The active tab's toolbar sits in the tab bar: inline when it fits, wrapped below when not. */
function setTools(html) {
  $("#tab-tools").innerHTML = html;
}

let shownTab = "";
function render() {
  paintTimer();
  if (ui.tab !== shownTab) {
    shownTab = ui.tab;
    $(".hdr")?.classList.remove("bar-hide");
    lastWinY = Math.max(0, window.scrollY);
  }
  const title = PAGES[ui.tab] || PAGES.log;
  // the page heading shows the same line icon as the active tab (Settings: the gear's)
  const tabIcon = document.querySelector(
    ui.tab === "settings" ? "#settings-btn svg" : '.tab[data-t="' + ui.tab + '"] .tab-ic svg',
  );
  $("#settings-btn").classList.toggle("on", ui.tab === "settings");
  $("#page-icon").replaceChildren(tabIcon.cloneNode(true));
  $("#page-icon").className = "page-icon tag-" + (PAGE_TINT[ui.tab] || "gray");
  $("#page-title").textContent = title;
  $("#page-sub").textContent = pageSummary();
  $("#crumb-page").textContent = title;
  document
    .querySelectorAll(".tab")
    .forEach((b) => b.classList.toggle("on", b.dataset.t === ui.tab));
  document
    .querySelectorAll(".sec")
    .forEach((s) => s.classList.toggle("on", s.id === "sec-" + ui.tab));
  setTools("");
  if (ui.tab === "plan") renderPlan();
  else if (ui.tab === "workout") renderWorkout();
  else if (ui.tab === "log") renderLog();
  else if (ui.tab === "personal") renderPersonal();
  else if (ui.tab === "stats") renderStats();
  else renderSettings();
  renderModal();
}
/* Which dialog is showing — re-rendering the same one keeps its scroll and focused field. */
function modalKey() {
  if (tplUI) return "tpl:" + tplUI.id + ":" + tplUI.dayId; // a new day starts at the top
  if (cycUI) return "cyc:" + cycUI.id + ":" + cycUI.dayId; // a new day starts at the top
  if (exUI) return "ex:" + exUI.id;
  if (pdUI) return "personal";
  if (viewUI) return "view:" + viewUI.kind + ":" + viewUI.id;
  if (infoUI) return "info:" + infoUI;
  return helpUI ? "help" : "";
}
let shownModal = "";
function focusedFieldSelector(root) {
  const el = document.activeElement;
  if (!el || !root.contains(el)) return "";
  if (el.id) return "#" + el.id;
  const cls = el.classList[0];
  if (!cls) return "";
  const ds = ["day", "ex", "i"].filter((k) => el.dataset[k] !== undefined);
  return "." + cls + ds.map((k) => "[data-" + k + '="' + el.dataset[k] + '"]').join("");
}
function renderModal() {
  const root = modalRoot();
  const key = modalKey();
  const same = key && key === shownModal;
  const body = root.querySelector(".modal-body");
  const scroll = same && body ? body.scrollTop : 0;
  const barHide = same && !!root.querySelector(".modal-bar.bar-hide");
  const focusSel = same ? focusedFieldSelector(root) : "";
  if (tplUI) root.innerHTML = tplModalHtml();
  else if (cycUI) root.innerHTML = cycModalHtml();
  else if (exUI) root.innerHTML = exModalHtml();
  else if (pdUI) root.innerHTML = pdModalHtml();
  else if (viewUI) root.innerHTML = viewModalHtml();
  else if (helpUI) root.innerHTML = helpModalHtml();
  else if (infoUI) root.innerHTML = infoModalHtml();
  else root.innerHTML = "";
  shownModal = key;
  lastModalY = same ? scroll : 0;
  if (same) {
    if (barHide) root.querySelector(".modal-bar")?.classList.add("bar-hide");
    const nb = root.querySelector(".modal-body");
    if (nb) nb.scrollTop = scroll;
    const f = focusSel && root.querySelector(focusSel);
    if (f) f.focus({ preventScroll: true });
  }
  syncModalTopPad(root);
  setBgInert(modalOpen());
  shortcutTitles();
  syncTimerTick();
}
/* On phones and tablets (.modal-bar is absolute), keep .modal-body's top padding below a wrapped bar. */
function syncModalTopPad(root) {
  const bar = root.querySelector(".modal-bar");
  const body = root.querySelector(".modal-body");
  if (!bar || !body) return;
  const compact = window.matchMedia("(max-width: 1024px), (hover: none) and (pointer: coarse)").matches;
  if (!compact) {
    body.style.paddingTop = "";
    return;
  }
  const phone = window.matchMedia("(max-width: 760px)").matches;
  const base = phone ? 56 : 60;
  const gap = phone ? 12 : body.closest(".modal.sm") ? 16 : 24;
  body.style.paddingTop = bar.offsetHeight > base ? bar.offsetHeight + gap + "px" : "";
}
/* While a dialog is open the page behind it is inert: no clicks, no tab focus —
   this is what keeps the Plan/Log/Analytics/Data tabs from being reachable. */
function setBgInert(on) {
  on = on || !!askUI; // the ask dialog can outlive the dialog that opened it
  // the page behind stays put, so the sheet's body is the only thing that scrolls
  document.documentElement.classList.toggle("modal-open", on);
  [".hdr", ".main"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el || !el.setAttribute) return;
    if (on) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  });
}
/* <option> list of library exercises for the plan editor's picker column. */
/* Archived exercises are left out, except the one a row already holds (marked). */
function libOptions(sel) {
  const list = (state.exercises || [])
    .filter((x) => !x.archived || x.id === sel)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length)
    return '<option value="">— add exercises in the Workout tab —</option>';
  let h = "";
  if (!sel || !exById(sel)) h += '<option value="" selected>— pick an exercise —</option>';
  return (
    h +
    list
      .map(
        (x) =>
          '<option value="' + x.id + '"' + (x.id === sel ? " selected" : "") + ">" + esc(x.name) +
          (x.archived ? " (archived)" : "") + "</option>",
      )
      .join("")
  );
}
/* Page peek: a bar with the breadcrumb on the left, record-specific `extra` actions and the
   global timer next, and basic `bar` actions + ✕ rightmost, then the scrolling page below.
   opts: { crumb, title, body, bar (basic actions html), extra (record-specific actions html),
           size — omitted = wide (a record's view and editor), "sm" = helper dialogs,
           titleId — makes the title the record's editable name field,
           placeholder — shown while an editable title is empty } */
function modalWrap(opts) {
  return (
    '<div class="modal-bg" data-close-bg="1"><div class="modal' +
    (opts.size ? " " + opts.size : "") +
    '" role="dialog" aria-modal="true" aria-label="' +
    esc(opts.title || opts.crumb) +
    '">' +
    '<div class="modal-bar' +
    (opts.extra ? " has-extra" : "") +
    '"><span class="modal-crumb">' +
    esc(opts.crumb) +
    "</span>" +
    (opts.extra ? '<div class="bar-actions bar-extra">' + opts.extra + "</div>" : "") +
    '<span id="modal-timer">' +
    globalTimerHtml() +
    "</span>" +
    '<div class="bar-actions">' +
    (opts.bar || "") +
    '<button class="iconbtn" data-close="1" title="Close (Esc)" aria-label="Close">✕</button>' +
    "</div></div>" +
    '<div class="modal-body">' +
    titleHtml(opts) +
    opts.body +
    "</div></div></div>"
  );
}
function titleHtml(opts) {
  if (opts.titleId)
    return (
      '<h1 class="modal-title" id="' +
      opts.titleId +
      '" contenteditable="plaintext-only" spellcheck="false" title="Click to rename" data-placeholder="' +
      esc(opts.placeholder || "Untitled") +
      '">' +
      esc(opts.title) +
      "</h1>"
    );
  return opts.title ? '<h1 class="modal-title">' + esc(opts.title) + "</h1>" : "";
}
/* Text of an editable title: one line, spaces collapsed. */
function titleText(el) {
  return el.textContent.replace(/\s+/g, " ");
}
