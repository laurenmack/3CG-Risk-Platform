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

## Note

Scores and costs are 3CG estimates, not PRT figures. A real deployment would keep vendor ratings private and put the site behind a login.
