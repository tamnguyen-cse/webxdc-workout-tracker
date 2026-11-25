/* ============ PERSONAL TAB — body data and calculators ============
   The tab reads state.personal; Edit opens a dialog with a draft and a Save, like every
   other editor. Each calculator shows as soon as the fields it needs are filled in.
   BMR is Mifflin–St Jeor (1990); TDEE = BMR × the activity factor for the weekly
   workout count; BMI bands are the WHO adult ones (not for under-18s). */
const PD_FIELDS = [
  // [key, label, icon, min, max, step, unit]
  ["height", "Height", "📏", 100, 250, 1, "cm"],
  ["weight", "Weight", "⚖", 25, 350, 0.1, "kg"],
  ["age", "Age", "🎂", 15, 100, 1, "years"],
  ["freq", "Workouts/week", "🏋", 0, 14, 1, "per week"],
];
// [most workouts per week, factor, label] — first row whose limit covers the count
const ACTIVITY = [
  [0, 1.2, "sedentary"],
  [3, 1.375, "lightly active"],
  [5, 1.55, "moderately active"],
  [7, 1.725, "very active"],
  [Infinity, 1.9, "extra active"],
];
let pdUI = null; // { draft: { height, weight, gender, age, freq } } — the Personal editor
/* A field's number, or null when blank or outside its plausible range. */
function pdNum(p, key) {
  const f = PD_FIELDS.find((x) => x[0] === key);
  const raw = p[key];
  if (raw === "" || raw === undefined || raw === null) return null;
  const v = +raw;
  return Number.isFinite(v) && v >= f[3] && v <= f[4] ? v : null;
}
function activityOf(freq) {
  return ACTIVITY.find((a) => freq <= a[0]);
}
function bmiCategory(v) {
  if (v < 18.5) return ["Underweight", "tag-blue"];
  if (v < 25) return ["Normal", "tag-green"];
  if (v < 30) return ["Overweight", "tag-orange"];
  return ["Obese", "tag-red"];
}
/* Every calculator the filled-in fields allow; a missing input leaves its result null. */
function personalResults(p) {
  const h = pdNum(p, "height");
  const w = pdNum(p, "weight");
  const a = pdNum(p, "age");
  const f = pdNum(p, "freq");
  const r = { bmi: null, range: null, bmr: null, tdee: null, act: null, protein: null };
  if (h && w) r.bmi = w / Math.pow(h / 100, 2);
  if (h) r.range = [18.5, 24.9].map((b) => Math.round(b * Math.pow(h / 100, 2) * 10) / 10);
  if (w) r.protein = [Math.round(w * 1.6), Math.round(w * 2.2)];
  if (h && w && a) r.bmr = Math.round(10 * w + 6.25 * h - 5 * a + (p.gender === "f" ? -161 : 5));
  if (f !== null) r.act = activityOf(f);
  if (r.bmr && r.act) r.tdee = Math.round(r.bmr * r.act[1]);
  return r;
}
/* Sessions logged per week over the last 28 days — a check on "workouts per week". */
function loggedPerWeek() {
  const from = new Date();
  from.setDate(from.getDate() - 27);
  const start = from.toISOString().slice(0, 10);
  let n = 0;
  state.cycles.forEach((c) => c.sessions.forEach((s) => (n += s.date >= start ? 1 : 0)));
  return Math.round((n / 4) * 10) / 10;
}
function calcRow(label, icon, value, desc) {
  return prop(label, value, icon) + '<div class="calc-desc">' + desc + "</div>";
}
function renderPersonal() {
  setTools('<button class="btn primary" id="pd-edit" title="Edit (E)">✎ Edit</button>');
  const p = state.personal;
  const r = personalResults(p);
  const need = (what) => '<span class="hint">Needs ' + what + "</span>";
  let h =
    '<div class="card"><div class="props">' +
    PD_FIELDS.map((f) => {
      const v = pdNum(p, f[0]);
      return prop(f[1], v === null ? "" : esc(v + " " + f[6]), f[2]);
    }).join("") +
    prop("Gender", p.gender === "f" ? "Female" : "Male", "⚥") +
    "</div>" +
    '<div class="hint">Logged in the last 4 weeks: ' +
    loggedPerWeek() +
    " sessions per week.</div></div>";
  const bmi = r.bmi
    ? "<b>" + r.bmi.toFixed(1) + '</b> <span class="pill ' + bmiCategory(r.bmi)[1] + '">' +
      bmiCategory(r.bmi)[0] + "</span>"
    : need("height and weight");
  h +=
    '<div class="card"><h2 class="view-h">Calculations</h2>' +
    calcRow("BMI", "⚖", bmi,
      "Body mass index = weight ÷ height² (m). Under 18.5 underweight, 18.5–24.9 normal, " +
      "25–29.9 overweight, 30+ obese. Adults only; muscle mass reads as overweight.") +
    calcRow("Healthy range", "↔", r.range ? r.range[0] + "–" + r.range[1] + " kg" : need("height"),
      "The weight range that gives a BMI of 18.5–24.9 at your height.") +
    calcRow("BMR", "🔥", r.bmr ? r.bmr + " kcal/day" : need("height, weight and age"),
      "Basal metabolic rate (Mifflin–St Jeor): energy burnt at complete rest.") +
    calcRow("TDEE", "⚡",
      r.tdee ? r.tdee + " kcal/day · " + r.act[2] + " (×" + r.act[1] + ")" : need("BMR inputs and workouts/week"),
      "Total daily energy expenditure = BMR × activity factor: 0 workouts/week ×1.2, 1–3 ×1.375, " +
      "4–5 ×1.55, 6–7 ×1.725, 8+ ×1.9. Eating this much keeps your weight steady.") +
    calcRow("Calories", "🎯",
      r.tdee ? "lose " + Math.max(r.bmr, r.tdee - 500) + " · keep " + r.tdee + " · gain " + (r.tdee + 300) + " kcal/day"
        : need("TDEE"),
      "TDEE − 500 kcal loses about 0.5 kg a week (never below BMR); TDEE + 300 kcal is a lean bulk.") +
    calcRow("Protein", "🥩", r.protein ? r.protein[0] + "–" + r.protein[1] + " g/day" : need("weight"),
      "1.6–2.2 g per kg of body weight a day supports muscle gain from training.") +
    "</div>";
  $("#sec-personal").innerHTML = h;
}
function openPersonal() {
  pdUI = { draft: Object.assign({ height: "", weight: "", gender: "m", age: "", freq: "" }, state.personal) };
  render();
}
function pdDirty() {
  const d = pdUI.draft;
  const p = state.personal;
  return ["height", "weight", "gender", "age", "freq"].some((k) => String(d[k] ?? "") !== String(p[k] ?? ""));
}
function pdModalHtml() {
  const d = pdUI.draft;
  const fields = PD_FIELDS.map((f) =>
    prop(
      f[1] + " (" + f[6] + ")",
      '<input id="pd-' + f[0] + '" type="number" inputmode="decimal" min="' + f[3] + '" max="' + f[4] +
        '" step="' + f[5] + '" value="' + esc(d[f[0]]) + '" placeholder="' + f[3] + "–" + f[4] + '">',
      f[2],
    ),
  ).join("");
  const gender =
    '<select id="pd-gender" aria-label="Gender">' +
    '<option value="m"' + (d.gender === "f" ? "" : " selected") + ">Male</option>" +
    '<option value="f"' + (d.gender === "f" ? " selected" : "") + ">Female</option></select>";
  const bad = PD_FIELDS.filter((f) => String(d[f[0]] ?? "").trim() !== "" && pdNum(d, f[0]) === null);
  return modalWrap({
    crumb: "Personal",
    title: "Body data",
    size: "sm",
    body:
      '<div class="props">' + fields + prop("Gender", gender, "⚥") + "</div>" +
      (bad.length
        ? '<div class="hint warn">Out of range: ' +
          bad.map((f) => esc(f[1]) + " " + f[3] + "–" + f[4] + " " + f[6]).join(", ") +
          ". Such a value is kept but left out of the calculations.</div>"
        : "") +
      '<div class="hint">Gender picks the BMR formula. Kept on this device and in backups ' +
      "(Settings → Make a backup).</div>",
    bar: '<button class="btn primary" id="pd-save">Save</button>',
  });
}
function pdInput(e) {
  const el = e.target;
  if (!el.id || !el.id.startsWith("pd-")) return;
  pdUI.draft[el.id.slice(3)] = el.value.trim();
}
function pdChange(e) {
  pdInput(e);
  renderModal(); // refresh the out-of-range warning; renderModal keeps the focused field
}
function pdClick(e) {
  if (!e.target.closest("#pd-save")) return;
  if (pdDirty()) {
    state.personal = Object.assign({}, pdUI.draft);
    saveState();
  }
  closeModal();
}
