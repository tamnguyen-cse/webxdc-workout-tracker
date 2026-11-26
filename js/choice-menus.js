/* ============ CHOICE MENUS ============
   Notion's select menu: a button showing the current choice opens a ticked list of every
   choice. choicePicker(key, value, choices) returns the HTML; choices is [{ value, html }],
   where html is what both the button and the menu row show (a pill, a swatch + name).
   Choosing repaints the button in place (focus stays put) and fires a bubbling
   "choicechange" event whose detail is { key, value } — value is always a string — so the
   owning editor updates its draft without a re-render. colourPicker is the colour flavour:
   ten Prism colours, each a swatch + name, mapped to .tag-<name> in css/pills.css. */
const COLOURS = ["gray", "brown", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "red"];
const colourOf = (c) => (COLOURS.includes(c) ? c : "gray");
const CHECK_SVG =
  '<svg class="chk" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>';
function choicePicker(key, value, choices) {
  const cur = choices.find((c) => c.value === String(value)) || choices[0];
  return (
    '<div class="choice-pick" data-choice-key="' + esc(key) + '">' +
    '<button type="button" class="choice-btn" aria-haspopup="menu" aria-expanded="false">' +
    cur.html + "</button>" +
    '<div class="menu choice-menu" role="menu" hidden>' +
    choices.map(
      (c) =>
        '<button type="button" role="menuitemradio" data-choice="' + esc(c.value) +
        '" aria-checked="' + (c === cur) + '">' + c.html + CHECK_SVG + "</button>",
    ).join("") +
    "</div></div>"
  );
}
function colourPicker(key, colour) {
  const choices = COLOURS.map((c) => ({
    value: c,
    html: '<span class="swatch tag-' + c + '"></span>' + c[0].toUpperCase() + c.slice(1),
  }));
  return choicePicker(key, colourOf(colour), choices);
}
const openChoicePick = () => {
  const menu = document.querySelector(".choice-menu:not([hidden])");
  return menu && menu.closest(".choice-pick");
};
function toggleChoiceMenu(pick, open) {
  const menu = pick.querySelector(".choice-menu");
  menu.hidden = !open;
  pick.querySelector(".choice-btn").setAttribute("aria-expanded", String(open));
  if (!open) return;
  menu.classList.remove("flip");
  if (menu.getBoundingClientRect().right > document.documentElement.clientWidth - 8) menu.classList.add("flip");
  pick.querySelector('[aria-checked="true"]').focus();
}
function chooseChoice(pick, item) {
  pick.querySelectorAll("[data-choice]").forEach((b) => b.setAttribute("aria-checked", String(b === item)));
  const btn = pick.querySelector(".choice-btn");
  btn.innerHTML = item.innerHTML;
  btn.querySelector(".chk").remove();
  toggleChoiceMenu(pick, false);
  btn.focus();
  pick.dispatchEvent(
    new CustomEvent("choicechange", {
      bubbles: true,
      detail: { key: pick.dataset.choiceKey, value: item.dataset.choice },
    }),
  );
}
/* Like the theme menu, an open choice menu owns the keyboard: Esc closes only the menu. */
function onChoiceMenuKey(e) {
  const pick = openChoicePick();
  const items = [...pick.querySelectorAll("[data-choice]")];
  if (e.key === "Escape") {
    toggleChoiceMenu(pick, false);
    pick.querySelector(".choice-btn").focus();
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
  } else return;
  e.preventDefault();
}
function bindChoicePicks() {
  document.addEventListener("click", (e) => {
    const pick = e.target.closest(".choice-pick");
    const open = openChoicePick();
    if (open && open !== pick) toggleChoiceMenu(open, false);
    if (!pick) return;
    const item = e.target.closest("[data-choice]");
    if (item) chooseChoice(pick, item);
    else if (e.target.closest(".choice-btn")) toggleChoiceMenu(pick, open !== pick);
  });
}
