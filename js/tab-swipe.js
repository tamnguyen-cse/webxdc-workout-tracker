/* ============ PHONE TAB SWIPE ============
   Phone only: drag the page sideways to reach the next (left) or previous (right) tab. The
   page follows the finger with the neighbouring tab beside it, then snaps to whichever wins.
   The neighbour is a still copy of that tab, drawn when the drag starts; letting go switches
   for real. Ignored while a dialog is open, on fields and the tab bar, inside anything that
   scrolls sideways, and 20 px from the screen edges (iOS back gesture). With Reduced Motion
   on, the page does not move; a swipe just switches the tab. */
const SWIPE = { lock: 10, ratio: 1.2, edge: 20, gap: 12, commit: 0.33, flick: 0.5, ms: 280 };
let drag = null;
let swipeBusy = false;
function scrollsSideways(el) {
  for (; el && el !== document.body; el = el.parentElement) {
    const ox = getComputedStyle(el).overflowX;
    if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth) return true;
  }
  return false;
}
function swipeAllowed(e) {
  const t = e.touches[0];
  const phone = matchMedia("(max-width: 760px)").matches;
  if (swipeBusy || e.touches.length !== 1 || !phone) return false;
  if (t.clientX < SWIPE.edge || t.clientX > innerWidth - SWIPE.edge) return false;
  if (modalOpen() || isTyping(e.target)) return false;
  return !e.target.closest("input, select, textarea, .tabs") && !scrollsSideways(e.target);
}
/* A still copy of the app bar + page as they look now, the page `pageTop` px from the top.
   The copies keep their ids so id-based CSS still applies; the stage is appended after the
   real page and removed before anything else runs, so getElementById still finds the real one. */
function snapshotPane(pageTop) {
  const pane = document.createElement("div");
  pane.className = "swipe-pane";
  const bar = $(".hdr").cloneNode(true);
  const page = $("main.main");
  const copy = page.cloneNode(true);
  copy.querySelector(".tabs")?.remove();
  const live = page.querySelectorAll("select, input");
  copy.querySelectorAll("select, input").forEach((el, i) => {
    if (live[i]) el.value = live[i].value;
  });
  bar.classList.add("swipe-bar");
  copy.classList.add("swipe-page");
  copy.style.top = pageTop + "px";
  pane.append(copy, bar);
  return pane;
}
function neighbourTab(dir) {
  const tabs = [...document.querySelectorAll(".tab")];
  const i = tabs.findIndex((b) => b.dataset.t === ui.tab);
  return i < 0 ? null : tabs[i + dir] || null;
}
function startStage(d) {
  const page = $("main.main");
  const stage = document.createElement("div");
  stage.className = "swipe-stage";
  d.panes = { cur: snapshotPane(page.getBoundingClientRect().top) };
  stage.append(d.panes.cur);
  // draw each neighbour once (as a tab switch shows it, at scroll 0), copy it, put this tab back
  const y = window.scrollY;
  const orig = ui.tab;
  for (const dir of [1, -1]) {
    const btn = neighbourTab(dir);
    if (!btn) continue;
    ui.tab = btn.dataset.t;
    render();
    d.panes[dir] = snapshotPane(page.offsetTop);
    stage.append(d.panes[dir]);
    ui.tab = orig;
  }
  render();
  window.scrollTo(0, y);
  document.body.append(stage);
  d.stage = stage;
  d.w = stage.clientWidth;
}
function placePanes(d, dx, animate) {
  const w = d.w + SWIPE.gap;
  for (const [key, pane] of Object.entries(d.panes)) {
    const off = key === "cur" ? 0 : Number(key) * w;
    pane.style.transition = animate ? "transform " + SWIPE.ms + "ms var(--ease)" : "none";
    pane.style.transform = "translateX(" + (dx + off) + "px)";
  }
}
function endStage(d, target) {
  const dir = target ? (d.dx < 0 ? 1 : -1) : 0;
  placePanes(d, dir ? -dir * (d.w + SWIPE.gap) : 0, true);
  swipeBusy = true;
  setTimeout(() => {
    try {
      if (target) {
        target.click();
        window.scrollTo(0, 0);
      }
    } finally {
      // same task as the switch, so the real page and the copy never show apart
      d.stage.remove();
      swipeBusy = false;
    }
  }, SWIPE.ms);
}
function onSwipeMove(e) {
  if (!drag || drag.mode === "vertical") return;
  const t = e.touches[0];
  const dx = t.clientX - drag.x;
  const dy = t.clientY - drag.y;
  if (!drag.mode) {
    if (Math.abs(dx) < SWIPE.lock && Math.abs(dy) < SWIPE.lock) return;
    drag.mode = Math.abs(dx) > SWIPE.ratio * Math.abs(dy) ? "horizontal" : "vertical";
    if (drag.mode === "vertical") return;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) startStage(drag);
  }
  e.preventDefault();
  const now = Date.now();
  drag.v = (t.clientX - drag.lastX) / Math.max(1, now - drag.lastAt);
  drag.lastX = t.clientX;
  drag.lastAt = now;
  drag.dx = dx;
  if (!drag.stage) return;
  // no tab that way: the page stretches a little and springs back
  placePanes(drag, drag.panes[dx < 0 ? 1 : -1] ? dx : dx * 0.25, false);
}
function onSwipeEnd(cancelled) {
  const d = drag;
  drag = null;
  if (!d) return;
  unbindSwipe(d);
  if (d.mode !== "horizontal") return;
  const target = neighbourTab(d.dx < 0 ? 1 : -1);
  const far = Math.abs(d.dx) > SWIPE.commit * (d.w || innerWidth);
  const flick = Math.abs(d.v) > SWIPE.flick && Math.sign(d.v) === Math.sign(d.dx);
  const go = !cancelled && target && (far || flick) ? target : null;
  if (d.stage) endStage(d, go);
  else if (go) go.click();
}
const onSwipeDone = () => onSwipeEnd(false);
const onSwipeCancel = () => onSwipeEnd(true);
function unbindSwipe(d) {
  d.el.removeEventListener("touchmove", onSwipeMove);
  d.el.removeEventListener("touchend", onSwipeDone);
  d.el.removeEventListener("touchcancel", onSwipeCancel);
}
/* The move/end listeners go on the touched element itself: drawing the neighbour tabs
   rebuilds the list, and iOS keeps sending a touch's later events to its first element even
   once it has left the page, where they no longer bubble up to document. */
function bindSwipe() {
  document.addEventListener(
    "touchstart",
    (e) => {
      if (drag) {
        unbindSwipe(drag);
        drag.stage?.remove();
        drag = null;
      }
      if (!swipeAllowed(e)) return;
      const t = e.touches[0];
      const el = e.target;
      const at = Date.now();
      drag = { el, x: t.clientX, y: t.clientY, dx: 0, mode: "", v: 0 };
      drag.lastX = t.clientX;
      drag.lastAt = at;
      el.addEventListener("touchmove", onSwipeMove, { passive: false });
      el.addEventListener("touchend", onSwipeDone, { passive: true });
      el.addEventListener("touchcancel", onSwipeCancel, { passive: true });
    },
    { passive: true },
  );
}
