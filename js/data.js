/* ==========================================================
   data.js: connects the site to the team Google Sheet
   Load this before any page script. Then, in your page's JS:

     const risks = await loadTable("risks");
     const [vendors, tiers] = await loadTables(["vendors", "tiers"]);

   Each table comes back as an array of row objects keyed by the
   sheet's column headers, e.g. { vendor_id: "masabi", ... }.
   ========================================================== */

/* STEP 1: Paste each published CSV link between the quotes.
   Google Sheet > File > Share > Publish to web > choose tab > CSV > Publish.
   Leave a link blank to use the sample file in /data instead. */
const SHEET_URLS = {
  vendors:      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpH9x6fNy3NsFgFoBIHC0NdyyRmUAK89S0yvS0wL42hI7h2H5i-r-6gBDxIN2sNA/pub?gid=819438981&single=true&output=csv",
  scoreReasons: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpH9x6fNy3NsFgFoBIHC0NdyyRmUAK89S0yvS0wL42hI7h2H5i-r-6gBDxIN2sNA/pub?gid=618020533&single=true&output=csv",
  weights:      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpH9x6fNy3NsFgFoBIHC0NdyyRmUAK89S0yvS0wL42hI7h2H5i-r-6gBDxIN2sNA/pub?gid=2023102265&single=true&output=csv",
  tiers:        "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpH9x6fNy3NsFgFoBIHC0NdyyRmUAK89S0yvS0wL42hI7h2H5i-r-6gBDxIN2sNA/pub?gid=171082539&single=true&output=csv",
  /* Risks: the Risks tab (gid 1182985444) of the PRT-risks Google Sheet, where the client edits
     likelihood, impact and notes. Read through its CSV export link (the sheet must stay shared
     as "Anyone with the link can view"). */
  risks:        "https://docs.google.com/spreadsheets/d/1HSnPp1hhtyK1v07ubjtsOO3oxysZZwbuBkto0xO_Zfc/export?format=csv&gid=1182985444",
  fair: "",
  fairParameters: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQLWy_SqgOI1SnY7aeM768A9VqO9M2hWPtE3QaO4Q0YDesqhjvamdbsRWEDSWWLXFBId1MMAW_YlD1/pub?gid=849211233&single=true&output=csv", 
  fairScenarios: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQLWy_SqgOI1SnY7aeM768A9VqO9M2hWPtE3QaO4Q0YDesqhjvamdbsRWEDSWWLXFBId1MMAW_YlD1/pub?gid=1793792482&single=true&output=csv", 
  fairControls: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQLWy_SqgOI1SnY7aeM768A9VqO9M2hWPtE3QaO4Q0YDesqhjvamdbsRWEDSWWLXFBId1MMAW_YlD1/pub?gid=1111731554&single=true&output=csv",
  fairSources: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQLWy_SqgOI1SnY7aeM768A9VqO9M2hWPtE3QaO4Q0YDesqhjvamdbsRWEDSWWLXFBId1MMAW_YlD1/pub?gid=829671258&single=true&output=csv" 
};

/* Sample copies used when a link above is blank or unreachable.
   Set to "" if there's no sample file yet. */
const LOCAL_FILES = {
  vendors:      "data/vendors.csv",
  scoreReasons: "data/score_reasons.csv",
  weights:      "data/weights.csv",
  tiers:        "data/tiers.csv",
  risks:        "data/risks.csv",
  fair:         "",
  fairParameters: "", 
  fairScenarios: "", 
  fairControls: "",
  fairSources: ""
};

const DATA_STATUS = { live: 0, sample: 0 };

/* Where each loaded table came from, e.g. DATA_SOURCE.risks === "live" or "sample". */
const DATA_SOURCE = {};

/* Load one tab by name. Tries the Google Sheet first, then the sample file. */
async function loadTable(name) {
  if (!(name in SHEET_URLS)) throw new Error(`No table called "${name}" in data.js`);
  const live = SHEET_URLS[name];
  if (live) {
    try {
      const rows = parseCSV(await fetchText(live));
      DATA_STATUS.live++; DATA_SOURCE[name] = "live"; updateDataBadge();
      return rows;
    } catch (err) {
      console.warn(`[3CG] Google Sheet for "${name}" failed; trying sample file.`, err);
    }
  }
  if (!LOCAL_FILES[name]) throw new Error(`"${name}" has no Google Sheet link and no sample file yet`);
  const rows = parseCSV(await fetchText(LOCAL_FILES[name]));
  DATA_STATUS.sample++; DATA_SOURCE[name] = "sample"; updateDataBadge();
  return rows;
}

/* Load several tabs at once. */
function loadTables(names) {
  return Promise.all(names.map(loadTable));
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.text();
}

/* CSV parser: handles quotes, commas and line breaks inside cells. */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const keys = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(c => c.trim() !== ""))
    .map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/* Sheet text to number: "20%" -> 0.2, "4.35" -> 4.35, "$1,200" -> 1200, "" -> null */
function toNumber(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().replace(/[$,]/g, "");
  if (s === "") return null;
  if (s.endsWith("%")) return parseFloat(s) / 100;
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

/* Escape sheet text before inserting it into HTML. Always use this. */
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Footer label showing where the data came from. */
function updateDataBadge() {
  const el = document.getElementById("data-source");
  if (!el || DATA_STATUS.live + DATA_STATUS.sample === 0) return;
  if (DATA_STATUS.sample === 0) { el.textContent = "Live from Google Sheet"; el.dataset.state = "live"; }
  else if (DATA_STATUS.live === 0) { el.textContent = "Sample data (Google Sheet not linked yet)"; el.dataset.state = "sample"; }
  else { el.textContent = "Partly live; some tabs using sample data"; el.dataset.state = "mixed"; }
}

/* Shows which tables loaded. Handy while building; remove when done. */
async function showDataCheck(container, names) {
  const results = await Promise.all(names.map(n =>
    loadTable(n).then(rows => ({ n, ok: true, rows: rows.length, cols: Object.keys(rows[0] || {}) }))
                .catch(err => ({ n, ok: false, err: err.message }))));
  container.innerHTML = `
    <h4>Data connection check</h4>
    <ul class="data-check">
      ${results.map(r => r.ok
        ? `<li><span class="ok">✓</span> ${esc(r.n)}: ${r.rows} rows · columns: ${esc(r.cols.join(", "))}</li>`
        : `<li><span class="fail">✗</span> ${esc(r.n)}: ${esc(r.err)}</li>`).join("")}
    </ul>
    ${results.some(r => !r.ok && /Failed to fetch|NetworkError/.test(r.err))
      ? `<p class="small muted">Opened by double-clicking? Use VS Code Live Server instead; browsers block data files opened straight from your computer.</p>` : ""}`;
  return results;
}
