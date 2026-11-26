const LS = "workout-tracker-v5"; // never bump: add a migration in upgrade() instead
/* 2026-10-31…11-05 the key was bumped to -v6, which hid the -v5 data. A browser that
   saved under -v6 in that window still loads, whichever copy is newer. */
const LS_STRAY = "workout-tracker-v6";

const $ = (s) => document.querySelector(s);
/* Phones and tablets: a long press anywhere on a session exercise card picks it up to
   reorder, since the ⠿ grip alone is a small target for a finger. Mouse users keep the
   grip only, so dragging inside the card's inputs still selects their text. */
const TOUCH = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

function uid() {
  return "x" + Math.random().toString(36).slice(2, 9);
}
function clone(o) {
  return JSON.parse(JSON.stringify(o));
}
function today() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function parseReps(v) {
  if (typeof v === "number") return v;
  const m = String(v || "").match(/\d+/g);
  return m ? m.reduce((a, b) => a + +b, 0) : 0;
}
/* Some exercises are counted by time (holds, timed sets) instead of reps. They carry
   `by: "time"` on the library entry and their `reps` field then holds seconds.
   A missing `by` (all older data) means reps — hence no storage-key bump. */
function isTime(x) {
  return !!x && x.by === "time";
}
/* Seconds from a logged set: "45" / "45s" → 45, "1:30" → 90, "1:02:03" → 3723.
   Anything else sums its numbers, the same leniency parseReps has ("40+5" → 45). */
function parseSeconds(v) {
  const t = String(v || "").trim().match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (t) return t[3] !== undefined ? +t[1] * 3600 + +t[2] * 60 + +t[3] : +t[1] * 60 + +t[2];
  return parseReps(v);
}
/* 45 → "45s", 90 → "1:30", 3723 → "1:02:03" — seconds shown the way they are typed. */
function fmtSecs(n) {
  const s = Math.max(0, Math.round(n) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return h + ":" + String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  if (m) return m + ":" + String(s % 60).padStart(2, "0");
  return s + "s";
}
/* Parse a single HTML element without touching the live DOM. */
function htmlToEl(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
/* Subtle entrance animation for an item inserted in place (respects reduced motion). */
function animateIn(el) {
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.classList.add("item-in");
  const clean = () => el.classList.remove("item-in");
  el.addEventListener("animationend", clean, { once: true });
  setTimeout(clean, 260);
}
/* Smoothly collapse and remove an item in place; axis "y" for cards/rows, "x" for inline sets. */
function removeAnimated(el, onDone, axis) {
  if (!el) return;
  el.style.pointerEvents = "none";
  el.setAttribute("aria-hidden", "true");
  const finish = () => {
    if (done) return;
    done = true;
    el.remove();
    if (onDone) onDone();
  };
  let done = false;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
  if (axis === "x") {
    const w = el.offsetWidth;
    if (!w) return finish();
    el.style.width = w + "px";
    el.style.minWidth = "0";
    el.style.overflow = "hidden";
    void el.offsetWidth;
    el.classList.add("item-out");
    el.style.width = "0";
    el.style.paddingLeft = "0";
    el.style.paddingRight = "0";
    el.style.borderLeftWidth = "0";
    el.style.borderRightWidth = "0";
    el.style.marginLeft = "0";
    el.style.marginRight = "0";
    el.style.opacity = "0";
  } else {
    const h = el.offsetHeight;
    if (!h) return finish();
    el.style.boxSizing = "border-box";
    el.style.height = h + "px";
    el.style.minHeight = "0";
    el.style.overflow = "hidden";
    void el.offsetHeight;
    el.classList.add("item-out");
    el.style.height = "0";
    el.style.paddingTop = "0";
    el.style.paddingBottom = "0";
    el.style.marginTop = "0";
    el.style.marginBottom = "0";
    el.style.borderTopWidth = "0";
    el.style.borderBottomWidth = "0";
    el.style.opacity = "0";
  }
  el.addEventListener("transitionend", (e) => {
    if (e.target === el) finish();
  });
  setTimeout(finish, 240);
}
