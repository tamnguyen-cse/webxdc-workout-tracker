/* ============ PAGINATION — long lists show one page at a time ============
   From the sync-app-style template (2026-11-22.3). A page holds PAGE_ROWS lines of cards:
   List 10 records, Cards 20, Gallery 30, Auto columns × 10. Every list that can grow past
   one page renders through paginate(key, list), draws the grid with data-page-grid="<key>",
   appends `pager` under it, then calls fitPage(key, grid): it measures the grid's real
   column count (Auto, and Gallery capped at 2 on phones, depend on width) and returns true
   when the page size was wrong, so the caller draws once more. `ui.page[key]` holds the
   index of the page's first record, so column changes keep those records in view. Call
   resetPage(key) whenever search or the shelf changes, and set `ui.reveal = rec.id` before
   saveState() so a saved record stays visible. ← / → turn pages, and J/K or ↑↓ run across
   page edges (moveRow in js/shortcuts.js). */
const PAGE_ROWS = 10;
function pageSize(key) {
  return PAGE_ROWS * (ui.pageCols[key] || 1);
}
function gridCols(grid) {
  const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean) : [];
  return Math.max(1, cols.length);
}
function fitPage(key, grid) {
  const cols = gridCols(grid);
  if (cols === (ui.pageCols[key] || 1)) return false;
  ui.pageCols[key] = cols;
  return true;
}
function resetPage(key) {
  ui.page[key] = 0;
}
function paginate(key, list) {
  const size = pageSize(key);
  const pages = Math.max(1, Math.ceil(list.length / size));
  const at = ui.reveal ? list.findIndex((x) => x.id === ui.reveal) : -1;
  if (at >= 0) ui.page[key] = at;
  ui.reveal = ""; // spent even when the record left this list (archived, filtered out)
  // the page holding the remembered first record; a delete can empty the last page
  const page = Math.min(Math.floor(Math.max(0, ui.page[key] || 0) / size), pages - 1);
  const start = page * size;
  ui.page[key] = start;
  return {
    rows: list.slice(start, start + size),
    pager: pages > 1 ? pagerHtml(key, page, pages, list.length) : "",
  };
}
/* Page numbers to show: the first, the last and the current one ±1, with null for a "…" gap.
   A gap of a single page shows that page instead, since "…" would take the same room. */
function pageNumbers(page, pages) {
  const keep = [];
  for (let i = 0; i < pages; i++) if (i === 0 || i === pages - 1 || Math.abs(i - page) <= 1) keep.push(i);
  const out = [];
  keep.forEach((i, n) => {
    const prev = keep[n - 1];
    if (n && i - prev === 2) out.push(prev + 1);
    else if (n && i - prev > 2) out.push(null);
    out.push(i);
  });
  return out;
}
function pagerHtml(key, page, pages, total) {
  const btn = (to, label, cls, extra) =>
    '<button type="button" class="btn ' +
    cls +
    '" data-pager="' +
    key +
    '" data-page="' +
    to +
    '"' +
    extra +
    ">" +
    label +
    "</button>";
  const step = (dir, label, off) =>
    btn(page + dir, label, "pg-step", ' data-step="' + dir + '"' + (off ? " disabled" : ""));
  let h = '<nav class="pager" aria-label="Pages">' + step(-1, "‹ Prev", page === 0) + '<span class="pg-nums">';
  pageNumbers(page, pages).forEach((i) => {
    h +=
      i === null
        ? '<span class="pg-gap">…</span>'
        : btn(i, String(i + 1), "pg-num" + (i === page ? " on" : ""), i === page ? ' aria-current="page"' : "");
  });
  const from = page * pageSize(key) + 1;
  const to = Math.min(total, from + pageSize(key) - 1);
  return (
    h +
    "</span>" +
    step(1, "Next ›", page === pages - 1) +
    '<span class="pg-of">' +
    from +
    "–" +
    to +
    " of " +
    total +
    " · page " +
    (page + 1) +
    " of " +
    pages +
    "</span></nav>"
  );
}
/* Turning a page scrolls back to the top of the list; with `focus` ("first" / "last") the
   keyboard lands on that row of the new page. */
function turnPage(key, page, focus) {
  ui.page[key] = page * pageSize(key);
  render();
  window.scrollTo(0, 0);
  const rows = document.querySelectorAll(".sec.on .rowcard");
  const row = focus === "last" ? rows[rows.length - 1] : focus === "first" ? rows[0] : null;
  if (row) row.focus({ preventScroll: focus === "first" });
}
/* A resize that changes a paged grid's column count (Auto, phone rotation) redraws it. */
function bindPagers() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-pager]");
    if (b && !b.disabled) turnPage(b.dataset.pager, +b.dataset.page);
  });
  window.addEventListener("resize", () => {
    const grid = document.querySelector(".sec.on [data-page-grid]");
    if (grid && gridCols(grid) !== (ui.pageCols[grid.dataset.pageGrid] || 1)) render();
  });
}
/* ← / → press the current tab's Prev / Next — or, on a tab with a history calendar and no
   pager, its previous / next month. Returns false when the tab has neither. */
function pressStep(dir, focus) {
  const b = document.querySelector('.sec.on .pager [data-step="' + dir + '"]');
  if (b) {
    if (!b.disabled) turnPage(b.dataset.pager, +b.dataset.page, focus);
    return true;
  }
  const m = document.querySelector('.sec.on [data-cal-go="' + dir + '"]');
  if (m) m.click();
  return !!m;
}
