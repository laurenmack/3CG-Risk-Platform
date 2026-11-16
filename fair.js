/* ==========================================================
   fair.js: FAIR Calculator page
   Owner: [Name]

   Build your tool inside <div id="fair-app"> on fair.html.
   Load data with loadTable("tabName") from data.js, and wrap any
   sheet text in esc() before putting it on the page.
   Shared styles: see components.html.
   ========================================================== */

(async function () {
  const app = document.getElementById("fair-app");
  const dataBox = document.getElementById("fair-app-data");

  /* Shows which Google Sheet tabs loaded. Delete these two lines
     (and the fair-app-data div in fair.html) once your tool works. */
  await showDataCheck(dataBox, ["fair"]);

  /* TODO: build the FAIR Calculator here. Example:
     const rows = await loadTable("fair");
     app.innerHTML = rows.map(r => `<p>${esc(r[Object.keys(r)[0]])}</p>`).join("");
  */
})();
