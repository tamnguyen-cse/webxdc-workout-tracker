/* ============ PHONE VIEW SHEET SWIPE ============
   Phone only: swiping down fast (or dragging past 33% height) on a read-only view sheet
   closes it — from the top of .modal-body or anywhere on .modal-bar. Ignored while scrolled
   partway down so flicking back to the top still scrolls, on editors, and while ASK is open. */
const VIEW_SWIPE = {
  lock: 10,
  ratio: 1.2,
  commit: 0.33,
  flick: 0.5,
  minFlick: 36,
  windowMs: 100,
  ms: 220,
};
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const touchEl = (e) =>
  e.target instanceof Element ? e.target : e.target?.parentElement || null;
const viewSheetOpen = () =>
  !!(viewUI || infoUI) && !tplUI && !cycUI && !exUI && !pdUI && !helpUI && !askUI;
function viewSwipeAllowed(e, root, busy) {
  const ready = !busy && viewSheetOpen() && e.touches.length === 1;
  if (!ready || !matchMedia("(max-width: 760px)").matches) return null;
  const modal = root.querySelector(".modal");
  const body = root.querySelector(".modal-body");
  const el = touchEl(e);
  if (!modal || !body || !el || !modal.contains(el) || isTyping(el)) return null;
  const onBar = !!el.closest(".modal-bar");
  if (!onBar && body.scrollTop > 1) return null;
  return { el, onBar, modal, body, bg: root.querySelector(".modal-bg") };
}
function pushSheetSample(samples, y, now) {
  samples.push({ y, at: now });
  while (samples.length > 2 && now - samples[0].at > VIEW_SWIPE.windowMs) samples.shift();
}
function sheetSwipeVelocity(samples, now) {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (now - last.at > VIEW_SWIPE.windowMs) return 0;
  let first = samples[0];
  for (let i = samples.length - 2; i >= 0; i--) {
    first = samples[i];
    if (now - first.at >= VIEW_SWIPE.windowMs) break;
  }
  return (last.y - first.y) / Math.max(1, last.at - first.at);
}
function shouldCloseSheet(d, cancelled) {
  if (cancelled || d.mode !== "down") return false;
  const h = d.modal.clientHeight || window.innerHeight;
  const far = d.dy > VIEW_SWIPE.commit * h;
  const v = sheetSwipeVelocity(d.samples, Date.now());
  const flick =
    d.dy >= VIEW_SWIPE.minFlick && d.dy >= d.maxDy - 12 && v > VIEW_SWIPE.flick;
  return far || flick;
}
function lockSheetMode(d, dx, dy) {
  if (Math.abs(dx) < VIEW_SWIPE.lock && Math.abs(dy) < VIEW_SWIPE.lock) return false;
  const down = dy > VIEW_SWIPE.ratio * Math.abs(dx) && (d.onBar || d.body.scrollTop <= 1);
  d.mode = down ? "down" : "other";
  if (d.mode === "down" && !reducedMotion()) {
    d.modal.classList.add("sheet-drag");
    d.modal.style.animation = "none";
    d.modal.style.transition = "none";
  }
  return d.mode === "down";
}
function bindViewSwipe() {
  const root = modalRoot();
  let sheetDrag = null;
  let busy = false;
  let sheetTimer = 0;

  function resetSheet(modal, bg) {
    clearTimeout(sheetTimer);
    sheetTimer = 0;
    busy = false;
    if (modal) {
      modal.style.transform = "";
      modal.style.transition = "";
      modal.style.animation = "";
      modal.classList.remove("sheet-drag");
    }
    bg?.classList.remove("sheet-closing");
  }
  function unbind(d) {
    d.el.removeEventListener("touchmove", onMove);
    d.el.removeEventListener("touchend", onDone);
    d.el.removeEventListener("touchcancel", onCancel);
  }
  function finishSheet(d, close) {
    if (reducedMotion() || (!close && !d.dy)) {
      if (close && viewSheetOpen()) closeModal();
      resetSheet(d.modal, d.bg);
      return;
    }
    busy = true;
    d.modal.style.animation = "none";
    d.modal.style.transition = "transform " + VIEW_SWIPE.ms + "ms var(--ease)";
    d.modal.style.transform = close ? "translateY(100%)" : "translateY(0px)";
    if (close) d.bg?.classList.add("sheet-closing");
    sheetTimer = setTimeout(() => {
      try {
        if (close && viewSheetOpen()) closeModal();
      } finally {
        resetSheet(d.modal, d.bg);
      }
    }, VIEW_SWIPE.ms);
  }
  function onMove(e) {
    if (!sheetDrag || sheetDrag.mode === "other") return;
    if (e.touches.length !== 1 || !viewSheetOpen()) return onEnd(true);
    const t = e.touches[0];
    const dx = t.clientX - sheetDrag.x;
    const dy = t.clientY - sheetDrag.y;
    pushSheetSample(sheetDrag.samples, t.clientY, Date.now());
    if (!sheetDrag.mode && !lockSheetMode(sheetDrag, dx, dy)) return;
    e.preventDefault();
    const y = Math.max(0, dy);
    sheetDrag.dy = y;
    if (y > sheetDrag.maxDy) sheetDrag.maxDy = y;
    if (!reducedMotion()) sheetDrag.modal.style.transform = "translateY(" + y + "px)";
  }
  function onEnd(cancelled) {
    const d = sheetDrag;
    sheetDrag = null;
    if (!d) return;
    unbind(d);
    if (d.mode !== "down") return;
    finishSheet(d, shouldCloseSheet(d, cancelled));
  }
  const onDone = () => onEnd(false);
  const onCancel = () => onEnd(true);

  root.addEventListener(
    "touchstart",
    (e) => {
      if (sheetDrag) onEnd(true);
      const hit = viewSwipeAllowed(e, root, busy);
      if (!hit) return;
      const t = e.touches[0];
      sheetDrag = Object.assign(hit, {
        x: t.clientX,
        y: t.clientY,
        dy: 0,
        maxDy: 0,
        mode: "",
        samples: [{ y: t.clientY, at: Date.now() }],
      });
      hit.el.addEventListener("touchmove", onMove, { passive: false });
      hit.el.addEventListener("touchend", onDone, { passive: true });
      hit.el.addEventListener("touchcancel", onCancel, { passive: true });
    },
    { passive: true },
  );
}
