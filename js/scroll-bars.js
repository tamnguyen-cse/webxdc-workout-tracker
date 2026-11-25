/* ============ KEYBOARD RESET + AUTO-HIDING BARS (phones and tablets) ============ */
/* iOS scrolls the whole web view to keep a focused field above the keyboard and does not
   always scroll it back once the keyboard closes. Under a full-screen sheet that leaves the
   bar pushed off the top and an unpainted strip at the bottom, so put the view back — to
   where the page stood when the sheet opened, not the top: opening a sheet moves focus off
   the tapped row (the page goes inert), and that focusout must not scroll the page away. */
function bindKeyboardReset() {
  const root = document.documentElement;
  const sheetOpen = () => root.classList.contains("modal-open");
  let pageY = 0;
  let wasOpen = sheetOpen();
  new MutationObserver(() => {
    if (sheetOpen() && !wasOpen) pageY = window.scrollY;
    wasOpen = sheetOpen();
  }).observe(root, { attributeFilter: ["class"] });
  const reset = () => {
    if (!sheetOpen()) return;
    if (window.scrollY !== pageY || window.scrollX) window.scrollTo(0, pageY);
  };
  if (window.visualViewport) window.visualViewport.addEventListener("resize", reset);
  // moving to the next field keeps the keyboard up, and iOS must keep that field in view
  const typing = () =>
    document.activeElement?.matches("input, select, textarea, [contenteditable]");
  document.addEventListener("focusout", () => setTimeout(() => typing() || reset(), 50));
}
/* On phones and tablets, the page top bar (.hdr) and the dialog bar (.modal-bar) slide out
   of the way on scroll-down and return on scroll-up, so the scrolling page or dialog gets
   the full height. Clamping to [0, max] ignores iOS rubber-band bounce at both ends. */
let lastWinY = 0;
let lastModalY = 0;
function stepBarScroll(bar, rawY, max, prevY) {
  if (!bar) return 0;
  const y = max > 0 ? Math.max(0, Math.min(rawY, max)) : Math.max(0, rawY);
  if (y <= 10) {
    bar.classList.remove("bar-hide");
    return y;
  }
  const dy = y - prevY;
  if (dy > 6 && y > 44) bar.classList.add("bar-hide");
  else if (dy < -6) bar.classList.remove("bar-hide");
  return Math.abs(dy) > 6 ? y : prevY;
}
function bindBarScroll() {
  window.addEventListener(
    "scroll",
    () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      lastWinY = stepBarScroll($(".hdr"), window.scrollY, max, lastWinY);
    },
    { passive: true },
  );
  modalRoot().addEventListener(
    "scroll",
    (e) => {
      const el = e.target;
      if (!el || !el.classList || !el.classList.contains("modal-body")) return;
      const max = el.scrollHeight - el.clientHeight;
      lastModalY = stepBarScroll(
        modalRoot().querySelector(".modal-bar"),
        el.scrollTop,
        max,
        lastModalY,
      );
    },
    { capture: true, passive: true },
  );
}
