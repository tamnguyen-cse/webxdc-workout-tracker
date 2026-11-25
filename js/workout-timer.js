/* ============ WORKOUT TIMER — one global stopwatch recorded per cycle day ============
   Only one workout timer can be active at a time across the app, tied to the cycle and day
   where it was started. While active (running, or paused with elapsed time > 0), a compact
   pill in the page top bar and dialog bars shows the clock and Pause/Resume, and clicking
   the time jumps straight to that cycle day's session editor.
   The clock lives in its own localStorage key, not in state — so it keeps running through
   closing dialogs, switching tabs, reloads or a locked phone, and never lands in a backup.
   Save copies the elapsed time into the session's `dur`; a paused clock is then cleared,
   while a running one keeps ticking so mid-workout saves update `dur` without stopping. */
const TIMERS_KEY = "workout-tracker-timers";
let timer = loadTimer(); // { cycleId, dayId, secs, since } or null — since = ms epoch or null
let timerTick = null;
function parseLegacyTimer(raw) {
  const entries = Object.entries(raw).filter(([, v]) => v && (v.since || +v.secs > 0));
  const pick = entries.find(([, v]) => v.since) || entries[0];
  if (!pick) return null;
  const [k, v] = pick;
  const sep = k.indexOf(":");
  if (sep < 1) return null;
  return {
    cycleId: k.slice(0, sep),
    dayId: k.slice(sep + 1),
    secs: +v.secs || 0,
    since: v.since || null,
  };
}
function loadTimer() {
  try {
    const raw = JSON.parse(localStorage.getItem(TIMERS_KEY));
    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.cycleId === "string" && typeof raw.dayId === "string") {
      return {
        cycleId: raw.cycleId,
        dayId: raw.dayId,
        secs: +raw.secs || 0,
        since: raw.since || null,
      };
    }
    return parseLegacyTimer(raw);
  } catch (e) {
    return null; // unreadable timer starts from the saved sessions' times
  }
}
function saveTimer() {
  if (timer && (timer.since || timer.secs > 0)) {
    localStorage.setItem(TIMERS_KEY, JSON.stringify(timer));
  } else {
    localStorage.removeItem(TIMERS_KEY);
  }
}
function clearTimer() {
  timer = null;
  saveTimer();
}
/* The active global timer and its cycle + day, or null when idle or orphaned. */
function activeTimer() {
  if (!timer || (!timer.since && !(timer.secs > 0))) return null;
  if (!state) return null;
  const c = cycById(timer.cycleId);
  const day = c && !c.done && !c.archived && c.days.find((d) => d.id === timer.dayId);
  if (!day) {
    clearTimer();
    return null;
  }
  return { c, day, timer };
}
function isTimerDay(c, dayId) {
  const act = activeTimer();
  return !!act && act.c.id === c.id && act.day.id === dayId;
}
/* The day's stopwatch: the active global timer when it belongs to this day, else a paused
   clock at the editor's typed/reset value or the saved session's time. */
function timerOf(c, dayId) {
  if (isTimerDay(c, dayId)) return timer;
  if (cycUI && cycUI.id === c.id && cycUI.dayId === dayId && cycUI.dur !== undefined) {
    return { secs: cycUI.dur, since: null };
  }
  const s = daySession(c, dayId);
  return { secs: (s && +s.dur) || 0, since: null };
}
function timerSecs(t) {
  return t.secs + (t.since ? Math.max(0, Math.floor((Date.now() - t.since) / 1000)) : 0);
}
/* 45 → "0:45", 3120 → "52:00", 4500 → "1:15:00" — the stopwatch face. */
function clockFace(n) {
  return n < 60 ? "0:" + String(n).padStart(2, "0") : fmtSecs(n);
}
/* A typed time: m:ss or h:mm:ss, or a plain number (formula allowed) read as minutes. NaN
   when it can't be worked out. */
function parseDur(text) {
  const t = String(text).trim();
  if (!t) return 0;
  const n = t.includes(":") ? clockCalc(t) : calc(t) * 60;
  return isNaN(n) || n < 0 ? NaN : Math.round(n);
}
function globalTimerHtml() {
  const act = activeTimer();
  if (!act) return "";
  const run = !!act.timer.since;
  const where = act.c.name + " · " + act.day.name;
  const actLabel = run ? "Pause timer" : "Resume timer";
  return (
    '<span class="gtimer' + (run ? " running" : "") + '">' +
    '<button type="button" class="gtimer-jump" title="Open ' + esc(where) + '">' +
    '<span class="gtimer-ico" aria-hidden="true">⏱</span>' +
    '<span class="gtimer-day">' + esc(act.day.name) + "</span>" +
    '<span class="gtimer-clock">' + clockFace(timerSecs(act.timer)) + "</span></button>" +
    '<button type="button" class="gtimer-toggle" title="' + actLabel + '" aria-label="' +
    actLabel + '">' + (run ? "⏸" : "▶") + "</button></span>"
  );
}
function paintTimer() {
  const html = globalTimerHtml();
  const hdr = $("#hdr-timer");
  if (hdr) hdr.innerHTML = html;
  const mod = $("#modal-timer");
  if (mod) {
    mod.innerHTML = html;
    syncModalTopPad(modalRoot());
  }
  syncTimerTick();
}
function toggleGlobalTimer() {
  const act = activeTimer();
  if (!act) return;
  const t = act.timer;
  timer = t.since
    ? { cycleId: t.cycleId, dayId: t.dayId, secs: timerSecs(t), since: null }
    : { cycleId: t.cycleId, dayId: t.dayId, secs: t.secs, since: Date.now() };
  saveTimer();
  paintTimer();
  if (cycUI && cycUI.id === t.cycleId && cycUI.dayId === t.dayId) renderModal();
}
async function jumpToTimer() {
  const act = activeTimer();
  if (!act) return;
  if (cycUI && cycUI.id === act.c.id) {
    if (cycUI.dayId !== act.day.id) {
      pickDay(act.c, act.day.id);
      render();
    } else {
      modalRoot().querySelector(".modal-body")?.scrollTo({ top: 0, behavior: "smooth" });
      $("#cyc-timer-go")?.focus();
    }
    return;
  }
  if (editorDirty() && !(await ask("Discard unsaved changes?", "Discard", true))) return;
  tplUI = null;
  exUI = null;
  pdUI = null;
  helpUI = false;
  infoUI = "";
  viewUI = null;
  editFromView = null;
  openCycle(act.c.id, act.day.id);
}
function bindTimer() {
  $("#hdr-timer").addEventListener("click", (e) => {
    if (e.target.closest(".gtimer-toggle")) toggleGlobalTimer();
    else if (e.target.closest(".gtimer-jump")) jumpToTimer();
  });
}
function timerRowHtml(c, dayId) {
  const t = timerOf(c, dayId);
  const run = !!t.since;
  const act = activeTimer();
  const other = act && !isTimerDay(c, dayId)
    ? (act.c.id === c.id ? "" : act.c.name + " · ") + act.day.name
    : "";
  return (
    '<span class="timer' + (run ? " running" : "") + '">' +
    '<input id="cyc-timer" type="text" inputmode="tel" autocomplete="off" spellcheck="false"' +
    ' enterkeyhint="done" aria-label="Workout time" value="' + clockFace(timerSecs(t)) + '"' +
    (run ? " readonly" : ' title="Type m:ss, h:mm:ss or minutes"') + ">" +
    '<button class="btn' + (run ? "" : " primary") + '" id="cyc-timer-go">' +
    (run ? "⏸ Pause" : timerSecs(t) ? "▶ Resume" : "▶ Start") + "</button>" +
    '<button class="iconbtn" id="cyc-timer-reset" title="Reset the timer to 0:00"' +
    (timerSecs(t) || run ? "" : " disabled") + ">↺</button>" +
    (other ? '<span class="hint timer-other">Active on ' + esc(other) + "</span>" : "") +
    "</span>"
  );
}
async function resolveOtherTimer(act, startSecs) {
  const where = act.c.name + " · " + act.day.name + " (" + clockFace(timerSecs(act.timer)) + ")";
  const msg =
    "Timer is active on " + where + ".\n\nOnly one workout timer can be active at a time. " +
    "Move that time to this day, or start this day from " + clockFace(startSecs) + "?";
  const pick = await choose(msg, [
    ["", "Cancel", ""],
    ["fresh", "Start at " + clockFace(startSecs), ""],
    ["move", "Move time here", "primary"],
  ]);
  if (!pick) return null;
  return pick === "move" ? timerSecs(act.timer) : startSecs;
}
async function timerClick(c, el) {
  const dayId = cycUI.dayId;
  const t = timerOf(c, dayId);
  if (el.closest("#cyc-timer-reset")) {
    if (isTimerDay(c, dayId)) clearTimer();
    cycUI.dur = 0;
    render();
    return;
  }
  if (!el.closest("#cyc-timer-go")) return;
  if (isTimerDay(c, dayId)) {
    timer = t.since
      ? { cycleId: c.id, dayId, secs: timerSecs(t), since: null }
      : { cycleId: c.id, dayId, secs: t.secs, since: Date.now() };
    saveTimer();
    render();
    return;
  }
  const act = activeTimer();
  const secs = act ? await resolveOtherTimer(act, t.secs) : t.secs;
  if (secs === null) return;
  delete cycUI.dur;
  timer = { cycleId: c.id, dayId, secs, since: Date.now() };
  saveTimer();
  render();
}
function applyTypedDur(c, dayId, n) {
  if (isTimerDay(c, dayId)) {
    if (n > 0) {
      delete cycUI.dur;
      timer = { cycleId: c.id, dayId, secs: n, since: null };
      saveTimer();
    } else {
      clearTimer();
      cycUI.dur = 0;
    }
  } else {
    cycUI.dur = n;
  }
}
/* A typed time sets a paused clock; text that can't be read puts the old time back. */
function timerTyped(c, el) {
  const n = parseDur(el.value);
  if (!isNaN(n)) applyTypedDur(c, cycUI.dayId, n);
  render();
}
/* While the global timer is running, repaint every visible clock face once a second. */
function syncTimerTick() {
  const act = activeTimer();
  const run = !!act && !!act.timer.since;
  if (run && !timerTick) {
    timerTick = setInterval(() => {
      const a = activeTimer();
      if (!a || !a.timer.since) {
        syncTimerTick();
        return;
      }
      const face = clockFace(timerSecs(a.timer));
      document.querySelectorAll(".gtimer-clock").forEach((el) => {
        el.textContent = face;
      });
      const inp = $("#cyc-timer");
      if (inp && cycUI && cycUI.id === a.c.id && cycUI.dayId === a.day.id) inp.value = face;
    }, 1000);
  } else if (!run && timerTick) {
    clearInterval(timerTick);
    timerTick = null;
  }
}
