/* ============ THEME ============
   "os" follows prefers-color-scheme (no data-theme attribute); "light"/"dark" force one.
   A per-browser display preference, so it lives in its own localStorage key, not in state
   (and never reaches a backup). index.html applies it before first paint. */
const THEME_KEY = "workout-tracker-theme";
function applyTheme(mode) {
  if (mode === "light" || mode === "dark") document.documentElement.dataset.theme = mode;
  else delete document.documentElement.dataset.theme;
}
const themeItems = () => [...document.querySelectorAll("#theme-menu [data-theme-choice]")];
function themeMenuOpen() {
  return !$("#theme-menu").hidden;
}
/* The button shows the chosen mode's icon; the menu ticks it. */
function showThemeChoice() {
  const cur = document.documentElement.dataset.theme || "os";
  themeItems().forEach((it) => {
    const on = it.dataset.themeChoice === cur;
    it.setAttribute("aria-checked", String(on));
    if (on) {
      $("#theme-btn").innerHTML = it.querySelector(".ico").outerHTML;
      $("#theme-btn").title = "Theme: " + it.textContent.trim();
    }
  });
}
function toggleThemeMenu(open) {
  $("#theme-menu").hidden = !open;
  $("#theme-btn").setAttribute("aria-expanded", String(open));
  if (open) (themeItems().find((it) => it.getAttribute("aria-checked") === "true") || themeItems()[0]).focus();
}
function chooseTheme(mode) {
  applyTheme(mode);
  try {
    if (mode === "os") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, mode);
  } catch (e) {
    console.warn("Theme not saved (storage unavailable):", e);
  }
  showThemeChoice();
  toggleThemeMenu(false);
  $("#theme-btn").focus();
}
/* An open menu owns the keyboard: Esc closes it, ↑↓ move between choices. */
function onThemeMenuKey(e) {
  const items = themeItems();
  if (e.key === "Escape") {
    toggleThemeMenu(false);
    $("#theme-btn").focus();
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
  } else return;
  e.preventDefault();
}
function bindTheme() {
  showThemeChoice();
  $("#theme-btn").addEventListener("click", () => toggleThemeMenu(!themeMenuOpen()));
  themeItems().forEach((it) =>
    it.addEventListener("click", () => chooseTheme(it.dataset.themeChoice)),
  );
  document.addEventListener("click", (e) => {
    if (themeMenuOpen() && !e.target.closest(".menu-wrap")) toggleThemeMenu(false);
  });
}
