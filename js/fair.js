/* FAIR Calculator (3CG): isolated to fair.html, uses shared loadTables() and esc().
   Revenue and wages sourced; scenario/control parameters are synthetic.
   FAIR-style deterministic approximation; does not claim full distribution-based FAIR. */
(function () {
  "use strict";
  const app = document.getElementById("fair-app");
  if (!app) return;
  const errorBox = document.getElementById("fair-error");
  const dollars = v => new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
  const pct = v => `${(v * 100).toFixed(1)}%`;
  let chart = null;
  let data = null;
  let selectedRisk = "R1";
  let selectedCase = "base";

  function num(raw, label, min=0, max=Infinity) {
    const n = toNumber(raw);
    if (n === null || !Number.isFinite(n) || n < min || n > max) {
      throw new Error(`Invalid ${label}: ${raw}`);
    }
    return n;
  }
  function calc(row, parameters, control, overrides={}) {
    const p = Object.fromEntries(parameters.map(r => [r.key, num(r.value, r.key)]));
    const value = (name,min=0,max=Infinity) => num(overrides[name] ?? row[name], name,min,max);
    const tef=value("tef_per_year");
    const susceptibility=value("susceptibility",0,1);
    const days=value("outage_days");
    const exposure=value("affected_fare_share",0,1);
    const unrecoverable=value("unrecoverable_fraction",0,1);
    const itHours=value("it_hours");
    const supportHours=value("support_hours");
    const external=value("external_response_usd");
    const manual=value("manual_ops_usd");
    const secondaryProbability=value("secondary_probability",0,1);
    const conditionalSecondary=value("secondary_cost_if_occurs_usd");
    const fareLoss=(p.annual_fare_revenue_usd/p.days_per_year)*days*exposure*unrecoverable;
    const labor=(itHours*p.it_hourly_wage_usd + supportHours*p.support_hourly_wage_usd)*p.loaded_labor_multiplier;
    const primary=fareLoss+labor+external+manual;
    const expectedSecondary=secondaryProbability*conditionalSecondary;
    const magnitude=primary+expectedSecondary;
    const lef=tef*susceptibility;
    const before=lef*magnitude;
    const postTef=num(control.post_tef_multiplier,"post_tef_multiplier",0);
    const postSus=num(control.post_susceptibility_multiplier,"post_susceptibility_multiplier",0,1);
    const postMag=num(control.post_magnitude_multiplier,"post_magnitude_multiplier",0,1);
    const after=lef*postTef*postSus*magnitude*postMag;
    const annualReduction=before-after;
    const years=p.analysis_years;
    const cost=num(control.initial_cost_usd,"initial_cost_usd")+years*num(control.annual_cost_usd,"annual_cost_usd");
    const net=annualReduction*years-cost;
    return {fareLoss,labor,primary,expectedSecondary,magnitude,lef,before,after,annualReduction,cost,net,years};
  }
  const pick = (id) => document.getElementById(id);
  function readOverrides() {
    const fields=["tef_per_year","susceptibility","outage_days","affected_fare_share","unrecoverable_fraction","it_hours","support_hours","external_response_usd","manual_ops_usd","secondary_probability","secondary_cost_if_occurs_usd"];
    return Object.fromEntries(fields.map(k => [k,pick(`fair-${k}`).value]));
  }
  function validateTables(rows) {
    const cols={fairParameters:["key","value"],fairScenarios:["risk_id","case","tef_per_year","susceptibility","outage_days","affected_fare_share","unrecoverable_fraction","it_hours","support_hours","external_response_usd","manual_ops_usd","secondary_probability","secondary_cost_if_occurs_usd","control_id"],fairControls:["control_id","initial_cost_usd","annual_cost_usd","post_tef_multiplier","post_susceptibility_multiplier","post_magnitude_multiplier"]};
    Object.entries(cols).forEach(([name,required]) => {
      if (!rows[name]?.length) throw new Error(`Missing or empty ${name} table`);
      required.forEach(col => {if (!(col in rows[name][0])) throw new Error(`Missing column ${col} in ${name}`);});
    });
  }
  function getRow() {
    const row=data.fairScenarios.find(r=>r.risk_id===selectedRisk&&r.case===selectedCase);
    if (!row) throw new Error("Selected scenario not found");
    const control=data.fairControls.find(c=>c.control_id===row.control_id);
    if (!control) throw new Error(`Missing control ${row.control_id}`);
    return {row,control};
  }
  function field(key,title,step="any") {
    return `<div class="field"><label for="fair-${key}">${esc(title)}</label><input type="number" id="fair-${key}" step="${step}" min="0" value="0"></div>`;
  }
  function renderShell() {
    const risks=[...new Map(data.fairScenarios.map(r=>[r.risk_id,r.risk_name])).entries()];
    app.innerHTML=`
      <div class="card fair-panel">
        <h2>1. Choose an incident</h2>
        <div class="fair-controls">
          <div class="field"><label for="fair-risk">Cyber risk</label><select id="fair-risk">${risks.map(([id,name])=>`<option value="${esc(id)}">${esc(id)} · ${esc(name)}</option>`).join("")}</select></div>
          <div class="field"><label for="fair-case">Scenario</label><select id="fair-case"><option value="low">Low</option><option value="base" selected>Base</option><option value="high">High stress test</option></select></div>
        </div>
        <p class="fair-note">Low, base and high are hypothetical scenarios, not statistically measured percentiles.</p>
      </div>
      <div class="card fair-panel"><h2>2. Adjust risk assumptions</h2>
        <div class="fair-controls">
          ${field("tef_per_year","Threat events / year","0.01")}
          ${field("susceptibility","Susceptibility (0–1)","0.01")}
          ${field("outage_days","Outage days","0.5")}
          ${field("affected_fare_share","Share of PRT fare revenue affected (0–1)","0.01")}
          ${field("unrecoverable_fraction","Unrecoverable share (0–1)","0.01")}
          ${field("it_hours","IT response hours","1")}
          ${field("support_hours","Customer support hours","1")}
          ${field("external_response_usd","Forensic / vendor costs ($)","100")}
          ${field("manual_ops_usd","Temporary operations costs ($)","100")}
          ${field("secondary_probability","Secondary loss probability (0–1)","0.01")}
          ${field("secondary_cost_if_occurs_usd","Secondary cost if triggered ($)","100")}
        </div>
        <div class="fair-actions"><button type="button" class="btn" id="fair-recalculate">Recalculate</button><button type="button" class="btn btn-outline" id="fair-reset">Reset to sheet values</button><span id="fair-input-error" role="alert" class="fair-note"></span></div>
      </div>
      <div class="fair-stat-grid" id="fair-stats"></div>
      <div class="card fair-panel"><h2>3. Annual financial risk</h2><div class="fair-chart-container"><canvas id="fair-chart" aria-label="Annual loss before and after controls" role="img"></canvas></div>
        <div id="fair-results"></div></div>
      <div class="card fair-panel"><h2>4. How the estimate is built</h2><div id="fair-breakdown"></div></div>
      <div class="card fair-panel"><h2>5. What is real versus assumed?</h2><div id="fair-evidence"></div></div>
    `;
    pick("fair-risk").addEventListener("change",ev=>{selectedRisk=ev.target.value;applyScenario();});
    pick("fair-case").addEventListener("change",ev=>{selectedCase=ev.target.value;applyScenario();});
    pick("fair-recalculate").addEventListener("click",recalculate);
    pick("fair-reset").addEventListener("click",applyScenario);
    applyScenario();
  }
  function applyScenario() {
    try {
      const {row}=getRow();
      pick("fair-risk").value=selectedRisk;
      pick("fair-case").value=selectedCase;
      Object.keys(readOverrides()).forEach(k=>{const n=toNumber(row[k]);pick(`fair-${k}`).value=n===null?"":n;});
      recalculate();
    } catch(err){showError(err);}
  }
  function recalculate() {
    try {
      const {row,control}=getRow();
      const overrides=readOverrides();
      const result=calc(row,data.fairParameters,control,overrides);
      pick("fair-input-error").textContent="";
      const cards=[
        ["Loss per incident",result.magnitude],
        ["Expected annual loss · before",result.before],
        ["Expected annual loss · after",result.after],
        ["Annual risk reduction",result.annualReduction],
        [`${result.years}-year control cost`,result.cost],
        [`${result.years}-year net benefit`,result.net]
      ];
      pick("fair-stats").innerHTML=cards.map(([label,value])=>`<div class="card stat"><span class="stat-value">${dollars(value)}</span><span class="stat-label">${esc(label)}</span></div>`).join("");
      pick("fair-results").innerHTML=`<div class="table-wrap"><table><tbody><tr><th>Loss event frequency</th><td class="num">${result.lef.toFixed(3)} events/year</td></tr><tr><th>Annualized loss exposure (ALE)</th><td class="num">${dollars(result.before)}</td></tr><tr><th>Residual ALE after control</th><td class="num">${dollars(result.after)}</td></tr><tr><th>Control: ${esc(control.control_name)}</th><td class="num">${dollars(result.cost)} over ${result.years} years</td></tr><tr><th>Undiscounted net benefit</th><td class="num">${dollars(result.net)}</td></tr></tbody></table></div>`;
      pick("fair-breakdown").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Component (per loss event)</th><th class="num">Estimated USD</th></tr></thead><tbody><tr><td>Unrecoverable passenger fares</td><td class="num">${dollars(result.fareLoss)}</td></tr><tr><td>IT + support labor (wages × loaded factor)</td><td class="num">${dollars(result.labor)}</td></tr><tr><td>Forensics, restoration and temporary operations</td><td class="num">${dollars(result.primary-result.fareLoss-result.labor)}</td></tr><tr><td>Expected secondary losses (probability × conditional cost)</td><td class="num">${dollars(result.expectedSecondary)}</td></tr><tr><th>Total expected loss magnitude</th><th class="num">${dollars(result.magnitude)}</th></tr></tbody></table></div><p class="fair-note">ALE = Threat Event Frequency × Susceptibility × Loss Magnitude. Post-control ALE uses the three synthetic multipliers in the Controls sheet. Net benefit = risk reduction × ${result.years} years − initial/recurring control costs.</p>`;
      const src=data.fairSources;
      const fareValue=data.fairParameters.find(p=>p.key==="annual_fare_revenue_usd");
      pick("fair-evidence").innerHTML=`<p><strong>Measured/public:</strong> FY2025 agency-wide NTD-derived fare revenue ${dollars(num(fareValue.value,"annual_fare_revenue_usd"))}; May 2025 Pittsburgh wage averages used as labor proxies. <strong>Not measured:</strong> affected revenue share, outage days, attack frequency, susceptibility, cost assumptions, secondary claims and control effectiveness.</p><p class="fair-risk-flag"><strong>Do not interpret these estimates as actual PRT losses.</strong> Fare revenue is agency-wide rather than exclusively ReadyFare; unrelated scenarios can overlap, and an NTD figure is different from audited passenger fares.</p><h3>Source references</h3><ul class="fair-sources">${src.filter(s=>s.url).map(s=>`<li><a target="_blank" rel="noopener noreferrer" href="${esc(s.url)}">${esc(s.title)}</a></li>`).join("")}</ul><p class="fair-note">FAIR calculator inputs are loaded from published Google Sheets CSV data. Changes made in the browser are temporary and are not saved back to Google Sheets.</p>`;
      updateChart(result);
    } catch(err){pick("fair-input-error").textContent=err.message;}
  }
  function updateChart(result) {
    const canvas=pick("fair-chart");
    if(typeof Chart==="undefined"){
      canvas.style.display="none";
      if (!pick("fair-chart-fallback")) {
        const note=document.createElement("p");note.id="fair-chart-fallback";note.textContent="Chart.js unavailable. Annual totals are displayed above.";canvas.parentNode.appendChild(note);
      }
      return;
    }
    if(chart){chart.destroy();chart=null;}
    chart=new Chart(canvas,{type:"bar",data:{labels:["Before security controls","After security controls"],datasets:[{label:"Annualized loss ($)",data:[result.before,result.after],backgroundColor:["#c41230","#00773a"],borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:context=>dollars(context.parsed.y)}}},scales:{y:{beginAtZero:true,ticks:{callback:value=>"$"+(value/1000).toFixed(0)+"k"}}}}});
  }
  function showError(err) { console.error(err);errorBox.hidden=false;errorBox.textContent=err.message;}
  (async()=>{
    try {
      const [fairParameters,fairScenarios,fairControls,fairSources]=await loadTables(["fairParameters","fairScenarios","fairControls","fairSources"]);
      data={fairParameters,fairScenarios,fairControls,fairSources};
      validateTables(data);
      renderShell();
    } catch(err){app.innerHTML="";showError(new Error(`FAIR calculator could not load: ${err.message}`));}
  })();
})();
