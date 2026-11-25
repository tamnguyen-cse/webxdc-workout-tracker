/* ============ EXERCISE MODAL ============ */
function defaultLevelId() {
  const ls = state.settings.levels;
  const strength = ls.find((l) => l.id === 2);
  return strength ? strength.id : ls.length ? ls[0].id : 0;
}
function openEx(id) {
  const x = id ? exById(id) : null;
  exUI = {
    id: x ? x.id : null,
    draft: x
      ? {
          name: x.name,
          by: x.by === "time" ? "time" : "reps",
          level: x.level || 0,
          bw: x.bw || false,
          notes: x.notes || "",
          video: x.video || "",
        }
      : { name: "", by: "reps", level: defaultLevelId(), bw: false, notes: "", video: "" },
  };
  render();
}
/* Duplicating an exercise copies every field into a brand-new library entry — new id,
   name "… (copy)", no plan day and no log entry referencing it yet — and opens it in the
   editor so it can be renamed, the same shape as duplicating a plan. The copy is saved at
   once, so cancelling the editor still leaves it in the library. */
function duplicateExercise(x) {
  if (!x) return;
  const copy = {
    id: uid(),
    name: copyName((x.name || "Exercise").trim() || "Exercise", (n) =>
      state.exercises.some((y) => y.name === n),
    ),
    level: x.level || 0,
    bw: x.bw || false,
    by: x.by === "time" ? "time" : "reps",
    notes: x.notes || "",
    video: x.video || "",
  };
  state.exercises.push(copy);
  ui.reveal = copy.id;
  saveState();
  viewUI = null; // the copy's editor replaces the source's view; closing it lists exercises
  editFromView = null;
  openEx(copy.id);
}
async function deleteExercise(id) {
  const x = exById(id);
  if (!x) return;
  const refs = state.templates.reduce(
    (n, t) =>
      n +
      t.versions.reduce(
        (m, v) => m + v.days.reduce((k, d) => k + (d.items || []).filter((i) => i.ex === id).length, 0),
        0,
      ),
    0,
  );
  const cyc = cyclesUsing(id);
  const uses = [refs && plural(refs, "plan day"), cyc && plural(cyc, "cycle")].filter(Boolean).join(" and ");
  const detail = refs || cyc
    ? "Deleting removes it from " + uses + ". Already-logged sets keep their numbers."
    : "";
  if (!(await confirmDelete("ex", x, uses, detail))) return;
  state.exercises = state.exercises.filter((y) => y.id !== id);
  const strip = (days) =>
    days.forEach((d) => (d.items = (d.items || []).filter((i) => i.ex !== id)));
  state.templates.forEach((t) => t.versions.forEach((v) => strip(v.days)));
  state.cycles.forEach((c) => strip(c.days));
  saveState();
  closeModal();
}
function exVideoHtml() {
  const d = exUI.draft;
  if (exUI.vEdit)
    return (
      '<span class="vref"><input id="ex-video" type="text" value="' +
      esc(d.video) +
      '" placeholder="Paste video link"><button class="btn sm" id="ex-v-ok">OK</button></span>'
    );
  if (!d.video) return '<span class="vref"><button class="btn sm" id="ex-v-edit">+ Add link</button></span>';
  return (
    '<span class="vref"><a class="vlink" href="' +
    esc(d.video) +
    '" target="_blank" rel="noopener">▶ video</a>' +
    '<button class="btn sm" id="ex-v-edit">Change</button>' +
    '<button class="btn sm danger" id="ex-v-del">Remove</button></span>'
  );
}
function exModalHtml() {
  const d = exUI.draft;
  const acts = '<button class="btn primary" id="ex-save">Save</button>';
  // a level removed in Settings stays selectable on exercises that still carry it
  const curLvl = Math.max(0, Math.floor(+d.level) || 0);
  const lvlChoices = state.settings.levels.map((l) => ({ value: String(l.id), html: lvlPill(l.id) }));
  if (!state.settings.levels.some((l) => l.id === curLvl))
    lvlChoices.push({ value: String(curLvl), html: lvlPill(curLvl) });
  const levelSel = choicePicker("level", curLvl, lvlChoices);
  const bySel = choicePicker("by", d.by === "time" ? "time" : "reps", [
    { value: "reps", html: "reps" },
    { value: "time", html: "time (s)" },
  ]);
  const typeSel = choicePicker("bw", d.bw ? "1" : "0", [
    { value: "1", html: bwPill(true) },
    { value: "0", html: bwPill(false) },
  ]);
  const h =
    '<div class="props">' +
    prop("Level", levelSel, "▾") +
    prop("Counted by", bySel, "▾") +
    prop("Type", typeSel, "▾") +
    prop("Video", exVideoHtml(), "↗") +
    "</div>" +
    '<h3 class="view-h">Notes</h3>' +
    '<textarea id="ex-notes" class="blk-text" rows="4" placeholder="Ring height, cues…">' +
    esc(d.notes) +
    "</textarea>" +
    usageHint(exUI.id);
  return modalWrap({
    crumb: "Workout / " + (exUI.id ? "Edit" : "New"),
    title: d.name,
    titleId: "ex-name",
    placeholder: "New exercise",
    body: h,
    bar: acts,
  });
}
/* Commit the link being edited: empty removes it, a bare domain gets https:// */
function exVideoCommit() {
  const inp = $("#ex-video");
  const v = inp ? inp.value.trim() : exUI.draft.video;
  exUI.draft.video = v && !/^https?:\/\//i.test(v) ? "https://" + v : v;
  exUI.vEdit = false;
  renderModal();
}
function exVideoEdit(on) {
  exUI.vEdit = on;
  renderModal();
  const inp = $("#ex-video");
  if (inp) inp.focus();
}
function exKey(e) {
  if (e.target.id !== "ex-video") return;
  if (e.key === "Enter") exVideoCommit();
  else if (e.key === "Escape") {
    e.stopPropagation(); // cancel the link edit only, keep the dialog open
    exVideoEdit(false);
  }
}
function exInput(e) {
  const el = e.target;
  const d = exUI.draft;
  if (el.id === "ex-name") d.name = titleText(el);
  else if (el.id === "ex-notes") d.notes = el.value;
}
function exClick(e) {
  const el = e.target;
  if (el.closest("#ex-v-edit")) return exVideoEdit(true);
  if (el.closest("#ex-v-ok")) return exVideoCommit();
  if (el.closest("#ex-v-del")) {
    exUI.draft.video = "";
    renderModal();
    return;
  }
  if (el.closest("#ex-save")) {
    if (exUI.vEdit) exVideoCommit();
    const d = exUI.draft;
    if (!d.name.trim()) {
      tell("Give the exercise a name first.");
      return;
    }
    const fields = {
      name: d.name.trim(),
      by: d.by === "time" ? "time" : "reps",
      level: +d.level || 0,
      bw: d.bw === true,
      notes: d.notes,
      video: d.video,
    };
    let revealId = exUI.id;
    if (exUI.id) Object.assign(exById(exUI.id), fields);
    else {
      const rec = Object.assign({ id: uid() }, fields);
      state.exercises.push(rec);
      revealId = rec.id;
    }
    ui.reveal = revealId;
    saveState();
    closeModal();
  }
}
