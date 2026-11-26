/* ============ ABOUT SHEET ============
   Opened from Settings → About (the app's row), as a read-only sheet: who the app is for, how its data
   is kept, what changed in each version, and a few details for support. Rewrite ABOUT for
   the domain; add a CHANGES entry (newest first) for every build you hand out — the top
   one is the version shown everywhere. ✕, Esc, the backdrop or a swipe down closes it (INFO SHEETS). */
const ABOUT = {
  summary: "Plan calisthenics workouts, log every set, and see your progress over time.",
  features: [
    "Plan: build workout plans as days of exercises with sets, reps or seconds and weight; " +
      "every edit keeps the earlier version.",
    "Log: run a plan as a cycle and log each session — type 16+2 and it adds up — with a " +
      "workout timer that keeps running while you train.",
    "Workout: your exercise library with levels, notes and video links, plus your best and " +
      "latest sets for each.",
    "Personal: BMI, BMR, daily calories and protein from your body data.",
    "Analytics: reps, weight and workout time over a date range, and a calendar of sessions.",
    "Archive exercises, plans and cycles you no longer use; their history stays.",
  ],
};
/* 0.x versions are the milestones before the first public release (1.0.0). */
const CHANGES = [
  {
    v: "1.0.0",
    date: "2026-11-26",
    what: "First public release: a fresh install starts empty, ready for your own exercises.",
  },
  {
    v: "0.8.0",
    date: "2026-11-22",
    what:
      "Runs as a Delta Chat mini app: data stays on the device, with backup, restore and " +
      "erase in Settings, and this About page. Analytics by date range, a Logged summary " +
      "on each exercise, day tabs in the plan editor.",
  },
  {
    v: "0.7.0",
    date: "2026-11-21",
    what: "Settings page with editable exercise levels, and the new indigo look.",
  },
  {
    v: "0.6.0",
    date: "2026-11-17",
    what: "One workout timer for the whole app, recorded on each session.",
  },
  {
    v: "0.5.0",
    date: "2026-11-07",
    what:
      "Archive, cycles marked Done, the same exercise twice in one day, average reps and " +
      "weight in Analytics.",
  },
  {
    v: "0.4.0",
    date: "2026-10-31",
    what: "Personal tab with body data and BMI, BMR and calorie calculators.",
  },
  {
    v: "0.3.0",
    date: "2026-10-09",
    what: "Exercises counted by time, duplicate plans, and a View picker for lists.",
  },
  {
    v: "0.2.0",
    date: "2026-09-24",
    what: "Workout exercise library, keyboard shortcuts, and light / dark themes.",
  },
  {
    v: "0.1.0",
    date: "2026-09-22",
    what: "First version: plans, cycles and set logging.",
  },
];
const APP_VERSION = CHANGES[0].v;
function runsIn() {
  return window.webxdc ? "Delta Chat (mini app)" : "Web browser";
}
function aboutHeroHtml() {
  return (
    '<div class="card about-hero"><img class="about-app" src="icon.png" alt="">' +
    '<h2 class="about-name">Workout Tracker</h2>' +
    '<p class="about-ver">Version ' +
    esc(APP_VERSION) +
    " · updated " +
    esc(CHANGES[0].date) +
    "</p>" +
    '<p class="about-sum">' +
    esc(ABOUT.summary) +
    "</p></div>"
  );
}
function aboutFeaturesHtml() {
  return (
    '<div class="card"><div class="stat-t">What it does</div><ul class="about-list">' +
    ABOUT.features.map((f) => "<li>" + esc(f) + "</li>").join("") +
    "</ul></div>"
  );
}
function aboutDataHtml() {
  return (
    '<div class="stat-t set-group">Your data</div><div class="card set-list">' +
    setRow({
      icon: "saved",
      title: "Stays on this device",
      sub: "Nothing is uploaded. Erasing the app or this device's storage deletes it.",
    }) +
    setRow({
      icon: "offline",
      title: "Works offline",
      sub: "The app never connects to the internet; it only opens links you tap.",
    }) +
    setRow({
      icon: "backup",
      title: "Back up to keep a copy",
      sub: "Settings → Make a backup saves everything in one file you can restore later.",
    }) +
    "</div>"
  );
}
function aboutChangesHtml() {
  return (
    '<div class="card"><div class="stat-t">What\'s new</div><ul class="about-changes">' +
    CHANGES.map(
      (c) =>
        '<li><span class="pill tag-purple">' +
        esc(c.v) +
        '</span><span class="about-date">' +
        esc(c.date) +
        '</span><p class="about-what">' +
        esc(c.what) +
        "</p></li>",
    ).join("") +
    "</ul></div>"
  );
}
function aboutDetailsHtml() {
  let size = "unavailable";
  try {
    size = fmtSize(storageUse().app);
  } catch (e) {
    console.warn("Storage size unavailable:", e);
  }
  return (
    '<div class="card"><div class="stat-t">Details</div><div class="props about-props">' +
    prop("Version", esc(APP_VERSION), "#") +
    prop("Updated", esc(CHANGES[0].date), "◷") +
    prop("Runs in", esc(runsIn()), "▢") +
    prop("Saved data", esc(size) + " · " + plural(sessionCount(state), "session"), "≡") +
    prop("Storage key", "<code>" + esc(LS) + "</code>", "⚿") +
    "</div></div>"
  );
}
function aboutHtml() {
  return (
    aboutHeroHtml() + aboutFeaturesHtml() + aboutDataHtml() + aboutChangesHtml() + aboutDetailsHtml()
  );
}
