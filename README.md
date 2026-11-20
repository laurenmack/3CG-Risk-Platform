# 3CG - Carnegie Cyber Consulting Group

Cyber risk tools for Pittsburgh Regional Transit's switch from ConnectCard to ReadyFare. CRM Group Project, Carnegie Mellon University, 2026. Built from public information.

## Where to build your part

| Tool | Page | Your JS file | Build inside |
|---|---|---|---|
| Vendor Scorecard | `scorecard.html` | `js/scorecard.js` | `<div id="scorecard-app">` |
| Risk Heat Map | `heatmap.html` | `js/heatmap.js` | `<div id="heatmap-app">` |
| FAIR Calculator | `fair.html` | `js/fair.js` | `<div id="fair-app">` |
| Vendor Portal (planned) | `vendor-portal.html` | none yet | |

**Rules so we don't break each other's work:**
- Edit only your own page and your own JS file.
- Ask the site lead before changing the shared files: `css/style.css`, `js/site.js`, `js/data.js`.
- Use the pieces on `components.html` (cards, badges, tables, buttons, form fields) so everything matches.
- Put your name in the `Owner: [Name]` line on your page and in your JS file.

## Shared files

| File | What it does |
|---|---|
| `css/style.css` | All styles. Carnegie Mellon colors and the tartan are at the top. |
| `js/site.js` | Header, navigation and footer for every page. To add a page to the menu, add one line to `NAV`. |
| `js/data.js` | Connects to the Google Sheet. Gives every page `loadTable()`, `toNumber()` and `esc()`. |
| `data/*.csv` | Sample copies of the sheet tabs, used until the sheet is linked. |
| `assets/3cg-logo.png` | Logo. Replace it with a sharper version using the same file name. |

## Using the Google Sheet data

In your JS file:

```js
const risks = await loadTable("risks");      // array of rows
risks.forEach(r => {
  const likelihood = toNumber(r.adjusted_likelihood); // text to number
  const name = esc(r.risk_name);                      // safe to put in HTML
});
```

Every page also shows a **Data connection check** box listing which tabs loaded. Delete it once your tool works.

### Connecting the sheet

1. In the Google Sheet, go to **File > Share > Publish to web**, pick a tab, choose **CSV**, and click **Publish**.
2. Paste the link into `SHEET_URLS` in `js/data.js`.
3. Repeat for each tab. The footer changes to "Live from Google Sheet" once all of them are linked.

Don't rename the column headers in the sheet. The code finds data by header name.

**Adding a new tab (e.g. FAIR):** publish it, then put its link in `SHEET_URLS.fair`. If you want a fallback, save a copy as `data/fair.csv` and set `LOCAL_FILES.fair` to that path.

## Test on your computer

Browsers block data files when you double-click an HTML file. Use **VS Code > Live Server** (right-click `index.html` and choose Open with Live Server), or run `python3 -m http.server` in this folder and go to `http://localhost:8000`.

## Risk Heat Map

**Which sheet powers it.** The heat map reads the **Risks** tab of the reviewed, scored risk sheet
([Google Sheet](https://docs.google.com/spreadsheets/d/1HSnPp1hhtyK1v07ubjtsOO3oxysZZwbuBkto0xO_Zfc/edit?gid=1182985444#gid=1182985444)),
through the CSV export link in `SHEET_URLS.risks` in `js/data.js`. It does not use the Risks tab in the team's
Vendor Scorecard sheet, which still has placeholder values. The sheet has to stay shared as "Anyone with the link
can view", or the export link stops working and the page falls back to the backup copy.

**What the client updates.** One row per risk, matched by `risk_id` (R1–R13):

| Column | Who fills it | Notes |
|---|---|---|
| `likelihood` | Client | Whole number from 1 to 5; higher means more likely |
| `impact` | Client | Whole number from 1 to 5; higher means more damage |
| `notes` | Client | Short English reason for the ratings |
| `adjusted_likelihood` | Formula (gray) | `likelihood + 1` when `vendor_tier` is High. Don't type over it. |
| `risk_score` | Formula (gray) | `adjusted_likelihood × impact`. Don't type over it. |
| `vendor_tier` | Typed copy | **A snapshot**, not linked to the Vendor Scorecard. If a vendor's tier changes on the scorecard, change it here by hand. |

Save the sheet, then refresh the website to see the new positions.

**How scores are plotted.**
- Impact runs left to right (1–5). Adjusted likelihood runs bottom to top (1–6). The sheet's formula has no cap, so a
  base likelihood of 5 at a High-tier vendor lands in row 6.
- Each risk ID sits in the cell for its sheet values. The page doesn't recalculate them. Risks that share a cell are all shown.
- Cell color shows the score band: Low 1–4, Moderate 5–9, High 10–14, Critical 15–30.
- Click an ID to see its name, category, vendor, base and adjusted likelihood, impact, score, and notes.
- A row with a blank or invalid `likelihood`, `impact`, `adjusted_likelihood` or `risk_score` isn't plotted.
  It appears under **Awaiting scores** with the missing fields.

**Live or backup data.** A banner above the map says which one is showing. If the sheet can't be reached, the page
uses `data/risks.csv`, a verified copy of all 13 scored risks taken on 20 November 2026. To refresh the copy, download the
Risks tab as CSV (File > Download > CSV), replace `data/risks.csv`, and update `BACKUP_DATE` in `js/heatmap.js`.

**Run it locally.** In this folder, run `python -m http.server 8000` (or `python3 ...`), then open
`http://localhost:8000` and choose **Risk Heat Map** in the menu. VS Code Live Server works too.

**Run the heat map tests.** These are optional and need Node.js and Google Chrome; the site itself needs no install.
In one terminal, run `python -m http.server 8765` in this folder. In a second terminal, run `cd tests`, then `npm install`, then `npm test`.
The script opens the site in headless Chrome. It checks the live map, a phone-sized screen, missing scores, a failed live request (backup data), and an adjusted likelihood of 6.
The first section reads the real sheet and expects the reviewed values for R1, R4, R5, R11 and R13. If the client re-rates those risks, update the expected values in `tests/heatmap.test.js`.
Every other section fakes the sheet's reply inside the test browser, so the shared sheet is never changed.

## Note

Scores and costs are 3CG estimates, not PRT figures. A real deployment would keep vendor ratings private and put the site behind a login.
