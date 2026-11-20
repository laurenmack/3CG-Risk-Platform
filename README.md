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

**Where the data comes from.** The heat map reads the **Risks** tab of the team's Google Sheet (the same sheet as the
Vendor Scorecard), through the published CSV link in `SHEET_URLS.risks` in `js/data.js`. It fetches the sheet every time
the page opens or is refreshed. The client only edits the Google Sheet; a new rating needs no GitHub change or pull request.

**What the client updates in the Risks tab.** There is one row per risk, matched by `risk_id` (R1–R13). Don't rename the column headers.

| Column | Who fills it | Notes |
|---|---|---|
| `likelihood` | Client | Whole number from 1 to 5; higher means more likely |
| `impact` | Client | Whole number from 1 to 5; higher means more damage |
| `notes` | Client | Short English reason for the ratings |
| `vendor_tier` | Formula (gray) | Don't type over it |
| `adjusted_likelihood` | Formula (gray) | `likelihood + 1` when `vendor_tier` is High. Don't type over it. |
| `risk_score` | Formula (gray) | `adjusted_likelihood × impact`. Don't type over it. |

After editing the sheet, refresh the heat map. Google can take a few minutes to update the published CSV after an edit,
so wait a moment and refresh again if a change doesn't show yet. The sheet must stay published to the web
(**File > Share > Publish to web**) for the link to work.

**Live data, backup data and awaiting scores.**
- A banner above the map says **Live data** when the team's sheet loaded, or **Backup data** when it couldn't be reached.
- Backup data comes from `data/risks.csv`, which holds the reviewed ratings for all 13 risks (20 November 2026). The tests
  also use it as their sample data.
- To refresh the backup, download the Risks tab as CSV (**File > Download > Comma-separated values**), replace
  `data/risks.csv`, and update `BACKUP_DATE` in `js/heatmap.js`. Downloading it from the sheet keeps the calculated columns
  correct, and `npm test` checks them.
- If the live sheet loads but a row has a blank or invalid score, that risk isn't plotted. It appears under
  **Awaiting scores** with the missing fields.

**How scores are plotted.**
- Impact runs left to right (1–5). Adjusted likelihood runs bottom to top (1–6). A base likelihood of 5 at a High-tier
  vendor lands in row 6.
- Each risk ID sits in the cell for its values in the sheet; the page doesn't recalculate them. Risks that share a cell are all shown.
- Cell color shows the score band: Low 1–4, Moderate 5–9, High 10–14, Critical 15–30.
- Click an ID to see its name, category, vendor, base and adjusted likelihood, impact, score, and notes.

**Run it locally.** In this folder, run `python -m http.server 8000` (or `python3 ...`), then open
`http://localhost:8000` and choose **Risk Heat Map** in the menu. VS Code Live Server works too.

**Run the heat map tests.** These are optional and need Node.js and Google Chrome; the site itself needs no install.
1. In one terminal, run `python -m http.server 8765` in this folder.
2. In a second terminal, run `cd tests`, then `npm install`, then `npm test`.

The script opens the site in headless Chrome and checks:
- that the browser fetches the team sheet's Risks tab and no other Google Sheet;
- with the reviewed ratings served as the sheet's reply: all 13 risks appear once, R1, R5 and R13 score 20, and R11 scores 6;
- that when a second sheet reply changes a rating, the risk moves to its new cell after a refresh, with no code change;
- blank scores, a failed sheet request (backup data), phone-sized screens, and an adjusted likelihood of 6.

Only the first check reads the real sheet. The others replace the sheet's reply inside the test browser, so the shared
sheet is never changed. If the reviewed ratings in `data/risks.csv` change, update the expected values in `tests/heatmap.test.js`.

## Note

Scores and costs are 3CG estimates, not PRT figures. A real deployment would keep vendor ratings private and put the site behind a login.
