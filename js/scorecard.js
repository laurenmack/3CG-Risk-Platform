/* ==========================================================
   scorecard.js: Vendor Scorecard page
   Owner: [Name]

   Build your tool inside <div id="scorecard-app"> on scorecard.html.
   Load data with loadTable("tabName") from data.js, and wrap any
   sheet text in esc() before putting it on the page.
   Shared styles: see components.html.
   ========================================================== */

(async function () {
  const app = document.getElementById("scorecard-app");
  const dataBox = document.getElementById("scorecard-app-data");

  /* Shows which Google Sheet tabs loaded. Delete these two lines
     (and the scorecard-app-data div in scorecard.html) once your tool works. */
  await showDataCheck(dataBox, ["vendors", "scoreReasons", "weights", "tiers"]);

  /* TODO: build the Vendor Scorecard here. Example:
     const rows = await loadTable("vendors");
     app.innerHTML = rows.map(r => `<p>${esc(r[Object.keys(r)[0]])}</p>`).join("");
  */
})();
