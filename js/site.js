/* ==========================================================
   site.js: shared header, navigation and footer
   Every page gets the same header and footer from here, so a
   change to NAV below updates the whole site at once.
   ========================================================== */

const SITE = {
  name: "3CG",
  fullName: "Carnegie Cyber Consulting Group",
  logo: "assets/3cg-logo.png",
  footerNote: "Student project for the CRM Group Project, Carnegie Mellon University, 2026. Built from public information."
};

/* Navigation. To add a page: add one line here.
   Optional: soon: true shows a "Soon" tag next to the link. */
const NAV = [
  { href: "index.html",         label: "Overview" },
  { href: "scorecard.html",     label: "Vendor Scorecard" },
  { href: "heatmap.html",       label: "Risk Heat Map" },
  { href: "fair.html",          label: "FAIR Calculator" }
];

function renderHeader() {
  const el = document.getElementById("site-header");
  if (!el) return;
  const page = location.pathname.split("/").pop() || "index.html";
  el.outerHTML = `
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="index.html">
          <img src="${SITE.logo}" alt="" width="34" height="42">
          <span class="brand-text">
            <span class="brand-short">${SITE.name}</span>
            <span class="brand-long">${SITE.fullName}</span>
          </span>
        </a>
        <nav class="site-nav" aria-label="Main">
          ${NAV.map(item => `
            <a href="${item.href}"${item.href === page ? ' aria-current="page"' : ""}>
              ${item.label}${item.soon ? '<span class="nav-soon">Soon</span>' : ""}
            </a>`).join("")}
        </nav>
      </div>
    </header>
    <div class="tartan tartan-band" aria-hidden="true"></div>`;
}

function renderFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;
  el.outerHTML = `
    <footer class="site-footer">
      <div class="tartan tartan-band thin" aria-hidden="true"></div>
      <div class="container footer-inner">
        <span>${SITE.name} - ${SITE.fullName}<br><span class="small">${SITE.footerNote}</span></span>
        <span id="data-source"></span>
      </div>
    </footer>`;
  if (typeof updateDataBadge === "function") updateDataBadge();
}

renderHeader();
renderFooter();
