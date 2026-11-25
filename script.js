/* ============================================================
   Workout Tracker — app logic
   Template: sync-app-style 2026-11-25 (upgrades: the skill's references/changelog.md)
   Data model (localStorage key LS in js/helpers.js; a fresh install starts from data/seed.js):
     templates: [{ id, name, isDefault, updated,
                   versions: [{ v, updated, days: [Day] }] }]
     cycles:    [{ id, n, name, templateId, templateV, created,
                   days: [Day], sessions: [Session] }]
     Day:      { id, name, color, items: [{ ex, key?, sets, reps, wt?, notes? }] }
             `key`: a cycle day item's log slot, set only when the day holds the same
             exercise more than once (see slotKeys); absent = the exercise id.
     Exercise: { id, name, level, notes, video, by, bw }
             `by`: "reps" (default, also when absent) | "time" — for a time-counted
             exercise (hold, timed set) a plan day item's `reps` holds seconds.
             `bw`: true = bodyweight exercise (defined on the exercise; `wt` in kg lives
             on the plan day item and session entry — added on top of body weight when
             `bw` is true, the lifted weight otherwise).
     Session:  { date, dayId, dur?, entries: { [slot]: { ex?, sets, expr?, note, skip, bw, wt } } }
             `dur`: workout time in seconds from the day's stopwatch (absent = not timed);
             the running clock itself lives outside the state — see WORKOUT TIMER.
             `sets`: one number per set — reps, or seconds for a time-counted exercise
             ("" = not done); the formula typed for it (16+2, 3*5, 60+30) is kept in
             `expr["sets.<i>"]` — see FORMULA INPUT.
             slot = the day item's key, else its exercise id; `ex` names the exercise
             when the slot is a key (entryEx).
     done:     optional ISO date on a cycle — the day it was marked Done. A done cycle is
             read-only (no logging, no editing) until it is reopened; absent = in progress
             (see CYCLE STATUS).
     archived: optional ISO date on an exercise, template or cycle — the record leaves its
             tab's list, pickers and "new" flows but keeps its history (see ARCHIVE).
     settings: { levels: [{ id, name, color }] } — exercise levels edited on Settings.
     personal: { height, weight, gender, age, freq } — cm, kg, "m"|"f", years,
             workouts per week; read by the Personal tab calculators.
   Code: one file per section in js/, loaded as classic scripts in the order index.html
   lists them, all sharing one global scope. This file loads last and only starts the
   app: a top-level statement in js/ may use only what an earlier file declared.
   ============================================================ */
/* ============ INIT ============ */
function init() {
  bindCalc();
  loadState();
  ui.cols = loadCols();
  document.querySelectorAll(".tab").forEach((b) =>
    b.addEventListener("click", () => {
      // A dialog is modal: tabs stay put until it is closed (the overlay also
      // covers the header, this is the belt-and-braces guard).
      if (modalOpen()) return;
      ui.tab = b.dataset.t;
      render();
    }),
  );
  document.addEventListener("keydown", onShortcut);
  $("#kbd-help").addEventListener("click", openHelp);
  bindTools();
  bindTimer();
  bindPlan();
  bindWorkout();
  bindLog();
  bindStats();
  bindSettings();
  bindModal();
  bindTheme();
  bindChoicePicks();
  bindKeyboardReset();
  bindBarScroll();
  bindSwipe();
  bindViewSwipe();
  bindPagers();
  bindCalendars();
  render();
}
init();
