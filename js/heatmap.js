/* ==========================================================
   heatmap.js: Risk Heat Map page
   Owner: Yihao Ma

   Reads the Risks tab of the PRT-risks Google Sheet with loadTable("risks")
   (link in data.js) every time the page opens or is refreshed. If the
   sheet can't be reached, it uses the reviewed copy in data/risks.csv.
   Each risk is placed by impact (left to right) and adjusted likelihood
   (bottom to top). Adjusted likelihood and risk score come straight from
   the sheet's formula columns; this page does not recalculate them.
   Rows with blank or invalid scores are listed under "Awaiting scores"
   instead of being plotted.
   ========================================================== */

(async function () {
  const app = document.getElementById("heatmap-app");

  /* Date of the reviewed ratings saved in data/risks.csv (the backup copy).
     Update it whenever you replace that file. */
  const BACKUP_DATE = "20 November 2026";

  /* Base likelihood and impact are rated 1 to 5. Adjusted likelihood adds 1
     for High-tier vendors with no cap, so it can reach 6 (a base of 5 at a
     High-tier vendor). */
  const IMPACTS = [1, 2, 3, 4, 5];
  const LIKELIHOODS = [6, 5, 4, 3, 2, 1]; // top row first

  /* Color bands for each cell, by score (adjusted likelihood x impact, 1 to 30). */
  const BANDS = [
    { key: "critical", label: "Critical", min: 15, range: "15–30" },
    { key: "high",     label: "High",     min: 10, range: "10–14" },
    { key: "moderate", label: "Moderate", min: 5,  range: "5–9" },
    { key: "low",      label: "Low",      min: 1,  range: "1–4" }
  ];
  const bandFor = score => BANDS.find(b => score >= b.min) || BANDS[BANDS.length - 1];

  /* ---------- Load ---------- */
  let rows, vendors, isLive;
  try {
    [rows, vendors] = await Promise.all([
      loadTable("risks"),
      loadTable("vendors").catch(() => []) // only used for vendor display names
    ]);
    isLive = DATA_SOURCE.risks === "live";
    // A live reply without a risk_id column (for example a Google sign-in page if the
    // sheet's sharing changes) counts as a failed request: use the backup copy instead.
    if (isLive && !rows.some(r => "risk_id" in r)) {
      console.warn('[3CG] Live Risks tab has no "risk_id" column; using the backup copy.');
      rows = parseCSV(await fetchText(LOCAL_FILES.risks));
      isLive = false;
      DATA_STATUS.live--; DATA_STATUS.sample++; DATA_SOURCE.risks = "sample"; updateDataBadge();
    }
    if (!rows.some(r => "risk_id" in r)) throw new Error('The risk data has no "risk_id" column.');
  } catch (err) {
    app.innerHTML = `<div class="callout"><strong>The risk data didn't load.</strong>
      <p class="small muted">${esc(err.message)}</p></div>`;
    return;
  }
  const vendorNames = Object.fromEntries(
    vendors.filter(v => v.vendor_id).map(v => [v.vendor_id.trim(), v.vendor || v.vendor_id]));

  /* ---------- Prepare the rows ---------- */
  const SCORE_FIELDS = [
    { key: "likelihood",          label: "likelihood",          max: 5 },
    { key: "impact",              label: "impact",              max: 5 },
    { key: "adjusted_likelihood", label: "adjusted likelihood", max: 6 },
    { key: "risk_score",          label: "risk score",          max: 30 }
  ];

  const idNumber = id => parseInt(String(id).replace(/\D/g, ""), 10) || 0;
  const byId = (a, b) => idNumber(a.id) - idNumber(b.id) || a.id.localeCompare(b.id);

  const risks = rows
    .filter(r => (r.risk_id || "").trim() !== "")
    .map(r => {
      const missing = [], invalid = [], values = {};
      SCORE_FIELDS.forEach(f => {
        const raw = (r[f.key] ?? "").trim();
        const n = toNumber(raw);
        values[f.key] = n;
        if (raw === "") missing.push(f.label);
        else if (n === null || !Number.isInteger(n) || n < 1 || n > f.max)
          invalid.push(`${f.label} "${raw}" is not a whole number from 1 to ${f.max}`);
      });
      return {
        id: r.risk_id.trim(),
        row: r,
        base: values.likelihood,
        impact: values.impact,
        adj: values.adjusted_likelihood,
        score: values.risk_score,
        missing, invalid,
        complete: missing.length === 0 && invalid.length === 0
      };
    })
    .sort(byId);

  const plotted = risks.filter(r => r.complete);
  const awaiting = risks.filter(r => !r.complete);
  const riskById = Object.fromEntries(risks.map(r => [r.id, r]));

  /* ---------- Small helpers ---------- */
  const chip = r => `
    <button type="button" class="hm-chip" data-id="${esc(r.id)}" aria-pressed="false"
      title="${esc(r.row.risk_name)}"
      aria-label="${esc(r.id)}: ${esc(r.row.risk_name)}${r.complete ? `, score ${r.score}` : ", awaiting scores"}">${esc(r.id)}</button>`;

  const show = v => (v === null || v === undefined ? '<span class="muted">Not scored</span>' : esc(v));

  /* ---------- Data source banner ---------- */
  const loadedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const statusHTML = isLive
    ? `<div class="callout callout-info hm-status" data-source="live" role="status">
         <strong>Live data.</strong> Read from the Risks tab of the PRT-risks Google Sheet at ${esc(loadedAt)}.
         Refresh the page after editing the sheet to see the changes.
       </div>`
    : `<div class="callout callout-warn hm-status" data-source="backup" role="status">
         <strong>Backup data.</strong> The PRT-risks Google Sheet could not be reached, so this map shows the
         reviewed ratings saved on ${esc(BACKUP_DATE)} (<code>data/risks.csv</code>).
         Sheet edits are not shown. Refresh the page to try the live sheet again.
       </div>`;

  const countsHTML = `
    <p class="hm-counts">
      <strong>${plotted.length}</strong> of ${risks.length} risks plotted ·
      <strong>${awaiting.length}</strong> awaiting scores
    </p>`;

  /* ---------- Matrix ---------- */
  let gridHTML = "";
  LIKELIHOODS.forEach(l => {
    gridHTML += `<div class="hm-tick hm-tick-y${l === 6 ? " hm-tick-extra" : ""}" aria-hidden="true">${l}</div>`;
    IMPACTS.forEach(i => {
      const here = plotted.filter(r => r.adj === l && r.impact === i);
      const cellScore = l * i;
      const band = bandFor(cellScore);
      gridHTML += `
        <div class="hm-cell band-${band.key}" role="group" data-likelihood="${l}" data-impact="${i}"
          aria-label="Adjusted likelihood ${l}, impact ${i}, score ${cellScore} (${band.label}): ${here.length
            ? here.map(r => r.id).join(", ") : "no risks"}">
          <span class="hm-cell-score" aria-hidden="true">${cellScore}</span>
          ${here.length ? `<div class="hm-chips">${here.map(chip).join("")}</div>` : ""}
        </div>`;
    });
  });
  gridHTML += `<div class="hm-corner" aria-hidden="true"></div>` +
    IMPACTS.map(i => `<div class="hm-tick hm-tick-x" aria-hidden="true">${i}</div>`).join("");

  const legendHTML = `
    <div class="hm-legend">
      <span class="hm-legend-title">Score = adjusted likelihood × impact</span>
      <ul class="hm-legend-list">
        ${BANDS.slice().reverse().map(b => `
          <li><span class="hm-swatch band-${b.key}" aria-hidden="true"></span>${b.label} <span class="muted">${b.range}</span></li>`).join("")}
      </ul>
      <p class="small muted">A risk tied to a High-tier vendor moves up one likelihood step. The top row (6) can only be
        reached that way, from a base likelihood of 5.</p>
    </div>`;

  /* ---------- Awaiting scores ---------- */
  const awaitingHTML = `
    <section class="hm-awaiting" aria-labelledby="hm-awaiting-h">
      <h3 id="hm-awaiting-h">Awaiting scores <span class="badge ${awaiting.length ? "status-progress" : "status-ready"}">${awaiting.length}</span></h3>
      ${awaiting.length ? `
        <p class="small muted">These rows have blank or invalid values in the sheet, so they are not on the map yet.</p>
        <ul class="hm-awaiting-list">
          ${awaiting.map(r => `
            <li data-id="${esc(r.id)}">
              ${chip(r)}
              <span class="hm-awaiting-text">
                <span>${esc(r.row.risk_name)}</span>
                <span class="small muted">${[
                  r.missing.length ? `Missing: ${r.missing.join(", ")}` : "",
                  ...r.invalid
                ].filter(Boolean).map(esc).join(". ")}</span>
              </span>
            </li>`).join("")}
        </ul>`
      : `<p class="small muted">None. All ${risks.length} risks have complete scores.</p>`}
    </section>`;

  /* ---------- Page ---------- */
  app.innerHTML = `
    ${statusHTML}
    ${countsHTML}
    <div class="hm-layout">
      <div class="hm-chart">
        <div class="hm-plot">
          <div class="hm-y-title" aria-hidden="true">Adjusted likelihood →</div>
          <div class="hm-grid" role="group" aria-label="Risk heat map: impact from left to right, adjusted likelihood from bottom to top">
            ${gridHTML}
          </div>
          <div class="hm-x-title" aria-hidden="true">Impact →</div>
        </div>
        ${legendHTML}
      </div>
      <aside class="hm-detail card" id="hm-detail" aria-live="polite" tabindex="-1">
        <p class="muted hm-detail-empty">Select a risk ID on the map to see its details.</p>
      </aside>
    </div>
    ${awaitingHTML}`;

  /* ---------- Detail panel ---------- */
  const detail = document.getElementById("hm-detail");

  function renderDetail(r) {
    const vendorId = (r.row.related_vendor_id || "").trim();
    const tier = (r.row.vendor_tier || "").trim();
    const vendor = vendorId
      ? `${esc(vendorNames[vendorId] || vendorId)}${tier ? ` <span class="muted">(${esc(tier)} tier)</span>` : ""}`
      : '<span class="muted">None</span>';

    let adjNote = "";
    if (r.base !== null && r.adj !== null) {
      const step = r.adj - r.base;
      adjNote = step === 0 ? "no vendor adjustment"
        : `${step > 0 ? "+" : ""}${step}${tier ? ` for ${esc(tier)}-tier vendor` : ""}`;
    }
    const band = r.complete ? bandFor(r.adj * r.impact) : null;

    detail.innerHTML = `
      <p class="eyebrow hm-detail-id">${esc(r.id)}${r.complete ? "" : " · Awaiting scores"}</p>
      <h3>${esc(r.row.risk_name)}</h3>
      <dl class="hm-facts">
        <dt>Category</dt><dd>${r.row.cia_category ? esc(r.row.cia_category) : '<span class="muted">None</span>'}</dd>
        <dt>Vendor</dt><dd>${vendor}</dd>
        <dt>Base likelihood</dt><dd class="mono" data-field="likelihood">${show(r.base)}</dd>
        <dt>Adjusted likelihood</dt><dd><span class="mono" data-field="adjusted_likelihood">${show(r.adj)}</span>${adjNote ? ` <span class="small muted">(${adjNote})</span>` : ""}</dd>
        <dt>Impact</dt><dd class="mono" data-field="impact">${show(r.impact)}</dd>
        <dt>Risk score</dt><dd><span class="mono hm-final" data-field="risk_score">${show(r.score)}</span>${band
          ? ` <span class="hm-band-tag"><span class="hm-swatch band-${band.key}" aria-hidden="true"></span>${band.label}</span>` : ""}</dd>
      </dl>
      <h4>Notes</h4>
      <p class="hm-notes">${r.row.notes ? esc(r.row.notes) : '<span class="muted">No notes yet.</span>'}</p>`;
  }

  function select(id) {
    const r = riskById[id];
    if (!r) return;
    app.querySelectorAll(".hm-chip").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
    renderDetail(r);
    // On narrow screens the panel sits below the map, so bring it into view.
    if (window.matchMedia("(max-width: 860px)").matches) {
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  app.addEventListener("click", e => {
    const btn = e.target.closest(".hm-chip");
    if (btn) select(btn.dataset.id);
  });
})();
