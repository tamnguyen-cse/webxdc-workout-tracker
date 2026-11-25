/* ============ VIEW DIALOG — read-only page for a list row ============
   Clicking a row in Workout, Plan or Log opens this first, laid out for reading.
   Edit (or Log session), Delete and Set as default live in its action bar. */
function openView(kind, id) {
  viewUI = { kind, id };
  render();
}
function viewItem(v) {
  if (v.kind === "ex") return exById(v.id);
  if (v.kind === "tpl") return tplById(v.id);
  return cycById(v.id);
}
function prop(label, value, icon) {
  return (
    '<div class="prop"><div class="prop-k">' +
    (icon ? "<i>" + icon + "</i>" : "") +
    label +
    '</div><div class="prop-v">' +
    (value || '<span class="hint">Empty</span>') +
    "</div></div>"
  );
}
function videoLink(url, label) {
  return url
    ? '<a class="vlink" href="' + esc(url) + '" target="_blank" rel="noopener">' + label + "</a>"
    : "";
}
function lvlPill(level) {
  const l = Math.max(0, Math.floor(+level) || 0);
  return '<span class="' + lvlClass(l) + '">' + l + "</span> " + esc(lvlName(l));
}
function dayHead(day, extra) {
  return (
    '<h3 class="view-h"><span class="view-h-main"><span class="swatch tag-' +
    colourOf(day.color) +
    '"></span>' +
    esc(day.name) +
    "</span>" +
    (extra ? '<span class="hint view-h-meta">' + extra + "</span>" : "") +
    "</h3>"
  );
}
/* "12 · 12 · 10", "skipped", or "" when nothing was entered */
function entryText(en, byTime, x) {
  if (en.skip) return "skipped";
  const t = en.sets
    .map((v, i) => setText(en, i, byTime))
    .filter((v) => v.trim())
    .map(esc)
    .join(" · ");
  const load = loadText(itemLoad(en, x));
  return t && load ? t + " @ " + esc(load) : t; // a load alone is not a logged set
}
function entryHtml(en, byTime, x) {
  if (en.skip) return '<span class="hint">skipped</span>';
  const t = en.sets
    .map((v, i) => setText(en, i, byTime))
    .filter((v) => v.trim())
    .map(esc)
    .join(" · ");
  if (!t) return "";
  const load = loadText(itemLoad(en, x));
  return (
    '<span class="hist-sets">' +
    t +
    "</span>" +
    (load ? ' <span class="hint">@ ' + esc(load) + "</span>" : "")
  );
}
const EX_CYCLES_PER_PAGE = 5;
function exEntryMetrics(en, x) {
  const byTime = isTime(x);
  const load = itemLoad(en, x);
  const skip = !!en.skip;
  const chips = [];
  if (!skip) {
    (en.sets || []).forEach((v, i) => {
      const text = setText(en, i, byTime).trim();
      if (!text) return;
      const val = typeof v === "number" ? v : byTime ? parseSeconds(v) : parseReps(v);
      const expr = en.expr && en.expr["sets." + i] ? en.expr["sets." + i] : "";
      chips.push({ text, val, expr });
    });
  }
  const total = chips.reduce((sum, c) => sum + c.val, 0);
  const maxSet = chips.reduce((m, c) => Math.max(m, c.val), 0);
  return { skip, chips, total, maxSet, avg: chips.length ? total / chips.length : 0, load };
}
function fmtDeltaAmt(diff, byTime, perSet) {
  const abs = Math.abs(diff);
  const arrow = diff > 0 ? "↑ +" : "↓ -";
  if (byTime) return arrow + fmtSecs(Math.round(abs)) + (perSet ? "/set" : "");
  const n = round1(abs);
  return arrow + (perSet ? n + "/set" : plural(n, "rep"));
}
/* Delta pills comparing one logged session to the previous non-skipped session chronologically. */
function exEntryDelta(cur, prev, byTime) {
  if (!prev || cur.skip || !cur.chips.length || !prev.chips.length) return [];
  const out = [];
  const dWt = round1(cur.load.wt - prev.load.wt);
  if (dWt !== 0)
    out.push({ text: (dWt > 0 ? "↑ +" : "↓ ") + dWt + " kg", tone: dWt > 0 ? "green" : "orange" });
  if (cur.chips.length === prev.chips.length) {
    const dTot = byTime ? Math.round(cur.total - prev.total) : round1(cur.total - prev.total);
    if (dTot !== 0)
      out.push({ text: fmtDeltaAmt(dTot, byTime, false), tone: dTot > 0 ? "green" : "orange" });
  } else {
    const dAvg = byTime ? Math.round(cur.avg - prev.avg) : round1(cur.avg - prev.avg);
    if (dAvg !== 0)
      out.push({ text: fmtDeltaAmt(dAvg, byTime, true), tone: dAvg > 0 ? "green" : "orange" });
    else {
      const dSets = cur.chips.length - prev.chips.length;
      out.push({
        text: (dSets > 0 ? "↑ +" : "↓ -") + plural(Math.abs(dSets), "set"),
        tone: dSets > 0 ? "green" : "orange",
      });
    }
  }
  return out;
}
/* Every logged session of an exercise, newest first, with per-session progression deltas. */
function exHistory(exId) {
  const x = exById(exId);
  const byTime = isTime(x);
  const rows = [];
  state.cycles.forEach((c) => {
    const dayIdx = new Map((c.days || []).map((d, i) => [d.id, i]));
    (c.sessions || []).forEach((s) => {
      const dayObj = (c.days || []).find((d) => d.id === s.dayId);
      let slotIdx = 0;
      Object.entries(s.entries || {}).forEach(([slot, en]) => {
        if (entryEx(slot, en) !== exId || !entryText(en, byTime, x)) return;
        rows.push({
          date: s.date,
          cycleId: c.id,
          cycle: c.name,
          cycleN: c.n || 0,
          archived: !!c.archived,
          dayId: s.dayId,
          day: dayName(c, s.dayId),
          dayOrder: dayIdx.has(s.dayId) ? dayIdx.get(s.dayId) : Infinity,
          dayColor: colourOf(dayObj && dayObj.color),
          slotIdx: slotIdx++,
          en,
          ...exEntryMetrics(en, x),
        });
      });
    });
  });
  rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.cycleN - b.cycleN ||
      a.dayOrder - b.dayOrder ||
      a.slotIdx - b.slotIdx,
  );
  let prev = null;
  rows.forEach((r) => {
    r.delta = exEntryDelta(r, prev, byTime);
    if (!r.skip && r.chips.length) prev = r;
  });
  return rows.reverse();
}
function compactLoadBadge(load) {
  if (load.bw && load.wt > 0) return { text: "+" + load.wt + " kg", title: "bodyweight + " + load.wt + " kg" };
  if (load.bw) return { text: "BW", title: "bodyweight only" };
  if (load.wt > 0) return { text: load.wt + " kg", title: load.wt + " kg" };
  return null;
}
function exBestKpi(active, byTime) {
  if (!active.length) return { val: "—", sub: "All sessions skipped" };
  const maxWt = Math.max(...active.map((r) => r.load.wt));
  if (maxWt > 0) {
    const atMax = active.filter((r) => r.load.wt === maxWt);
    const best = atMax.reduce((a, b) => (b.maxSet > a.maxSet ? b : a), atMax[0]);
    const setAmt = byTime ? fmtSecs(best.maxSet) : plural(best.maxSet, "rep");
    return {
      val: (best.load.bw ? "+" : "") + best.load.wt + " kg",
      sub: (best.load.bw ? "BW · " : "") + "best set " + setAmt + " · " + best.date,
    };
  }
  const best = active.reduce(
    (a, b) => (b.maxSet > a.maxSet || (b.maxSet === a.maxSet && b.total > a.total) ? b : a),
    active[0],
  );
  return {
    val: byTime ? fmtSecs(best.maxSet) : plural(best.maxSet, "rep"),
    sub: "best set · total " + (byTime ? fmtSecs(best.total) : best.total) + " · " + best.date,
  };
}
function exSummaryHtml(hist, x) {
  const byTime = isTime(x);
  const active = hist.filter((r) => !r.skip && r.chips.length);
  const best = exBestKpi(active, byTime);
  const latest = hist[0];
  const lb = !latest.skip ? compactLoadBadge(latest.load) : null;
  const latVal = latest.skip ? "Skipped" : latest.chips.map((c) => c.text).join(" · ");
  const latSub = latest.date + (lb ? " · " + lb.text : "") + " · " + latest.cycle;
  const cycleCount = new Set(hist.map((r) => r.cycleId)).size;
  const skipped = hist.length - active.length;
  const cntSub =
    "across " + plural(cycleCount, "cycle") + (skipped ? " · " + skipped + " skipped" : "");
  return (
    '<div class="ex-kpis">' +
    '<div class="ex-kpi"><div class="ex-kpi-k">Best</div><div class="ex-kpi-v">' +
    esc(best.val) +
    '</div><div class="ex-kpi-sub">' +
    esc(best.sub) +
    "</div></div>" +
    '<div class="ex-kpi ex-kpi-latest"><div class="ex-kpi-k">Latest</div><div class="ex-kpi-v">' +
    esc(latVal) +
    '</div><div class="ex-kpi-sub">' +
    esc(latSub) +
    "</div></div>" +
    '<div class="ex-kpi"><div class="ex-kpi-k">Sessions</div><div class="ex-kpi-v">' +
    hist.length +
    '</div><div class="ex-kpi-sub">' +
    esc(cntSub) +
    "</div></div></div>"
  );
}
function exCycleSummary(rows, byTime) {
  const active = rows.filter((r) => !r.skip && r.chips.length);
  const base = plural(rows.length, "session");
  if (!active.length) return base + " · skipped";
  let sets = 0;
  let sum = 0;
  let wtSum = 0;
  let anyBw = false;
  active.forEach((r) => {
    sets += r.chips.length;
    sum += r.total;
    wtSum += r.load.wt * r.chips.length;
    anyBw = anyBw || r.load.bw;
  });
  const avg = sum / sets;
  const avgWt = round1(wtSum / sets);
  const avgText = byTime ? fmtSecs(avg) : round1(avg) + " reps";
  const loadPart = avgWt > 0 ? " @ " + (anyBw ? "+" : "") + avgWt + " kg" : "";
  return base + " · avg " + avgText + "/set" + loadPart;
}
function exCycleGroups(hist, byTime) {
  const byId = new Map();
  hist.forEach((r) => {
    let g = byId.get(r.cycleId);
    if (!g) {
      g = {
        id: r.cycleId,
        name: r.cycle,
        cycleN: r.cycleN,
        archived: r.archived,
        latestDate: r.date,
        rows: [],
      };
      byId.set(r.cycleId, g);
    }
    if (r.date > g.latestDate) g.latestDate = r.date;
    g.rows.push(r);
  });
  return [...byId.values()]
    .sort((a, b) => b.latestDate.localeCompare(a.latestDate) || b.cycleN - a.cycleN)
    .map((g) => Object.assign(g, { summary: exCycleSummary(g.rows, byTime) }));
}
function exLogRowHtml(r, byTime) {
  let vals;
  if (r.skip) {
    vals = '<span class="lvl tag-gray">skipped</span>';
  } else {
    const chips = r.chips
      .map(
        (c) =>
          '<span class="set-chip"' +
          (c.expr ? ' title="= ' + esc(byTime ? fmtSecs(c.val) : c.val) + '"' : "") +
          ">" +
          esc(c.text) +
          "</span>",
      )
      .join("");
    const lb = compactLoadBadge(r.load);
    const loadHtml = lb
      ? '<span class="lvl tag-gray" title="' + esc(lb.title) + '">' + esc(lb.text) + "</span>"
      : "";
    const deltaHtml = (r.delta || [])
      .map((d) => '<span class="lvl tag-' + d.tone + '">' + esc(d.text) + "</span>")
      .join("");
    vals = '<span class="set-chips">' + chips + "</span>" + loadHtml + deltaHtml;
  }
  return (
    '<button type="button" class="ex-log-row' +
    (r.skip ? " skip" : "") +
    '" data-open-cyc="' +
    esc(r.cycleId) +
    '" title="Open ' +
    esc(r.cycle) +
    '"><div class="ex-log-main"><span class="ex-log-when"><span class="swatch sm tag-' +
    r.dayColor +
    '" aria-hidden="true"></span><span class="ex-log-day">' +
    esc(r.day) +
    '</span><span class="ex-log-date">' +
    esc(r.date) +
    '</span></span><span class="ex-log-vals">' +
    vals +
    "</span></div>" +
    (r.en.note ? '<div class="ex-log-note">' + esc(r.en.note) + "</div>" : "") +
    "</button>"
  );
}
function exLoggedHtml(x) {
  const hist = exHistory(x.id);
  const byTime = isTime(x);
  let h =
    '<div class="view-h ex-log-head"><span>Logged <span class="hint">' +
    plural(hist.length, "session") +
    "</span></span>" +
    (hist.length
      ? '<button type="button" class="btn ghost sm ex-analytics" data-ex-analytics="1">View in Analytics ↗</button>'
      : "") +
    "</div>";
  if (!hist.length) return h + '<div class="view-p hint">Not logged yet.</div>';
  h += exSummaryHtml(hist, x);
  const groups = exCycleGroups(hist, byTime);
  const pages = Math.max(1, Math.ceil(groups.length / EX_CYCLES_PER_PAGE));
  const page = Math.min(Math.max(0, (viewUI && viewUI.logPage) || 0), pages - 1);
  if (viewUI) viewUI.logPage = page;
  const openMap = (viewUI && viewUI.openCycles) || {};
  const start = page * EX_CYCLES_PER_PAGE;
  const slice = groups.slice(start, start + EX_CYCLES_PER_PAGE);
  h += '<div class="cyc-grps">';
  slice.forEach((g, idx) => {
    const open = openMap[g.id] !== undefined ? !!openMap[g.id] : idx === 0;
    h +=
      '<div class="cyc-grp">' +
      '<button type="button" class="cyc-grp-head" data-cyc-toggle="' +
      esc(g.id) +
      '" aria-expanded="' +
      open +
      '"><span class="cyc-grp-title"><span class="cyc-chev" aria-hidden="true">▸</span>' +
      esc(g.name) +
      (g.archived ? ' <span class="hint">(archived)</span>' : "") +
      '</span><span class="cyc-grp-meta">' +
      esc(g.summary) +
      "</span></button>" +
      (open
        ? '<div class="cyc-grp-body">' +
          g.rows.map((r) => exLogRowHtml(r, byTime)).join("") +
          "</div>"
        : "") +
      "</div>";
  });
  h += "</div>";
  if (pages > 1) {
    const from = start + 1;
    const to = Math.min(groups.length, start + EX_CYCLES_PER_PAGE);
    h +=
      '<nav class="ex-log-pager" aria-label="Logged cycles">' +
      '<button type="button" class="btn sm" data-ex-page="' +
      (page - 1) +
      '"' +
      (page === 0 ? " disabled" : "") +
      ">‹ Prev</button>" +
      '<span class="hint">' +
      from +
      "–" +
      to +
      " of " +
      plural(groups.length, "cycle") +
      "</span>" +
      '<button type="button" class="btn sm" data-ex-page="' +
      (page + 1) +
      '"' +
      (page === pages - 1 ? " disabled" : "") +
      ">Next ›</button></nav>";
  }
  return h;
}
function exViewHtml(x) {
  const days = usedIn(x.id);
  const cycles = cyclesUsing(x.id);
  let h =
    '<div class="props">' +
    prop("Level", lvlPill(x.level), "▾") +
    prop("Counted by", isTime(x) ? "time (s)" : "reps", "#") +
    prop("Type", bwPill(x.bw), "▾") +
    prop("Video", videoLink(x.video, "▶ video"), "↗") +
    prop("Used in", days.length && esc(days.join(", ")), "≡") +
    prop("Cycles", cycles && plural(cycles, "cycle"), "#") +
    "</div>";
  if (x.notes) h += '<h3 class="view-h">Notes</h3><div class="view-p">' + esc(x.notes) + "</div>";
  return h + exLoggedHtml(x);
}
/* The plan version the view shows — picked in its Version select, the current one by
   default. Edit, New version, Duplicate and Delete act on it. */
function viewVer(t) {
  return t.versions.find((x) => x.v === viewUI.v) || curV(t);
}
function versionSelect(t, v) {
  const cur = curV(t);
  let h = '<select id="view-ver" title="Version" aria-label="Version">';
  t.versions.forEach((x) => {
    h +=
      '<option value="' +
      x.v +
      '"' +
      (x.v === v.v ? " selected" : "") +
      ">v" +
      x.v +
      " · " +
      esc(x.updated) +
      (x.v === cur.v ? " · current" : "") +
      "</option>";
  });
  return h + "</select>";
}
function tplViewHtml(t) {
  const v = viewVer(t);
  const cycles = state.cycles.filter((c) => c.templateId === t.id).length;
  let h =
    '<div class="props">' +
    prop("Default", t.isDefault ? "★ Default plan" : "No", "★") +
    prop("Version", versionSelect(t, v), "#") +
    prop("Updated", esc(v.updated), "◷") +
    prop("Content", plural(v.days.length, "day") + " · " + plural(exCount(v.days), "exercise"), "≡") +
    prop("Cycles", cycles && plural(cycles, "cycle"), "#") +
    "</div>";
  v.days.forEach((day) => {
    const items = day.items || [];
    h += dayHead(day, plural(items.length, "exercise"));
    if (!items.length) {
      h += '<div class="view-p hint">No exercises.</div>';
      return;
    }
    h += '<table class="vtable"><tbody>';
    items.forEach((it) => {
      const x = exById(it.ex);
      const notes = it.notes || (x && x.notes) || "";
      const load = loadText(itemLoad(it, x));
      h +=
        "<tr><td>" +
        '<span class="' +
        lvlClass(x && x.level) +
        '">' +
        ((x && x.level) || 0) +
        "</span> " +
        bwIcon(x && x.bw) +
        " " +
        '<span class="ex-name">' +
        esc(x ? x.name : "(removed from library)") +
        "</span> " +
        videoLink(x && x.video, "▶") +
        (notes ? '<div class="ex-target">' + esc(notes) + "</div>" : "") +
        '</td><td class="vt-dose">' +
        esc(doseText(it.sets, it.reps, x && x.by)) +
        (load ? '<div class="hint">' + esc(load) + "</div>" : "") +
        "</td></tr>";
    });
    h += "</tbody></table>";
  });
  return h;
}
function orderedCycleSessions(c) {
  const order = new Map(c.days.map((d, i) => [d.id, i]));
  return c.sessions.slice().sort((a, b) => {
    const ia = order.has(a.dayId) ? order.get(a.dayId) : Infinity;
    const ib = order.has(b.dayId) ? order.get(b.dayId) : Infinity;
    return ia - ib || b.date.localeCompare(a.date);
  });
}
function orderedSessionEntries(day, entries) {
  const map = entries || {};
  const seen = new Set();
  const out = [];
  (day && day.items ? day.items : []).forEach((it) => {
    const slot = slotOf(it);
    if (Object.prototype.hasOwnProperty.call(map, slot)) {
      out.push([slot, map[slot]]);
      seen.add(slot);
    }
  });
  Object.entries(map).forEach(([slot, en]) => {
    if (!seen.has(slot)) out.push([slot, en]);
  });
  return out;
}
function cycViewHtml(c) {
  const t = tplById(c.templateId);
  const vol = volText(c.sessions);
  const ss = orderedCycleSessions(c);
  const lastDate = c.sessions.map((s) => s.date).sort().slice(-1)[0];
  let h =
    '<div class="props">' +
    prop("Plan", esc(t ? t.name : "deleted plan") + " v" + c.templateV, "▾") +
    prop("Created", esc(c.created), "◷") +
    prop("Status", statusPill(c), "◉") +
    prop("Days", c.days.length && esc(c.days.map((d) => d.name).join(", ")), "≡") +
    prop(
      "Sessions",
      ss.length && plural(ss.length, "session") + " · " + vol + " total" + durTag(ss),
      "#",
    ) +
    prop("Last session", lastDate && esc(lastDate), "◷") +
    "</div>";
  if (!ss.length) return h + '<div class="view-p hint">No sessions logged yet.</div>';
  ss.forEach((s) => {
    const day = c.days.find((d) => d.id === s.dayId) || { name: "?", color: "gray" };
    h += dayHead(day, esc(s.date) + " · " + volText(s) + durTag(s));
    orderedSessionEntries(day, s.entries).forEach(([slot, en]) => {
      const exId = entryEx(slot, en);
      const x = exById(exId);
      const sets = entryHtml(en, isTime(x), x);
      if (!sets) return;
      h +=
        '<div class="hist-row hist-entry' +
        (en.skip ? " skip" : "") +
        '"><span class="hist-main">' +
        bwIcon(itemLoad(en, x).bw) +
        " " +
        '<span class="hist-name">' +
        esc(exName(exId, en.name)) +
        '</span></span><span class="hist-val">' +
        sets +
        "</span></div>" +
        (en.note ? '<div class="ex-target view-note">' + esc(en.note) + "</div>" : "");
    });
  });
  return h;
}
function viewModalHtml() {
  const x = viewItem(viewUI);
  if (!x) {
    viewUI = null;
    return "";
  }
  const crumb = { ex: "Workout", tpl: "Plan", cyc: "Log" }[viewUI.kind];
  const body =
    archivedNote(x) +
    (viewUI.kind === "cyc" ? doneNote(x) : "") +
    (viewUI.kind === "ex" ? exViewHtml(x) : viewUI.kind === "tpl" ? tplViewHtml(x) : cycViewHtml(x));
  // an archived record is read-only: Restore or Delete forever
  if (x.archived)
    return modalWrap({
      crumb: crumb + " / Archive",
      title: x.name,
      body,
      bar:
        '<button class="btn ghost danger" id="view-del">Delete forever</button>' +
        '<button class="btn primary" id="view-restore" title="Restore (A)">Restore</button>',
    });
  const locked = viewUI.kind === "cyc" && !!x.done;
  const extra =
    (viewUI.kind === "tpl"
      ? (!x.isDefault ? '<button class="btn ghost" id="view-default">Set as default</button>' : "") +
        '<button class="btn ghost" id="view-newver">New version</button>'
      : "") +
    (viewUI.kind === "cyc"
      ? locked
        ? '<button class="btn ghost" id="view-reopen" title="Reopen (M)">Reopen</button>'
        : '<button class="btn ghost" id="view-done" title="Mark done (M)">Mark done</button>'
      : "");
  const bar =
    (locked ? "" : '<button class="btn ghost" id="view-edit" title="Edit (E)">Edit</button>') +
    '<button class="btn ghost" id="view-dup" title="Duplicate (D)">Duplicate</button>' +
    '<button class="btn ghost danger" id="view-del">Delete</button>';
  return modalWrap({ crumb, title: x.name, body, bar, extra });
}
function viewChange(e) {
  if (e.target.id !== "view-ver") return;
  viewUI.v = +e.target.value;
  render();
}
function viewClick(e) {
  const el = e.target;
  const v = viewUI;
  if (el.closest("[data-ex-analytics]")) {
    const x = exById(v.id);
    if (x) {
      ui.tab = "stats";
      ui.statEx = x.name;
      closeModal();
    }
    return;
  }
  const tog = el.closest("[data-cyc-toggle]");
  if (tog) {
    const cid = tog.dataset.cycToggle;
    const expanded = tog.getAttribute("aria-expanded") === "true";
    v.openCycles = Object.assign({}, v.openCycles, { [cid]: !expanded });
    renderModal();
    const again = modalRoot().querySelector('[data-cyc-toggle="' + cid + '"]');
    if (again) again.focus({ preventScroll: true });
    return;
  }
  const pg = el.closest("[data-ex-page]");
  if (pg && !pg.disabled) {
    v.logPage = +pg.dataset.exPage;
    renderModal();
    const head = modalRoot().querySelector(".ex-log-head");
    if (head) head.scrollIntoView({ block: "nearest" });
    return;
  }
  const openCyc = el.closest("[data-open-cyc]");
  if (openCyc) {
    openView("cyc", openCyc.dataset.openCyc);
    return;
  }
  if (el.closest("#view-dup")) {
    if (v.kind === "tpl") duplicatePlan(tplById(v.id), v.v);
    else if (v.kind === "ex") duplicateExercise(exById(v.id));
    else duplicateCycle(cycById(v.id));
    return;
  }
  if (el.closest("#view-done")) return setCycleDone(cycById(v.id), true);
  if (el.closest("#view-reopen")) return setCycleDone(cycById(v.id), false);
  if (el.closest("#view-restore")) return restoreRecord(v.kind, recordOf(v.kind, v.id));
  if (el.closest("#view-edit") || el.closest("#view-newver")) {
    viewUI = null;
    editFromView = v;
    if (v.kind === "ex") openEx(v.id);
    else if (v.kind === "tpl") openTpl(v.id, v.v, !!el.closest("#view-newver"));
    else openCycle(v.id);
  } else if (el.closest("#view-del")) {
    if (v.kind === "ex") deleteExercise(v.id);
    else if (v.kind === "tpl") deletePlan(tplById(v.id), viewVer(tplById(v.id)).v);
    else deleteCycle(cycById(v.id));
  } else if (el.closest("#view-default")) {
    state.templates.forEach((t) => (t.isDefault = t.id === v.id));
    saveState();
    render();
  }
}
