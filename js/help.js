/* ============ HELP SHEET ============
   Opened from Settings → Help as a read-only sheet: a short guide in plain steps, then touch tips (phones and
   tablets only) and the keyboard shortcuts (hidden on phones, which have no keyboard — the
   .touch-only / .kbd-only rules in style.css). Rewrite HELP for the domain: a handful of
   steps a first-time user needs, not a manual. */
const HELP = {
  steps: [
    [
      "Add your exercises",
      "Workout tab → New: name, level, reps or time, notes and a video link.",
    ],
    [
      "Build a plan",
      "Plan tab → New: add days, put exercises in each with sets, reps or seconds and " +
        "weight, then Save. Set as default picks the plan new cycles use.",
    ],
    [
      "Start a cycle",
      "Log tab → New cycle copies the default plan, so later plan edits never change it.",
    ],
    [
      "Log a session",
      "Open the cycle, Edit, pick the day and type each set — 16+2 adds up. Start the " +
        "timer while you train, then Save. Mark the cycle Done when it is finished.",
    ],
    [
      "See your progress",
      "Analytics: pick a date range and an exercise; tap a calendar day for its sessions.",
    ],
  ],
  touch: [
    "Swipe the page sideways to switch tabs.",
    "Swipe down on an open card to close it.",
    "Long-press an exercise card in a session to drag it into a new order.",
    "Scroll down to hide the top bar; scroll up to bring it back.",
  ],
};
function helpStepsHtml() {
  return (
    '<div class="card"><div class="stat-t">Quick guide</div><ol class="help-steps">' +
    HELP.steps
      .map(([title, text]) => "<li><b>" + esc(title) + "</b><span>" + esc(text) + "</span></li>")
      .join("") +
    "</ol></div>"
  );
}
function helpTouchHtml() {
  return (
    '<div class="card touch-only"><div class="stat-t">On a phone or tablet</div>' +
    '<ul class="about-list">' +
    HELP.touch.map((t) => "<li>" + esc(t) + "</li>").join("") +
    "</ul></div>"
  );
}
function guideHtml() {
  return (
    helpStepsHtml() +
    helpTouchHtml() +
    '<div class="card kbd-only"><div class="stat-t">Keyboard shortcuts</div>' +
    shortcutsHtml() +
    "</div>"
  );
}

/* ============ INFO SHEETS (About, Help) ============
   Read-only dialogs over Settings: a bottom sheet on phones that a swipe down closes (VIEW
   SWIPE), a centred page peek on wider screens. No editing, so nothing to save. */
function infoModalHtml() {
  const about = infoUI === "about";
  return modalWrap({
    crumb: "Settings / " + (about ? "About" : "Help"),
    title: about ? "About" : "Help",
    body: about ? aboutHtml() : guideHtml(),
    size: "sm",
  });
}
function openInfo(name) {
  if (modalOpen()) return;
  infoUI = name;
  renderModal();
}
