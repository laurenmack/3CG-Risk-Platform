/* ==========================================================
   heatmap.js: Risk Heat Map page
   Owner: [Name]

   Build your tool inside <div id="heatmap-app"> on heatmap.html.
   Load data with loadTable("tabName") from data.js, and wrap any
   sheet text in esc() before putting it on the page.
   Shared styles: see components.html.
   ========================================================== */

(async function () {
  const app = document.getElementById("heatmap-app");
  const dataBox = document.getElementById("heatmap-app-data");

  /* Shows which Google Sheet tabs loaded. Delete these two lines
     (and the heatmap-app-data div in heatmap.html) once your tool works. */
  await showDataCheck(dataBox, ["risks"]);

  /* TODO: build the Risk Heat Map here. Example:
     const rows = await loadTable("risks");
     app.innerHTML = rows.map(r => `<p>${esc(r[Object.keys(r)[0]])}</p>`).join("");
  */
})();
