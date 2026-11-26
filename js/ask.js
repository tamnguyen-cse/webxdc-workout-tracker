/* ============ ASK — the app's own confirm / notice dialog ============
   window.confirm() and alert() show nothing in Delta Chat's webxdc view on iOS — confirm()
   just returns false, so a delete silently did nothing. Every question goes through here
   instead. choose() resolves with the key of the button pressed, or null for Cancel, Esc and
   the backdrop; ask() is the yes/no form, tell() a notice with one OK. It draws above any
   open dialog, takes the keyboard while open (Esc cancels, Enter presses the focused
   button) and puts focus back where it was. */
let askUI = null; // { msg, buttons: [[key, label, cls]], resolve, back }
let askEl = null;
function choose(msg, buttons) {
  return new Promise((resolve) => {
    if (askUI) askUI.resolve(null);
    askUI = { msg, buttons, resolve, back: document.activeElement };
    renderAsk();
  });
}
function ask(msg, okLabel, danger) {
  const ok = [["ok", okLabel || "OK", danger ? "danger solid" : "primary"]];
  return choose(msg, [["", "Cancel", ""], ...ok]).then((k) => k === "ok");
}
function tell(msg) {
  return choose(msg, [["ok", "OK", "primary"]]).then(() => undefined);
}
function renderAsk() {
  if (!askEl) {
    askEl = document.createElement("div");
    askEl.id = "ask-root";
    document.body.appendChild(askEl);
    askEl.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-ask]");
      if (b) answerAsk(b.dataset.ask || null);
      else if (e.target.classList.contains("ask-bg")) answerAsk(null);
    });
  }
  modalRoot().toggleAttribute("inert", !!askUI);
  setBgInert(!!askUI || modalOpen());
  if (!askUI) {
    askEl.innerHTML = "";
    return;
  }
  askEl.innerHTML =
    '<div class="ask-bg"><div class="ask" role="alertdialog" aria-modal="true" aria-describedby="ask-msg">' +
    '<div class="ask-msg" id="ask-msg">' +
    esc(askUI.msg) +
    '</div><div class="ask-acts">' +
    askUI.buttons
      .map((b) => '<button class="btn ' + b[2] + '" data-ask="' + b[0] + '">' + esc(b[1]) + "</button>")
      .join("") +
    "</div></div></div>";
  // a destructive question starts on Cancel, so Enter never deletes by reflex
  const btns = [...askEl.querySelectorAll("button")];
  const safe = btns.some((b) => b.classList.contains("danger")) ? btns[0] : btns[btns.length - 1];
  safe.focus();
}
function answerAsk(key) {
  const a = askUI;
  askUI = null;
  renderAsk();
  if (a.back && a.back.isConnected) a.back.focus({ preventScroll: true });
  a.resolve(key);
}
function onAskKey(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    answerAsk(null);
  } else if (e.key === "Tab") {
    // keep focus on the dialog's buttons
    const btns = [...askEl.querySelectorAll("button")];
    const i = btns.indexOf(document.activeElement);
    e.preventDefault();
    btns[(i + (e.shiftKey ? btns.length - 1 : 1)) % btns.length].focus();
  }
}
/* Delete confirm for a record. An active one is offered Archive next to Delete — the
   only way to archive, as views have no Archive button; `uses` (e.g. "2 plan days and
   1 cycle") says what old data still points at it. An archived one asks "Delete forever".
   Resolves true to go on deleting; archiving happens here and resolves false. */
async function confirmDelete(kind, x, uses, detail) {
  const more = detail ? "\n\n" + detail : "";
  if (x.archived) return ask('Delete "' + x.name + '" forever?' + more, "Delete forever", true);
  const lead = uses ? '"' + x.name + '" is used by ' + uses + "." : 'Delete "' + x.name + '"?';
  const pick = await choose(
    lead + "\n\nArchive it to hide it from lists and new use while keeping its history — " +
      "or delete it." + more,
    [["", "Cancel", ""], ["delete", "Delete", "danger"], ["archive", "Archive", "primary"]],
  );
  if (pick === "archive") archiveRecord(kind, x);
  return pick === "delete";
}
