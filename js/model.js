/* ---- model helpers ---- */
function curV(t) {
  return t.versions[t.versions.length - 1];
}
function tplById(id) {
  return state.templates.find((t) => t.id === id);
}
function defaultTpl() {
  const ts = live(state.templates);
  return ts.find((t) => t.isDefault) || ts[0] || null;
}
function cycById(id) {
  return state.cycles.find((c) => c.id === id);
}
function exCount(days) {
  return days.reduce((n, d) => n + (d.items || []).length, 0);
}
function exById(id) {
  return (state.exercises || []).find((x) => x.id === id) || null;
}
/* Name of an exercise, falling back to the snapshot stored in a session entry so
   history keeps reading correctly even after the library entry is deleted. */
function exName(id, snapshot) {
  const x = exById(id);
  return x ? x.name : snapshot || "(removed from library)";
}
/* Number of cycles whose days reference an exercise. */
function cyclesUsing(exId) {
  return state.cycles.filter((c) =>
    c.days.some((d) => (d.items || []).some((i) => i.ex === exId)),
  ).length;
}
/* Days of the default template's current version that reference an exercise. */
function usedIn(exId) {
  const t = defaultTpl();
  if (!t) return [];
  return curV(t)
    .days.filter((d) => (d.items || []).some((i) => i.ex === exId))
    .map((d) => d.name);
}
/* Reps and seconds of a session, counted separately: a time-counted exercise's sets
   are seconds and never leak into the reps totals (and vice versa). Skipped entries
   count for neither. */
function sessionTotals(sess) {
  let reps = 0;
  let secs = 0;
  Object.entries(sess.entries || {}).forEach(([slot, e]) => {
    if (e.skip) return;
    const byTime = isTime(exById(entryEx(slot, e)));
    e.sets.forEach((v) => {
      if (byTime) secs += parseSeconds(v);
      else reps += parseReps(v);
    });
  });
  return { reps, secs };
}
/* "120 reps", "1:30", "120 reps · 1:30" (or "0 reps" for nothing) — one session, or
   several sessions summed, as the UI shows them. */
function volText(sessions) {
  const list = Array.isArray(sessions) ? sessions : [sessions];
  let reps = 0;
  let secs = 0;
  list.forEach((s) => {
    const t = sessionTotals(s);
    reps += t.reps;
    secs += t.secs;
  });
  const out = [];
  if (reps) out.push(reps + " reps");
  if (secs) out.push(fmtSecs(secs));
  return out.join(" · ") || "0 reps";
}
/* " · ⏱ 52 min" — the workout time of one session or several summed; "" when none timed. */
function durTag(sessions) {
  const list = Array.isArray(sessions) ? sessions : [sessions];
  const secs = list.reduce((n, s) => n + (+s.dur || 0), 0);
  return secs ? " · ⏱ " + durText(secs) : "";
}
/* 3120 → "52 min", 4500 → "1 h 15 min", 30 → "<1 min": a workout's length in words. */
function durText(secs) {
  if (secs > 0 && secs < 60) return "<1 min";
  const m = Math.round(secs / 60);
  return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min";
}
function dayName(c, dayId) {
  const d = c.days.find((x) => x.id === dayId);
  return d ? d.name : "?";
}

/* ---- day reordering (plan editor + cycle editor) ----
   Drop handlers and the ←/→ buttons both end here: the plan reorders its draft,
   which only reaches a version on Save; the cycle reorders its own copy of
   the days and persists at once — the rule its exercise rows already follow. */
function reorderDays(list, from, to) {
  if (to < 0 || to >= list.length || from === to) return false;
  const moved = list.splice(from, 1)[0];
  list.splice(to, 0, moved);
  return true;
}
function moveDay(from, to) {
  let list = null;
  if (tplUI) list = tplUI.draft.days;
  else if (cycUI) {
    const c = cycById(cycUI.id);
    list = c ? c.days : null;
  }
  if (!list || !reorderDays(list, from, to)) return;
  if (cycUI) {
    saveState();
    render();
  } else {
    renderModal();
  }
}

/* ---- ui state ---- */
// cols: gallery layout, set by loadCols() · page / pageCols / reveal: PAGINATION · cal: HISTORY CALENDAR
const ui = {
  tab: "log",
  statEx: "",
  statRange: "2w",
  q: "",
  cols: "",
  shelf: {},
  page: {},
  pageCols: {},
  reveal: "",
  cal: {},
};
let tplUI = null; // { id, viewV, isNew, dayId, draft:{ name, days } } — isNew: Save adds a version
let cycUI = null; // { id, name, date, dayId, draft, draftKey }
let exUI = null; // { id|null, draft:{ name, reps, level, sets, notes, video } }
let helpUI = false; // keyboard-shortcut reference dialog
let infoUI = ""; // "about" | "help": the read-only sheets opened from Settings
let viewUI = null; // { kind: "ex" | "tpl" | "cyc", id } — read-only view of a list row
let editFromView = null; // the view an editor was opened from; closing the editor returns there
function modalOpen() {
  return !!(tplUI || cycUI || exUI || pdUI || helpUI || viewUI || infoUI);
}

/* ============ ARCHIVE — retire a record without losing its history ============
   `archived: "YYYY-MM-DD"` on an exercise, plan or cycle. Archived records leave the tab's
   list, the plan editor's exercise picker, the default plan and "+ New cycle"; plans,
   cycles and logged sessions that already use them keep working. Each tab's shelf select
   (Active / Archive) shows them, and their view offers Restore and Delete forever.
   Deleting a record that old data still uses offers Archive first. */
function live(list) {
  return list.filter((x) => !x.archived);
}
function shelfOn() {
  return !!ui.shelf[ui.tab];
}
/* The records the current tab shows: active ones, or the archived ones on the shelf. */
function shelfList(list) {
  return list.filter((x) => !!x.archived === shelfOn());
}
function shelfSelect(list) {
  const n = list.length - live(list).length;
  return (
    '<select id="shelf" title="Active or archived records">' +
    '<option value=""' + (shelfOn() ? "" : " selected") + ">Active (" + (list.length - n) + ")</option>" +
    '<option value="1"' + (shelfOn() ? " selected" : "") + ">Archive (" + n + ")</option></select>"
  );
}
function chooseShelf(v) {
  ui.shelf[ui.tab] = !!v;
  resetPage(ui.tab);
  render();
}
function recordOf(kind, id) {
  return kind === "ex" ? exById(id) : kind === "tpl" ? tplById(id) : cycById(id);
}
/* A plan list always keeps one active default while any active plan exists. */
function ensureDefault() {
  const ts = live(state.templates);
  if (ts.length && !ts.some((t) => t.isDefault)) ts[0].isDefault = true;
}
function archiveRecord(kind, x) {
  x.archived = today();
  if (kind === "tpl") {
    x.isDefault = false;
    ensureDefault();
  } else if (kind === "cyc" && timer && timer.cycleId === x.id) {
    clearTimer();
  }
  saveState();
  closeModal();
}
function restoreRecord(kind, x) {
  delete x.archived;
  if (kind === "tpl") ensureDefault();
  ui.reveal = x.id;
  saveState();
  closeModal();
}
function archivedNote(x) {
  return x.archived
    ? '<div class="card banner"><span class="lvl tag-gray">Archived ' + esc(x.archived) + "</span>" +
        '<span class="hint">Hidden from lists and new use. Restore it to edit or use it again.</span></div>'
    : "";
}

/* ============ CYCLE STATUS — in progress or Done ============
   Marking a cycle Done stamps `done` with today's date: the Log list stops highlighting
   it and its view loses Edit (so no session can be logged or changed). Reopen clears the
   stamp and makes it editable again. */
function setCycleDone(c, on) {
  if (!c) return;
  if (on) {
    c.done = today();
    if (timer && timer.cycleId === c.id) clearTimer();
  } else delete c.done;
  saveState();
  render();
}
function statusPill(c) {
  return c.done
    ? '<span class="lvl tag-gray">Done ' + esc(c.done) + "</span>"
    : '<span class="lvl tag-blue">In progress</span>';
}
function doneNote(c) {
  return c.done && !c.archived
    ? '<div class="card banner"><span class="lvl tag-gray">Done ' + esc(c.done) + "</span>" +
        '<span class="hint">Read-only. Reopen it to log sessions or edit it.</span></div>'
    : "";
}
