/* ============ FORMULA INPUT — a number field that also takes 8+2, 7*3, 2*(3+4) ============
   Opt-in per field: render it with calcInput() and read it with readCalc(). The record keeps
   the result in its usual numeric field, so totals, charts and backup readers never parse a
   formula; the text is kept only when it holds an operator, in `record.expr[field]`
   (keepExpr maintains it). Typing is limited to digits, + - * / ( ) . , and spaces;
   x, X and × become *, ÷ becomes /, so "7x3" works from the iPhone letter keyboard. */
const CALC_BAD = /[^0-9+\-*/().,\s]/g;
/* A `calc-clock` field counts seconds and also takes m:ss or h:mm:ss (1:30 = 90). */
const CALC_BAD_CLOCK = /[^0-9+\-*/().,:\s]/g;
function calcClean(text, clock) {
  const t = String(text).replace(/[xX×]/g, "*").replace(/÷/g, "/");
  return t.replace(clock ? CALC_BAD_CLOCK : CALC_BAD, "");
}
function clockCalc(text) {
  return calc(
    String(text ?? "").replace(/(\d+):(\d{1,2})(?::(\d{1,2}))?/g, (m, a, b, c) =>
      c === undefined ? "(" + a + "*60+" + b + ")" : "(" + a + "*3600+" + b + "*60+" + c + ")",
    ),
  );
}
function isClock(el) {
  return el.classList.contains("calc-clock");
}
/* Seconds the way a clock field shows them: 45 → "45", 90 → "1:30". */
function clockText(n) {
  return n < 60 ? String(n) : fmtSecs(n);
}
/* Evaluates + - * / with unary minus and parentheses; "," is a decimal point.
   Returns NaN for anything malformed or non-finite (8+, (), 1/0). Never uses eval. */
function calc(text) {
  const src = String(text ?? "").replace(/\s+/g, "").replace(/,/g, ".");
  let i = 0;
  const peek = () => src[i];
  function atom() {
    if (peek() === "-") {
      i++;
      return -atom();
    }
    if (peek() === "+") {
      i++;
      return atom();
    }
    if (peek() === "(") {
      i++;
      const v = sum();
      if (peek() !== ")") return NaN;
      i++;
      return v;
    }
    const m = /^\d+\.?\d*|^\.\d+/.exec(src.slice(i));
    if (!m) return NaN;
    i += m[0].length;
    return Number(m[0]);
  }
  function product() {
    let v = atom();
    while (peek() === "*" || peek() === "/") {
      const op = src[i++];
      if (peek() === "*" || peek() === "/") return NaN; // 2**3, 4//2
      const r = atom();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function sum() {
    let v = product();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = product();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  if (!src) return NaN;
  const v = sum();
  if (i !== src.length || !isFinite(v)) return NaN;
  return Math.round(v * 1e6) / 1e6; // 0.1+0.2 → 0.3
}
function hasOp(text) {
  return /[+\-*/]/.test(String(text).trim().replace(/^-/, ""));
}
/* A formula field. `value` is the stored number, `expr` the stored formula (if any);
   `cls` adds classes after "calc"; `attrs` is extra raw attributes such as data-* keys. */
function calcInput({
  id = "", cls = "", mode = "text", value = "", expr = "", label = "", placeholder = "", attrs = "",
}) {
  const shown = expr || (value === 0 || value ? value : "");
  return (
    '<input type="text" inputmode="' + mode + '" class="calc' + (cls ? " " + cls : "") + '"' +
    ' autocomplete="off" autocorrect="off"' +
    ' spellcheck="false" enterkeyhint="done"' +
    (id ? ' id="' + esc(id) + '"' : "") +
    (label ? ' aria-label="' + esc(label) + '"' : "") +
    (placeholder ? ' placeholder="' + esc(placeholder) + '"' : "") +
    (expr ? ' title="= ' + esc(calc(expr)) + '"' : "") +
    ' value="' + esc(shown) + '"' + (attrs ? " " + attrs : "") + ">"
  );
}
/* { n, expr }: n is the result (NaN when empty or malformed), expr the formula text or "". */
function readCalc(el) {
  const text = el.value.trim();
  const n = isClock(el) ? clockCalc(text) : calc(text);
  return { n, expr: text && hasOp(text) && !isNaN(n) ? text : "" };
}
/* Keep record.expr in step with a field: a formula is stored, anything else removes it. */
function keepExpr(rec, key, expr) {
  if (expr) rec.expr = Object.assign({}, rec.expr, { [key]: expr });
  else if (rec.expr) {
    delete rec.expr[key];
    if (!Object.keys(rec.expr).length) delete rec.expr;
  }
}
/* Runs before the app's own input handlers (capture), so they always see clean text. */
function bindCalc() {
  document.addEventListener(
    "input",
    (e) => {
      const el = e.target;
      if (!el.classList || !el.classList.contains("calc")) return;
      const clock = isClock(el);
      const clean = calcClean(el.value, clock);
      if (clean !== el.value) {
        const pos = (el.selectionStart || 0) - (el.value.length - clean.length);
        el.value = clean;
        el.setSelectionRange(Math.max(0, pos), Math.max(0, pos));
      }
      const t = clean.trim();
      const v = clock ? clockCalc(t) : calc(t);
      const bad = t !== "" && isNaN(v);
      if (bad) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
      el.title = !bad && hasOp(t) ? "= " + (clock ? fmtSecs(v) : v) : "";
    },
    true,
  );
}

const SEED =
  window.WT_SEED && Array.isArray(window.WT_SEED.templates)
    ? window.WT_SEED
    : { templates: [], cycles: [] };
