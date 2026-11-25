/* ============ KEYBOARD SHORTCUTS ============
   Every shortcut clicks the same button a mouse would, so confirms and validation stay in
   one place. Single-letter keys are ignored while typing in a field. */
const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
const SHORTCUTS = [
  ["Anywhere", [
    ["1 – 5", "Switch tab: Log · Plan · Workout · Personal · Analytics"],
    [",", "Settings"],
    ["E", "Personal tab: edit body data"],
    ["N", "New cycle / plan / exercise on the current tab"],
    ["/", "Focus search (Workout tab)"],
    ["↑ ↓  or  J K", "Move between rows in a list"],
    ["← →", "Previous / next page (or month)"],
    ["Enter  or  E", "Open the selected row (read-only view)"],
    ["Delete  or  ⌫", "Delete the selected row (asks first)"],
    ["?", "Show this list"],
  ]],
  ["In a dialog", [
    ["E  or  Enter", "In a view: Edit"],
    ["D", "In a view: Duplicate"],
    ["A", "In an archived record's view: Restore"],
    ["M", "In a cycle's view: Mark done, or Reopen a done one"],
    [MOD + "Enter", "Save (exercise, plan, session, body data)"],
    [MOD + "⌫", "Delete the item in the open view (asks first)"],
    ["Esc", "Cancel — unsaved changes are discarded (asks first)"],
  ]],
];
const SAVE_IDS = ["ex-save", "qex-create", "tpl-save", "cyc-save", "pd-save"];
const DELETE_IDS = ["view-del"]; // editors have no Delete: it lives in the view
const NEW_IDS = { log: "lg-new", plan: "pl-new", workout: "wk-new" };
const TAB_KEYS = ["log", "plan", "workout", "personal", "stats"];

function clickFirst(ids) {
  for (const id of ids) {
    const b = document.getElementById(id);
    if (b && !b.disabled) {
      b.click();
      return true;
    }
  }
  return false;
}
function isTyping(el) {
  return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
}
/* The list row a dialog was opened from, so closing it puts keyboard focus back there. */
let returnRow = "";
function rememberRow(row) {
  const attr = ["data-ex", "data-tpl", "data-cyc"].find((a) => row.hasAttribute(a));
  returnRow = attr ? ".sec.on .rowcard[" + attr + '="' + row.getAttribute(attr) + '"]' : "";
}
function refocusRow() {
  const row = returnRow && document.querySelector(returnRow);
  returnRow = "";
  if (row) row.focus();
}
function listRows() {
  return [...document.querySelectorAll(".sec.on .rowcard")];
}
/* Past the last row of a page, J / ↓ turns to the next page's first row (K / ↑ to the
   previous page's last row). */
function moveRow(step) {
  const rows = listRows();
  if (!rows.length) return;
  const i = rows.indexOf(document.activeElement);
  const to = i < 0 ? 0 : i + step;
  if (i >= 0 && (to < 0 || to >= rows.length) && pressStep(step, step < 0 ? "last" : "first")) return;
  rows[Math.min(rows.length - 1, Math.max(0, to))].focus();
}
/* Plan and cycle rows have no inline delete: open the item and press its Delete button;
   if the confirm is cancelled the dialog closes again so the list looks as before. */
function deleteRow(row) {
  const inline = row.querySelector(".row-del");
  if (inline) return inline.click();
  row.click();
  clickFirst(DELETE_IDS);
  if (modalOpen()) closeModal();
}
function onDialogKey(e) {
  const mod = e.metaKey || e.ctrlKey;
  if (e.key === "Escape") {
    if (tplUI && tplUI.quickEx) {
      tplUI.quickEx = null;
      render();
      return;
    }
    return cancelModal();
  }
  // D duplicates the record being viewed (presses the same button the mouse does)
  if (
    viewUI &&
    !mod &&
    !e.altKey &&
    (e.key === "d" || e.key === "D")
  ) {
    e.preventDefault();
    clickFirst(["view-dup"]);
    return;
  }
  // A restores the archived record being viewed (archiving goes through Delete)
  if (viewUI && !mod && !e.altKey && (e.key === "a" || e.key === "A")) {
    e.preventDefault();
    clickFirst(["view-restore"]);
    return;
  }
  // M marks the viewed cycle Done, or reopens it
  if (viewUI && !mod && !e.altKey && (e.key === "m" || e.key === "M")) {
    e.preventDefault();
    clickFirst(["view-done", "view-reopen"]);
    return;
  }
  if (viewUI && !mod && !e.altKey && isViewEditKey(e)) {
    e.preventDefault();
    clickFirst(["view-edit"]);
    return;
  }
  if (mod && e.key === "Enter") {
    e.preventDefault();
    clickFirst(SAVE_IDS);
  } else if (mod && (e.key === "Backspace" || e.key === "Delete") && !isTyping(e.target)) {
    e.preventDefault();
    clickFirst(DELETE_IDS);
  }
}
/* E edits; Enter does too unless a button or link in the view has focus (it presses that). */
function isViewEditKey(e) {
  if (e.key === "e" || e.key === "E") return true;
  return e.key === "Enter" && !(e.target.closest && e.target.closest("button, a"));
}
function onPageKey(e) {
  // row keys act on the focused row itself, not on a button or link inside it
  const row = e.target.classList && e.target.classList.contains("rowcard") ? e.target : null;
  const k = e.key;
  if (k >= "1" && k <= String(TAB_KEYS.length)) {
    ui.tab = TAB_KEYS[+k - 1];
    render();
  } else if (k === ",") openSettings();
  else if (k === "n" || k === "N") clickFirst([NEW_IDS[ui.tab]]);
  else if (k === "/" && $("#wk-q")) $("#wk-q").focus();
  else if ((k === "e" || k === "E") && !row && ui.tab === "personal") clickFirst(["pd-edit"]);
  else if (k === "?") openHelp();
  else if (k === "ArrowDown" || k === "j") moveRow(1);
  else if (k === "ArrowUp" || k === "k") moveRow(-1);
  else if (k === "ArrowLeft" || k === "ArrowRight") {
    if (!pressStep(k === "ArrowLeft" ? -1 : 1, row ? "first" : "")) return;
  }
  else if (row && (k === "Enter" || k === "e")) {
    rememberRow(row);
    row.click();
  } else if (row && (k === "Delete" || k === "Backspace")) {
    rememberRow(row);
    deleteRow(row);
  }
  else return;
  e.preventDefault();
}
function onShortcut(e) {
  if (e.defaultPrevented || e.isComposing) return;
  if (askUI) return onAskKey(e);
  if (themeMenuOpen()) return onThemeMenuKey(e);
  if (openChoicePick()) return onChoiceMenuKey(e);
  if (modalOpen()) return onDialogKey(e);
  if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
  onPageKey(e);
}
function openHelp() {
  helpUI = true;
  renderModal();
}
function helpModalHtml() {
  return modalWrap({ crumb: "Keyboard shortcuts", body: shortcutsHtml(), size: "sm" });
}
function shortcutsHtml() {
  let h = "";
  SHORTCUTS.forEach(([group, rows]) => {
    h += '<div class="kbd-group">' + esc(group) + '</div><table class="kbd-table"><tbody>';
    rows.forEach(([keys, what]) => {
      h += "<tr><td><kbd>" + esc(keys) + "</kbd></td><td>" + esc(what) + "</td></tr>";
    });
    h += "</tbody></table>";
  });
  return h;
}
/* Tooltips name the shortcut on the buttons it presses. */
function shortcutTitles() {
  const set = (id, t) => {
    const b = document.getElementById(id);
    if (b) b.title = t;
  };
  SAVE_IDS.forEach((id) => set(id, "Save (" + MOD + "Enter)"));
  DELETE_IDS.forEach((id) => set(id, "Delete (" + MOD + "⌫)"));
  Object.values(NEW_IDS).forEach((id) => set(id, "New (N)"));
}
