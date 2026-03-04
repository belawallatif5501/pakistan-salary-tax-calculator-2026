// =========================
// Branding (PDF + Copy)
// =========================
const TAX_YEAR_LABEL = "Tax Year 2026";
const BRAND_URL = "https://salary-tax-calculator.daybook.com.pk/";

// ✅ Local logo for web header + PDF
// Put file at: ./assets/logo.png
const LOGO_LOCAL = "./assets/logo.png";

const ONE_LINE_DISCLAIMER =
  "Estimate only — allocation is for transparency; actual payroll withholding may vary; rounding differences may occur; refer to official FBR law/notifications for final position (no liability assumed).";

// -------------------------
// State (for Copy/CSV/PDF)
// -------------------------
const state = {
  inputs: null,
  mode: null, // "monthly" | "annual"
  taxableIncome: 0,
  totalTax: 0,
  effectiveMonths: 0,
  appliedSlab: null,
  slabMathPlain: "",
  surchargeApplied: false,
  schedule: []
};

// -------------------------
// Utils
// -------------------------
function parseLocalInputDate(value) {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatDateSafe(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampDate(d, min, max) {
  return new Date(Math.min(Math.max(d.getTime(), min.getTime()), max.getTime()));
}

function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function monthName(m0) {
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m0];
}

function formatPKR(n) {
  return (Math.round(n)).toLocaleString("en-PK");
}

function safePdfText(s) {
  return String(s || "")
    .replace(/[×✕]/g, "x")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function setText(id, text){ document.getElementById(id).textContent = text; }
function setHTML(id, html){ document.getElementById(id).innerHTML = html; }

function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1200);
}

function enableExports(enabled){
  document.getElementById("copyBtn").disabled = !enabled;
  document.getElementById("csvBtn").disabled = !enabled;
  document.getElementById("pdfBtn").disabled = !enabled;
}

function cleanFilePart(s){
  return String(s || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildExportBaseName(){
  const i = state.inputs || {};
  const parts = [];

  const n = cleanFilePart(i.empName);
  const c = cleanFilePart(i.companyName);
  if (n) parts.push(n);
  if (c) parts.push(c);

  parts.push(TAX_YEAR_LABEL);
  parts.push(formatDateSafe(new Date())); // today's date

  // Example:
  // "Belawal Latif - HBS Parking Solutions - Tax Year 2026 - 2026-03-02"
  return parts.join(" - ");
}

// -------------------------
// Slabs (TY 2026)
// -------------------------
const SLABS_TY2026 = [
  { id: 1, label: "Up to 600,000",         lo: 0,        hi: 600000,   fixed: 0,      rate: 0.00, base: 0,
    formula: "0" },
  { id: 2, label: "600,001 – 1,200,000",   lo: 600000,   hi: 1200000,  fixed: 0,      rate: 0.01, base: 600000,
    formula: "1% of (Income - 600,000)" },
  { id: 3, label: "1,200,001 – 2,200,000", lo: 1200000,  hi: 2200000,  fixed: 6000,   rate: 0.11, base: 1200000,
    formula: "6,000 + 11% of (Income - 1,200,000)" },
  { id: 4, label: "2,200,001 – 3,200,000", lo: 2200000,  hi: 3200000,  fixed: 116000, rate: 0.23, base: 2200000,
    formula: "116,000 + 23% of (Income - 2,200,000)" },
  { id: 5, label: "3,200,001 – 4,100,000", lo: 3200000,  hi: 4100000,  fixed: 346000, rate: 0.30, base: 3200000,
    formula: "346,000 + 30% of (Income - 3,200,000)" },
  { id: 6, label: "Above 4,100,000",       lo: 4100000,  hi: Infinity, fixed: 616000, rate: 0.35, base: 4100000,
    formula: "616,000 + 35% of (Income - 4,100,000)" },
];

function getAppliedSlab(income) {
  if (income <= 600000) return SLABS_TY2026[0];
  for (const s of SLABS_TY2026) {
    if (income > s.lo && income <= s.hi) return s;
    if (s.hi === Infinity && income > s.lo) return s;
  }
  return SLABS_TY2026[0];
}

function salaryTaxTY2026(income) {
  const slab = getAppliedSlab(income);
  let tax = 0;

  if (slab.id === 1) tax = 0;
  else tax = slab.fixed + (income - slab.base) * slab.rate;

  const surchargeApplied = income > 10000000;
  if (surchargeApplied) tax = tax + (tax * 0.09);

  return { tax, slab, surchargeApplied };
}

function renderSlabTable(appliedSlabId) {
  const tbody = document.getElementById("slabTbody");
  tbody.innerHTML = "";

  for (const s of SLABS_TY2026) {
    const tr = document.createElement("tr");
    if (s.id === appliedSlabId) tr.className = "trApplied";

    const range = s.hi === Infinity
      ? `> ${formatPKR(s.lo)}`
      : `${formatPKR(s.lo + 1)} – ${formatPKR(s.hi)}`;

    tr.innerHTML = `
      <td>${s.label}<div style="color:#64748b;font-size:12px;margin-top:4px;">(${range})</div></td>
      <td class="rightAlign">PKR ${formatPKR(s.fixed)}</td>
      <td class="rightAlign">${Math.round(s.rate*100)}%</td>
      <td>${s.formula}</td>
    `;
    tbody.appendChild(tr);
  }
}

// -------------------------
// Month fractions (day-based)
// -------------------------
function computeMonthlyFractions(startDate, endDate) {
  const rows = [];
  let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  let total = 0;

  while (cur.getTime() <= endMonthStart.getTime()) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const dim = daysInMonth(y, m);

    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m, dim);

    const activeStart = new Date(Math.max(monthStart.getTime(), startDate.getTime()));
    const activeEnd = new Date(Math.min(monthEnd.getTime(), endDate.getTime()));

    let fraction = 0;
    if (activeStart.getTime() <= activeEnd.getTime()) {
      const daysWorked = Math.floor((activeEnd - activeStart) / (1000*60*60*24)) + 1;
      fraction = daysWorked / dim;
    }

    total += fraction;
    rows.push({ y, m, dim, fraction });

    cur = new Date(y, m + 1, 1);
  }

  return { total, rows };
}

// -------------------------
// Mode logic: monthly vs annual
// -------------------------
const elMonthly = document.getElementById("monthlySalary");
const elAnnual  = document.getElementById("annualSalary");
const elStart   = document.getElementById("startDate");
const elEnd     = document.getElementById("endDate");
const startHint = document.getElementById("startHint");
const endHint   = document.getElementById("endHint");

function syncSalaryInputs(){
  const mVal = Number(elMonthly.value);
  const aVal = Number(elAnnual.value);

  // prevent negatives (also handled on calculate)
  if (mVal < 0) elMonthly.value = "";
  if (aVal < 0) elAnnual.value = "";

  const hasMonthly = !!elMonthly.value;
  const hasAnnual  = !!elAnnual.value;

  // If annual entered: disable monthly + dates
  if (hasAnnual){
    elMonthly.disabled = true;
    elStart.disabled = true;
    elEnd.disabled = true;
    startHint.textContent = "Locked (annual salary mode)";
    endHint.textContent = "Locked (annual salary mode)";
  } else {
    elMonthly.disabled = false;
    elStart.disabled = false;
    elEnd.disabled = false;
    startHint.textContent = "If blank, assumes 2025-07-01";
    endHint.textContent = "If blank, assumes 2026-06-30";
  }

  // If monthly entered: disable annual
  if (hasMonthly){
    elAnnual.disabled = true;
  } else {
    elAnnual.disabled = false;
  }
}

elMonthly.addEventListener("input", syncSalaryInputs);
elAnnual.addEventListener("input", syncSalaryInputs);

// -------------------------
// Copy / CSV / PDF
// -------------------------
function buildSummaryText(){
  const i = state.inputs;
  const slab = state.appliedSlab;

  const lines = [];
  lines.push(`FBR Salary Tax Calculator (${TAX_YEAR_LABEL})`);
  lines.push(`Mode: ${state.mode === "annual" ? "Annual salary" : "Monthly salary"}`);
  lines.push(`Employee Name: ${i.empName || "-"}`);
  lines.push(`Company Name: ${i.companyName || "-"}`);
  lines.push(`Employee ID: ${i.employeeId || "-"}`);
  if (state.mode === "annual") {
    lines.push(`Annual Salary: PKR ${formatPKR(i.annualSalary)}`);
  } else {
    lines.push(`Monthly Salary: PKR ${formatPKR(i.monthlySalary)}`);
    lines.push(`Period: ${i.periodStart} to ${i.periodEnd}`);
  }
  lines.push(`Effective Months: ${state.effectiveMonths.toFixed(4)}`);
  lines.push(`Taxable Income (approx): PKR ${formatPKR(state.taxableIncome)}`);
  lines.push(`Estimated Total Tax: PKR ${formatPKR(state.totalTax)}`);
  lines.push(`Applied Slab: ${slab ? slab.label : "-"}`);
  lines.push(`Slab Calculation: ${state.slabMathPlain}`);
  lines.push(`Surcharge Applied: ${state.surchargeApplied ? "Yes (9%)" : "No"}`);
  lines.push("");
  lines.push("Monthly Schedule (Month | Fraction | Income | Tax Allocated | Net Salary | Cumulative)");
  for (const r of state.schedule){
    lines.push(`${r.label} | ${r.fraction.toFixed(4)} | ${formatPKR(r.income)} | ${formatPKR(r.tax)} | ${formatPKR(r.net)} | ${formatPKR(r.cumulative)}`);
  }
  lines.push("");
  lines.push(ONE_LINE_DISCLAIMER);
  lines.push(BRAND_URL);
  return lines.join("\n");
}

function downloadCSV(){
  const i = state.inputs;
  const slab = state.appliedSlab;

  const headerRows = [
    ["Report", `FBR Salary Tax Calculator (${TAX_YEAR_LABEL})`],
    ["Mode", state.mode === "annual" ? "Annual salary" : "Monthly salary"],
    ["Employee Name", i.empName || ""],
    ["Company Name", i.companyName || ""],
    ["Employee ID", i.employeeId || ""],
  ];

  if (state.mode === "annual"){
    headerRows.push(["Annual Salary (PKR)", i.annualSalary]);
    headerRows.push(["Period Start", "2025-07-01"]);
    headerRows.push(["Period End", "2026-06-30"]);
  } else {
    headerRows.push(["Monthly Salary (PKR)", i.monthlySalary]);
    headerRows.push(["Period Start", i.periodStart]);
    headerRows.push(["Period End", i.periodEnd]);
  }

  headerRows.push(
    ["Effective Months", state.effectiveMonths.toFixed(6)],
    ["Taxable Income (approx)", Math.round(state.taxableIncome)],
    ["Estimated Total Tax", Math.round(state.totalTax)],
    ["Applied Slab", slab ? slab.label : ""],
    ["Slab Calculation", state.slabMathPlain],
    ["Surcharge Applied", state.surchargeApplied ? "Yes (9%)" : "No"],
    ["Note", ONE_LINE_DISCLAIMER],
    ["Source", BRAND_URL],
    [],
    ["Month","Income Fraction","Income (approx)","Tax Allocated","Net Salary","Cumulative Tax"]
  );

  const scheduleRows = state.schedule.map(r => ([
    r.label,
    r.fraction.toFixed(6),
    Math.round(r.income),
    Math.round(r.tax),
    Math.round(r.net),
    Math.round(r.cumulative)
  ]));

  const all = headerRows.concat(scheduleRows);

  const csv = all.map(row => row.map(cell => {
    const s = (cell ?? "").toString();
    const escaped = s.replace(/"/g,'""');
    return `"${escaped}"`;
  }).join(",")).join("\n");

  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${buildExportBaseName()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadImageFromLocal(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("Logo fetch failed");

  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  return { dataUrl, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

function addFooter(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(10, 102, 194);

  const text = BRAND_URL;
  const textWidth = doc.getTextWidth(text);
  const x = pageWidth - 40 - textWidth;
  const y = pageHeight - 24;

  doc.textWithLink(text, x, y, { url: text });
  doc.setTextColor(0,0,0);
}

function ensurePageSpace(doc, y, needed, margin){
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - margin) {
    addFooter(doc);
    doc.addPage();
    return 52;
  }
  return y;
}

function ellipsize(doc, text, maxWidth){
  const t = String(text ?? "");
  if (doc.getTextWidth(t) <= maxWidth) return t;
  const ell = "…";
  let s = t;
  while (s.length > 1 && doc.getTextWidth(s + ell) > maxWidth){
    s = s.slice(0, -1);
  }
  return s + ell;
}

async function downloadPDF(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", format:"a4" });

  const i = state.inputs;
  const slab = state.appliedSlab;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = 52;

  // Title
  doc.setFont("helvetica","bold");
  doc.setFontSize(14);
  doc.text(`FBR Salary Tax Calculator (${TAX_YEAR_LABEL})`, margin, y);

  // Logo (top-right) - big but clean
  try{
    const { dataUrl, width, height } = await loadImageFromLocal(LOGO_LOCAL);
    const maxW = 120;
    const maxH = 44;
    const scale = Math.min(maxW / width, maxH / height);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const x = pageWidth - margin - w;
    const yLogo = 26;

    const fmt = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
    doc.addImage(dataUrl, fmt, x, yLogo, w, h);
  } catch(e){ /* ignore logo */ }

  y += 22;

  // Subtitle
  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  doc.setTextColor(60,60,60);
  doc.text("Simplified estimator (no exemptions/allowances/rebates/other income).", margin, y);
  doc.setTextColor(0,0,0);
  y += 18;

  // Summary block
  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  doc.text("Summary", margin, y);
  y += 14;

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);

  const leftLines = [
    `Employee Name: ${i.empName || "-"}`,
    `Company Name: ${i.companyName || "-"}`,
    `Employee ID: ${i.employeeId || "-"}`,
    `Mode: ${state.mode === "annual" ? "Annual salary" : "Monthly salary"}`
  ];

  const rightLines = [];

  if (state.mode === "annual"){
    rightLines.push(`Annual Salary: PKR ${formatPKR(i.annualSalary)}`);
    rightLines.push(`Period: 2025-07-01 to 2026-06-30`);
  } else {
    rightLines.push(`Monthly Salary: PKR ${formatPKR(i.monthlySalary)}`);
    rightLines.push(`Period: ${i.periodStart} to ${i.periodEnd}`);
  }

  rightLines.push(
    `Effective Months: ${state.effectiveMonths.toFixed(4)}`,
    `Taxable Income (approx): PKR ${formatPKR(state.taxableIncome)}`,
    `Estimated Total Tax: PKR ${formatPKR(state.totalTax)}`,
    `Applied Slab: ${slab ? slab.label : "-"}`,
    `Surcharge Applied: ${state.surchargeApplied ? "Yes (9%)" : "No"}`
  );

  // Two-column summary
  const colGap = 22;
  const colW = (pageWidth - margin*2 - colGap) / 2;
  const leftX = margin;
  const rightX = margin + colW + colGap;

  // Left
  for (const line of leftLines){
    y = ensurePageSpace(doc, y, 14, 90);
    doc.text(line, leftX, y);
    y += 14;
  }

  // Right (start from where left ended but keep consistent)
  let yRight = 52 + 22 + 18 + 14; // approx start below "Summary"
  yRight += (leftLines.length * 14) - (leftLines.length * 14); // keep explicit

  // We want right side aligned with first left line under "Summary"
  yRight = 52 + 22 + 18 + 14; // Title + subtitle + Summary heading lines
  yRight += 14; // first line baseline
  yRight = y - (leftLines.length * 14); // align to first left line

  // Draw right lines
  let yR = y - (leftLines.length * 14);
  for (const line of rightLines){
    yR = ensurePageSpace(doc, yR, 14, 90);
    doc.text(line, rightX, yR);
    yR += 14;
  }

  // Continue y after whichever is lower
  y = Math.max(y, yR) + 8;

  // Slab Calculation section
  y = ensurePageSpace(doc, y, 28, 90);
  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  doc.text("Slab Calculation", margin, y);
  y += 14;

  doc.setFont("helvetica","normal");
  doc.setFontSize(10);
  const slabText = safePdfText(state.slabMathPlain || "-");
  const slabLines = doc.splitTextToSize(slabText, pageWidth - (margin * 2));
  y = ensurePageSpace(doc, y, slabLines.length * 12 + 10, 90);
  doc.text(slabLines, margin, y);
  y += slabLines.length * 12 + 10;

  // Monthly Schedule table
  y = ensurePageSpace(doc, y, 26, 90);
  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  doc.text("Monthly Schedule", margin, y);
  y += 14;

  // Table settings (fit A4)
  const tableX = margin;
  const tableW = pageWidth - margin*2;

  // Column widths (percent)
  const colPerc = [0.16, 0.14, 0.18, 0.18, 0.16, 0.18]; // Month, Fraction, Income, Tax, Net, Cum
  const colWpx = colPerc.map(p => Math.floor(tableW * p));

  const cols = [
    { title:"Month",    w: colWpx[0], align:"left"  },
    { title:"Fraction", w: colWpx[1], align:"right" },
    { title:"Income",   w: colWpx[2], align:"right" },
    { title:"Tax",      w: colWpx[3], align:"right" },
    { title:"Net",      w: colWpx[4], align:"right" },
    { title:"Cum Tax",  w: colWpx[5], align:"right" },
  ];

  const rowH = 16;
  const headerH = 18;

  function drawTableHeader(){
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(229, 231, 235);
    doc.rect(tableX, y, tableW, headerH, "FD");

    doc.setFont("helvetica","bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    let cx = tableX;
    for (const c of cols){
      const tx = cx + 6;
      const ty = y + 12;
      const text = ellipsize(doc, c.title, c.w - 12);
      doc.text(text, tx, ty);
      cx += c.w;
    }

    y += headerH;
    doc.setTextColor(0,0,0);
  }

  function drawRow(r){
    // new page if needed
    if (y + rowH > pageHeight - 80){
      addFooter(doc);
      doc.addPage();
      y = 52;
      drawTableHeader();
    }

    doc.setFont("helvetica","normal");
    doc.setFontSize(9);

    // row line
    doc.setDrawColor(238, 242, 247);
    doc.line(tableX, y + rowH, tableX + tableW, y + rowH);

    const values = [
      r.label,
      r.fraction.toFixed(4),
      `PKR ${formatPKR(r.income)}`,
      `PKR ${formatPKR(r.tax)}`,
      `PKR ${formatPKR(r.net)}`,
      `PKR ${formatPKR(r.cumulative)}`,
    ];

    let cx = tableX;
    for (let k=0;k<cols.length;k++){
      const c = cols[k];
      const raw = values[k];

      const maxTextW = c.w - 12;
      const txt = ellipsize(doc, raw, maxTextW);

      let tx = cx + 6;
      if (c.align === "right"){
        const w = doc.getTextWidth(txt);
        tx = cx + c.w - 6 - w;
      }
      doc.text(txt, tx, y + 12);
      cx += c.w;
    }

    y += rowH;
  }

  // Draw header + rows
  drawTableHeader();
  for (const r of state.schedule){
    drawRow(r);
  }

  // Note (one line) + footer link
  y = ensurePageSpace(doc, y + 10, 40, 70);
  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 53, 15); // subtle warning tone
  const noteLines = doc.splitTextToSize(ONE_LINE_DISCLAIMER, pageWidth - margin*2);
  doc.text(noteLines, margin, y);
  doc.setTextColor(0,0,0);

  addFooter(doc);

  doc.save(`${buildExportBaseName()}.pdf`);
}

// -------------------------
// Calculate
// -------------------------
document.getElementById("calcBtn").addEventListener("click", () => {
  const monthlyRaw = elMonthly.value.trim();
  const annualRaw  = elAnnual.value.trim();

  const monthlySalary = monthlyRaw ? Number(monthlyRaw) : 0;
  const annualSalary  = annualRaw ? Number(annualRaw) : 0;

  // ✅ Negative not allowed
  if (monthlySalary < 0 || annualSalary < 0) {
    alert("Salary cannot be negative.");
    return;
  }

  // Must enter exactly one
  const hasMonthly = !!monthlyRaw;
  const hasAnnual  = !!annualRaw;

  if (!hasMonthly && !hasAnnual){
    alert("Please enter either Monthly Salary or Annual Salary.");
    return;
  }
  if (hasMonthly && hasAnnual){
    alert("Please enter only one: Monthly Salary or Annual Salary.");
    return;
  }

  // FY 2025-26: 01-Jul-2025 to 30-Jun-2026
  const fyStart = new Date(2025, 6, 1);
  const fyEnd = new Date(2026, 5, 30);

  let effectiveMonths = 12;
  let taxableIncome = 0;
  let schedule = [];
  let periodStart = "2025-07-01";
  let periodEnd = "2026-06-30";
  let mode = hasAnnual ? "annual" : "monthly";

  if (mode === "annual"){
    taxableIncome = annualSalary; // annualized already
    effectiveMonths = 12;

    // Option 1: still show schedule
    const incomePerMonth = annualSalary / 12;
    const taxResult = salaryTaxTY2026(taxableIncome);
    const totalTax = taxResult.tax;
    const taxPerMonth = totalTax / 12;

    let cumulativeTax = 0;
    const months = [
      { y:2025, m:6 },{ y:2025, m:7 },{ y:2025, m:8 },{ y:2025, m:9 },{ y:2025, m:10 },{ y:2025, m:11 },
      { y:2026, m:0 },{ y:2026, m:1 },{ y:2026, m:2 },{ y:2026, m:3 },{ y:2026, m:4 },{ y:2026, m:5 },
    ];

    schedule = months.map(mm => {
      cumulativeTax += taxPerMonth;
      return {
        label: `${monthName(mm.m)}-${String(mm.y).slice(-2)}`,
        fraction: 1,
        income: incomePerMonth,
        tax: taxPerMonth,
        net: incomePerMonth - taxPerMonth,
        cumulative: cumulativeTax
      };
    });

    // update UI later after computing tax result below
  } else {
    // Monthly mode with dates
    if (!monthlySalary || monthlySalary <= 0) {
      alert("Please enter a valid monthly salary.");
      return;
    }

    const rawStart = parseLocalInputDate(elStart.value) || fyStart;
    const rawEnd = parseLocalInputDate(elEnd.value) || fyEnd;

    const s0 = rawStart.getTime() <= rawEnd.getTime() ? rawStart : rawEnd;
    const e0 = rawStart.getTime() <= rawEnd.getTime() ? rawEnd : rawStart;

    const start = clampDate(s0, fyStart, fyEnd);
    const end = clampDate(e0, fyStart, fyEnd);

    periodStart = formatDateSafe(start);
    periodEnd = formatDateSafe(end);

    const frac = computeMonthlyFractions(start, end);
    effectiveMonths = frac.total;
    taxableIncome = monthlySalary * effectiveMonths;

    const taxResult = salaryTaxTY2026(taxableIncome);
    const totalTax = taxResult.tax;

    const taxPerEffectiveMonth = effectiveMonths > 0 ? (totalTax / effectiveMonths) : 0;

    let cumulativeTax = 0;
    schedule = frac.rows.map(r => {
      const income = monthlySalary * r.fraction;
      const taxThisMonth = taxPerEffectiveMonth * r.fraction;
      const net = income - taxThisMonth;
      cumulativeTax += taxThisMonth;

      return {
        label: `${monthName(r.m)}-${String(r.y).slice(-2)}`,
        fraction: r.fraction,
        income,
        tax: taxThisMonth,
        net,
        cumulative: cumulativeTax
      };
    });
  }

  // Compute tax once (common)
  const taxResult = salaryTaxTY2026(taxableIncome);
  const totalTax = taxResult.tax;
  const appliedSlab = taxResult.slab;

  let slabMathPlain = "";
  let slabMathHTML = "";

  if (appliedSlab.id === 1) {
    slabMathPlain = `No tax (<= PKR 600,000).`;
    slabMathHTML = slabMathPlain;
  } else {
    const marginalBase = taxableIncome - appliedSlab.base;
    const marginalTax = marginalBase * appliedSlab.rate;
    const preSurcharge = appliedSlab.fixed + marginalTax;

    slabMathPlain =
      `PKR ${formatPKR(appliedSlab.fixed)} + ${Math.round(appliedSlab.rate*100)}% x (PKR ${formatPKR(taxableIncome)} - PKR ${formatPKR(appliedSlab.base)}) = PKR ${formatPKR(preSurcharge)}` +
      (taxResult.surchargeApplied ? `, then +9% surcharge` : ``);

    slabMathHTML =
      `PKR ${formatPKR(appliedSlab.fixed)} + ${Math.round(appliedSlab.rate*100)}% × (PKR ${formatPKR(taxableIncome)} − PKR ${formatPKR(appliedSlab.base)}) = PKR ${formatPKR(preSurcharge)}` +
      (taxResult.surchargeApplied ? ` <span class="pill warn" style="margin-left:8px;">+9% Surcharge</span>` : ``);
  }

  // UI KPI
  setText("kpiIncome", `PKR ${formatPKR(taxableIncome)}`);
  setText("kpiTax", `PKR ${formatPKR(totalTax)}`);

  // Period + mode
  if (mode === "annual"){
    setText("rPeriod", `2025-07-01 to 2026-06-30 (annual salary mode)`);
  } else {
    setText("rPeriod", `${periodStart} to ${periodEnd}`);
  }

  setText("rEffMonths", effectiveMonths.toFixed(4));
  const effTaxRate = taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;
setText("rEffTaxRate", `${effTaxRate.toFixed(2)}%`);
  setHTML("rSlab", appliedSlab.label);
  setHTML("rSlabMath", slabMathHTML);

  const surchargePill = taxResult.surchargeApplied
    ? `<span class="pill warn">9% Surcharge Applied</span>`
    : `<span class="pill good">No Surcharge</span>`;

  setHTML("noteBlock",
    `Notes: simplified estimator; exemptions/allowances/rebates not included. ${surchargePill}`
  );

  renderSlabTable(appliedSlab.id);

  // Schedule table
  const tbody = document.getElementById("scheduleTbody");
  tbody.innerHTML = "";
  for (const s of schedule) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.label}</td>
      <td class="rightAlign">${s.fraction.toFixed(4)}</td>
      <td class="rightAlign">PKR ${formatPKR(s.income)}</td>
      <td class="rightAlign">PKR ${formatPKR(s.tax)}</td>
      <td class="rightAlign">PKR ${formatPKR(s.net)}</td>
      <td class="rightAlign">PKR ${formatPKR(s.cumulative)}</td>
    `;
    tbody.appendChild(tr);
  }

  // Save state
  state.inputs = {
    empName: document.getElementById("empName").value.trim(),
    companyName: document.getElementById("companyName").value.trim(),
    employeeId: document.getElementById("employeeId").value.trim(),
    monthlySalary: mode === "monthly" ? monthlySalary : null,
    annualSalary: mode === "annual" ? annualSalary : null,
    periodStart,
    periodEnd
  };

  state.mode = mode;
  state.taxableIncome = taxableIncome;
  state.totalTax = totalTax;
  state.effectiveMonths = effectiveMonths;
  state.appliedSlab = appliedSlab;
  state.slabMathPlain = slabMathPlain;
  state.surchargeApplied = taxResult.surchargeApplied;
  state.schedule = schedule;

  enableExports(true);
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  try{
    const text = buildSummaryText();
    await navigator.clipboard.writeText(text);
    showToast("Copied ✅");
  }catch(e){
    alert("Copy failed. Your browser may block clipboard access.");
  }
});

document.getElementById("csvBtn").addEventListener("click", () => downloadCSV());

document.getElementById("pdfBtn").addEventListener("click", async () => {
  try{ await downloadPDF(); }
  catch(e){ alert("PDF failed. Make sure assets/logo.png exists and is accessible."); }
});

// Init
renderSlabTable(-1);
enableExports(false);
syncSalaryInputs();

// -------------------------
// Guidelines modal handlers
// -------------------------
const overlay = document.getElementById("guidelinesOverlay");
const openBtn = document.getElementById("openGuidelines");
const closeBtn = document.getElementById("closeGuidelines");
const closeBtn2 = document.getElementById("closeGuidelines2");

function openModal(){
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden","false");
}
function closeModal(){
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden","true");
}

openBtn.addEventListener("click", openModal);
openBtn.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") openModal();
});

closeBtn.addEventListener("click", closeModal);
closeBtn2.addEventListener("click", closeModal);

overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay.classList.contains("show")) closeModal();
});