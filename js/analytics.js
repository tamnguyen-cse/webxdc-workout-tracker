/* ============ ANALYTICS ============ */
const STAT_RANGES = [
  ["2w", "Last 2 weeks", 0],
  ["1m", "Last 1 month", 1],
  ["2m", "Last 2 months", 2],
  ["3m", "Last 3 months", 3],
  ["6m", "Last 6 months", 6],
  ["1y", "Last year", 12],
];
function rangeEntry(key) {
  return STAT_RANGES.find(([k]) => k === key) || STAT_RANGES[0];
}
function validRange(key) {
  return rangeEntry(key)[0];
}
function rangeLabel(key) {
  return rangeEntry(key)[1];
}
/* Local ISO date `months` calendar months before `base`, clamping day-of-month
   (e.g. May 31 − 1 month → Apr 30). */
function subtractMonths(base, months) {
  const out = new Date(base.getFullYear(), base.getMonth() - months, 1);
  const last = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(base.getDate(), last));
  return out;
}
function isoDate(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function rangeStart(key) {
  const months = rangeEntry(key)[2];
  const now = new Date();
  if (months > 0) return isoDate(subtractMonths(now, months));
  now.setDate(now.getDate() - 13); // 14 calendar days inclusive
  return isoDate(now);
}
function flatSessions() {
  const out = [];
  state.cycles.forEach((c) => c.sessions.forEach((s) => out.push({ c, s })));
  return out.sort((a, b) => a.s.date.localeCompare(b.s.date));
}
function rangeSessions(key) {
  const start = rangeStart(key === undefined ? ui.statRange : key);
  return flatSessions().filter(({ s }) => s.date >= start);
}
function exerciseNames() {
  const names = new Set();
  (state.exercises || []).forEach((x) => names.add(x.name));
  // keep names of exercises that were logged before being removed from the library
  state.cycles.forEach((c) =>
    c.sessions.forEach((s) =>
      Object.values(s.entries || {}).forEach((en) => en.name && names.add(en.name)),
    ),
  );
  return [...names].sort();
}

/* ============ ANALYTICS — charts ============
   Inline SVG, coloured from theme tokens in css/base.css. Every x-point carries a
   `data-tip`; tapping or hovering it writes that text into its card's `.readout` line
   (bindStats), which starts on the latest point. Hover-only tooltips never show on a
   phone, so values are never only in a <title>. */
const CH = { W: 560, H: 196, L: 62, R: 28, T: 18, B: 30 };
const TIME_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
function round1(v) {
  return Math.round(v * 10) / 10;
}
function fmtCompact(v) {
  return v >= 1000 ? round1(v / 1000) + "k" : String(round1(v));
}
/* Round gridline values from 0 up past `max`: about four steps of 1, 2, 2.5 or 5 × 10ⁿ,
   or whole clock units (15s, 1:00, 5:00 …) for seconds. */
function niceTicks(max, byTime) {
  if (!(max > 0)) return [0, 1];
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = byTime
    ? TIME_STEPS.find((v) => v >= raw) || Math.ceil(raw / 3600) * 3600
    : [1, 2, 2.5, 5, 10].map((f) => f * mag).find((v) => v >= raw);
  const out = [];
  for (let v = 0; v < max + step - 1e-9; v += step) out.push(round1(v));
  return out;
}
function chartScaleY(top) {
  return (v) => CH.H - CH.B - (v * (CH.H - CH.T - CH.B)) / top;
}
function chartScaleX(n) {
  const span = CH.W - CH.L - CH.R - 24;
  return (i) => CH.L + 12 + (n === 1 ? span / 2 : (i * span) / (n - 1));
}
function hitBounds(i, n, X) {
  if (n === 1) return { x: CH.L, w: CH.W - CH.L - CH.R };
  const half = (X(1) - X(0)) / 2;
  const x1 = Math.max(CH.L, X(i) - half);
  const x2 = Math.min(CH.W - CH.R, X(i) + half);
  return { x: x1, w: Math.max(8, x2 - x1) };
}
/* Every how many points an x label fits: about `maxDesktop` across on wide screens, half on phones. */
function labelEvery(n, maxDesktop) {
  const cap = maxDesktop || 12;
  const limit = window.matchMedia("(max-width: 760px)").matches ? Math.ceil(cap / 2) : cap;
  return Math.max(1, Math.ceil(n / limit));
}
function xLabel(text, at) {
  return (
    '<text x="' + at + '" y="' + (CH.H - CH.B + 18) + '" font-size="9" text-anchor="middle">' +
    esc(text) + "</text>"
  );
}
/* Gridlines with left Y-axis ticks. */
function chartFrame(ticks, fmt) {
  const xEnd = CH.W - CH.R;
  const Y = chartScaleY(ticks[ticks.length - 1]);
  let s = '<svg viewBox="0 0 ' + CH.W + " " + CH.H + '" width="100%">';
  ticks.forEach((t) => {
    const y = Y(t);
    s +=
      '<line class="' + (t ? "grid" : "axis") + '" x1="' + CH.L + '" y1="' + y +
      '" x2="' + xEnd + '" y2="' + y + '"/>' +
      '<text x="' + (CH.L - 6) + '" y="' + (y + 3) + '" font-size="10" text-anchor="end">' +
      esc(fmt(t)) + "</text>";
  });
  return { s, Y };
}
/* pts: [{ label, y, tip }] — one dot per point, joined by a line in series colour `s0|s1|s2`. */
function lineChart(pts, opts) {
  const o = opts || {};
  if (!pts.length) return '<div class="hint">' + esc(o.empty || "No data in this range.") + "</div>";
  const fmt = o.fmt || String;
  const cls = o.series || "s0";
  const ticks = niceTicks(Math.max(...pts.map((p) => p.y)), fmt === fmtSecs);
  const f = chartFrame(ticks, fmt);
  const X = chartScaleX(pts.length);
  let s = f.s;
  if (pts.length > 1) {
    s +=
      '<polyline class="' + cls + '" points="' +
      pts.map((p, i) => X(i) + "," + f.Y(p.y)).join(" ") +
      '" fill="none" stroke-width="2"/>';
  }
  const step = labelEvery(pts.length, o.maxLabels);
  pts.forEach((p, i) => {
    const cx = X(i);
    const cy = f.Y(p.y);
    const hit = hitBounds(i, pts.length, X);
    s +=
      '<g class="pt' + (i === pts.length - 1 ? " on" : "") + '" data-tip="' + esc(p.tip) + '">' +
      '<rect class="hit" x="' + hit.x + '" y="' + CH.T + '" width="' + hit.w +
      '" height="' + (CH.H - CH.T - CH.B) + '"/>' +
      '<line class="guide" x1="' + cx + '" y1="' + CH.T + '" x2="' + cx + '" y2="' + (CH.H - CH.B) + '"/>' +
      '<circle class="dot ' + cls + '" cx="' + cx + '" cy="' + cy + '" r="3.5"/></g>';
    if ((pts.length - 1 - i) % step === 0) s += xLabel(p.label, cx);
  });
  return '<div class="svg-wrap">' + s + "</svg></div>";
}
/* A titled chart card: optional calculation description, readout line, then the chart. */
function chartCard(title, chart, last, desc) {
  return (
    '<div class="card" style="margin-bottom:12px"><div class="stat-t">' + esc(title) + "</div>" +
    (desc ? '<div class="chart-desc">' + esc(desc) + "</div>" : "") +
    (last ? '<div class="readout hint">' + esc(last) + "</div>" : "") +
    chart +
    "</div>"
  );
}

/* ============ ANALYTICS — charts data ============ */
/* One exercise in one session: filled sets (across repeated slots), average reps/secs,
   set-weighted average added/lifted weight, and strength = avg reps × avg ((bodyweight) + weight). */
function exSessionStats(sess, name, byTime, bodyWeight) {
  let n = 0;
  let sum = 0;
  let wtSum = 0;
  let effWtSum = 0;
  let bw = false;
  const bwKg = bodyWeight || 0;
  Object.entries(sess.entries || {}).forEach(([slot, en]) => {
    const x = exById(entryEx(slot, en));
    if ((x ? x.name : en.name || "") !== name || en.skip) return;
    const vals = (en.sets || [])
      .filter((v) => String(v).trim())
      .map((v) => (byTime ? parseSeconds(v) : parseReps(v)));
    if (!vals.length) return;
    const load = itemLoad(en, x);
    const slotSum = vals.reduce((a, b) => a + b, 0);
    n += vals.length;
    sum += slotSum;
    wtSum += load.wt * vals.length;
    effWtSum += ((load.bw ? bwKg : 0) + load.wt) * vals.length;
    bw = bw || load.bw;
  });
  if (!n) return null;
  const avg = sum / n;
  const wt = wtSum / n;
  const effWt = effWtSum / n;
  return { n, sum, avg, wt, effWt, strength: avg * effWt, bw };
}
function strengthFormulaDesc(isBw, byTime, bodyWeight) {
  const avgLabel = byTime ? "avg time (s)" : "avg reps";
  if (!isBw) return "Strength = " + avgLabel + " × avg weight.";
  if (bodyWeight !== null) {
    return "Strength = " + avgLabel + " × avg (bodyweight " + bodyWeight + " kg + added weight).";
  }
  return (
    "Strength = " + avgLabel + " × avg (bodyweight + added weight). " +
    "Set your weight in Personal to include bodyweight (currently 0 kg)."
  );
}
/* Strength by workout — 3 separate charts (one per unit): avg reps/time, avg weight, strength. */
function workoutStrengthCharts(flat, name, x) {
  const byTime = isTime(x);
  const bodyWeight = pdNum(state.personal || {}, "weight");
  const rows = flat
    .map(({ c, s }) => ({ c, s, st: exSessionStats(s, name, byTime, bodyWeight) }))
    .filter((r) => r.st);
  const isBw = !!(x && x.bw) || rows.some((r) => r.st.bw);
  const label = name || "—";
  const empty = "No logs for " + (name || "this workout") + " in the selected range.";
  const amount = (v) => (byTime ? fmtSecs(v) : plural(round1(v), "rep"));
  const prefix = (c, s) => s.date + " · " + c.name + " · " + dayName(c, s.dayId) + " · ";

  const repPts = rows.map(({ c, s, st }) => ({
    label: s.date.slice(5),
    y: round1(st.avg),
    tip:
      prefix(c, s) + amount(st.avg) + " per set · " +
      amount(st.sum) + " across " + plural(st.n, "set"),
  }));
  const wtPts = rows.map(({ c, s, st }) => ({
    label: s.date.slice(5),
    y: round1(st.wt),
    tip:
      prefix(c, s) +
      (st.wt ? loadText({ bw: st.bw, wt: round1(st.wt) }) + " avg" : st.bw ? "bodyweight only (+0 kg)" : "0 kg"),
  }));
  const strengthUnit = byTime ? " kg·s" : " kg";
  const strPts = rows.map(({ c, s, st }) => ({
    label: s.date.slice(5),
    y: round1(st.strength),
    tip:
      prefix(c, s) + round1(st.strength) + strengthUnit + " (" +
      amount(st.avg) + "/set × " + round1(st.effWt) + " kg avg)",
  }));

  return (
    chartCard(
      (byTime ? "Average time per set — " : "Average reps per set — ") + label,
      lineChart(repPts, { fmt: byTime ? fmtSecs : String, empty, series: "s0" }),
      repPts.length ? repPts[repPts.length - 1].tip : "",
      byTime
        ? "Average time per set = total time ÷ sets logged in each session."
        : "Average reps per set = total reps ÷ sets logged in each session.",
    ) +
    chartCard(
      (isBw ? "Average added weight — " : "Average weight — ") + label + " (kg)",
      lineChart(wtPts, { fmt: String, empty, series: "s1" }),
      wtPts.length ? wtPts[wtPts.length - 1].tip : "",
      isBw
        ? "Set-weighted average added weight (kg) on top of bodyweight per session."
        : "Set-weighted average weight (kg) per session.",
    ) +
    chartCard(
      "Strength — " + label + (byTime ? " (kg·s)" : " (kg)"),
      lineChart(strPts, { fmt: fmtCompact, empty, series: "s2" }),
      strPts.length ? strPts[strPts.length - 1].tip : "",
      strengthFormulaDesc(isBw, byTime, bodyWeight),
    )
  );
}
/* Time by day: total timed workout duration summed per calendar day. */
function timeByDayChart(flat) {
  const byDate = {};
  flat.forEach(({ c, s }) => {
    const dur = +s.dur || 0;
    if (!dur) return;
    if (!byDate[s.date]) byDate[s.date] = { dur: 0, count: 0, days: [] };
    byDate[s.date].dur += dur;
    byDate[s.date].count += 1;
    byDate[s.date].days.push(dayName(c, s.dayId));
  });
  const pts = Object.keys(byDate)
    .sort()
    .map((date) => {
      const d = byDate[date];
      return {
        label: date.slice(5),
        y: d.dur,
        tip:
          date + " · " + durText(d.dur) + " (" + fmtSecs(d.dur) + ") · " +
          plural(d.count, "session") + " (" + d.days.join(", ") + ")",
      };
    });
  return chartCard(
    "Time by day",
    lineChart(pts, { fmt: fmtSecs, empty: "No timed workouts in the selected range.", maxLabels: 12 }),
    pts.length ? pts[pts.length - 1].tip : "",
    "Total timed workout duration summed across sessions logged on each calendar day.",
  );
}
function shortLabel(text, max) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
/* Average time by cycle: average timed session duration per cycle active in range. */
function avgTimeByCycleChart(start) {
  const rows = [];
  state.cycles.forEach((c) => {
    const timed = (c.sessions || []).filter((s) => +s.dur > 0);
    if (!timed.length || !timed.some((s) => s.date >= start)) return;
    const total = timed.reduce((sum, s) => sum + (+s.dur || 0), 0);
    const avg = Math.round(total / timed.length);
    const dates = timed.map((s) => s.date).sort();
    rows.push({ c, total, avg, count: timed.length, first: dates[0], last: dates[dates.length - 1] });
  });
  rows.sort(
    (a, b) =>
      a.first.localeCompare(b.first) ||
      a.last.localeCompare(b.last) ||
      (a.c.n || 0) - (b.c.n || 0),
  );
  const pts = rows.map((r) => ({
    label: shortLabel(r.c.name, 10),
    y: r.avg,
    tip:
      r.c.name + " · " + durText(r.avg) + " avg (" + fmtSecs(r.avg) + ") · " +
      durText(r.total) + " total across " + plural(r.count, "timed session") + " (" +
      (r.first === r.last ? r.first : r.first + " – " + r.last) + ")",
  }));
  return chartCard(
    "Average time by cycle",
    lineChart(pts, { fmt: fmtSecs, empty: "No timed cycles in the selected range.", maxLabels: 8 }),
    pts.length ? pts[pts.length - 1].tip : "",
    "Average timed session duration per cycle = total cycle time ÷ timed sessions in that cycle.",
  );
}

/* Dated session history across all cycles for the month calendar (browsing months is
   independent of the chart date range). Clicking a row opens that cycle's view. */
function sessionHistoryDays() {
  const days = {};
  flatSessions().forEach(({ c, s }) => {
    (days[s.date] = days[s.date] || []).push({
      label: c.name + " · " + dayName(c, s.dayId),
      right: volText(s) + durTag(s),
      attrs: 'data-cyc="' + c.id + '"',
    });
  });
  return days;
}

function renderStats() {
  const sec = $("#sec-stats");
  const range = validRange(ui.statRange);
  ui.statRange = range;
  const start = rangeStart(range);
  const flat = flatSessions().filter(({ s }) => s.date >= start);
  const names = exerciseNames();
  if (!ui.statEx || names.indexOf(ui.statEx) < 0) ui.statEx = names[0] || "";
  setTools(
    '<div class="filters stats-filters">' +
      '<select id="st-range" aria-label="Statistics range">' +
      STAT_RANGES.map(
        ([k, label]) =>
          '<option value="' + k + '"' + (k === range ? " selected" : "") + ">" + esc(label) + "</option>",
      ).join("") +
      "</select>" +
      '<select id="st-ex" aria-label="Workout">' +
      names
        .map((n) => "<option" + (n === ui.statEx ? " selected" : "") + ">" + esc(n) + "</option>")
        .join("") +
      "</select>" +
      "</div>",
  );
  const statEx = (state.exercises || []).find((x) => x.name === ui.statEx);
  let h =
    workoutStrengthCharts(flat, ui.statEx, statEx) +
    timeByDayChart(flat) +
    avgTimeByCycleChart(start);
  h +=
    '<div class="card"><div class="stat-t">Session history</div>' +
    historyCalendar("sessions", sessionHistoryDays(), "session") +
    "</div>";
  sec.innerHTML = h;
}
/* Tapping or hovering a point shows its value in the card's readout line. */
function showTip(e) {
  const g = e.target.closest && e.target.closest("#sec-stats [data-tip]");
  if (!g) return;
  const card = g.closest(".card");
  card.querySelectorAll(".pt.on").forEach((x) => x.classList.remove("on"));
  g.classList.add("on");
  const readout = card.querySelector(".readout");
  if (readout) readout.textContent = g.dataset.tip;
}
function bindStats() {
  $("#tab-tools").addEventListener("change", (e) => {
    if (e.target.id === "st-ex") {
      ui.statEx = e.target.value;
      render();
    } else if (e.target.id === "st-range") {
      ui.statRange = e.target.value;
      render();
    }
  });
  $("#sec-stats").addEventListener("pointerover", showTip);
  $("#sec-stats").addEventListener("click", (e) => {
    const row = e.target.closest && e.target.closest(".hist-row[data-cyc]");
    if (row) return openView("cyc", row.dataset.cyc);
    showTip(e);
  });
  $("#sec-stats").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest && e.target.closest(".hist-row[data-cyc]");
    if (!row) return;
    e.preventDefault();
    openView("cyc", row.dataset.cyc);
  });
}
