/* ============ MODAL ROOT BINDINGS ============ */
function bindModal() {
  const root = modalRoot();
  root.addEventListener("click", (e) => {
    if ((e.target.dataset && e.target.dataset.closeBg) || e.target.closest("[data-close]")) {
      cancelModal();
      return;
    }
    if (e.target.closest(".gtimer-toggle")) {
      toggleGlobalTimer();
      return;
    }
    if (e.target.closest(".gtimer-jump")) {
      jumpToTimer();
      return;
    }
    if (tplUI) tplClick(e);
    else if (cycUI) cycClick(e);
    else if (exUI) exClick(e);
    else if (pdUI) pdClick(e);
    else if (viewUI) viewClick(e);
  });
  root.addEventListener("input", (e) => {
    if (tplUI) tplInput(e);
    else if (cycUI) cycInput(e);
    else if (exUI) exInput(e);
    else if (pdUI) pdInput(e);
  });
  root.addEventListener("change", (e) => {
    if (tplUI) tplChange(e);
    else if (cycUI) cycChange(e);
    else if (pdUI) pdChange(e);
    else if (viewUI) viewChange(e);
  });
  // choice menus: the plan editor's quick-create type & day colours, the exercise fields
  root.addEventListener("choicechange", (e) => {
    const { key, value } = e.detail;
    if (tplUI && key === "qex-bw") {
      if (tplUI.quickEx) tplUI.quickEx.bw = value === "1";
    } else if (tplUI) {
      const day = tplUI.draft.days[+key];
      if (!day) return;
      day.color = value;
      const chip = [...root.querySelectorAll(".chip.on")].find((b) => b.dataset.day === day.id);
      if (chip) {
        COLOURS.forEach((c) => chip.classList.remove("tag-" + c));
        chip.classList.add("tag-" + colourOf(value));
      }
    } else if (exUI && key === "level") exUI.draft.level = +value;
    else if (exUI && key === "by") exUI.draft.by = value === "time" ? "time" : "reps";
    else if (exUI && key === "bw") exUI.draft.bw = value === "1";
  });
  root.addEventListener("keydown", (e) => {
    // an editable title is one line: Enter leaves it instead of adding a line break;
    // Enter in the typed workout time commits it the same way; Enter in quick-create Name submits
    if (e.target.id === "qex-name" && e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      tplQuickCreate();
      return;
    }
    const oneLine = e.target.classList.contains("modal-title") || e.target.id === "cyc-timer";
    if (oneLine && e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      e.target.blur();
      return;
    }
    if (exUI) exKey(e);
  });
  /* ---- drag & drop reorder (⠿ grips on .dnd-row rows, and on days) ----
     Three kinds: plan exercise rows carry {kind:"item", day, idx}, cycle exercise rows
     {kind:"cycle", exId}, and days {kind:"day", idx} — a plan's or cycle's day chip (the
     chip itself). A drop inserts the dragged thing *before* the target row (with the usual
     shift when moving down). */
  let dnd = null; // source, set on dragstart
  let dndOver = null; // element currently highlighted as drop target
  const dndEnd = () => {
    dnd = null;
    if (dndOver) {
      dndOver.classList.remove("drop-target");
      dndOver = null;
    }
  };
  /* days drop on day chips, exercise rows only on rows of their own day */
  const dndSel = () => (dnd.kind === "day" ? ".dnd-day" : ".dnd-row");
  const dndOk = (row) => {
    if (!dnd || !row) return false;
    if (dnd.kind === "day")
      return row.dataset.dayorder !== undefined && +row.dataset.dayorder !== dnd.idx;
    if (dnd.kind === "item")
      return row.dataset.day !== undefined && +row.dataset.day === dnd.day && +row.dataset.ex !== dnd.idx;
    return dnd.exId && row.dataset.ex && row.dataset.ex !== dnd.exId; // cycle rows
  };
  root.addEventListener("dragstart", (e) => {
    if (!e.target.closest) return;
    const grip = e.target.closest(".grip");
    // on touch screens a whole exercise card (plan or cycle) is draggable, not only its grip
    const wholeRow = e.target.matches(".dnd-row[draggable]") ? e.target : null;
    const row = grip ? grip.closest(".dnd-row") : wholeRow;
    // a grip in an exercise row wins over the day card that contains it
    if (row)
      dnd =
        row.dataset.day !== undefined
          ? { kind: "item", day: +row.dataset.day, idx: +row.dataset.ex }
          : { kind: "cycle", exId: row.dataset.ex };
    else {
      const day = (grip || e.target).closest(".dnd-day");
      if (!day) return;
      dnd = { kind: "day", idx: +day.dataset.dayorder };
    }
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", "");
      } catch (err) {}
    }
  });
  root.addEventListener("dragover", (e) => {
    if (!dnd) return;
    const row = e.target.closest && e.target.closest(dndSel());
    if (!dndOk(row)) return;
    e.preventDefault(); // required for drop to fire
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (dndOver !== row) {
      if (dndOver) dndOver.classList.remove("drop-target");
      dndOver = row;
      row.classList.add("drop-target");
    }
  });
  root.addEventListener("drop", (e) => {
    const row = dnd && e.target.closest && e.target.closest(dndSel());
    if (dndOk(row)) {
      e.preventDefault();
      if (dnd.kind === "day") {
        const to = +row.dataset.dayorder;
        moveDay(dnd.idx, dnd.idx < to ? to - 1 : to); // no-op (no render) on a same-slot drop
      } else if (dnd.kind === "item") {
        const items = tplUI.draft.days[dnd.day].items;
        const to = +row.dataset.ex;
        const moved = items.splice(dnd.idx, 1)[0];
        items.splice(dnd.idx < to ? to - 1 : to, 0, moved);
        renderModal(); // the draft re-renders without reloading the sheet
      } else {
        const c = cycById(cycUI.id);
        const day = c && c.days.find((x) => x.id === cycUI.dayId);
        if (day) {
          const items = day.items;
          const from = items.findIndex((i) => slotOf(i) === dnd.exId);
          const to = items.findIndex((i) => slotOf(i) === row.dataset.ex);
          if (from > -1 && to > -1) {
            const moved = items.splice(from, 1)[0];
            items.splice(from < to ? to - 1 : to, 0, moved);
            saveState(); // the cycle owns its day items directly
            render(); // re-reads saved state
          }
        }
      }
    }
    dndEnd();
  });
  root.addEventListener("dragend", dndEnd);
}
