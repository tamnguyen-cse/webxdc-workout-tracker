/* ============ TEMPLATE MODAL ============ */
function tplDayLabel(day) {
  return (day && day.name ? day.name : "").trim() || "Untitled day";
}
function tplChipsHtml(days, di) {
  let h = '<div class="chips">';
  days.forEach((dd, i) => {
    const on = i === di;
    // active chip gets the day's Notion tag class (tag-blue / tag-purple / …) from css/pills.css
    const tag = "tag-" + colourOf(dd.color);
    h +=
      '<button type="button" class="chip dnd-day' +
      (on ? " on " + tag : "") +
      '" data-dayorder="' +
      i +
      '" data-day="' +
      esc(dd.id) +
      '" draggable="true" title="Drag to reorder days">' +
      esc(tplDayLabel(dd)) +
      "</button>";
  });
  h += '<button type="button" class="chip chip-add" id="pl-addday" title="Add day">+ Add day</button>';
  if (days.length) {
    h +=
      '<button type="button" class="iconbtn chip-move" id="tpl-dayup"' +
      (di <= 0 ? " disabled" : "") +
      ' title="Move this day left" aria-label="Move this day left">←</button>' +
      '<button type="button" class="iconbtn chip-move" id="tpl-daydown"' +
      (di < 0 || di >= days.length - 1 ? " disabled" : "") +
      ' title="Move this day right" aria-label="Move this day right">→</button>';
  }
  return h + "</div>";
}
function tplExBadgesHtml(x) {
  if (!x) return "";
  const lvl = x.level || 0;
  return (
    '<span class="pex-badges">' +
    '<span class="' +
    lvlClass(lvl) +
    '">' +
    lvl +
    " · " +
    esc(lvlName(lvl)) +
    "</span>" +
    bwPill(x.bw) +
    "</span>"
  );
}
function tplExCardHtml(it, di, xi) {
  const x = exById(it.ex);
  const time = isTime(x);
  const bw = !!(x && x.bw);
  const attrs = ' data-day="' + di + '" data-ex="' + xi + '"';
  return (
    '<div class="ex pex dnd-row"' +
    attrs +
    (TOUCH ? ' draggable="true"' : "") +
    '><div class="ex-head pex-head">' +
    '<span class="grip" draggable="true" title="Drag to reorder">⠿</span>' +
    '<select class="pe-pick"' +
    attrs +
    ' aria-label="Exercise">' +
    libOptions(it.ex) +
    "</select>" +
    tplExBadgesHtml(x) +
    '<button type="button" class="iconbtn pe-del"' +
    attrs +
    ' title="Remove from this day (the exercise itself stays in Workout)" aria-label="Remove exercise">✕</button>' +
    '</div><div class="pex-fields">' +
    '<label class="pex-field"><span>Sets</span>' +
    '<input class="pe-sets"' +
    attrs +
    ' type="number" min="1" step="1" inputmode="numeric" value="' +
    (it.sets || "") +
    '" placeholder="sets"></label>' +
    '<label class="pex-field"><span>' +
    (time ? "Time (s)" : "Reps") +
    '</span><input class="pe-reps"' +
    attrs +
    ' type="number" min="1" step="1" inputmode="numeric" value="' +
    (it.reps || "") +
    '" placeholder="' +
    (time ? "secs" : "reps") +
    '" title="' +
    (time ? "Seconds" : "Reps") +
    '"></label>' +
    '<label class="pex-field"><span>' +
    (bw ? "+ Weight (kg)" : "Weight (kg)") +
    '</span><input class="pe-wt"' +
    attrs +
    ' type="number" min="0" step="0.5" inputmode="decimal" value="' +
    (it.wt === undefined ? "" : it.wt) +
    '" placeholder="' +
    (bw ? "+ kg" : "kg") +
    '" title="Weight in kg — added on top of body weight for a bodyweight exercise"></label>' +
    '<label class="pex-field pex-notes"><span>Notes</span>' +
    '<input class="pe-notes"' +
    attrs +
    ' type="text" value="' +
    esc(it.notes || "") +
    '" placeholder="' +
    esc((x && x.notes) || "Notes…") +
    '"></label></div></div>'
  );
}
function tplQuickExHtml(q) {
  const typeSel = choicePicker("qex-bw", q.bw ? "1" : "0", [
    { value: "1", html: bwPill(true) },
    { value: "0", html: bwPill(false) },
  ]);
  return (
    '<div class="card qex">' +
    '<div class="qex-head"><span class="qex-title">New workout</span>' +
    '<button type="button" class="iconbtn qex-cancel" title="Cancel (Esc)" aria-label="Cancel">✕</button></div>' +
    '<div class="qex-row">' +
    '<label class="pex-field"><span>Name</span>' +
    '<input id="qex-name" type="text" value="' +
    esc(q.name) +
    '" placeholder="e.g. Ring Face Pulls"></label>' +
    '<div class="pex-field qex-type-f"><span>Type</span>' +
    typeSel +
    "</div></div>" +
    '<label class="pex-field qex-note-f"><span>Note</span>' +
    '<textarea id="qex-notes" rows="2" placeholder="Ring height, cues…">' +
    esc(q.notes) +
    "</textarea></label>" +
    '<div class="qex-acts">' +
    '<button type="button" class="btn qex-cancel">Cancel</button>' +
    '<button type="button" class="btn primary" id="qex-create">Create &amp; add</button>' +
    "</div></div>"
  );
}
function tplDayBodyHtml(day, di) {
  const items = day.items || [];
  let h =
    '<div class="dayhdr">' +
    '<input class="pl-dname" data-day="' +
    di +
    '" type="text" value="' +
    esc(day.name) +
    '" placeholder="Day name" aria-label="Day name">' +
    colourPicker(String(di), day.color) +
    '<span class="day-acts">' +
    '<button type="button" class="iconbtn pl-delday" data-day="' +
    di +
    '" title="Delete day" aria-label="Delete day">✕</button></span></div>';
  h += items.length
    ? items.map((it, xi) => tplExCardHtml(it, di, xi)).join("")
    : '<div class="card hint">No exercises in this day yet.</div>';
  if (tplUI.quickEx) return h + tplQuickExHtml(tplUI.quickEx);
  return (
    h +
    '<div class="day-foot">' +
    '<button type="button" class="btn pl-addex" data-day="' +
    di +
    '">+ Add exercise</button>' +
    '<button type="button" class="btn pl-quickex" data-day="' +
    di +
    '">+ New workout</button></div>'
  );
}
function tplModalHtml() {
  const t = tplById(tplUI.id);
  if (!t) {
    tplUI = null;
    return "";
  }
  const d = tplUI.draft;
  let di = d.days.findIndex((day) => day.id === tplUI.dayId);
  if (di < 0 && d.days.length) {
    di = 0;
    tplUI.dayId = d.days[0].id;
  }
  const day = di >= 0 ? d.days[di] : null;
  const nextV = curV(t).v + 1;
  const extra = t.isDefault ? "" : '<button class="btn ghost" id="tpl-default">Set as default</button>';
  const acts = '<button class="btn primary" id="tpl-save">Save</button>';
  let h =
    '<div class="hint" style="margin-bottom:10px">' +
    (tplUI.isNew
      ? "Save adds these days as v" + nextV + ", the current version, starting from v" + tplUI.viewV
      : "Save writes your changes to v" + tplUI.viewV) +
    "; Esc or ✕ discards them. Days list exercises from the <b>Workout</b> library; enter each exercise's sets, reps/time target and weight (kg) here (leave notes blank to use the Workout default, shown in gray).</div>";
  h += tplChipsHtml(d.days, di);
  h += day
    ? tplDayBodyHtml(day, di)
    : '<div class="card hint">No days yet — click <b>+ Add day</b> to add one.</div>';
  return modalWrap({
    crumb: tplUI.isNew ? "Plan / New version v" + nextV : "Plan / Edit v" + tplUI.viewV,
    title: d.name,
    titleId: "tpl-name",
    placeholder: "Plan name",
    body: h,
    bar: acts,
    extra,
  });
}
/* Quick-create a library exercise from inside the plan editor (name, type, note) and
   immediately append it to the active plan day. The library entry persists right away;
   the plan day addition still commits on Plan Save. */
function tplQuickCreate() {
  const q = tplUI && tplUI.quickEx;
  if (!q) return;
  const name = q.name.trim();
  if (!name) {
    tell("Give the workout a name first.");
    return;
  }
  const d = tplUI.draft;
  const di = d.days.findIndex((day) => day.id === tplUI.dayId);
  const ex = {
    id: uid(),
    name,
    by: "reps",
    level: defaultLevelId(),
    bw: !!q.bw,
    notes: q.notes.trim(),
    video: "",
  };
  state.exercises.push(ex);
  saveState();
  tplUI.quickEx = null;
  let xi = -1;
  if (di >= 0) {
    d.days[di].items.push({ ex: ex.id });
    xi = d.days[di].items.length - 1;
  }
  render();
  if (di >= 0 && xi >= 0) {
    const setsIn = modalRoot().querySelector('.pe-sets[data-day="' + di + '"][data-ex="' + xi + '"]');
    if (setsIn) setsIn.focus();
  }
}
/* The plan editor works on a draft: Save writes it to the version being edited — or adds
   it as the next version when the editor came from New version — and Esc or ✕ drops it.
   An unchanged edit saves nothing, so opening a plan and pressing Save doesn't bump its
   "updated" date; a new version is added even unchanged, since asking for it was the edit. */
function tplDirty() {
  const t = tplById(tplUI.id);
  const v = t && t.versions.find((x) => x.v === tplUI.viewV);
  const d = tplUI.draft;
  return !!v && (d.name.trim() !== t.name || JSON.stringify(d.days) !== JSON.stringify(v.days));
}
function tplSave() {
  const t = tplById(tplUI.id);
  const d = tplUI.draft;
  const badDay = d.days.find((day) =>
    (day.items || []).some((it) => !it.ex || !(it.sets >= 1) || !(it.reps >= 1)),
  );
  if (badDay) {
    if (tplUI.dayId !== badDay.id) {
      tplUI.dayId = badDay.id;
      tplUI.quickEx = null;
      render();
    }
    tell(
      'Enter sets and a target (reps or seconds) for every exercise in "' +
        tplDayLabel(badDay) +
        '".',
    );
    return;
  }
  if (tplUI.isNew) {
    const nv = { v: curV(t).v + 1, updated: today(), days: clone(d.days) };
    t.versions.push(nv);
    if (editFromView) editFromView.v = nv.v; // back in the view, show the new version
  } else if (tplDirty()) {
    const v = t.versions.find((x) => x.v === tplUI.viewV);
    v.days = clone(d.days);
    v.updated = today();
  } else return closeModal();
  t.name = d.name.trim() || t.name;
  t.updated = today();
  ui.reveal = t.id;
  saveState();
  closeModal();
}
function tplInput(e) {
  const el = e.target;
  const d = tplUI.draft;
  if (el.id === "tpl-name") {
    d.name = titleText(el);
    return;
  }
  if (el.id === "qex-name" && tplUI.quickEx) {
    tplUI.quickEx.name = el.value;
    return;
  }
  if (el.id === "qex-notes" && tplUI.quickEx) {
    tplUI.quickEx.notes = el.value;
    return;
  }
  const di = +el.dataset.day;
  const xi = +el.dataset.ex;
  if (el.classList.contains("pl-dname")) {
    d.days[di].name = el.value;
    const chip = [...modalRoot().querySelectorAll(".chip[data-day]")].find(
      (b) => b.dataset.day === d.days[di].id,
    );
    if (chip) chip.textContent = tplDayLabel(d.days[di]);
  } else if (el.classList.contains("pe-sets")) setPlanDose(d.days[di].items[xi], "sets", el.value);
  else if (el.classList.contains("pe-reps")) setPlanDose(d.days[di].items[xi], "reps", el.value);
  else if (el.classList.contains("pe-wt")) setOverride(d.days[di].items[xi], "wt", el.value);
  else if (el.classList.contains("pe-notes")) setOverride(d.days[di].items[xi], "notes", el.value);
}
function setPlanDose(it, key, raw) {
  const v = Math.floor(+raw.trim()) || 0;
  if (v >= 1) it[key] = v;
  else delete it[key];
}
/* Plan-day weight (kg) and notes (which override the Workout notes); a blank cell removes it. */
function setOverride(it, key, raw) {
  const v = raw.trim();
  if (!v) delete it[key];
  else if (key === "wt") it.wt = Math.max(0, +v || 0);
  else it[key] = raw;
}
function tplChange(e) {
  const el = e.target;
  const d = tplUI.draft;
  const di = +el.dataset.day;
  const xi = +el.dataset.ex;
  if (el.classList.contains("pe-pick")) {
    // a different exercise clears the row's dose, weight and notes so the user sets them
    const it = d.days[di].items[xi];
    it.ex = el.value;
    delete it.sets;
    delete it.reps;
    delete it.wt;
    delete it.notes;
    render();
  }
}
function tplClick(e) {
  const t = tplById(tplUI.id);
  const d = tplUI.draft;
  const el = e.target;
  const chip = el.closest(".chip[data-day]");
  if (chip) {
    tplUI.dayId = chip.dataset.day;
    tplUI.quickEx = null;
    render();
    return;
  }
  if (el.closest("#tpl-dayup") || el.closest("#tpl-daydown")) {
    const i = d.days.findIndex((day) => day.id === tplUI.dayId);
    const dir = el.closest("#tpl-dayup") ? -1 : 1;
    if (i > -1) moveDay(i, i + dir);
    return;
  }
  if (el.closest("#pl-addday")) {
    const nd = { id: uid(), name: "Day " + (d.days.length + 1), color: "blue", items: [] };
    d.days.push(nd);
    tplUI.dayId = nd.id;
    tplUI.quickEx = null;
    render();
    return;
  }
  const pd = el.closest(".pl-delday");
  if (pd) {
    const idx = +pd.dataset.day;
    d.days.splice(idx, 1);
    const next = d.days[Math.min(idx, d.days.length - 1)] || null;
    tplUI.dayId = next ? next.id : null;
    tplUI.quickEx = null;
    render();
    return;
  }
  if (el.closest(".pl-quickex")) {
    tplUI.quickEx = { name: "", bw: false, notes: "" };
    render();
    const inp = $("#qex-name");
    if (inp) inp.focus();
    return;
  }
  if (el.closest(".qex-cancel")) {
    tplUI.quickEx = null;
    render();
    return;
  }
  if (el.closest("#qex-create")) {
    tplQuickCreate();
    return;
  }
  const pa = el.closest(".pl-addex");
  if (pa) {
    const first = live(state.exercises).sort((a, b) => a.name.localeCompare(b.name))[0];
    d.days[+pa.dataset.day].items.push({ ex: first ? first.id : "" });
    render();
    return;
  }
  const px = el.closest(".pe-del");
  if (px) {
    d.days[+px.dataset.day].items.splice(+px.dataset.ex, 1);
    render();
    return;
  }
  if (el.closest("#tpl-default")) {
    state.templates.forEach((x) => (x.isDefault = x.id === t.id));
    saveState();
    render();
    return;
  }
  if (el.closest("#tpl-save")) {
    tplSave();
    return;
  }
}
