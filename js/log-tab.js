/* ============ LOG TAB — cycle list ============ */
function renderLog() {
  const sec = $("#sec-log");
  const cs = shelfList(state.cycles).sort((a, b) => b.n - a.n);
  const dt = defaultTpl();
  setTools(
    '<div class="filters">' +
      shelfSelect(state.cycles) +
      colsSelect() +
      "</div>" +
      (shelfOn()
        ? ""
        : '<button class="btn primary" id="lg-new"' +
          (dt ? "" : " disabled") +
          ">+ New cycle" +
          (dt ? ' from "' + esc(dt.name) + '"' : "") +
          "</button>"),
  );
  let h = "";
  if (shelfOn()) {
    if (!cs.length) h += '<div class="card hint" style="margin-bottom:12px">No archived cycles.</div>';
  } else if (!dt)
    h +=
      '<div class="card hint" style="margin-bottom:12px">' +
      (state.templates.length
        ? "No active plan — create one, or restore one from the Plan tab's Archive."
        : "Create a plan in the Plan tab first.") +
      "</div>";
  else if (!cs.length)
    h +=
      '<div class="card hint" style="margin-bottom:12px">No cycles yet — start one from your default plan.</div>';
  const { rows, pager } = paginate("log", cs);
  h += '<div class="grid" data-page-grid="log"' + (ui.cols ? ' data-cols="' + ui.cols + '"' : "") + ">";
  rows.forEach((c) => {
    const vol = volText(c.sessions);
    const last = c.sessions
      .map((s) => s.date)
      .sort()
      .slice(-1)[0];
    const t = tplById(c.templateId);
    h +=
      '<div class="card rowcard' +
      (c.done ? "" : " cyc-live") +
      '" tabindex="0" data-cyc="' +
      c.id +
      '"><div class="row-name">' +
      esc(c.name) +
      "</div>" +
      '<div class="pills">' +
      statusPill(c) +
      (activeTimer()?.c.id === c.id
        ? '<span class="lvl tag-blue">⏱ ' + esc(activeTimer().day.name) + "</span>"
        : "") +
      (c.archived
        ? ""
        : '<button class="btn ghost cyc-mark" data-mark="' +
          c.id +
          '">' +
          (c.done ? "Reopen" : "Mark done") +
          "</button>") +
      "</div>" +
      '<div class="hint">From ' +
      esc(t ? t.name : "a deleted plan") +
      " v" +
      c.templateV +
      " · started " +
      esc(c.created) +
      "</div>" +
      '<div class="hint">' +
      (c.sessions.length
        ? plural(c.sessions.length, "session") +
          " · " +
          vol +
          " total" +
          durTag(c.sessions) +
          " · last " +
          esc(last)
        : "No sessions yet") +
      (c.archived ? " · archived " + esc(c.archived) : "") +
      "</div></div>";
  });
  sec.innerHTML = h + "</div>" + pager;
  if (fitPage("log", sec.querySelector(".grid"))) renderLog(); // page size follows the columns
}
async function deleteCycle(c) {
  const n = c.sessions.length;
  const detail = n ? "Its " + plural(n, "logged session") + " go with it." : "";
  if (!(await confirmDelete("cyc", c, n && plural(n, "logged session"), detail))) return;
  state.cycles = state.cycles.filter((x) => x.id !== c.id);
  if (timer && timer.cycleId === c.id) clearTimer();
  saveState();
  closeModal();
}
/* Duplicating a cycle makes a new cycle with the same plan, version and days (order
   included) but no sessions — logged history stays with the original. Opens for logging. */
function duplicateCycle(c) {
  if (!c) return;
  const n = state.cycles.reduce((m, y) => Math.max(m, y.n), 0) + 1;
  const copy = {
    id: uid(),
    n,
    name: copyName((c.name || "Cycle").trim() || "Cycle", (nm) => state.cycles.some((y) => y.name === nm)),
    templateId: c.templateId,
    templateV: c.templateV,
    created: today(),
    days: slotKeys(clone(c.days)),
    sessions: [],
  };
  state.cycles.push(copy);
  ui.reveal = copy.id;
  saveState();
  viewUI = null; // the copy's editor replaces the source's view; closing it lists cycles
  editFromView = null;
  openCycle(copy.id);
}
function newCycleFromDefault() {
  const t = defaultTpl();
  if (!t) return;
  const v = curV(t);
  const n = state.cycles.reduce((m, c) => Math.max(m, c.n), 0) + 1;
  const c = {
    id: uid(),
    n,
    name: "Cycle " + n,
    templateId: t.id,
    templateV: v.v,
    created: today(),
    days: slotKeys(clone(v.days)),
    sessions: [],
  };
  state.cycles.push(c);
  ui.reveal = c.id;
  saveState();
  openCycle(c.id);
}
/* ONE SESSION PER DAY: a cycle logs each of its days once. Picking a day that is already
   logged opens that session (its date included) and Save overwrites it; the date can be
   changed. States from before 2026-11-08 may hold a day twice — the newest is the one
   edited, older ones stay in the history until deleted there. */
function daySession(c, dayId) {
  return c.sessions
    .filter((s) => s.dayId === dayId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}
/* The newest log of this day in any other cycle (cycles from one plan share day ids), so a
   new cycle starts from where the last one left off. */
function lastDayLog(c, dayId) {
  let best = null;
  state.cycles.forEach((o) => {
    if (o.id === c.id) return;
    o.sessions.forEach((s) => {
      if (s.dayId === dayId && (!best || s.date > best.s.date)) best = { c: o, s };
    });
  });
  return best;
}
function pickDay(c, dayId) {
  const s = daySession(c, dayId);
  cycUI.dayId = dayId;
  cycUI.date = s ? s.date : today();
  cycUI.draft = null;
  delete cycUI.dur;
}
function openCycle(id, dayId) {
  const c = cycById(id);
  if (!c || c.done) return; // a done cycle is read-only until reopened
  const act = activeTimer();
  const timerDay = act && act.c.id === id ? act.day : null;
  const requested = dayId ? c.days.find((d) => d.id === dayId) : null;
  const open = requested || timerDay || c.days.find((d) => !daySession(c, d.id)) || c.days[0];
  cycUI = { id, name: c.name, date: today(), dayId: null, draft: null, draftKey: "" };
  if (open) pickDay(c, open.id);
  render();
}
function bindLog() {
  $("#sec-log").addEventListener("click", (e) => {
    const mark = e.target.closest("[data-mark]");
    if (mark) {
      const c = cycById(mark.dataset.mark);
      return setCycleDone(c, !c.done);
    }
    const card = e.target.closest("[data-cyc]");
    if (card) openView("cyc", card.dataset.cyc);
  });
}
