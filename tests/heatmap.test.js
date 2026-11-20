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

   Section 0 checks data/risks.csv itself: adjusted_likelihood and
   risk_score must follow the rules in the README.
   Section 1 loads the real data/risks.csv and checks the reviewed
   values (R1/R5/R13, R11, R4). If those ratings change, update the
   expected values here. Sections 3-5 replace the file's contents
   inside the test browser only; the file on disk is never changed.
   ========================================================== */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:8765/";
const SHOTS = path.join(__dirname, "screenshots");
const RISKS_CSV = path.join(__dirname, "..", "data", "risks.csv");
const RISKS_ROUTE = "**/data/risks.csv";
// The only Google Sheet the heat map page may contact: the team's published
// Vendor Scorecard sheet (Vendors tab, used for vendor display names).
const TEAM_SHEET_PREFIX = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpH9x6fNy3NsFgFoBIHC0NdyyRmUAK89S0yvS0wL42hI7h2H5i-r-6gBDxIN2sNA/";
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0, passes = 0;
function check(name, cond, extra = "") {
  if (cond) { passes++; console.log(`  PASS  ${name}`); }
  else { failures++; console.log(`  FAIL  ${name} ${extra}`); }
}

// CSV helpers: read data/risks.csv and build modified copies for the browser
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
const toCSV = rows => rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(",")).join("\r\n");
function modified(edits) {
  const rows = parse(fs.readFileSync(RISKS_CSV, "utf8"));
  const h = rows[0];
  rows.slice(1).forEach(r => { const e = edits[r[0]]; if (e) Object.entries(e).forEach(([k, v]) => { r[h.indexOf(k)] = v; }); });
  return toCSV(rows);
}
const serve = body => route => route.fulfill({ status: 200, contentType: "text/csv; charset=utf-8", body });

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  return { ctx, page, errors };
}

// Navigate the way a visitor would: Overview -> header nav "Risk Heat Map"
async function openHeatmapViaNav(page, waitFor = ".hm-status") {
  await page.goto(BASE + "index.html");
  await page.click('.site-nav a[href="heatmap.html"]');
  await page.waitForSelector(waitFor, { timeout: 20000 });
}

async function gridState(page) {
  return page.$$eval(".hm-grid .hm-cell", cells => cells.map(c => ({
    l: +c.dataset.likelihood, i: +c.dataset.impact,
    score: c.querySelector(".hm-cell-score").textContent.trim(),
    band: [...c.classList].find(x => x.startsWith("band-")),
    ids: [...c.querySelectorAll(".hm-chip")].map(b => b.dataset.id)
  })));
}
const cellAt = (grid, l, i) => grid.find(c => c.l === l && c.i === i);
const detailField = (page, f) => page.$eval(`#hm-detail [data-field="${f}"]`, e => e.textContent.trim());
const ALL = Array.from({ length: 13 }, (_, k) => "R" + (k + 1));

(async () => {
  /* ---------- 0. data/risks.csv follows the scoring rules ---------- */
  console.log("\n[0] data/risks.csv: calculated columns are consistent");
  {
    const [header, ...body] = parse(fs.readFileSync(RISKS_CSV, "utf8"));
    const rows = body.map(r => Object.fromEntries(header.map((k, i) => [k.trim(), (r[i] ?? "").trim()])));
    const ids = rows.map(r => r.risk_id);
    check("13 rows, R1–R13 each exactly once", rows.length === 13 && ALL.every(id => ids.filter(x => x === id).length === 1), JSON.stringify(ids));
    const bad = [];
    for (const r of rows) {
      const [lik, imp, adj, score] = ["likelihood", "impact", "adjusted_likelihood", "risk_score"].map(k => r[k] === "" ? null : Number(r[k]));
      if ([lik, imp, adj, score].includes(null)) continue; // blank rows show under "Awaiting scores"
      const expAdj = lik + (r.vendor_tier === "High" ? 1 : 0);
      if (adj !== expAdj) bad.push(`${r.risk_id}: adjusted_likelihood ${adj}, expected ${expAdj}`);
      if (score !== adj * imp) bad.push(`${r.risk_id}: risk_score ${score}, expected ${adj * imp}`);
    }
    check("adjusted_likelihood = likelihood (+1 if High tier) and risk_score = adjusted × impact on every row", bad.length === 0, JSON.stringify(bad));
  }

  const browser = await chromium.launch(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH, headless: true }
    : { channel: "chrome", headless: true });
  // Fail fast with a clear message if the local server isn't running
  try { await fetch(BASE + "index.html"); }
  catch { console.error(`Can't reach ${BASE}. Start the site first: python -m http.server 8765`); await browser.close(); process.exit(2); }

  /* ---------- 1. Desktop, repository CSV ---------- */
  console.log("\n[1] Desktop: heat map reads data/risks.csv from the repository");
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    const csvResponses = [], sheetRequests = [];
    page.on("response", r => { if (new URL(r.url()).pathname.endsWith("/data/risks.csv")) csvResponses.push(`${r.status()} ${r.url()}`); });
    page.on("request", req => {
      if (!/docs\.google\.com\/spreadsheets|googleusercontent\.com/.test(req.url())) return;
      let first = req; while (first.redirectedFrom()) first = first.redirectedFrom(); // follow redirects back
      sheetRequests.push({ url: req.url(), origin: first.url() });
    });
    await openHeatmapViaNav(page);
    await page.waitForLoadState("networkidle");
    check("URL is heatmap.html after nav click", page.url().endsWith("/heatmap.html"));
    check("nav marks Risk Heat Map as current", await page.$eval('.site-nav a[aria-current="page"]', a => a.getAttribute("href")) === "heatmap.html");
    check("browser loaded the repository's data/risks.csv (200)",
      csvResponses.some(s => s.startsWith("200 ") && s.endsWith(new URL("data/risks.csv", BASE).href)), JSON.stringify(csvResponses));
    const otherSheets = sheetRequests.filter(s => !s.origin.startsWith(TEAM_SHEET_PREFIX));
    check("no request to any Google Sheet except the team's Vendor Scorecard tabs (so none to the personal review sheet)",
      otherSheets.length === 0, JSON.stringify(otherSheets));
    console.log(`     Google Sheet requests seen: ${sheetRequests.length}, all from the team sheet: ${otherSheets.length === 0}`);
    check("banner says Repository CSV", await page.$eval(".hm-status", e => e.dataset.source) === "repo"
      && (await page.textContent(".hm-status")).includes("Repository CSV"));
    const footer = (await page.textContent("#data-source")).trim();
    check("footer names the repository CSV", footer.includes("repository CSV") || footer === "Repository CSV", footer);

    const grid = await gridState(page);
    const ids = grid.flatMap(c => c.ids);
    check("grid has 30 cells (6 likelihood rows x 5 impact cols)", grid.length === 30, grid.length);
    check("13 chips in matrix", ids.length === 13, ids.length);
    check("each of R1–R13 appears exactly once", ALL.every(id => ids.filter(x => x === id).length === 1), JSON.stringify(ids));
    check("awaiting count is 0", (await page.textContent("#hm-awaiting-h .badge")).trim() === "0");
    const c45 = cellAt(grid, 4, 5);
    check("R1, R5, R13 share cell impact 5 / adjusted 4", JSON.stringify(c45.ids) === '["R1","R5","R13"]', JSON.stringify(c45.ids));
    check("that cell's score label is 20", c45.score === "20");
    for (const id of ["R1", "R5", "R13"]) {
      await page.click(`.hm-grid .hm-chip[data-id="${id}"]`);
      check(`${id} detail score is 20`, await detailField(page, "risk_score") === "20");
    }
    const c32 = cellAt(grid, 3, 2);
    check("R11 is in cell impact 2 / adjusted 3", c32.ids.includes("R11"), JSON.stringify(c32));
    await page.click('.hm-grid .hm-chip[data-id="R11"]');
    check("R11 impact 2", await detailField(page, "impact") === "2");
    check("R11 adjusted likelihood 3", await detailField(page, "adjusted_likelihood") === "3");
    check("R11 score 6", await detailField(page, "risk_score") === "6");

    await page.click('.hm-grid .hm-chip[data-id="R4"]');
    check("R4 base likelihood 3", await detailField(page, "likelihood") === "3");
    check("R4 adjusted likelihood 3", await detailField(page, "adjusted_likelihood") === "3");
    const r4 = await page.textContent("#hm-detail");
    check("R4 shows no vendor adjustment and vendor None", r4.includes("no vendor adjustment") && /Vendor\s*None/.test(r4));
    check("R4 sits in cell impact 4 / adjusted 3", cellAt(grid, 3, 4).ids.includes("R4"));

    await page.click('.hm-grid .hm-chip[data-id="R1"]');
    const d = await page.textContent("#hm-detail");
    check("R1 detail shows reviewed notes", d.includes("Ransomware has affected PRT, and Masabi reports redundancy"));
    check("R1 detail shows name, category, vendor", d.includes("Ransomware at the fare vendor (main scenario)") && d.includes("Availability") && d.includes("Masabi") && d.includes("High tier"));
    check("R1 base 3 / adjusted 4 / impact 5", await detailField(page, "likelihood") === "3" && await detailField(page, "adjusted_likelihood") === "4" && await detailField(page, "impact") === "5");
    check("R1 chip is marked selected", await page.$eval('.hm-grid .hm-chip[data-id="R1"]', b => b.getAttribute("aria-pressed")) === "true");
    check("R1 detail does not say EXAMPLE ROW", !d.includes("EXAMPLE ROW"));

    // Every plotted risk's cell must match its own values
    let consistent = true;
    for (const c of grid) for (const id of c.ids) {
      await page.click(`.hm-grid .hm-chip[data-id="${id}"]`);
      const adj = +(await detailField(page, "adjusted_likelihood")), imp = +(await detailField(page, "impact")), sc = +(await detailField(page, "risk_score"));
      if (adj !== c.l || imp !== c.i || sc !== adj * imp) { consistent = false; console.log("     mismatch", id, adj, imp, sc, c.l, c.i); }
    }
    check("every chip sits in the cell matching its adjusted likelihood, impact and score", consistent);
    await page.click('.hm-grid .hm-chip[data-id="R1"]');
    await page.screenshot({ path: path.join(SHOTS, "1-desktop.png"), fullPage: true });
    check("no console/page errors", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 2. Mobile layout ---------- */
  for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    console.log(`\n[2] Mobile ${vp.width}x${vp.height}`);
    const { ctx, page, errors } = await newPage(browser, { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await openHeatmapViaNav(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("no horizontal page scroll", overflow <= 0, `overflow=${overflow}px`);
    const boxes = await page.$$eval(".hm-grid .hm-chip", bs => bs.map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.id, l: r.left, r: r.right, w: r.width, h: r.height }; }));
    check("13 chips rendered", boxes.length === 13);
    check("all chips inside viewport width", boxes.every(b => b.l >= 0 && b.r <= vp.width), JSON.stringify(boxes.filter(b => b.l < 0 || b.r > vp.width)));
    check("chips are at least 24x24 px tap targets", boxes.every(b => b.w >= 24 && b.h >= 24), JSON.stringify(boxes.map(b => [b.id, Math.round(b.w), Math.round(b.h)])));
    // Chip text must not overflow its button
    const clipped = await page.$$eval(".hm-grid .hm-chip", bs => bs.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.dataset.id));
    check("chip labels are not clipped", clipped.length === 0, JSON.stringify(clipped));
    await page.screenshot({ path: path.join(SHOTS, `2-mobile-${vp.width}-map.png`), fullPage: true });
    await page.tap('.hm-grid .hm-chip[data-id="R13"]');
    await page.waitForTimeout(700);
    const inView = await page.$eval("#hm-detail", e => { const r = e.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; });
    check("detail panel scrolled into view after tap", inView);
    check("R13 detail shown after tap", (await page.textContent("#hm-detail")).includes("Card data stolen"));
    await page.screenshot({ path: path.join(SHOTS, `2-mobile-${vp.width}-detail.png`) });
    check("no console/page errors", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 3. Missing scores (file contents replaced in the browser) ---------- */
  console.log("\n[3] data/risks.csv has blank or invalid scores");
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await page.route(RISKS_ROUTE, serve(modified({
      R2: { impact: "", risk_score: "" },                                   // impact cleared, score left blank
      R7: { likelihood: "", adjusted_likelihood: "", risk_score: "" },      // likelihood cleared
      R9: { impact: "7", risk_score: "28" }                                 // out-of-range value
    })));
    await openHeatmapViaNav(page);
    check("banner still says Repository CSV", await page.$eval(".hm-status", e => e.dataset.source) === "repo");
    const ids = (await gridState(page)).flatMap(c => c.ids);
    check("10 risks plotted", ids.length === 10, ids.length);
    check("R2, R7, R9 not on the map", !ids.includes("R2") && !ids.includes("R7") && !ids.includes("R9"));
    const aw = await page.$$eval(".hm-awaiting-list li", lis => lis.map(li => ({ id: li.dataset.id, text: li.textContent.replace(/\s+/g, " ").trim() })));
    check("awaiting list is R2, R7, R9", JSON.stringify(aw.map(a => a.id)) === '["R2","R7","R9"]', JSON.stringify(aw));
    check("R2 lists missing impact and risk score", aw[0] && aw[0].text.includes("Missing: impact, risk score"), aw[0] && aw[0].text);
    check("R7 lists missing likelihood, adjusted likelihood, risk score", aw[1] && aw[1].text.includes("Missing: likelihood, adjusted likelihood, risk score"));
    check("R9 explains invalid impact", aw[2] && aw[2].text.includes('impact "7" is not a whole number from 1 to 5'));
    check("awaiting badge shows 3", (await page.textContent("#hm-awaiting-h .badge")).trim() === "3");
    check("counts line says 10 of 13 plotted, 3 awaiting", (await page.textContent(".hm-counts")).replace(/\s+/g, " ").includes("10 of 13 risks plotted · 3 awaiting scores"));
    await page.click('.hm-awaiting-list .hm-chip[data-id="R2"]');
    check("R2 detail shows impact as Not scored", await detailField(page, "impact") === "Not scored");
    check("R2 detail still shows notes", (await page.textContent("#hm-detail")).includes("Vendor-managed access creates a lockout scenario"));
    await page.screenshot({ path: path.join(SHOTS, "3-missing-scores.png"), fullPage: true });
    check("no console/page errors", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 4. Risk file can't be loaded ---------- */
  for (const mode of ["http404", "not-csv"]) {
    console.log(`\n[4] data/risks.csv can't be used (${mode})`);
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await page.route(RISKS_ROUTE, r => mode === "http404"
      ? r.fulfill({ status: 404, body: "Not found" })
      : r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body>Page not found</body></html>" }));
    await openHeatmapViaNav(page, "#heatmap-app .callout");
    const msg = (await page.textContent("#heatmap-app")).replace(/\s+/g, " ");
    check("page says the risk data didn't load", msg.includes("The risk data didn't load"), msg);
    check("no risk IDs are drawn", (await page.$$(".hm-chip")).length === 0);
    const pageErrors = errors.filter(e => e.startsWith("pageerror"));
    check("no uncaught script errors", pageErrors.length === 0, JSON.stringify(pageErrors));
    if (mode === "http404") await page.screenshot({ path: path.join(SHOTS, "4-file-missing.png"), fullPage: true });
    await ctx.close();
  }

  /* ---------- 5. Adjusted likelihood of 6 ---------- */
  console.log("\n[5] Base likelihood 5 at a High-tier vendor -> adjusted 6");
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await page.route(RISKS_ROUTE, serve(modified({ R12: { likelihood: "5", adjusted_likelihood: "6", risk_score: "30" } })));
    await openHeatmapViaNav(page);
    const grid = await gridState(page);
    const c65 = cellAt(grid, 6, 5);
    check("R12 plotted in top row (adjusted 6), impact 5", c65.ids.includes("R12"), JSON.stringify(c65));
    check("that cell is score 30, Critical band", c65.score === "30" && c65.band === "band-critical");
    check("still 13 risks plotted", grid.flatMap(c => c.ids).length === 13);
    await page.click('.hm-grid .hm-chip[data-id="R12"]');
    check("R12 detail: base 5, adjusted 6, score 30", await detailField(page, "likelihood") === "5" && await detailField(page, "adjusted_likelihood") === "6" && await detailField(page, "risk_score") === "30");
    check("no console/page errors", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 6. Other tools still work ---------- */
  console.log("\n[6] Vendor Scorecard and FAIR Calculator via header nav");
  {
    const { ctx, page, errors } = await newPage(browser, { viewport: { width: 1280, height: 900 } });
    await openHeatmapViaNav(page);
    await page.click('.site-nav a[href="scorecard.html"]');
    await page.waitForSelector(".sc-vendor", { timeout: 20000 });
    check("Vendor Scorecard renders vendor cards", (await page.$$(".sc-vendor")).length >= 5);
    const scFooter = (await page.textContent("#data-source")).trim();
    check("Vendor Scorecard still reads the live Google Sheet", scFooter === "Live from Google Sheet", scFooter);
    await page.click('.site-nav a[href="fair.html"]');
    await page.waitForLoadState("networkidle");
    const fairText = (await page.textContent("#fair-app")) || "";
    check("FAIR Calculator renders content", fairText.trim().length > 50, fairText.slice(0, 120));
    const fairFooter = (await page.textContent("#data-source")).trim();
    check("FAIR Calculator still reads the live Google Sheet", fairFooter === "Live from Google Sheet", fairFooter);
    await page.screenshot({ path: path.join(SHOTS, "6-fair.png"), fullPage: true });
    check("no console/page errors on scorecard/FAIR", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  /* ---------- 7. Dark mode look ---------- */
  console.log("\n[7] Dark mode screenshot");
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
    await openHeatmapViaNav(page);
    await page.click('.hm-grid .hm-chip[data-id="R1"]');
    await page.screenshot({ path: path.join(SHOTS, "7-desktop-dark.png"), fullPage: true });
    check("dark mode renders 13 chips", (await page.$$(".hm-grid .hm-chip")).length === 13);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
