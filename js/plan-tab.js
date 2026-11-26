/* ============ PLAN TAB — template list ============ */
function renderPlan() {
  const sec = $("#sec-plan");
  const ts = shelfList(state.templates).sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  setTools(
    '<div class="filters">' +
      shelfSelect(state.templates) +
      colsSelect() +
      "</div>" +
      (shelfOn() ? "" : '<button class="btn primary" id="pl-new">+ New plan</button>'),
  );
  let h =
    '<div class="hint" style="margin-bottom:12px">Plans are reusable sets of days and exercises, independent of cycles. Create cycles from the default plan in the Log tab.</div>';
  if (!ts.length)
    h +=
      '<div class="card hint">' +
      (shelfOn() ? "No archived plans." : "No plans yet — create one to get started.") +
      "</div>";
  const { rows, pager } = paginate("plan", ts);
  h += '<div class="grid" data-page-grid="plan"' + (ui.cols ? ' data-cols="' + ui.cols + '"' : "") + ">";
  rows.forEach((t) => {
    const v = curV(t);
    h +=
      '<div class="card rowcard" tabindex="0" data-tpl="' +
      t.id +
      '"><div class="row-name">' +
      esc(t.name) +
      "</div>" +
      (t.isDefault ? '<div class="pills"><span class="lvl tag-blue">default</span></div>' : "") +
      '<div class="hint">' +
      plural(v.days.length, "day") +
      " · " +
      plural(exCount(v.days), "exercise") +
      " · version " +
      v.v +
      " of " +
      t.versions.length +
      (t.updated ? " · updated " + esc(t.updated) : "") +
      (t.archived ? " · archived " + esc(t.archived) : "") +
      "</div>" +
      (t.archived ? "</div>" : '<button class="iconbtn row-star' +
      (t.isDefault ? " on" : "") +
      '" data-default="' +
      t.id +
      '" title="' +
      (t.isDefault ? "Default plan" : "Set as default") +
      '">' +
      (t.isDefault ? "★" : "☆") +
      "</button></div>");
  });
  sec.innerHTML = h + "</div>" + pager;
  if (fitPage("plan", sec.querySelector(".grid"))) renderPlan(); // page size follows the columns
}
function newTemplate() {
  const t = {
    id: uid(),
    name: "New plan",
    isDefault: state.templates.length === 0,
    updated: today(),
    versions: [
      {
        v: 1,
        updated: today(),
        days: [{ id: uid(), name: "Day 1", color: "blue", items: [] }],
      },
    ],
  };
  state.templates.push(t);
  ui.reveal = t.id;
  saveState();
  openTpl(t.id);
}
/* Edit version `ver` (the current one when omitted) — or, with `isNew`, start a new
   version from it that Save adds as the next number. */
function openTpl(id, ver, isNew) {
  const t = tplById(id);
  if (!t) return;
  const v = t.versions.find((x) => x.v === ver) || curV(t);
  const days = clone(v.days);
  tplUI = {
    id,
    viewV: v.v,
    isNew: !!isNew,
    dayId: days[0] ? days[0].id : null,
    draft: { name: t.name, days },
  };
  render();
}
/* "Pull - Push (copy)", then "(copy 2)", … — plan names are not keys, but two plans
   with the same name are just confusing. */
function copyName(base, taken) {
  let n = base + " (copy)";
  let i = 2;
  while (taken(n)) n = base + " (copy " + i++ + ")";
  return n;
}
/* Duplicating a plan makes a brand-new plan from the version shown in its view: one
   version (v1), the same days and exercises, never the default star. Version history
   and cycles stay with the original — a copy is a new plan, not a fork of history.
   It opens straight in the editor so it can be renamed. */
function duplicatePlan(t, ver) {
  if (!t) return;
  const src = t.versions.find((x) => x.v === ver) || curV(t);
  const copy = {
    id: uid(),
    name: copyName((t.name || "Plan").trim() || "Plan", (n) =>
      state.templates.some((y) => y.name === n),
    ),
    isDefault: false,
    updated: today(),
    versions: [{ v: 1, updated: today(), days: clone(src.days) }],
  };
  state.templates.push(copy);
  ui.reveal = copy.id;
  saveState();
  viewUI = null; // the copy's editor replaces the source's view; closing it lists plans
  editFromView = null;
  openTpl(copy.id);
}
function bindPlan() {
  $("#sec-plan").addEventListener("click", (e) => {
    const star = e.target.closest("[data-default]");
    if (star) {
      e.stopPropagation();
      state.templates.forEach((x) => (x.isDefault = x.id === star.dataset.default));
      saveState();
      render();
      return;
    }
    const card = e.target.closest("[data-tpl]");
    if (card) openView("tpl", card.dataset.tpl);
  });
}
/* With several versions, Delete removes the one in the view; the others keep their
   numbers (cycles name the version they came from). The last version deletes the plan. */
async function deletePlan(t, ver) {
  const v = t.versions.find((x) => x.v === ver);
  if (v && t.versions.length > 1 && !t.archived) {
    const msg =
      'Delete version v' + v.v + ' of "' + t.name + '"? Cycles created from it keep their own copy.';
    if (!(await ask(msg, "Delete version", true))) return;
    t.versions = t.versions.filter((x) => x !== v);
    t.updated = today();
    saveState();
    viewUI.v = curV(t).v;
    render();
    return;
  }
  const cyc = state.cycles.filter((c) => c.templateId === t.id).length;
  const detail = "Cycles already created from it keep their own copy.";
  if (!(await confirmDelete("tpl", t, cyc && plural(cyc, "cycle"), detail))) return;
  state.templates = state.templates.filter((x) => x.id !== t.id);
  ensureDefault();
  saveState();
  closeModal();
}
