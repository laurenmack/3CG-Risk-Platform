/* ==========================================================
   scorecard.js: Vendor Scorecard page
   Owner: Lauren Mack

   Reads the Vendors, Score_Reasons, Weights and Tiers tabs.
   Scores, weights, tiers and colors all come from the Google Sheet,
   so changing the sheet changes this page. No code edits needed.
   ========================================================== */

(async function () {
  const app = document.getElementById("scorecard-app");
  const methodBox = document.getElementById("scorecard-method");

  let vendors, reasons, weights, tiers;
  try {
    [vendors, reasons, weights, tiers] = await loadTables(["vendors", "scoreReasons", "weights", "tiers"]);
  } catch (err) {
    app.innerHTML = `<div class="callout"><strong>The scorecard data didn't load.</strong>
      <p class="small muted">${esc(err.message)}</p></div>`;
    return;
  }

  /* ---------- Prepare the data ---------- */
  const criteria = weights
    .filter(w => w.criterion_key)
    .map(w => ({ ...w, weight: toNumber(w.weight) ?? 0 }));

  // Tiers sorted highest cutoff first: High, Medium, Low
  const tierList = tiers
    .filter(t => t.tier)
    .map(t => ({ ...t, min: toNumber(t.min_score) ?? 0 }))
    .sort((a, b) => b.min - a.min);

  const tierForScore = s => tierList.find(t => s >= t.min) || tierList[tierList.length - 1];

  vendors = vendors.filter(v => v.vendor_id);
  vendors.forEach(v => {
    // Use the sheet's weighted score; if it's blank, work it out from the weights.
    let s = toNumber(v.weighted_score);
    if (s === null) {
      s = criteria.reduce((sum, c) => sum + (toNumber(v[c.criterion_key]) ?? 0) * c.weight, 0);
      s = Math.round(s * 100) / 100;
    }
    v.score = s;
    v.tierInfo = tierList.find(t => t.tier === v.tier) || tierForScore(s);
  });
  vendors.sort((a, b) => b.score - a.score);

  /* ---------- Small helpers ---------- */
  const evidenceClass = level =>
    "ev-" + String(level || "unknown").toLowerCase().replace(/\s+/g, "-");

  const tierRule = (t, i) => {
    if (i === 0) return `score ${t.min.toFixed(1)} or higher`;
    if (t.min > 0) return `${t.min.toFixed(1)} to ${(tierList[i - 1].min - 0.01).toFixed(2)}`;
    return `below ${tierList[i - 1].min.toFixed(1)}`;
  };

  function dots(score) {
    if (score === null) return '<span class="muted">n/a</span>';
    let html = `<span class="sc-dots" aria-label="${score} out of 5">`;
    for (let i = 1; i <= 5; i++) html += `<span class="sc-dot${i <= score ? " on" : ""}"></span>`;
    return html + `</span><span class="sc-dot-num">${score}</span>`;
  }

  /* ---------- Tier tiles ---------- */
  const tilesHTML = `
    <div class="sc-tiles" role="group" aria-label="Filter vendors by risk tier">
      ${tierList.map((t, i) => {
        const n = vendors.filter(v => v.tierInfo.tier === t.tier).length;
        return `
          <button class="sc-tile" data-filter="${esc(t.tier)}" style="--tier:${esc(t.color_hex)}" aria-pressed="false">
            <span class="sc-tile-count">${n}</span>
            <span class="sc-tile-label">${esc(t.tier)} risk</span>
            <span class="sc-tile-rule">${tierRule(t, i)}</span>
          </button>`;
      }).join("")}
    </div>`;

  /* ---------- Vendor cards ---------- */
  const cardsHTML = vendors.map(v => {
    const pct = Math.max(0, Math.min(100, ((v.score - 1) / 4) * 100));
    const mine = reasons.filter(r => r.vendor_id === v.vendor_id);

    const rows = criteria.map(c => {
      const r = mine.find(x => x.criterion_key === c.criterion_key) || {};
      return `
        <tr>
          <th scope="row">${esc(c.criterion)}<span class="small muted sc-weight">${Math.round(c.weight * 100)}% of score</span></th>
          <td>${dots(toNumber(v[c.criterion_key]))}</td>
          <td>${esc(r.reason || "No reason recorded yet")}</td>
          <td><span class="evidence ${evidenceClass(r.evidence_level)}">${esc(r.evidence_level || "Unknown")}</span></td>
          <td>${r.source_url
            ? `<a href="${esc(r.source_url)}" target="_blank" rel="noopener">Source ↗</a>`
            : '<span class="muted">None</span>'}</td>
        </tr>`;
    }).join("");

    return `
      <article class="sc-vendor" data-tier="${esc(v.tierInfo.tier)}" style="--tier:${esc(v.tierInfo.color_hex)}">
        <div class="sc-head">
          <div>
            <h3>${esc(v.vendor)}</h3>
            <p class="muted">${esc(v.role)}</p>
          </div>
          <div class="sc-score">
            <span class="sc-score-num">${v.score.toFixed(2)}</span>
            <span class="sc-badge">${esc(v.tierInfo.tier)}</span>
          </div>
        </div>

        <div class="sc-meter" role="img" aria-label="Score ${v.score.toFixed(2)} out of 5">
          <div class="sc-track">
            ${tierList.filter(t => t.min > 0).map(t =>
              `<span class="sc-tick" style="left:${((t.min - 1) / 4) * 100}%"></span>`).join("")}
            <span class="sc-fill" style="width:${pct}%"></span>
          </div>
          <div class="sc-scale"><span>1 · lower risk</span><span>5 · higher risk</span></div>
        </div>

        <div class="sc-body">
          <div>
            <h4>What 3CG recommends</h4>
            <p>${esc(v.vendor_specific_action || "No recommendation yet")}</p>
          </div>
          <div class="sc-meta">
            <span>Evidence: <span class="evidence ${evidenceClass(v.overall_evidence)}">${esc(v.overall_evidence || "Unknown")}</span></span>
            <span class="small muted">Last reviewed ${esc(v.last_reviewed || "n/a")}</span>
          </div>
        </div>

        <details class="sc-why">
          <summary>See why it scored ${v.score.toFixed(2)}</summary>
          <p class="sc-tier-action"><strong>Standard ${esc(v.tierInfo.tier.toLowerCase())}-tier steps:</strong> ${esc(v.tierInfo.recommended_action)}</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Criterion</th><th>Score</th><th>Why</th><th>Evidence</th><th>Source</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </details>
      </article>`;
  }).join("");

  app.innerHTML = tilesHTML + `<div class="sc-list">${cardsHTML}</div>`;

  /* ---------- Click a tier tile to filter ---------- */
  app.querySelector(".sc-tiles").addEventListener("click", e => {
    const tile = e.target.closest(".sc-tile");
    if (!tile) return;
    const turnOn = tile.getAttribute("aria-pressed") !== "true";
    app.querySelectorAll(".sc-tile").forEach(t => t.setAttribute("aria-pressed", "false"));
    tile.setAttribute("aria-pressed", String(turnOn));
    app.querySelectorAll(".sc-vendor").forEach(card => {
      card.hidden = turnOn && card.dataset.tier !== tile.dataset.filter;
    });
  });

  /* ---------- "How we score" table ---------- */
  methodBox.innerHTML = `
    <table>
      <thead><tr><th>Criterion</th><th class="num">Weight</th><th>1 means</th><th>3 means</th><th>5 means</th></tr></thead>
      <tbody>
        ${criteria.map(c => `
          <tr>
            <th scope="row">${esc(c.criterion)}</th>
            <td class="num">${Math.round(c.weight * 100)}%</td>
            <td>${esc(c.score_1_means)}</td>
            <td>${esc(c.score_3_means)}</td>
            <td>${esc(c.score_5_means)}</td>
          </tr>`).join("")}
      </tbody>
    </table>
    <p class="small muted sc-tier-key">Tiers: ${tierList.map((t, i) =>
      `<span class="badge" style="background:${esc(t.color_hex)};color:#fff">${esc(t.tier)}</span> ${tierRule(t, i)}`).join(" · ")}</p>`;
})();
