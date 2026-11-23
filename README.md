# 3CG Risk Platform

**3CG - Carnegie Cyber Consulting Group** · CRM Group Project, Carnegie Mellon University, 2026

Cyber risk tools for Pittsburgh Regional Transit's (PRT) switch from ConnectCard to ReadyFare. The site has three linked tools — a **Vendor Scorecard**, a **Risk Heat Map** and a **FAIR Cost Calculator** — and they read their data live from the team's Google Sheets.

**Live site:** https://laurenmack.github.io/3CG-Risk-Platform/

> Built from public information for a class project. Scores and costs are 3CG estimates, not PRT figures. A real deployment would keep vendor ratings in a private sheet and put the site behind PRT's sign-in.

---

## Contents

1. [Quick start](#1-quick-start)
2. [How the site works](#2-how-the-site-works)
3. [File structure](#3-file-structure)
4. [The Google Sheets](#4-the-google-sheets)
5. [Connecting the Google Sheets](#5-connecting-the-google-sheets)
6. [Editing each part of the site](#6-editing-each-part-of-the-site)
7. [Adding a new page or data tab](#7-adding-a-new-page-or-data-tab)
8. [Shared code reference](#8-shared-code-reference)
9. [Ways to edit and publish](#9-ways-to-edit-and-publish)
10. [Troubleshooting](#10-troubleshooting)
11. [Team rules](#11-team-rules)

---

## 1. Quick start

| I want to… | Do this |
|---|---|
| Read the tools | Open the live site. Start on **Overview**. |
| Change a vendor score | Edit the yellow cells on the **Vendors** tab of the scorecard sheet. See [section 4](#4-the-google-sheets). |
| Change a risk's likelihood or impact | Edit the **Risks** tab of the PRT-risks sheet. See [section 4.2](#42-prt-risks-sheet-risk-heat-map). |
| Change FAIR assumptions | Edit the FAIR sheet, or try values on the page (not saved). See [section 4.3](#43-fair-sheet-fair-calculator). |
| Change colors, the menu or the logo | Edit `css/style.css` or `js/site.js`. See [section 6.1](#61-site-wide-colors-header-menu-footer-logo). |
| Work on my tool | Edit only your page and its script. See [section 6](#6-editing-each-part-of-the-site). |
| Test before publishing | Use VS Code Live Server. See [section 9](#9-ways-to-edit-and-publish). |

---

## 2. How the site works

```
 Google Sheets ──(each tab shared as a CSV link)──▶ js/data.js ──▶ each tool page
 (staff edit them)                                  (loads the data,   (scorecard, heat map, FAIR)
                                                     falls back to
                                                     /data copies)
```

- **No server and no database.** GitHub Pages serves plain HTML, CSS and JavaScript files for free.
- **Google Sheets are the database.** There are currently three sheets (see [section 4](#4-the-google-sheets)). Each tab is shared as a CSV link, and the site downloads those links every time a page loads.
- **`js/data.js` is the only place that knows where the data lives.** Every page uses its `loadTable()` function.
- **There's a fallback.** If a Sheet link is blank or can't be reached, the scorecard and heat map use the saved copy in `/data`. The FAIR tables don't have saved copies yet, so the FAIR page shows an error if Google can't be reached. The footer shows which source is being used:
  - 🟢 **Live from Google Sheet**: every tab came from the sheet.
  - 🟡 **Sample data**: no tab came from the sheet.
  - 🟡 **Partly live**: some tabs came from the sheet and some from the samples.
- **The tools feed each other.** A risk tied to a High-tier vendor moves up one likelihood step on the heat map. FAIR then prices the top risks.

---

## 3. File structure

```
3CG-Risk-Platform/
├── index.html            Overview page (tool cards, how they connect, team)
├── scorecard.html        Vendor Scorecard page
├── heatmap.html          Risk Heat Map page
├── fair.html             FAIR Cost Calculator page
├── components.html       Style guide: copy-paste pieces for building pages (not in the menu)
├── README.md             This file
│
├── css/
│   ├── style.css         SHARED: colors, fonts, header, tartan, cards, tables, buttons, forms
│   ├── scorecard.css     Scorecard page only
│   ├── heatmap.css       Heat map page only
│   └── fair.css          FAIR page only
│
├── js/
│   ├── site.js           SHARED: draws the header, menu and footer on every page
│   ├── data.js           SHARED: Google Sheet links + data loading helpers
│   ├── scorecard.js      Scorecard page logic
│   ├── heatmap.js        Heat map page logic
│   └── fair.js           FAIR calculator logic
│
├── data/                 Saved CSV copies of the sheet tabs (fallback only)
│   ├── vendors.csv
│   ├── score_reasons.csv
│   ├── weights.csv
│   ├── tiers.csv
│   └── risks.csv         Heat map's reviewed ratings (see BACKUP_DATE in js/heatmap.js)
│
├── assets/
│   └── 3cg-logo.png      Logo (also the browser tab icon)
│
└── tests/                Browser checks for the heat map (optional; see section 9)
```

**Rule of thumb:** HTML pages stay at the top level. GitHub Pages looks for `index.html` there, and every page finds `css/`, `js/` and `assets/` relative to the top level. A page moved into a folder will lose its styles.

Every page loads its scripts in this order. Keep the order, because each script depends on the one before it:

```html
<script src="js/data.js"></script>     <!-- data helpers first -->
<script src="js/site.js"></script>     <!-- then header/footer -->
<script src="js/<page>.js"></script>   <!-- then the page's own tool -->
```

---

## 4. The Google Sheets

The site currently reads from **three** Google Sheets, one per tool owner.

| Sheet | Owner | Tabs the site reads | How it's linked |
|---|---|---|---|
| Scorecard sheet | Lauren Mack | Vendors, Score_Reasons, Weights, Tiers | Published to web as CSV |
| PRT-risks sheet | Yihao Ma | Risks | CSV export link (sheet shared as "Anyone with the link can view") |
| FAIR sheet | Vismitha Suresh | Parameters, Scenarios, Controls, Sources | Published to web as CSV |

> Combining all three into one sheet would mean one link to share and would let the Risks tab pull vendor tiers straight from the scorecard. If you do, re-publish every tab and update all the links in `js/data.js` and in `tests/heatmap.test.js`.

### 4.1 Scorecard sheet (Vendor Scorecard)

The scorecard sheet has a README tab and a Sources tab for people; the site reads four tabs. Its own Risks tab is a starter copy and is **not** read by the site; the heat map uses the PRT-risks sheet.

**Color key:** blue text on yellow = input you can edit · black = formula, don't edit · green = pulled from another tab.

#### Vendors

One row per vendor. This is the scorecard's main table.

| Column | What it is | Edit? |
|---|---|---|
| `vendor_id` | Short ID, e.g. `masabi`. Links rows across tabs. | Only when adding a vendor |
| `vendor`, `role` | Display name and what the vendor does | Yes |
| `data_sensitivity` · `criticality` · `system_access` · `security_evidence` · `contract_protections` · `concentration` | Criterion scores, 1 (lower risk) to 5 (higher risk). Dropdown-limited to 1–5. | **Yes** |
| `weighted_score` | Σ score × weight, rounded to 2 decimals | No (formula) |
| `tier` | High / Medium / Low from the Tiers tab | No (formula) |
| `recommended_action` | Standard action for the tier | No (formula) |
| `overall_evidence` | Verified · Partly verified · Claimed · Assumed · Unknown | Yes |
| `vendor_specific_action` | 3CG's recommendation for this vendor | Yes |
| `last_reviewed` | Date of last review, `YYYY-MM-DD` | Yes |

#### Score_Reasons

One row per vendor per criterion (5 vendors × 6 criteria = 30 rows). Powers the **See why** drop-down.

| Column | What it is |
|---|---|
| `vendor_id`, `criterion_key` | Which vendor and which criterion |
| `score` | Pulled from Vendors automatically (don't edit) |
| `reason` | One sentence explaining the score |
| `evidence_level` | Dropdown: Verified · Partly verified · Claimed · Assumed · Unknown |
| `source_url` | Link to the evidence (leave blank if none) |

#### Weights

`criterion_key`, `criterion`, `weight` (as a %), `score_1_means`, `score_3_means`, `score_5_means`. **Weights must total 100%.** The README tab shows a live check.

| Criterion | Weight |
|---|---|
| Data sensitivity | 20% |
| Criticality | 20% |
| Security evidence | 20% |
| System access | 15% |
| Concentration | 15% |
| Contract protections | 10% |

#### Tiers

`tier`, `min_score`, `color_hex`, `recommended_action`. The rows **must stay in the order High, Medium, Low.** Changing `min_score` moves the cutoffs; changing `color_hex` changes the colors on the site.

| Tier | Min score | Color |
|---|---|---|
| High | 3.5 | `#D9534F` |
| Medium | 2.5 | `#F0AD4E` |
| Low | 0 | `#5CB85C` |

### 4.2 PRT-risks sheet (Risk Heat Map)

One tab, **Risks**, with risks R1–R13. The heat map reads it every time the page opens.

| Column | What it is | Edit? |
|---|---|---|
| `risk_id`, `risk_name`, `cia_category` | ID, name, and Availability / Confidentiality / Integrity | Yes |
| `related_vendor_id` | Which vendor the risk depends on (blank if none): `masabi`, `processor`, `digi`, `flowbird`, `sb` | Yes |
| `vendor_tier` | That vendor's scorecard tier | Keep in step with the scorecard |
| `likelihood`, `impact` | Whole numbers 1–5 | **Yes** |
| `adjusted_likelihood` | likelihood + 1 if the vendor is High tier, capped at 5: `=MIN(5, likelihood + 1)` | Formula |
| `risk_score` | adjusted_likelihood × impact (1–25) | Formula |
| `notes` | Reason for the ratings (shown in the detail panel) | Yes |

Rows with a blank or invalid score aren't plotted; they're listed under **Awaiting scores** instead.

> **Rule:** adjusted likelihood never goes above 5, so the heat map is a standard 5 × 5 grid. The sheet formula and `js/heatmap.js` both use this cap; keep them in step.

### 4.3 FAIR sheet (FAIR Calculator)

| Tab (key in `data.js`) | Columns the page needs |
|---|---|
| Parameters (`fairParameters`) | `key`, `value`. Keys used: `annual_fare_revenue_usd`, `days_per_year`, `it_hourly_wage_usd`, `support_hourly_wage_usd`, `loaded_labor_multiplier`, `analysis_years` |
| Scenarios (`fairScenarios`) | `risk_id`, `risk_name`, `case` (`low` / `base` / `high`), `tef_per_year`, `susceptibility`, `outage_days`, `affected_fare_share`, `unrecoverable_fraction`, `it_hours`, `support_hours`, `external_response_usd`, `manual_ops_usd`, `secondary_probability`, `secondary_cost_if_occurs_usd`, `control_id` |
| Controls (`fairControls`) | `control_id`, `control_name`, `initial_cost_usd`, `annual_cost_usd`, `post_tef_multiplier`, `post_susceptibility_multiplier`, `post_magnitude_multiplier` |
| Sources (`fairSources`) | `title`, `url` (listed at the bottom of the page) |

Every Scenarios row needs a matching `control_id` in Controls, and each risk needs `low`, `base` and `high` rows.

### 4.4 Rules that keep the site working

1. **Don't rename column headers.** The code finds data by header name. Renaming `weighted_score` breaks the scorecard.
2. **Keep published tabs as clean tables.** Don't add notes, totals or blank header cells under or beside the data; put notes on the README tab.
3. **Adding columns is fine.** The code ignores columns it doesn't use.
4. **Use `vendor_id` and `risk_id` consistently** across all three sheets.
5. **Protected ranges** on formula columns show a warning before anyone overwrites them. Don't remove them.
6. **Keep the sharing settings.** If the PRT-risks sheet stops being "Anyone with the link can view," the heat map falls back to its saved copy.

---

## 5. Connecting the Google Sheets

1. In the Google Sheet, go to **File → Share → Publish to web**.
2. Choose a tab (e.g. **Vendors**) and **Comma-separated values (.csv)**.
3. Under **Published content and settings**, keep **Automatically republish when changes are made** on.
4. Click **Publish** and copy the link.
5. Repeat for every tab the site reads.
6. Paste each link into `SHEET_URLS` at the top of `js/data.js`:

```js
const SHEET_URLS = {
  vendors:        "https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv",
  scoreReasons:   "…",
  weights:        "…",
  tiers:          "…",
  risks:          "https://docs.google.com/spreadsheets/d/<sheet id>/export?format=csv&gid=<tab id>",
  fairParameters: "…",
  fairScenarios:  "…",
  fairControls:   "…",
  fairSources:    "…"
};
```

7. Commit. The footer should change to **Live from Google Sheet**.

The heat map's `risks` link uses a different kind of link: the sheet's **export** link, which works as long as the sheet is shared as "Anyone with the link can view." Either kind works with `loadTable()`.

**Notes**
- Published CSVs show calculated values, not formulas. A weight of 20% arrives as the text `"20%"`, and `toNumber()` turns it into `0.2`.
- Google may take a few minutes to republish after an edit.
- Anyone with a published link can read that tab. That's fine for this project; don't publish anything private.
- **Updating the saved copies:** when a sheet changes a lot, download each tab (**File → Download → CSV**) and replace the matching file in `/data`. For the heat map, also update `BACKUP_DATE` at the top of `js/heatmap.js`.
- **Adding saved copies for FAIR:** save the four FAIR tabs as `data/fair_parameters.csv`, `data/fair_scenarios.csv`, `data/fair_controls.csv` and `data/fair_sources.csv`, and put those paths in `LOCAL_FILES` in `js/data.js`. Then the FAIR page still works if Google is blocked, such as on some school or conference networks.

---

## 6. Editing each part of the site

> **Ownership:** edit only your own page, script and stylesheet. Ask the site lead (Lauren Mack) before changing the **shared** files: `css/style.css`, `js/site.js`, `js/data.js`.

### 6.1 Site-wide: colors, header, menu, footer, logo

**Colors and fonts** live at the top of `css/style.css` as variables. Change one value and every page follows.

```css
:root {
  --cmu-red: #C41230;      /* header, accents */
  --tier-high: #D9534F;    /* fallback tier colors (the sheet's Tiers tab wins on the scorecard) */
  --link: #A50F28;
  --font: "Open Sans", …;  /* body */
  --serif: "Source Serif 4", …;  /* headings */
  --mono: "IBM Plex Mono", …;    /* numbers */
}
```

Dark mode values are in the `@media (prefers-color-scheme: dark)` block just below.

**Header text, footer note, logo path:** the `SITE` object at the top of `js/site.js`:

```js
const SITE = {
  name: "3CG",
  fullName: "Carnegie Cyber Consulting Group",
  logo: "assets/3cg-logo.png",
  footerNote: "Student project for the CRM Group Project, Carnegie Mellon University, 2026. …"
};
```

**Menu:** the `NAV` list in `js/site.js`. One line per link. Adding `soon: true` to a line shows a "Soon" tag next to it.

```js
const NAV = [
  { href: "index.html",         label: "Overview" },
  { href: "scorecard.html",     label: "Vendor Scorecard" },
  { href: "heatmap.html",       label: "Risk Heat Map" },
  { href: "fair.html",          label: "FAIR Calculator" }
];
```

**Logo:** replace `assets/3cg-logo.png` with a sharper image of the **same file name**. No code changes are needed.

**Tartan band:** the `.tartan` class in `style.css`. Use `class="tartan"` on any block; use it sparingly.

### 6.2 Overview page (`index.html`)

Plain HTML, no script.
- **Tool cards:** each `<a class="card card-accent">` links to one tool, with a one-line description.
- **How they work together:** the four step cards under the tools.
- **About box:** the `callout callout-warn` at the bottom.

### 6.3 Vendor Scorecard (`scorecard.html`, `js/scorecard.js`, `css/scorecard.css`)

Reads **Vendors, Score_Reasons, Weights, Tiers**.

**Everything on this page comes from the sheet:** scores, tiers, tier colors and cutoffs, recommendations, reasons, sources and the "How we score" table. To change what it says, change the sheet, not the code.

| To change… | Edit |
|---|---|
| Page title, intro, "How to read" box, owner/status | `scorecard.html` |
| Card layout, tier tiles, filtering, "See why" table | `js/scorecard.js` |
| Scorecard look (tiles, cards, score bar, dots) | `css/scorecard.css`; classes start with `sc-` |

How the script works, top to bottom:
1. `loadTables(["vendors","scoreReasons","weights","tiers"])`
2. Turns weights into numbers and sorts tiers from the highest cutoff down
3. Uses the sheet's `weighted_score`; **if it's blank, recalculates it** from the weights
4. Draws the tier tiles, then one card per vendor, sorted by score (highest first)
5. Adds click-to-filter on the tiles and fills the "How we score" table

### 6.4 Risk Heat Map (`heatmap.html`, `js/heatmap.js`, `css/heatmap.css`) · Owner: Yihao Ma

Reads **risks** (PRT-risks sheet) and **vendors** (only for vendor display names).

| To change… | Edit |
|---|---|
| A risk's ratings or notes | The PRT-risks sheet, not the code |
| Color bands (Low 1–4, Moderate 5–9, High 10–14, Critical 15–25) | `BANDS` in `js/heatmap.js`; colors in `css/heatmap.css` (`--hm-*`) |
| Grid size (impact 1–5, likelihood 1–5) | `IMPACTS` and `LIKELIHOODS` in `js/heatmap.js` |
| Date shown in the backup notice | `BACKUP_DATE` in `js/heatmap.js` |
| Look of the grid, chips, legend, detail panel | `css/heatmap.css`; classes start with `hm-` |

How it works: it reads the Risks rows, plots each complete row at (impact, adjusted likelihood), and lists incomplete rows under **Awaiting scores**. Clicking a risk ID opens the detail panel. Adjusted likelihood and risk score come straight from the sheet; the page doesn't recalculate them. A banner says whether the data is live or the saved backup.

### 6.5 FAIR Cost Calculator (`fair.html`, `js/fair.js`, `css/fair.css`) · Owner: Vismitha Suresh

Reads **fairParameters, fairScenarios, fairControls, fairSources** (FAIR sheet). The bar chart uses Chart.js 4.4.8, loaded from jsDelivr in `fair.html`; if it can't load, the page shows the totals without the chart.

How it works:
1. The reader picks a risk and a **low / base / high** scenario. The page fills the inputs from that Scenarios row.
2. Readers can change any input and click **Recalculate**. Changes aren't saved to the sheet; **Reset to sheet values** undoes them.
3. The calculation:
   - Loss event frequency = threat events per year × susceptibility
   - Loss per event = unrecoverable fares (annual fare revenue ÷ days per year × outage days × share affected × unrecoverable share) + IT and support labor (hours × wage × loaded multiplier) + forensic/vendor and temporary operations costs + secondary probability × secondary cost
   - Annualized loss = loss event frequency × loss per event
   - After the control: annualized loss × the Controls row's three multipliers
   - Net benefit = yearly reduction × analysis years − (initial cost + yearly cost × analysis years)

| To change… | Edit |
|---|---|
| Revenue, wages, analysis years | Parameters tab |
| Scenario assumptions | Scenarios tab |
| The control being tested and its effect | Controls tab |
| Labels, layout, chart | `js/fair.js`, `css/fair.css`; classes start with `fair-` |

### 6.6 Components (`components.html`)

Copy the HTML from this page so new work matches the rest of the site.

| Need | Class |
|---|---|
| Card / accent card / link card | `card` · `card card-accent` · `<a class="card">` |
| Responsive grid of cards | `grid` |
| Tier badge | `badge tier-high` · `tier-medium` · `tier-low` |
| Status badge | `badge status-todo` · `status-progress` · `status-ready` |
| Evidence pill | `evidence ev-verified` · `ev-partly-verified` · `ev-claimed` · `ev-assumed` · `ev-unknown` |
| Big number | `stat` with `stat-value` + `stat-label` |
| Note box | `callout` · `callout callout-info` · `callout callout-warn` · `<details class="callout">` |
| Buttons | `btn` · `btn btn-outline` |
| Form field | `field` wrapping `<label>`, input, `<span class="hint">` |
| Table that scrolls on phones | wrap `<table>` in `table-wrap` |
| Box around a tool | `slot` (dashed, in progress) → `slot done` (solid, finished) |

---

## 7. Adding a new page or data tab

### 7.1 Add a new page

1. Copy `heatmap.html` and rename it, e.g. `controls.html`.
2. Change the `<title>`, eyebrow, `<h1>`, lede, owner line, the app `div` id (e.g. `controls-app`) and the page stylesheet link.
3. Change the last script tag to `js/controls.js` and create that file:

```js
(async function () {
  const app = document.getElementById("controls-app");
  try {
    const rows = await loadTable("risks");
    app.innerHTML = rows.map(r => `<p>${esc(r.risk_name)}</p>`).join("");
  } catch (err) {
    app.innerHTML = `<div class="callout"><strong>Data didn't load.</strong> ${esc(err.message)}</div>`;
  }
})();
```

4. Add it to the menu in `js/site.js`: `{ href: "controls.html", label: "Controls" },`
5. Optional: add a card for it on `index.html`.

### 7.2 Add a new data tab

1. Add the tab to the Google Sheet as a clean table, with snake_case headers in row 1.
2. Publish it as CSV ([section 5](#5-connecting-the-google-sheet)).
3. In `js/data.js`, add a key to **both** objects:

```js
const SHEET_URLS  = { …, controls: "https://docs.google.com/…output=csv" };
const LOCAL_FILES = { …, controls: "data/controls.csv" };   // or "" if no saved copy
```

4. Optional: save a copy to `data/controls.csv` as a fallback.
5. Load it in any page: `const rows = await loadTable("controls");`

---

## 8. Shared code reference

All of these come from `js/data.js` and work on every page.

| Function | What it does |
|---|---|
| `loadTable(name)` | Loads one tab by its key in `SHEET_URLS` (e.g. `"vendors"`). Returns an array of row objects keyed by column header. Tries the sheet, then the sample file. |
| `loadTables([names])` | Loads several tabs at once; returns them in the same order. |
| `toNumber(value)` | Sheet text to a number: `"20%"` → `0.2`, `"$1,200"` → `1200`, `"4.35"` → `4.35`, `""` → `null`. |
| `esc(value)` | Makes sheet text safe to put in HTML. **Always use it** on anything from the sheet. |
| `showDataCheck(element, [names])` | Shows which tabs loaded and their columns. A building aid; remove it when your tool works. |
| `DATA_SOURCE[name]` | `"live"` or `"sample"` for each table already loaded. The heat map uses it for its banner. |

A row looks like this:

```js
{ vendor_id: "masabi", vendor: "Masabi", data_sensitivity: "5", weighted_score: "4.35", tier: "High", … }
```

Every value arrives as **text**, so use `toNumber()` before doing math.

---

## 9. Ways to edit and publish

| Method | Best for | How |
|---|---|---|
| **github.com** | One small text change | Open the file → pencil icon → edit → **Commit changes** |
| **github.dev** | Several files, moving files, making folders | Press `.` on the repo page (or go to `github.dev/laurenmack/3CG-Risk-Platform`) → edit → **Source Control** icon → message → **Commit & Push** |
| **VS Code on your computer** | Building and testing a tool | Clone the repo, edit, preview with **Live Server**, then commit and push |

**Testing locally:** browsers block data files when you double-click an HTML file. Use VS Code's **Live Server** extension (right-click `index.html` → **Open with Live Server**), or run `python3 -m http.server` in the repo folder and open `http://localhost:8000`.

**Heat map tests (optional):** `tests/heatmap.test.js` checks the heat map in headless Chrome. Start `python -m http.server 8765` in the repo folder, then in `tests/` run `npm install` and `npm test`. Screenshots land in `tests/screenshots/` (not committed).

**Publishing:** every commit to `main` republishes the site through GitHub Pages (**Settings → Pages → Deploy from a branch → `main` / root**). Watch the **Actions** tab: 🟡 building, ✅ live, ❌ failed. It usually takes 1–2 minutes.

**Uploading files:** dragging folders onto github.com's upload page often flattens them, so every file lands at the top level. Use github.dev to make folders and drag files into them, or upload from **inside** the target folder.

---

## 10. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Page shows the old version after a commit | Browser cache (GitHub Pages lets browsers keep copies for up to 10 min) | Hard refresh (Cmd/Ctrl+Shift+R), open a private window, or add `?v=2` to the link |
| Page is plain black text on white, no red header | Files aren't in their folders, or a path is wrong | Check that `css/style.css` and `js/site.js` exist at those exact paths |
| "The data didn't load" | Page opened by double-clicking, or a Sheet link is wrong | Use Live Server; check the links in `js/data.js` |
| Footer says **Sample data** | `SHEET_URLS` are blank or unreachable | Paste the CSV links ([section 5](#5-connecting-the-google-sheets)) |
| FAIR page says "could not load" | A FAIR link failed and there's no saved copy, or a required column is missing | Check the FAIR links and column names ([section 4.3](#43-fair-sheet-fair-calculator)); add saved copies ([section 5](#5-connecting-the-google-sheets)) |
| Heat map shows **Backup data** | PRT-risks sheet unreachable or no longer shared by link | Check its sharing setting; refresh |
| A risk is under **Awaiting scores** | Blank or non-whole-number likelihood or impact | Fix the row in the PRT-risks sheet |
| FAIR chart missing | Chart.js didn't load (network blocks jsDelivr) | Totals still show; try another network |
| A number shows `NaN` or `0` | The value is text like `"20%"`, or the header was renamed | Use `toNumber()`; check the header spelling |
| A vendor card is missing | Blank `vendor_id`, or a stray row/note in the tab | Clean up the Vendors tab |
| "See why" says "No reason recorded yet" | `vendor_id` or `criterion_key` in Score_Reasons doesn't match | Match the IDs exactly (lowercase, underscores) |
| Weights look wrong | Weights don't total 100% | Check the README tab in the sheet |
| Tier colors wrong | `color_hex` on the Tiers tab | Use a full hex like `#D9534F` |
| 404 page | Pages is off, or the link has the wrong capitalization | Settings → Pages → `main` / root; use `3CG-Risk-Platform` exactly |
| Logo missing | `assets/3cg-logo.png` not uploaded or misnamed | Upload into `assets/` with that exact name |

To find errors: right-click the page → **Inspect** → **Console**. Red messages name the file and line.

---

## 11. Team rules

1. **Own your files.** Edit only your page, script and stylesheet; ask Lauren before changing `style.css`, `site.js` or `data.js`.
2. **Change data in the sheet, not in code.** If a number on the site is wrong, fix the sheet.
3. **Always `esc()` sheet text** before putting it on a page.
4. **Test locally** (Live Server) before committing big changes.
5. **Write clear commit messages**, like "Heat map: add CIA filter", so the history is easy to follow.
6. **Keep numbers consistent.** Slides and the report use the same figures as the sheet.

---

### Team

| Member | Part |
|---|---|
| Lauren Mack | Vendor Scorecard · website lead |
| Yihao Ma | Risk Heat Map |
| Vismitha Suresh | FAIR Cost Calculator |

### Method sources

NIST Cybersecurity Framework 2.0 · NIST SP 800-161 Rev. 1 · CISA/FBI *Secure by Demand* · APTA SS-ECS-RP-001-14 R1 · FAIR (Factor Analysis of Information Risk) · PCI DSS v4.0.1. Full citations are in the Sources tabs of the Google Sheets, on the FAIR page and in the final report.
