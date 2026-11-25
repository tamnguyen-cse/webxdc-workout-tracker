/* ============ HISTORY CALENDAR — dated sessions as a month grid ============
   From the sync-app-style template (2026-11-22.4), with a 🔥 fire symbol marking every
   done workout day. Build `days` = { "YYYY-MM-DD": [{ label, right, attrs }] } (label /
   right are plain text; attrs is markup such as 'data-cyc="x1"' so the tab's own handler
   opens that cycle), then put historyCalendar(key, days, "session") in a card.
   ui.cal[key] = { month: "YYYY-MM", day: "YYYY-MM-DD" | "" | null } survives re-renders;
   it starts on the newest entry's month with that day picked (null: pick the newest day
   again). ← / → change month (pressStep in js/pagination.js). */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // ISO weeks start Monday
function shiftMonth(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
/* The newest day in `month` that has entries, or "" — picked when the month changes. */
function lastDayIn(days, month) {
  return Object.keys(days).filter((d) => d.startsWith(month + "-") && days[d].length).sort().pop() || "";
}
function calView(key, days) {
  if (!ui.cal[key]) {
    const month = (Object.keys(days).sort().pop() || today()).slice(0, 7);
    ui.cal[key] = { month, day: lastDayIn(days, month) };
  }
  const v = ui.cal[key];
  if (v.day === null) v.day = lastDayIn(days, v.month);
  return v;
}
/* Every day is a button, so any date can be picked; only done workout days get a tint and 🔥. */
function calDayHtml(key, iso, rows, max, unit) {
  const d = +iso.slice(8);
  const cls =
    (rows.length ? " cal-done" : "") +
    (iso === today() ? " today" : "") +
    (iso === ui.cal[key].day ? " on" : "");
  const lvl = rows.length ? Math.max(1, Math.ceil((rows.length / max) * 3)) : 0; // 1–3, scaled to the month's busiest day
  const label = new Date(iso + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  const mark = !rows.length
    ? ""
    : '<span class="cal-mark"><span class="cal-fire" aria-hidden="true">🔥</span>' +
      (rows.length > 1 ? '<span class="cal-c">' + rows.length + "</span>" : "") +
      "</span>";
  return (
    '<button type="button" class="cal-day' +
    cls +
    '" data-cal="' +
    key +
    '" data-cal-day="' +
    iso +
    '"' +
    (lvl ? ' data-lvl="' + lvl + '"' : "") +
    ' aria-pressed="' +
    (iso === ui.cal[key].day) +
    '" aria-label="' +
    esc(label + ", " + (rows.length ? "done, " : "") + plural(rows.length, unit)) +
    '"><span class="cal-n">' +
    d +
    "</span>" +
    mark +
    "</button>"
  );
}
function historyCalendar(key, days, unit) {
  const v = calView(key, days);
  const [y, m] = v.month.split("-").map(Number);
  const inMonth = Object.keys(days).filter((d) => d.startsWith(v.month + "-") && days[d].length);
  const total = inMonth.reduce((n, d) => n + days[d].length, 0);
  const max = Math.max(3, ...inMonth.map((d) => days[d].length)); // ≥ 3: a month of 1-a-day stays light
  const go = (to, label, text) =>
    '<button type="button" class="iconbtn" data-cal="' +
    key +
    '" data-cal-go="' +
    to +
    '" aria-label="' +
    label +
    '" title="' +
    label +
    " (" +
    (to < 0 ? "←" : "→") +
    ')">' +
    text +
    "</button>";
  const title = new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const sum = total
    ? "🔥 " + plural(inMonth.length, "workout day") + " · " + plural(total, unit)
    : "No " + unit + "s this month";
  let h =
    '<div class="cal"><div class="cal-main"><div class="cal-head">' +
    go(-1, "Previous month", "‹") +
    '<div class="cal-title">' +
    esc(title) +
    "</div>" +
    go(1, "Next month", "›") +
    '<button type="button" class="btn ghost sm" data-cal="' +
    key +
    '" data-cal-go="0">Today</button></div>' +
    '<div class="hint cal-sum">' +
    esc(sum) +
    '</div><div class="cal-grid">' +
    WEEKDAYS.map((w) => '<span class="cal-wd">' + w + "</span>").join("");
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) h += '<span class="cal-pad"></span>';
  const count = new Date(y, m, 0).getDate();
  for (let d = 1; d <= count; d++) {
    const iso = v.month + "-" + String(d).padStart(2, "0");
    h += calDayHtml(key, iso, days[iso] || [], max, unit);
  }
  h +=
    '</div></div><div class="cal-side">' +
    calDayList(v.day, days[v.day] || [], unit) +
    "</div></div>";
  return h;
}
function calDayList(iso, rows, unit) {
  if (!iso) return '<div class="hint cal-pick">Pick a day to see its ' + unit + "s.</div>";
  const when = new Date(iso + "T12:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (!rows.length) return '<div class="hint cal-pick">No ' + unit + "s on " + esc(when) + ".</div>";
  let h = '<div class="hist-h">' + esc(when) + " · " + plural(rows.length, unit) + "</div>";
  rows.forEach((r) => {
    h +=
      '<div class="hist-row"' +
      (r.attrs ? ' tabindex="0" ' + r.attrs : "") +
      '><span class="hist-main">' +
      esc(r.label) +
      '</span><span class="hist-val">' +
      esc(r.right || "") +
      "</span></div>";
  });
  return h;
}
/* Month arrows, Today and day buttons re-render, then put focus back on the same control so
   the keyboard can keep stepping. */
function bindCalendars() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-cal]");
    if (!b) return;
    const v = ui.cal[b.dataset.cal];
    if (!v) return;
    let sel;
    if (b.dataset.calDay) {
      v.day = v.day === b.dataset.calDay ? "" : b.dataset.calDay;
      sel = '[data-cal-day="' + b.dataset.calDay + '"]';
    } else {
      v.month = b.dataset.calGo === "0" ? today().slice(0, 7) : shiftMonth(v.month, +b.dataset.calGo);
      v.day = null; // calView picks the new month's newest day on the next render
      sel = '[data-cal-go="' + b.dataset.calGo + '"]';
    }
    render();
    const again = document.querySelector('[data-cal="' + b.dataset.cal + '"]' + sel);
    if (again) again.focus();
  });
}
