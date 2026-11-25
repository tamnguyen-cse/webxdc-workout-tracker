/* ============ WORKOUT TAB — the exercise library ============ */
/* Exercise levels and their tag colours (.tag-<colour> in css/pills.css). The live list lives in
   state.settings.levels, edited on the Settings page; these are the five defaults a new app
   (or data from before Settings existed) starts with. Stored on each exercise by integer id
   so removing a level never shifts the ids of higher levels.
   v1 was: 0 mobility/prehab · 1 activation · 2 main lift · 3 core · 4 cardio — migrated
   by migrateLevels, so a level 4 from that era reads as cardio 3, never skill. */
const DEFAULT_LEVELS = [
  [0, "mobility", "gray"],
  [1, "endurance", "green"],
  [2, "strength", "blue"],
  [3, "cardio", "orange"],
  [4, "skill", "purple"],
];
function levelOf(id) {
  const n = Math.max(0, Math.floor(+id) || 0);
  const hit =
    state && state.settings && Array.isArray(state.settings.levels)
      ? state.settings.levels.find((l) => l.id === n)
      : null;
  if (hit) return hit;
  const def = DEFAULT_LEVELS.find((d) => d[0] === n);
  return def ? { id: def[0], name: def[1], color: def[2] } : { id: n, name: "level " + n, color: "gray" };
}
const lvlName = (l) => levelOf(l).name;
const lvlColour = (l) => levelOf(l).color;
const lvlClass = (l) => "lvl tag-" + lvlColour(l);
const LVL_V1_TO_V2 = [0, 0, 2, 2, 3]; // activation→mobility, main lift/core→strength, cardio→cardio

function usageHint(id) {
  const cycles = cyclesUsing(id);
  if (!id)
    return '<div class="hint view-more">Saving adds it to the library — then pick it in a plan day from the Plan tab.</div>';
  const days = usedIn(id);
  return (
    '<div class="hint view-more">Used in ' +
    (days.length ? esc(days.join(", ")) : "no days") +
    (cycles ? " · " + plural(cycles, "cycle") : "") +
    ". An edit here shows up everywhere it is used; logged sets are untouched.</div>"
  );
}
/* "1 entry", "2 entries", "2 days": a consonant + y takes -ies, everything else -s. */
function plural(n, word) {
  if (n === 1) return n + " " + word;
  return n + " " + (/[^aeiou]y$/.test(word) ? word.slice(0, -1) + "ies" : word + "s");
}
/* "3 sets × 12 reps", "3 sets × 45s" for a time-counted exercise, or just "3 sets"
   when no target is set */
function doseText(sets, reps, by) {
  const s = plural(sets || 3, "set");
  if (!reps) return s;
  return s + " × " + (by === "time" ? fmtSecs(reps) : plural(reps, "rep"));
}
/* Load of a plan item or session entry: `bw` comes from the library exercise (falling back
   to the entry's snapshot if deleted); `wt` (kg) lives on the plan item or session entry. */
function itemLoad(it, x) {
  return {
    bw: x ? !!x.bw : !!(it && it.bw),
    wt: +(it && it.wt) || 0,
  };
}
/* "bodyweight + 10 kg", "bodyweight", "12.5 kg", or "" for no load set */
function loadText(load) {
  if (load.bw) return "bodyweight" + (load.wt ? " + " + load.wt + " kg" : "");
  return load.wt ? load.wt + " kg" : "";
}
/* Weight input value: blank instead of 0, so the placeholder shows. */
function wtValue(wt) {
  return wt ? String(wt) : "";
}
/* 🧍 = bodyweight is the base load; 🏋️ = external weight only. */
function bwIcon(bw) {
  const on = !!bw;
  const label = on ? "Bodyweight exercise" : "External weight only (not bodyweight)";
  return (
    '<span class="bw-ico" title="' +
    label +
    '" aria-label="' +
    label +
    '">' +
    (on ? "🧍" : "🏋️") +
    "</span>"
  );
}
function bwPill(bw) {
  const on = !!bw;
  const label = on ? "Bodyweight exercise" : "External weight only (not bodyweight)";
  return (
    '<span class="lvl tag-gray" title="' +
    label +
    '">' +
    (on ? "🧍 bodyweight" : "🏋️ weights") +
    "</span>"
  );
}
function renderWorkout() {
  const sec = $("#sec-workout");
  const q = (ui.q || "").trim().toLowerCase();
  // default order: by level, then name (0 mobility → 4 skill, alphabetical inside)
  let list = shelfList(state.exercises || [])
    .slice()
    .sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name));
  if (q)
    list = list.filter((x) =>
      ((x.name || "") + " " + (x.notes || "")).toLowerCase().includes(q),
    );
  setTools(
    '<input id="wk-q" class="q" type="search" placeholder="Search…" value="' +
      esc(ui.q || "") +
      '">' +
      '<div class="filters">' +
      shelfSelect(state.exercises || []) +
      colsSelect() +
      "</div>" +
      (shelfOn() ? "" : '<button class="btn primary" id="wk-new">+ New exercise</button>'),
  );
  let h =
    '<div class="hint" style="margin-bottom:12px">The exercise library, sorted by level then name. Plan days and log entries only <b>reference</b> these, so names, levels, bodyweight, notes and videos are edited here and update everywhere at once; sets, targets and weight (kg) are set in each plan.</div>';
  if (!list.length)
    h +=
      '<div class="card hint">' +
      (q
        ? "No exercises match “" + esc(ui.q) + "”."
        : shelfOn()
          ? "No archived exercises."
          : "No exercises yet — add the first one.") +
      "</div>";
  const { rows, pager } = paginate("workout", list);
  h += '<div class="grid" data-page-grid="workout"' + (ui.cols ? ' data-cols="' + ui.cols + '"' : "") + ">";
  rows.forEach((x) => {
    const days = usedIn(x.id);
    const cycles = cyclesUsing(x.id);
    const l = x.level || 0;
    h +=
      '<div class="card rowcard" tabindex="0" data-ex="' +
      x.id +
      '"><div class="row-name">' +
      esc(x.name) +
      (x.video
        ? ' <a class="vlink" href="' + esc(x.video) + '" target="_blank" rel="noopener">▶ video</a>'
        : "") +
      "</div>" +
      '<div class="pills"><span class="' +
      lvlClass(l) +
      '">' +
      l +
      " · " +
      esc(lvlName(l)) +
      "</span>" +
      bwPill(x.bw) +
      "</div>" +
      '<div class="hint">' +
      (isTime(x) ? "Counted by time (s)" : "Counted by reps") +
      (days.length ? " · used in " + esc(days.join(", ")) : " · not in any day yet") +
      (cycles ? " · " + plural(cycles, "cycle") : "") +
      (x.archived ? " · archived " + esc(x.archived) : "") +
      "</div>" +
      (x.notes ? '<div class="row-notes">' + esc(x.notes) + "</div>" : "") +
      '<button class="iconbtn row-del" data-ex="' +
      x.id +
      '" title="' +
      (x.archived ? "Delete forever" : "Delete from the library") +
      '">✕</button></div>';
  });
  sec.innerHTML = h + "</div>" + pager;
  if (fitPage("workout", sec.querySelector(".grid"))) renderWorkout(); // page size follows the columns
}
const COLS_KEY = "workout-tracker-cols";
const VIEWS = [
  ["", "Auto", "As many columns as fit"],
  ["1", "List", "1 column"],
  ["2", "Cards", "2 columns"],
  ["3", "Gallery", "3 columns"],
];
function loadCols() {
  try {
    const v = localStorage.getItem(COLS_KEY) || "";
    return VIEWS.some(([k]) => k === v) ? v : "";
  } catch (e) {
    return "";
  }
}
function colsSelect() {
  return (
    '<select id="cols" title="Layout">' +
    VIEWS.map(
      ([v, name, hint]) =>
        '<option value="' + v + '" title="' + hint + '"' + (v === ui.cols ? " selected" : "") +
        ">View: " + name + "</option>",
    ).join("") +
    "</select>"
  );
}
function chooseCols(v) {
  ui.cols = v;
  try {
    if (v) localStorage.setItem(COLS_KEY, v);
    else localStorage.removeItem(COLS_KEY);
  } catch (e) {
    console.warn("Layout not saved (storage unavailable):", e);
  }
  render();
}
function bindTools() {
  $("#tab-tools").addEventListener("change", (e) => {
    if (e.target.id === "cols") chooseCols(e.target.value);
    else if (e.target.id === "shelf") chooseShelf(e.target.value);
  });
  $("#tab-tools").addEventListener("click", (e) => {
    if (e.target.closest("#wk-new")) openEx(null);
    else if (e.target.closest("#pl-new")) newTemplate();
    else if (e.target.closest("#lg-new")) newCycleFromDefault();
    else if (e.target.closest("#pd-edit")) openPersonal();
  });
}
function bindWorkout() {
  // search: keep the query in ui so re-renders preserve it; refocus after each render
  $("#tab-tools").addEventListener("input", (e) => {
    if (e.target.id !== "wk-q") return;
    ui.q = e.target.value;
    resetPage("workout");
    render();
    const inp = $("#wk-q");
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  });
  $("#sec-workout").addEventListener("click", (e) => {
    const el = e.target;
    if (el.closest("a")) return; // let video links open normally
    const del = el.closest(".row-del");
    if (del) {
      deleteExercise(del.dataset.ex);
      return;
    }
    const card = el.closest("[data-ex]");
    if (card) openView("ex", card.dataset.ex);
  });
}
