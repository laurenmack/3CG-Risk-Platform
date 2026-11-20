/* ==========================================================
   heatmap.test.js: checks for the Risk Heat Map
   Owner: Yihao Ma

   Runs the site in your installed Google Chrome (headless) through
   playwright-core. Start a local server in the project folder first:
     python -m http.server 8765
   then, in this tests folder:
     npm install
     npm test
   Options (environment variables):
     BASE_URL     site address        (default http://127.0.0.1:8765/)
     CHROME_PATH  path to chrome.exe  (default: the installed Chrome)
   Screenshots go to tests/screenshots/ (not committed).

   Section 1 reads the real team Google Sheet and checks that the page
   matches whatever it holds. Every other section replaces the sheet's
   reply inside the test browser (usually with the reviewed ratings in
   data/risks.csv), so the shared sheet is never edited. If the reviewed
   ratings change, update the expected values in section 2.
   ========================================================== */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:8765/";
const SHOTS = path.join(__dirname, "screenshots");
const RISKS_CSV = path.join(__dirname, "..", "data", "risks.csv");
// The team's published Google Sheet (Vendor Scorecard + Risks tabs). The Risks tab is gid 593225350.
const TEAM_SHEET_PREFIX = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpH9x6fNy3NsFgFoBIHC0NdyyRmUAK89S0yvS0wL42hI7h2H5i-r-6gBDxIN2sNA/";
const TEAM_RISKS_GID = "593225350";
const TEAM_RISKS_URL = `${TEAM_SHEET_PREFIX}pub?gid=${TEAM_RISKS_GID}&single=true&output=csv`;
const isTeamRisks = u => String(u).startsWith(TEAM_SHEET_PREFIX) && new URL(u).searchParams.get("gid") === TEAM_RISKS_GID;
// Backup date shown on the page, read from js/heatmap.js so the test follows it
const BACKUP_DATE = (fs.readFileSync(path.join(__dirname, "..", "js", "heatmap.js"), "utf8")
  .match(/BACKUP_DATE = "([^"]+)"/) || [])[1];
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0, passes = 0;
function check(name, cond, extra = "") {
  if (cond) { passes++; console.log(`  PASS  ${name}`); }
  else { failures++; console.log(`  FAIL  ${name} ${extra}`); }
}

// CSV helpers: read data/risks.csv and build modified copies to serve as the sheet's reply
function parse(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ""));
}
const toObjects = text => { const [h, ...b] = parse(text); return b.map(r => Object.fromEntries(h.map((k, i) => [k.trim(), (r[i] ?? "").trim()]))); };
const toCSV = rows => rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(",")).join("\r\n");
const FIXTURE = fs.readFileSync(RISKS_CSV, "utf8");
function modified(edits) {
  const rows = parse(FIXTURE);
  const h = rows[0];
  rows.slice(1).forEach(r => { const e = edits[r[0]]; if (e) Object.entries(e).forEach(([k, v]) => { r[h.indexOf(k)] = v; }); });
  return toCSV(rows);
}
// Answer the team sheet's Risks request with the given CSV text (inside the test browser only)
const serveSheet = (page, body) => page.route(u => isTeamRisks(u.href),
  r => r.fulfill({ status: 200, contentType: "text/csv; charset=utf-8", body: typeof body === "function" ? body() : body }));

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  return { ctx, page, errors };
}

// Navigate the way a visitor would: Overview -> header nav "Risk Heat Map"
async function openHeatmapViaNav(page) {
  await page.goto(BASE + "index.html");
  await page.click('.site-nav a[href="heatmap.html"]');
  await page.waitForSelector(".hm-status", { timeout: 20000 });
}

async function gridState(page) {
  return page.$$eval(".hm-grid .hm-cell", cells => cells.map(c => ({
    l: +c.dataset.likelihood, i: +c.dataset.impact,
    score: c.querySelector(".hm-cell-score").textContent.trim(),
    band: [...c.classList].find(x => x.startsWith("band-")),
    ids: [...c.querySelectorAll(".hm-chip")].map(b => b.dataset.id)
  })));
}
const awaitingIds = page => page.$$eval(".hm-awaiting-list li", lis => lis.map(li => li.dataset.id));
const cellAt = (grid, l, i) => grid.find(c => c.l === l && c.i === i);
const cellOf = (grid, id) => grid.find(c => c.ids.includes(id));
const detailField = (page, f) => page.$eval(`#hm-detail [data-field="${f}"]`, e => e.textContent.trim());
const ALL = Array.from({ length: 13 }, (_, k) => "R" + (k + 1));

// Every plotted chip must sit in the cell that matches its own values
async function chipsMatchCells(page, grid) {
  for (const c of grid) for (const id of c.ids) {
    await page.click(`.hm-grid .hm-chip[data-id="${id}"]`);
    const adj = +(await detailField(page, "adjusted_likelihood")), imp = +(await detailField(page, "impact")), sc = +(await detailField(page, "risk_score"));
    if (adj !== c.l || imp !== c.i || sc !== adj * imp) { console.log("     mismatch", id, adj, imp, sc, c.l, c.i); return false; }
  }
  return true;
}

(async () => {
  /* ---------- 0. The reviewed backup file is internally consistent ---------- */
  console.log("\n[0] data/risks.csv (backup and test data): calculated columns are consistent");
  {
    const rows = toObjects(FIXTURE);
    const ids = rows.map(r => r.risk_id);
    check("13 rows, R1–R13 each exactly once", rows.length === 13 && ALL.every(id => ids.filter(x => x === id).length === 1), JSON.stringify(ids));
    const bad = [];
    for (const r of rows) {
      const [lik, imp, adj, score] = ["likelihood", "impact", "adjusted_likelihood", "risk_score"].map(k => r[k] === "" ? null : Number(r[k]));
      if ([lik, imp, adj, score].includes(null)) continue;
      const expAdj = lik + (r.vendor_tier === "High" ? 1 : 0);
      if (adj !== expAdj) bad.push(`${r.risk_id}: adjusted_likelihood ${adj}, expected ${expAdj}`);
      if (score !== adj * imp) bad.push(`${r.risk_id}: risk_score ${score}, expected ${adj * imp}`);
    }
    check("adjusted_likelihood = likelihood (+1 if High tier) and risk_score = adjusted × impact", bad.length === 0, JSON.stringify(bad));
  }

  const browser = await chromium.launch(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH, headless: true }
    : { channel: "chrome", headless: true });
  // Fail fast with a clear message if the local server isn't running
  try { await fetch(BASE + "index.html"); }
  catch { console.error(`Can't reach ${BASE}. Start the site first: python -m http.server 8765`); await browser.close(); process.exit(2); }

  /* ---------- 1. Real team sheet ---------- */
  console.log("\n[1] Heat map fetches the team's Google Sheet (real request, no interception)");
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    const sheetRequests = [], riskResponses = [];
    const firstUrl = req => { let f = req; while (f.redirectedFrom()) f = f.redirectedFrom(); return f.url(); };
    page.on("request", req => {
      if (/docs\.google\.com\/spreadsheets|googleusercontent\.com/.test(req.url())) sheetRequests.push(firstUrl(req));
    });
    page.on("response", res => {
      if (isTeamRisks(firstUrl(res.request()))) riskResponses.push(`${res.status()} ${res.headers()["content-type"] || ""}`);
    });
    await openHeatmapViaNav(page);
    await page.waitForLoadState("networkidle");
    check("URL is heatmap.html after nav click", page.url().endsWith("/heatmap.html"));
    check("browser requested the team sheet's Risks tab (gid 593225350)", sheetRequests.some(isTeamRisks), JSON.stringify(sheetRequests));
    check("team Risks CSV arrived (200 text/csv, after Google's redirect)", riskResponses.some(s => s.startsWith("200 text/csv")), JSON.stringify(riskResponses));
    const other = sheetRequests.filter(u => !u.startsWith(TEAM_SHEET_PREFIX));
    check("no request to any other Google Sheet", other.length === 0, JSON.stringify(other));
    check("banner says Live data", await page.$eval(".hm-status", e => e.dataset.source) === "live");
    check("footer says Live from Google Sheet", (await page.textContent("#data-source")).trim() === "Live from Google Sheet");

    // Compare the page with what the sheet holds right now
    const live = toObjects(await (await fetch(TEAM_RISKS_URL)).text()).filter(r => r.risk_id);
    const isScored = r => ["likelihood", "impact", "adjusted_likelihood", "risk_score"].every(k => /^\d+$/.test(r[k]));
    const grid = await gridState(page);
    const onMap = grid.flatMap(c => c.ids), waiting = await awaitingIds(page);
    const shown = [...onMap, ...waiting];
    check("every sheet risk appears exactly once (map or Awaiting scores)",
      live.length > 0 && live.every(r => shown.filter(x => x === r.risk_id).length === 1) && shown.length === live.length, JSON.stringify(shown));
    check("scored rows are on the map; blank rows are under Awaiting scores",
      live.every(r => isScored(r) ? onMap.includes(r.risk_id) : waiting.includes(r.risk_id)));
    check("each plotted risk sits in the cell for its sheet values", await chipsMatchCells(page, grid));
    console.log(`     team sheet right now: ${onMap.length} plotted, ${waiting.length} awaiting scores`);
    await page.screenshot({ path: path.join(SHOTS, "1-team-sheet-live.png"), fullPage: true });
    check("no console/page errors", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 2. Reviewed ratings as the sheet's reply ---------- */
  console.log("\n[2] Team sheet replies with the reviewed ratings (data/risks.csv)");
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await serveSheet(page, FIXTURE);
    await openHeatmapViaNav(page);
    check("banner says Live data", await page.$eval(".hm-status", e => e.dataset.source) === "live");
    const grid = await gridState(page);
    const ids = grid.flatMap(c => c.ids);
    check("grid has 30 cells (6 likelihood rows x 5 impact cols)", grid.length === 30, grid.length);
    check("each of R1–R13 appears exactly once", ids.length === 13 && ALL.every(id => ids.filter(x => x === id).length === 1), JSON.stringify(ids));
    check("awaiting count is 0", (await page.textContent("#hm-awaiting-h .badge")).trim() === "0");
    const c45 = cellAt(grid, 4, 5);
    check("R1, R5, R13 share cell impact 5 / adjusted 4", JSON.stringify(c45.ids) === '["R1","R5","R13"]', JSON.stringify(c45.ids));
    for (const id of ["R1", "R5", "R13"]) {
      await page.click(`.hm-grid .hm-chip[data-id="${id}"]`);
      check(`${id} score is 20`, await detailField(page, "risk_score") === "20");
    }
    check("R11 is in cell impact 2 / adjusted 3", cellAt(grid, 3, 2).ids.includes("R11"));
    await page.click('.hm-grid .hm-chip[data-id="R11"]');
    check("R11 impact 2, adjusted 3, score 6", await detailField(page, "impact") === "2"
      && await detailField(page, "adjusted_likelihood") === "3" && await detailField(page, "risk_score") === "6");
    await page.click('.hm-grid .hm-chip[data-id="R4"]');
    const r4 = await page.textContent("#hm-detail");
    check("R4 base 3 and adjusted 3, no vendor adjustment", await detailField(page, "likelihood") === "3"
      && await detailField(page, "adjusted_likelihood") === "3" && r4.includes("no vendor adjustment") && /Vendor\s*None/.test(r4));
    await page.click('.hm-grid .hm-chip[data-id="R1"]');
    const d = await page.textContent("#hm-detail");
    check("R1 shows reviewed notes", d.includes("Ransomware has affected PRT, and Masabi reports redundancy"));
    check("R1 shows name, category, vendor", d.includes("Ransomware at the fare vendor (main scenario)") && d.includes("Availability") && d.includes("Masabi") && d.includes("High tier"));
    check("R1 chip is marked selected", await page.$eval('.hm-grid .hm-chip[data-id="R1"]', b => b.getAttribute("aria-pressed")) === "true");
    check("each plotted risk sits in the cell for its values", await chipsMatchCells(page, grid));
    await page.click('.hm-grid .hm-chip[data-id="R1"]');
    await page.screenshot({ path: path.join(SHOTS, "2-reviewed-ratings.png"), fullPage: true });
    check("no console/page errors", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 3. Sheet edit between two page loads ---------- */
  console.log("\n[3] Two different sheet replies across page loads (an edit, then refresh)");
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    // Before: reviewed ratings, but R2 not scored yet. After: R11 re-rated, R2 scored.
    const before = modified({ R2: { likelihood: "", impact: "", adjusted_likelihood: "", risk_score: "" } });
    const after = modified({ R11: { likelihood: "4", impact: "3", adjusted_likelihood: "5", risk_score: "15" } });
    let reply = before, hits = 0;
    await serveSheet(page, () => { hits++; return reply; });
    await openHeatmapViaNav(page);
    let grid = await gridState(page);
    check("load 1: R11 at impact 2 / adjusted 3", cellOf(grid, "R11") === cellAt(grid, 3, 2));
    check("load 1: R2 under Awaiting scores", (await awaitingIds(page)).includes("R2") && !cellOf(grid, "R2"));
    reply = after;                       // the "sheet" now holds the edited values
    await page.reload();
    await page.waitForSelector(".hm-status");
    grid = await gridState(page);
    check("load 2 fetched the sheet again (2 requests, no cache)", hits === 2, `hits=${hits}`);
    check("load 2: R11 moved to impact 3 / adjusted 5", cellOf(grid, "R11") === cellAt(grid, 5, 3), JSON.stringify(cellOf(grid, "R11")));
    check("load 2: R11 no longer in its old cell", !cellAt(grid, 3, 2).ids.includes("R11"));
    await page.click('.hm-grid .hm-chip[data-id="R11"]');
    check("load 2: R11 score 15, Critical band", await detailField(page, "risk_score") === "15" && cellOf(grid, "R11").band === "band-critical");
    check("load 2: R2 now plotted at impact 3 / adjusted 4", cellOf(grid, "R2") === cellAt(grid, 4, 3));
    check("load 2: nothing awaiting, 13 risks each once", (await awaitingIds(page)).length === 0
      && grid.flatMap(c => c.ids).length === 13);
    await page.screenshot({ path: path.join(SHOTS, "3-after-edit.png"), fullPage: true });
    check("no console/page errors", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 4. Mobile layout ---------- */
  for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    console.log(`\n[4] Mobile ${vp.width}x${vp.height}`);
    const { ctx, page, errors } = await newPage(browser, { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await serveSheet(page, FIXTURE);
    await openHeatmapViaNav(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("no horizontal page scroll", overflow <= 0, `overflow=${overflow}px`);
    const boxes = await page.$$eval(".hm-grid .hm-chip", bs => bs.map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.id, l: r.left, r: r.right, w: r.width, h: r.height }; }));
    check("13 chips rendered", boxes.length === 13);
    check("all chips inside viewport width", boxes.every(b => b.l >= 0 && b.r <= vp.width), JSON.stringify(boxes.filter(b => b.l < 0 || b.r > vp.width)));
    check("chips are at least 24x24 px tap targets", boxes.every(b => b.w >= 24 && b.h >= 24));
    const clipped = await page.$$eval(".hm-grid .hm-chip", bs => bs.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.dataset.id));
    check("chip labels are not clipped", clipped.length === 0, JSON.stringify(clipped));
    await page.screenshot({ path: path.join(SHOTS, `4-mobile-${vp.width}-map.png`), fullPage: true });
    await page.tap('.hm-grid .hm-chip[data-id="R13"]');
    await page.waitForTimeout(700);
    const inView = await page.$eval("#hm-detail", e => { const r = e.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; });
    check("detail panel scrolled into view after tap", inView);
    check("R13 detail shown after tap", (await page.textContent("#hm-detail")).includes("Card data stolen"));
    check("no console/page errors", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 5. Live sheet with blank or invalid scores ---------- */
  console.log("\n[5] Live sheet loads but some scores are blank or invalid");
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await serveSheet(page, modified({
      R2: { impact: "", risk_score: "" },                                   // impact cleared, formula leaves score blank
      R7: { likelihood: "", adjusted_likelihood: "", risk_score: "" },      // likelihood cleared
      R9: { impact: "7", risk_score: "28" }                                 // out-of-range value
    }));
    await openHeatmapViaNav(page);
    check("banner still says Live data", await page.$eval(".hm-status", e => e.dataset.source) === "live");
    const ids = (await gridState(page)).flatMap(c => c.ids);
    check("10 risks plotted; R2, R7, R9 not on the map", ids.length === 10 && !ids.includes("R2") && !ids.includes("R7") && !ids.includes("R9"), JSON.stringify(ids));
    const aw = await page.$$eval(".hm-awaiting-list li", lis => lis.map(li => ({ id: li.dataset.id, text: li.textContent.replace(/\s+/g, " ").trim() })));
    check("Awaiting scores lists R2, R7, R9", JSON.stringify(aw.map(a => a.id)) === '["R2","R7","R9"]', JSON.stringify(aw));
    check("R2: Missing impact, risk score", aw[0] && aw[0].text.includes("Missing: impact, risk score"));
    check("R7: Missing likelihood, adjusted likelihood, risk score", aw[1] && aw[1].text.includes("Missing: likelihood, adjusted likelihood, risk score"));
    check("R9: invalid impact explained", aw[2] && aw[2].text.includes('impact "7" is not a whole number from 1 to 5'));
    await page.click('.hm-awaiting-list .hm-chip[data-id="R2"]');
    check("R2 detail shows impact as Not scored, notes still shown", await detailField(page, "impact") === "Not scored"
      && (await page.textContent("#hm-detail")).includes("Vendor-managed access creates a lockout scenario"));
    await page.screenshot({ path: path.join(SHOTS, "5-awaiting-scores.png"), fullPage: true });
    check("no console/page errors", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 6. Sheet request fails -> backup ---------- */
  for (const mode of ["abort", "http503", "html200"]) {
    console.log(`\n[6] Team sheet request fails (${mode}) -> Backup data from data/risks.csv`);
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await page.route(u => isTeamRisks(u.href), r =>
      mode === "abort" ? r.abort("failed")
      : mode === "http503" ? r.fulfill({ status: 503, body: "unavailable" })
      : r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body>Sign in to continue</body></html>" }));
    await openHeatmapViaNav(page);
    check("banner says Backup data", await page.$eval(".hm-status", e => e.dataset.source) === "backup");
    const text = await page.textContent(".hm-status");
    check("banner names the backup date and file", !!BACKUP_DATE && text.includes(BACKUP_DATE) && text.includes("data/risks.csv"), text.trim());
    const grid = await gridState(page);
    const ids = grid.flatMap(c => c.ids);
    check("all 13 risks plotted once from the backup", ids.length === 13 && ALL.every(id => ids.filter(x => x === id).length === 1));
    check("R1, R5, R13 share impact 5 / adjusted 4", JSON.stringify(cellAt(grid, 4, 5).ids) === '["R1","R5","R13"]');
    if (mode === "abort") await page.screenshot({ path: path.join(SHOTS, "6-backup.png"), fullPage: true });
    const unexpected = errors.filter(e => !/docs\.google\.com|Failed to load resource|503/.test(e));
    check("no unexpected console/page errors", unexpected.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 7. Adjusted likelihood of 6 ---------- */
  console.log("\n[7] Base likelihood 5 at a High-tier vendor -> adjusted 6");
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await serveSheet(page, modified({ R12: { likelihood: "5", adjusted_likelihood: "6", risk_score: "30" } }));
    await openHeatmapViaNav(page);
    const grid = await gridState(page);
    check("R12 in top row (adjusted 6), impact 5, score 30, Critical",
      cellOf(grid, "R12") === cellAt(grid, 6, 5) && cellAt(grid, 6, 5).score === "30" && cellAt(grid, 6, 5).band === "band-critical");
    check("no console/page errors", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 8. Other tools still work ---------- */
  console.log("\n[8] Vendor Scorecard and FAIR Calculator via header nav");
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await openHeatmapViaNav(page);
    await page.click('.site-nav a[href="scorecard.html"]');
    await page.waitForSelector(".sc-vendor", { timeout: 20000 });
    check("Vendor Scorecard renders vendor cards", (await page.$$(".sc-vendor")).length >= 5);
    check("Vendor Scorecard footer: Live from Google Sheet", (await page.textContent("#data-source")).trim() === "Live from Google Sheet");
    await page.click('.site-nav a[href="fair.html"]');
    await page.waitForLoadState("networkidle");
    check("FAIR Calculator renders content", ((await page.textContent("#fair-app")) || "").trim().length > 50);
    check("FAIR footer: Live from Google Sheet", (await page.textContent("#data-source")).trim() === "Live from Google Sheet");
    check("no console/page errors on scorecard/FAIR", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 9. Dark mode look ---------- */
  console.log("\n[9] Dark mode screenshot");
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
    await serveSheet(page, FIXTURE);
    await openHeatmapViaNav(page);
    await page.click('.hm-grid .hm-chip[data-id="R1"]');
    await page.screenshot({ path: path.join(SHOTS, "9-desktop-dark.png"), fullPage: true });
    check("dark mode renders 13 chips", (await page.$$(".hm-grid .hm-chip")).length === 13);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
