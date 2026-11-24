# 3CG Risk Platform
 
**3CG - Carnegie Cyber Consulting Group** · CRM Group Project, Carnegie Mellon University, 2026
 
A website with three linked tools for assessing the cyber risk of Pittsburgh Regional Transit's (PRT) switch from ConnectCard to ReadyFare.
 
**Live site:** https://laurenmack.github.io/3CG-Risk-Platform/
 
> Built from public information for a class project. Scores and costs are 3CG estimates, not PRT figures.
 
---
 
## The tools
 
| Tool | What it shows |
|---|---|
| **Vendor Scorecard** | How much risk each of PRT's five fare vendors brings, scored 1 (lower) to 5 (higher) and grouped into High, Medium and Low |
| **Risk Heat Map** | 13 risks placed by likelihood and impact. Risks tied to a High-risk vendor move up one step in likelihood |
| **FAIR Cost Calculator** | What the top risks could cost PRT in dollars, and whether a security control pays for itself |
 
---
 
## Using the site
 
1. Start on **Overview** to see the three tools and how they connect.
2. On **Vendor Scorecard**, click a tier at the top to filter the vendors, and click **See why** on any vendor to see the reason, evidence and source behind each score.
3. On **Risk Heat Map**, the top-right boxes are the most likely and most damaging risks. Click a risk ID to see its details.
4. On **FAIR Calculator**, pick a risk and a low, base or high scenario. You can change any number and click **Recalculate** to test your own assumptions; this doesn't change the saved data.
---
 
## Updating the data
 
All of the data lives in **one Google Sheet**. Change the sheet and the website updates within a few minutes. No code needed.
 
**In the sheet, only edit the yellow cells with blue text.** Other cells are formulas that update on their own.
 
| To change… | Edit this tab |
|---|---|
| A vendor's scores | **Vendors** (scores 1–5). Its weighted score and tier update automatically, and so do its risks on the heat map |
| Why a vendor got a score | **Score_Reasons** (reason, evidence level, source link) |
| How much each criterion counts | **Weights** (must add up to 100%; the README tab shows a check) |
| The High / Medium / Low cutoffs | **Tiers** |
| A risk's likelihood or impact | **Risks** (whole numbers 1–5) |
| FAIR assumptions or controls | **fair_scenarios** and **fair_controls** |
| Fare revenue and wage figures | **fair_parameters** (only change with a new source) |
 
**Three rules so nothing breaks:**
- Don't rename tabs or column headers.
- Don't add notes, totals or empty rows inside the data. Put notes on the README tab.
- Keep IDs the same everywhere (vendors: `masabi`, `processor`, `digi`, `flowbird`, `sb`; risks: `R1`–`R13`).
To see a change on the site, wait a few minutes and refresh the page.
 
---
 
## Changing the website
 
The easiest way to edit is **github.dev**: press `.` on the repository page, edit the file, then click the **Source Control** icon, add a short message and click **Commit & Push**. The live site updates in 1–2 minutes.
 
| To change… | Edit |
|---|---|
| Page text (titles, intros) | The page's `.html` file: `index.html`, `scorecard.html`, `heatmap.html` or `fair.html` |
| Colors and fonts | The top of `css/style.css` |
| Menu, header text or footer note | `js/site.js` |
| Logo | Replace `assets/3cg-logo.png` with a new image of the same name |
| Which Google Sheet the site reads | `js/data.js` (see below) |
 
Keep the `.html` pages at the top level of the repository, and the other files in their folders (`css`, `js`, `data`, `assets`). Moving them breaks the links between them.
 
---
 
## Connecting the Google Sheet
 
The links to the sheet are at the top of `js/data.js`.
 
1. In the Google Sheet, go to **File → Share → Publish to web**, choose **Entire Document** and **Comma-separated values (.csv)**, and click **Publish**. Leave **Automatically republish when changes are made** on.
2. In the link it gives you, copy the part between `/e/` and `/pub` (it starts with `2PACX-`). Paste it as `PUB` in `js/data.js`.
3. For each tab, click it in the sheet and copy the number after `#gid=` in the address bar. Paste it on that tab's line in `js/data.js`.
The site keeps saved copies of the data in the `data` folder. If Google Sheets can't be reached, the site uses them and says so. When the sheet changes a lot, update them by downloading each tab (**File → Download → CSV**) into the `data` folder with the same file name.
 
---
 
## If something looks wrong
 
| Problem | Fix |
|---|---|
| The site still shows an old version | Hard refresh (Cmd/Ctrl + Shift + R), or open it in a private window |
| A change in the sheet isn't showing | Wait a few minutes for Google to republish, then refresh |
| The footer says **Sample data**, or the heat map says **Backup data** | The site can't reach the sheet. Check that it's still published, and check the numbers in `js/data.js` |
| The page has no colors or red header | A file is in the wrong folder. Check that `css/style.css` and `js/site.js` are where they belong |
| A risk is listed under **Awaiting scores** | Its likelihood or impact is blank or not a whole number 1–5 |
| A number looks wrong | Check the sheet first; the site only shows what's there |
 
---
 
## Team
 
| Member | Built |
|---|---|
| Lauren Mack | Vendor Scorecard and website |
| Yihao Ma | Risk Heat Map |
| Vismitha Suresh | FAIR Cost Calculator |
 
Method sources: NIST Cybersecurity Framework 2.0, NIST SP 800-161 Rev. 1, CISA/FBI Secure by Demand, APTA transit cybersecurity guidance and FAIR. Full citations are in the final report.
 
