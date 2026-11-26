let state;
/* Older states embedded the exercise inside every day (`days[].exercises`). Fold those
   into the shared library (`exercises[]`), dedupe by name, and turn days into
   references (`days[].items`) so one edit in the Workout tab updates every plan/log. */
function migrate(s) {
  if (!s || Array.isArray(s.exercises)) return s;
  const lib = [];
  const byName = {};
  const idMap = {};
  const add = (x) => {
    let ex = byName[x.name];
    if (!ex) {
      ex = {
        id: x.id || uid(),
        name: x.name,
        target: x.target || "",
        level: x.level || 0,
        sets: x.sets || 3,
        notes: x.notes || "",
        video: x.video || "",
      };
      byName[x.name] = ex;
      lib.push(ex);
    } else {
      if (!ex.target && x.target) ex.target = x.target;
      if (!ex.video && x.video) ex.video = x.video;
      if (x.notes && ex.notes.indexOf(x.notes) < 0) ex.notes = ex.notes ? ex.notes + " · " + x.notes : x.notes;
    }
    if (x.id) idMap[x.id] = ex.id;
  };
  const allDays = [];
  (s.templates || []).forEach((t) => (t.versions || []).forEach((v) => allDays.push(...(v.days || []))));
  (s.cycles || []).forEach((c) => allDays.push(...(c.days || [])));
  allDays.forEach((d) => (d.exercises || []).forEach(add));
  const conv = (list) =>
    (list || []).map((d) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      items: (d.exercises || []).map((x) => ({ ex: idMap[x.id], sets: x.sets || 3 })),
    }));
  (s.templates || []).forEach((t) => (t.versions || []).forEach((v) => (v.days = conv(v.days))));
  (s.cycles || []).forEach((c) => {
    c.days = conv(c.days);
    (c.sessions || []).forEach((sess) => {
      const entries = {};
      Object.entries(sess.entries || {}).forEach(([oldId, en]) => {
        const nid = idMap[oldId] || oldId;
        const ex = lib.find((l) => l.id === nid);
        entries[nid] = Object.assign({}, en, { name: en.name || (ex ? ex.name : "") });
      });
      sess.entries = entries;
    });
  });
  s.exercises = lib;
  return s;
}
/* One-time remap of exercise levels from the 5-level v1 scale to the 4-level v2
   scale (see LVL_V1_TO_V2). Exercises named "…Endurance" go straight to
   endurance (1) — under v1 they were loosely tagged as core. Marked by _lvlV.
   A fifth level (4 = skill) was added later, in 2026-10-15, without touching this
   remap: an old v1 "4" has already become cardio 3, so 4 means skill only hereafter. */
function migrateLevels(s) {
  if (!s || s._lvlV === 2) return s;
  (s.exercises || []).forEach((x) => {
    const mapped = LVL_V1_TO_V2[x.level || 0];
    x.level = /endurance/i.test(x.name || "") ? 1 : mapped === undefined ? 2 : mapped;
  });
  s._lvlV = 2;
  return s;
}
/* One-time switch from the free-text `target` ("x12", "20 · 18 · 18", "30s") to a numeric
   `reps` (0 = unset). The leading rep count becomes `reps`; any target that was more than a
   plain count is kept verbatim at the front of the notes so nothing is lost. Marked by _repsV. */
function migrateReps(s) {
  if (!s || s._repsV === 1) return s;
  (s.exercises || []).forEach((x) => {
    const t = (x.target || "").trim();
    const m = t.match(/^x?(\d+)\b(?!s)/);
    x.reps = x.reps || (m ? +m[1] : 0);
    if (t && !/^x?\d+$/.test(t)) x.notes = "target " + t + (x.notes ? " · " + x.notes : "");
    delete x.target;
  });
  s._repsV = 1;
  return s;
}
/* 2026-11-21: exercise levels move from code into state.settings, where the Settings page
   edits them. Older data gets the five defaults once; after that an emptied list stays empty. */
function migrateSettings(s) {
  if (!s || s._settingsV) return s;
  s.settings = s.settings && typeof s.settings === "object" ? s.settings : {};
  if (!Array.isArray(s.settings.levels))
    s.settings.levels = DEFAULT_LEVELS.map(([id, name, color]) => ({ id, name, color }));
  s._settingsV = 1;
  return s;
}
function normalizeSettings(s) {
  if (!s) return s;
  s.settings = s.settings && typeof s.settings === "object" ? s.settings : {};
  const seen = new Set();
  s.settings.levels = (Array.isArray(s.settings.levels) ? s.settings.levels : [])
    .filter((l) => l && Number.isFinite(+l.id) && String(l.name || "").trim())
    .map((l) => ({
      id: Math.max(0, Math.floor(+l.id)),
      name: String(l.name).trim(),
      color: colourOf(l.color),
    }))
    .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
  return s;
}
/* Every path that brings in outside data (first load, Import, Link) runs all migrations. */
function upgrade(s) {
  if (s) delete s._synced; // stamp of the data/seed.js file sync, removed 2026-11-22
  s = migrateReps(migrateLevels(migrate(s)));
  if (s && !s.personal) s.personal = { height: "", weight: "", gender: "m", age: "", freq: "" };
  (s && s.cycles ? s.cycles : []).forEach((c) => slotKeys(c.days || []));
  return normalizeSettings(migrateSettings(migratePlanDose(migrateSetFormulas(s))));
}
/* Sets, target reps/seconds and weight (kg) belong to each plan day item, while
   bodyweight (`bw`) belongs to the Workout library exercise (2026-11-17). Copy any old
   library sets/reps/wt onto plan and cycle day items, fold any item-level `bw` onto its
   library exercise, and strip `sets`, `reps` and `wt` from library exercises. */
function migratePlanDose(s) {
  if (!s || s._planDoseV === 2) return s;
  const byId = {};
  (s.exercises || []).forEach((x) => (byId[x.id] = x));
  const fill = (days) =>
    (days || []).forEach((d) =>
      (d.items || []).forEach((it) => {
        const x = byId[it.ex];
        if (!it.sets) it.sets = (x && x.sets) || 3;
        if (it.reps === undefined && x && x.reps) it.reps = x.reps;
        if (it.wt === undefined && x && x.wt) it.wt = x.wt;
        if (it.bw && x && !x.bw) x.bw = true;
        delete it.bw;
      }),
    );
  (s.templates || []).forEach((t) => (t.versions || []).forEach((v) => fill(v.days)));
  (s.cycles || []).forEach((c) => fill(c.days));
  (s.exercises || []).forEach((x) => {
    delete x.sets;
    delete x.reps;
    delete x.wt;
  });
  s._planDoseV = 2;
  return s;
}
/* Sets were free text ("16+2", "1:30"); they are numbers — reps, or seconds for a
   time-counted exercise — with the typed formula kept in `entry.expr["sets.<i>"]`. Text the
   formula input can read becomes its result (3x5 → 15, 1:30 → 90); anything else keeps the
   old reading (digits summed, or parseSeconds) and the original text moves to the note so
   nothing is lost. _setsV 2 (2026-11-07) did reps only; 3 (2026-11-08) adds time sets. */
function migrateSetFormulas(s) {
  if (!s || s._setsV === 3) return s;
  const byId = {};
  (s.exercises || []).forEach((x) => (byId[x.id] = x));
  (s.cycles || []).forEach((c) =>
    (c.sessions || []).forEach((sess) =>
      Object.entries(sess.entries || {}).forEach(([slot, en]) => {
        const clock = isTime(byId[entryEx(slot, en)]);
        en.sets = (en.sets || []).map((v, i) => migrateSet(en, i, v, clock));
      }),
    ),
  );
  s._setsV = 3;
  return s;
}
function migrateSet(en, i, v, clock) {
  if (typeof v === "number") return v;
  const t = String(v ?? "").trim();
  if (!t) return "";
  const clean = calcClean(t, clock);
  const n = clock ? clockCalc(clean) : calc(clean);
  const typeable = clean === t.replace(/[xX×]/g, "*").replace(/÷/g, "/"); // nothing dropped
  if (typeable && !isNaN(n)) {
    keepExpr(en, "sets." + i, hasOp(clean) ? clean : "");
    return Math.max(0, n);
  }
  if (!(clock && /^\d+\s*s$/i.test(t))) // "45s" is just 45 seconds, nothing to keep
    en.note = "set " + (i + 1) + " was " + t + (en.note ? " · " + en.note : "");
  return clock ? parseSeconds(t) : parseReps(t);
}
/* What a set shows: its formula as typed, else its value (seconds as 45s / 1:30). */
function setText(en, i, byTime) {
  const v = en.sets[i];
  if (en.expr && en.expr["sets." + i]) return en.expr["sets." + i];
  return byTime && typeof v === "number" ? fmtSecs(v) : String(v ?? "");
}
/* A cycle day may hold one exercise more than once with different setups (sets, reps,
   load), and each must log on its own. The first occurrence keeps the exercise id as
   its slot, so sessions logged before keys existed still line up; each later one gets
   a key "<exId>~2", "~3", … Keys stay put once set, so reordering never swaps logs. */
function slotKeys(days) {
  days.forEach((d) => {
    const items = d.items || [];
    const used = new Set(items.filter((it) => it.key).map((it) => it.key));
    items.forEach((it) => {
      if (it.key) return;
      if (!used.has(it.ex)) {
        used.add(it.ex);
        return;
      }
      let n = 2;
      while (used.has(it.ex + "~" + n)) n += 1;
      it.key = it.ex + "~" + n;
      used.add(it.key);
    });
  });
  return days;
}
function slotOf(it) {
  return it.key || it.ex;
}
/* The exercise behind a session entry stored under `slot`. */
function entryEx(slot, en) {
  return (en && en.ex) || slot;
}
/* data/seed.js never carries body data, and a backup may not, so a state loaded from
   either keeps this device's `personal`. */
function keepPersonal(next, personal) {
  if (next && !next.personal && personal) next.personal = clone(personal);
  return next;
}
function readLocal(key) {
  try {
    const s = JSON.parse(localStorage.getItem(key));
    return s && Array.isArray(s.templates) && Array.isArray(s.cycles) ? s : null;
  } catch (e) {
    return null; // unreadable storage counts as empty; data/seed.js is the fallback
  }
}
function loadState() {
  const local = readLocal(LS) || readLocal(LS_STRAY);
  state = upgrade(clone(local || SEED));
}
function saveState() {
  localStorage.setItem(LS, JSON.stringify(state));
}
