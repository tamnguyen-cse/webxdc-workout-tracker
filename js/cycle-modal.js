/* ============ CYCLE MODAL — logging ============ */
/* "Target: 12 · notes" under an exercise — "Target: 45s" when it is counted by time:
   the plan day's target and notes (falling back to the Workout notes). */
function exPlanLine(it, x) {
  const reps = it.reps;
  const notes = it.notes || (x && x.notes) || "";
  if (!reps && !notes) return "";
  const target = reps ? "Target: " + (isTime(x) ? fmtSecs(reps) : reps) : "";
  return (
    '<div class="ex-target">' +
    target +
    (target && notes ? " · " : "") +
    esc(notes) +
    "</div>"
  );
}
function blankDraft(day) {
  const draft = {};
  (day ? day.items : []).forEach((it) => {
    const x = exById(it.ex);
    draft[slotOf(it)] = {
      sets: Array(it.sets || 3).fill(""),
      note: "",
      skip: false,
      ...itemLoad(it, x),
      name: x ? x.name : "",
      ...(it.key ? { ex: it.ex } : {}),
    };
  });
  return draft;
}
function cycDraft() {
  const c = cycById(cycUI.id);
  const key = cycUI.dayId;
  if (cycUI.draft && cycUI.draftKey === key) return cycUI.draft;
  const existing = daySession(c, cycUI.dayId);
  const prev = existing ? null : lastDayLog(c, cycUI.dayId);
  const src = existing ? existing.entries : prev && prev.s.entries;
  const day = c.days.find((d) => d.id === cycUI.dayId);
  const draft = {};
  (day ? day.items : []).forEach((it) => {
    const x = exById(it.ex);
    const p = src && src[slotOf(it)];
    const planned = it.sets || 3;
    // bodyweight follows the Workout library; weight carries over from the previous session, else the plan's
    const load = {
      bw: !!(x && x.bw),
      wt: p && p.wt !== undefined ? +p.wt || 0 : +(it.wt || 0),
    };
    const own = it.key ? { ex: it.ex } : {};
    draft[slotOf(it)] =
      existing && p
        ? {
            sets: p.sets.slice(),
            ...(p.expr ? { expr: clone(p.expr) } : {}),
            note: p.note || "",
            skip: !!p.skip,
            ...load,
            name: p.name || (x ? x.name : ""),
            ...own,
          }
        : { sets: Array(planned).fill(""), note: "", skip: false, ...load, name: x ? x.name : "", ...own };
  });
  cycUI.draft = draft;
  cycUI.draftKey = key;
  return draft;
}
function cycModalHtml() {
  const c = cycById(cycUI.id);
  if (!c) {
    cycUI = null;
    return "";
  }
  const t = tplById(c.templateId);
  let day = c.days.find((d) => d.id === cycUI.dayId);
  if (!day) {
    day = c.days[0] || null;
    cycUI.dayId = day ? day.id : null;
  }
  const draft = cycDraft();
  const existing = daySession(c, cycUI.dayId);
  const prev = existing ? null : lastDayLog(c, cycUI.dayId);
  let h =
    '<div class="props">' +
    prop(
      "Date",
      '<input id="cyc-date" type="date" aria-label="Session date" value="' + esc(cycUI.date) + '">',
      "◷",
    ) +
    prop("Time", timerRowHtml(c, cycUI.dayId), "⏱") +
    prop("Plan", esc(t ? t.name : "deleted plan") + " v" + c.templateV, "▾") +
    prop("Created", esc(c.created), "◷") +
    "</div>";
  h += '<div class="chips">';
  c.days.forEach((d, i) => {
    const on = d.id === cycUI.dayId;
    // active chip gets the day's Notion tag class (tag-blue / tag-purple / …) from css/pills.css
    const tag = "tag-" + colourOf(d.color);
    h +=
      '<button class="chip dnd-day' +
      (on ? " on " + tag : "") +
      '" data-dayorder="' +
      i +
      '" data-day="' +
      d.id +
      '" draggable="true" title="Drag to reorder days">' +
      esc(d.name) +
      (daySession(c, d.id) ? ' <span aria-label="logged">✓</span>' : "") +
      (isTimerDay(c, d.id)
        ? ' <span aria-label="active timer" title="Active workout timer">⏱</span>'
        : "") +
      "</button>";
  });
  const ci = c.days.findIndex((d) => d.id === cycUI.dayId);
  h +=
    '<button class="iconbtn chip-move" id="cyc-dayup"' +
    (ci <= 0 ? " disabled" : "") +
    ' title="Move this day left">←</button>' +
    '<button class="iconbtn chip-move" id="cyc-daydown"' +
    (ci < 0 || ci >= c.days.length - 1 ? " disabled" : "") +
    ' title="Move this day right">→</button>';
  h += "</div>";
  h +=
    '<div class="card banner"><span class="lvl ' +
    (existing ? "tag-blue" : "tag-green") +
    '">' +
    (existing ? "Logged " + esc(existing.date) : "New session") +
    "</span>" +
    '<span class="hint">' +
    (existing
      ? "This day is logged once per cycle — Save overwrites it."
      : prev
        ? "Weights from " + esc(prev.c.name) + " · " + esc(prev.s.date) + "."
        : "Nothing logged for this day before.") +
    '</span><button class="btn" id="cyc-clear">Clear</button></div>';
  (day ? day.items : []).forEach((it) => {
    const x = exById(it.ex);
    const en = draft[slotOf(it)];
    const lvl = x ? x.level || 0 : 0;
    const name = x ? x.name : en.name || "(removed from library)";
    h +=
      '<div class="ex dnd-row' +
      (en.skip ? " skip" : "") +
      '" data-ex="' +
      slotOf(it) +
      '"' +
      (TOUCH ? ' draggable="true"' : "") +
      '><div class="ex-head">' +
      '<span class="grip" draggable="true" title="Drag to reorder">⠿</span>' +
      '<span class="' +
      lvlClass(lvl) +
      '">' +
      lvl +
      "</span>" +
      bwIcon(en.bw) +
      '<span class="ex-name">' +
      esc(name) +
      "</span>" +
      (x ? "" : ' <span class="hint">(not in the library)</span>') +
      (x && x.video
        ? '<a class="vlink" href="' + esc(x.video) + '" target="_blank" rel="noopener">▶</a>'
        : "") +
      '<label class="hint"><input type="checkbox" class="ex-skip" data-ex="' +
      slotOf(it) +
      '"' +
      (en.skip ? " checked" : "") +
      "> skip</label></div>" +
      exPlanLine(it, x) +
      '<div class="ex-load">' +
      '<span class="hint">' +
      (en.bw ? "🧍 bodyweight +" : "🏋️ weight") +
      "</span>" +
      '<label class="check"><input class="ex-wt" data-ex="' +
      slotOf(it) +
      '" type="number" min="0" step="0.5" inputmode="decimal" value="' +
      wtValue(en.wt) +
      '" placeholder="0" aria-label="' +
      (en.bw ? "Added weight" : "Weight") +
      ' (kg)"> kg</label></div>' +
      '<div class="sets">' +
      en.sets.map((v, i) => setInput(it, x, en, i)).join("") +
      '<button class="iconbtn add-set" data-ex="' +
      slotOf(it) +
      '" title="Add set">＋</button>' +
      '<button class="iconbtn del-set" data-ex="' +
      slotOf(it) +
      '" title="Remove set">－</button></div>' +
      '<input class="ex-note-in" data-ex="' +
      slotOf(it) +
      '" placeholder="note…" value="' +
      esc(en.note) +
      '"></div>';
  });
  const hs = orderedCycleSessions(c);
  if (hs.length) {
    h += '<h3 class="hist-h">Sessions in this cycle</h3><div class="hist">';
    hs.forEach((s) => {
      h +=
        '<div class="hist-row"><span>' +
        esc(s.date) +
        " · " +
        esc(dayName(c, s.dayId)) +
        " — " +
        volText(s) +
        durTag(s) +
        (daySession(c, s.dayId) === s
          ? ""
          : ' <span class="hint">· earlier log of this day, kept from before</span>') +
        '</span><button class="iconbtn hs-del" data-date="' +
        s.date +
        '" data-dayid="' +
        s.dayId +
        '" title="Delete this session">✕</button></div>';
    });
    h += "</div>";
  }
  const cycActs = '<button class="btn primary" id="cyc-save">Save</button>';
  return modalWrap({
    crumb: "Log / " + (t ? t.name : "deleted plan"),
    title: cycUI.name,
    titleId: "cyc-name",
    placeholder: "Cycle name",
    body: h,
    bar: cycActs,
  });
}
/* Every set is a formula field: reps (16+2, 3*5) or seconds (45, 60+30, and 1:30 from a
   hardware keyboard). inputmode "tel" opens the phone pad on a phone — digits plus + and *,
   no letters; it has no ":" on an iPhone, so time is typed there in seconds. */
function setInput(it, x, en, i) {
  const time = isTime(x);
  const v = en.sets[i];
  return calcInput({
    value: time && typeof v === "number" ? clockText(v) : v,
    expr: en.expr && en.expr["sets." + i],
    label: "Set " + (i + 1) + (time ? " seconds" : " reps"),
    placeholder: "set " + (i + 1) + (time ? " (s)" : ""),
    cls: time ? "set-in calc-clock" : "set-in",
    mode: "tel",
    attrs: 'data-ex="' + esc(slotOf(it)) + '" data-i="' + i + '"',
  });
}
function cycInput(e) {
  const el = e.target;
  if (el.id === "cyc-name") {
    cycUI.name = titleText(el);
    return;
  }
  const draft = cycUI.draft;
  if (!draft) return;
  if (el.classList.contains("set-in")) readSet(draft[el.dataset.ex], el);
  else if (el.classList.contains("ex-wt")) draft[el.dataset.ex].wt = Math.max(0, +el.value || 0);
  else if (el.classList.contains("ex-note-in")) draft[el.dataset.ex].note = el.value;
}
/* Store what a set field holds: the result — reps, or seconds — (≥ 0, "" when empty) and
   its formula. Text that can't be worked out leaves the draft as it was —
   the field shows a red ring and Save refuses. */
function readSet(en, el) {
  const i = +el.dataset.i;
  const { n, expr } = readCalc(el);
  if (!el.value.trim()) en.sets[i] = "";
  else if (isNaN(n)) return;
  else en.sets[i] = Math.max(0, n);
  keepExpr(en, "sets." + i, expr);
}
function cycChange(e) {
  const el = e.target;
  if (el.id === "cyc-date") {
    cycUI.date = el.value || today();
    render();
    return;
  }
  if (el.id === "cyc-timer") {
    timerTyped(cycById(cycUI.id), el);
    return;
  }
  if (el.classList.contains("ex-skip")) {
    cycUI.draft[el.dataset.ex].skip = el.checked;
    render();
  }
}
/* Save also commits a renamed cycle; Esc or ✕ drops both. A save that goes
   through returns to the cycle's view, however the editor was opened. The session takes
   the day's stopwatch time (see WORKOUT TIMER). */
function saveSession() {
  const c = cycById(cycUI.id);
  if (cycUI.draft && cycUI.dayId && document.querySelector(".set-in[aria-invalid]")) {
    tell("A set can't be worked out — fix the field with the red ring (e.g. 16+2 or 3x5).");
    return;
  }
  c.name = cycUI.name.trim() || c.name;
  if (cycUI.draft && cycUI.dayId) {
    const entries = clone(cycUI.draft);
    const dur = sessionDur(c);
    const ex = daySession(c, cycUI.dayId);
    if (ex) {
      ex.entries = entries;
      ex.date = cycUI.date;
      if (dur) ex.dur = dur;
      else delete ex.dur;
    } else {
      const s = { date: cycUI.date, dayId: cycUI.dayId, entries };
      if (dur) s.dur = dur;
      c.sessions.push(s);
    }
  }
  ui.reveal = c.id;
  saveState();
  editFromView = { kind: "cyc", id: c.id };
  closeModal();
}
/* Seconds to save for the open day — a time still being typed (⌘Enter skips its change
   event) counts. A paused global timer on this day is cleared once saved to the session. */
function sessionDur(c) {
  const dayId = cycUI.dayId;
  const field = $("#cyc-timer");
  const curFace = clockFace(timerSecs(timerOf(c, dayId)));
  const typed = field && !field.readOnly && field.value !== curFace ? parseDur(field.value) : NaN;
  if (!isNaN(typed)) applyTypedDur(c, dayId, typed);
  const t = timerOf(c, dayId);
  const dur = timerSecs(t);
  if (isTimerDay(c, dayId) && !timer.since) clearTimer();
  return dur;
}
function cycClick(e) {
  const c = cycById(cycUI.id);
  const el = e.target;
  const chip = el.closest(".chip[data-day]");
  if (chip) {
    pickDay(c, chip.dataset.day);
    render();
    return;
  }
  if (el.closest("#cyc-dayup") || el.closest("#cyc-daydown")) {
    const i = c.days.findIndex((d) => d.id === cycUI.dayId);
    const dir = el.closest("#cyc-dayup") ? -1 : 1;
    if (i > -1) moveDay(i, i + dir);
    return;
  }
  if (el.closest("#cyc-timer-go") || el.closest("#cyc-timer-reset")) {
    timerClick(c, el);
    return;
  }
  if (el.closest("#cyc-clear")) {
    cycUI.draft = blankDraft(c.days.find((d) => d.id === cycUI.dayId));
    render();
    return;
  }
  const as = el.closest(".add-set");
  if (as) {
    cycUI.draft[as.dataset.ex].sets.push("");
    render();
    return;
  }
  const ds = el.closest(".del-set");
  if (ds) {
    const en = cycUI.draft[ds.dataset.ex];
    if (en.sets.length > 1) {
      en.sets.pop();
      keepExpr(en, "sets." + en.sets.length, "");
    }
    render();
    return;
  }
  if (el.closest("#cyc-save")) {
    saveSession();
    return;
  }
  const hd = el.closest(".hs-del");
  if (hd) {
    c.sessions = c.sessions.filter(
      (s) => !(s.date === hd.dataset.date && s.dayId === hd.dataset.dayid),
    );
    saveState();
    render();
  }
}
