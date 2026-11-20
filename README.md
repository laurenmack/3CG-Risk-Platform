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
| `data/*.csv` | Sample copies of the sheet tabs, used until the sheet is linked. Exception: `data/risks.csv` is the Risk Heat Map's real data (see below). |
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

**Where the data comes from.** The heat map reads **`data/risks.csv` in this repository**, both on your computer and on
GitHub Pages. No Google Sheet is involved: `js/data.js` lists `risks` under `REPO_FILES`, so `loadTable("risks")` reads
that file directly. The page labels it **"Repository CSV"**. Vendor display names still come from the team's Vendors
tab, like the Vendor Scorecard.

**How a change reaches the published site.** The site is published by GitHub Pages from the `main` branch
(<https://laurenmack.github.io/3CG-Risk-Platform/heatmap.html>).
1. Edit `data/risks.csv` on a branch. On GitHub you can open the file, click the pencil icon, and choose
   "Create a new branch and start a pull request".
2. Open a pull request and have a teammate review it.
3. Merge it into `main`. GitHub Pages rebuilds the site by itself; you can watch "pages build and deployment" in the
   **Actions** tab. GitHub's servers may keep the old file for up to 10 minutes, so reload the page after that.

Until the change is merged, the published site keeps showing the old values. A local copy shows your edits as soon as you save the file.

**Columns in `data/risks.csv`.** There is one row per risk, matched by `risk_id` (R1–R13). Keep the header names exactly as they are.

| Column | What to put in it |
|---|---|
| `likelihood` | Whole number from 1 to 5; higher means more likely |
| `impact` | Whole number from 1 to 5; higher means more damage |
| `notes` | Short English reason for the ratings |
| `vendor_tier` | The related vendor's tier copied from the Vendor Scorecard (`High`, `Medium`, `Low`), or blank. It is a copy, not a link. |
| `adjusted_likelihood` | Calculated: see the rules below |
| `risk_score` | Calculated: see the rules below |

**Keep the calculated columns consistent.** A CSV file stores values, not formulas, so nothing recalculates
`adjusted_likelihood` and `risk_score` for you. The page plots exactly what the file says. Whenever you change `likelihood`,
`impact` or `vendor_tier`, recalculate both in the same row:

- `adjusted_likelihood` = `likelihood + 1` if `vendor_tier` is `High`, otherwise `likelihood`. There is no cap, so 5 becomes 6.
- `risk_score` = `adjusted_likelihood × impact`.
- Example: R2 has likelihood 3, impact 3 and a High-tier vendor (Masabi), so adjusted likelihood is 4 and the score is 12.
- If a vendor's tier changes on the Vendor Scorecard, update `vendor_tier` and both calculated columns in **every** row
  with that `related_vendor_id`.
- Editing in Excel or Google Sheets is fine; you can use formulas while you edit. Save as **CSV UTF-8**, then check the numbers
  in the saved file before committing. `npm test` (below) flags any row that breaks these two rules.
- Leaving a score cell blank moves that risk to **Awaiting scores** instead of the map.

**How scores are plotted.**
- Impact runs left to right (1–5). Adjusted likelihood runs bottom to top (1–6).
- Each risk ID sits in the cell for its values in the file, and risks that share a cell are all shown.
- Cell color shows the score band: Low 1–4, Moderate 5–9, High 10–14, Critical 15–30.
- Click an ID to see its name, category, vendor, base and adjusted likelihood, impact, score, and notes.
- A row with a blank or invalid `likelihood`, `impact`, `adjusted_likelihood` or `risk_score` isn't plotted.
  It appears under **Awaiting scores** with the missing fields.

**Run it locally.** In this folder, run `python -m http.server 8000` (or `python3 ...`), then open
`http://localhost:8000` and choose **Risk Heat Map** in the menu. VS Code Live Server works too.

**Run the heat map tests.** These are optional and need Node.js and Google Chrome; the site itself needs no install.
1. In one terminal, run `python -m http.server 8765` in this folder.
2. In a second terminal, run `cd tests`, then `npm install`, then `npm test`.

The script first checks that every row of `data/risks.csv` follows the two rules above. It then opens the site in headless
Chrome and checks:
- the browser loads `data/risks.csv` and requests no Google Sheet other than the team's Vendor Scorecard tabs;
- all 13 risks appear exactly once;
- the map works on a phone-sized screen;
- missing scores, a risk file that fails to load, and an adjusted likelihood of 6 are handled.

Section 1 expects the reviewed values for R1, R4, R5, R11 and R13. If those ratings change, update the expected values in
`tests/heatmap.test.js`.

## Note

Scores and costs are 3CG estimates, not PRT figures. A real deployment would keep vendor ratings private and put the site behind a login.
