import type { AnalyticsData } from "./analytics-api";

function formatCurrency(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export async function exportAnalyticsPDF(data: AnalyticsData): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  let y = 0;

  const GOLD = [180, 130, 50] as const;
  const DARK = [18, 18, 22] as const;
  const LIGHT = [245, 243, 238] as const;
  const MID = [100, 95, 88] as const;
  const WHITE: [number, number, number] = [255, 255, 255];
  const BORDER: [number, number, number] = [220, 215, 205];

  const addPage = () => {
    doc.addPage();
    y = 20;
  };

  const checkPage = (need: number) => {
    if (y + need > ph - 15) addPage();
  };

  // ── COVER ─────────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pw, ph, "F");

  // Gold accent bar
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, 8, ph, "F");

  // Logo block
  doc.setFillColor(...GOLD);
  doc.roundedRect(20, 28, 18, 18, 3, 3, "F");
  doc.setTextColor(...DARK);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("L", 29, 41, { align: "center" });

  // Title
  doc.setTextColor(...LIGHT);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("Real Estate CRM", 20, 70);

  doc.setFontSize(16);
  doc.setTextColor(...GOLD);
  doc.text("Analytics Report", 20, 83);

  doc.setFontSize(10);
  doc.setTextColor(...MID);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 20, 95);

  // KPI summary on cover
  const kpis = [
    { label: "Total Leads", value: String(data.kpis.totalLeads) },
    { label: "Won Leads", value: String(data.kpis.wonLeads) },
    { label: "Conversion Rate", value: `${data.kpis.conversionRate}%` },
    { label: "Total Deals", value: String(data.kpis.totalDeals) },
    { label: "Pipeline Value", value: formatCurrency(data.kpis.totalPipeline) },
    { label: "Won Revenue", value: formatCurrency(data.kpis.wonRevenue) },
  ];

  const cardW = (pw - 40 - 10) / 3;
  const cardH = 22;
  const startX = 20;
  let cx = startX;
  let cy = 120;

  kpis.forEach((kpi, i) => {
    if (i > 0 && i % 3 === 0) { cx = startX; cy += cardH + 5; }
    doc.setFillColor(30, 28, 35);
    doc.roundedRect(cx, cy, cardW, cardH, 3, 3, "F");
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, cy, cardW, cardH, 3, 3, "S");
    doc.setFontSize(8);
    doc.setTextColor(...MID);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label.toUpperCase(), cx + 5, cy + 8);
    doc.setFontSize(13);
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, cx + 5, cy + 17);
    cx += cardW + 5;
  });

  // Footer on cover
  doc.setFontSize(8);
  doc.setTextColor(60, 58, 68);
  doc.setFont("helvetica", "normal");
  doc.text("CONFIDENTIAL · CRM Analytics · Internal Report", pw / 2, ph - 12, { align: "center" });

  // ── PAGE 2 — LEAD & CONVERSION ANALYTICS ─────────────────────────────────
  doc.addPage();
  y = 15;

  // Header bar
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pw, 8, "F");
  doc.setFillColor(252, 251, 248);
  doc.rect(0, 8, pw, ph - 8, "F");

  const sectionTitle = (title: string, sub?: string) => {
    checkPage(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(title, 15, y);
    if (sub) {
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MID);
      doc.text(sub, 15, y);
    }
    y += 8;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(15, y, pw - 15, y);
    y += 6;
  };

  const tableHeader = (cols: string[], widths: number[], startY: number) => {
    doc.setFillColor(235, 232, 224);
    doc.rect(15, startY - 4, pw - 30, 8, "F");
    let tx = 17;
    cols.forEach((c, i) => {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(c, tx, startY + 0.5);
      tx += widths[i]!;
    });
  };

  const tableRow = (cells: string[], widths: number[], startY: number, shade: boolean) => {
    if (shade) {
      doc.setFillColor(248, 246, 242);
      doc.rect(15, startY - 4, pw - 30, 7, "F");
    }
    let tx = 17;
    cells.forEach((c, i) => {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 38, 48);
      doc.text(c, tx, startY);
      tx += widths[i]!;
    });
  };

  // ── CONVERSION TREND ─────────────────────────────────────────────────────
  sectionTitle("Lead Conversion Trend", "Month-by-month new leads vs won deals");

  if (data.conversionTrend.length > 0) {
    const cols = ["Month", "New Leads", "Won", "Conversion Rate"];
    const widths = [35, 35, 30, 50];
    tableHeader(cols, widths, y);
    y += 8;

    data.conversionTrend.forEach((row, i) => {
      checkPage(10);
      tableRow(
        [row.month, String(row.total), String(row.won), `${row.rate}%`],
        widths,
        y,
        i % 2 === 0
      );
      y += 8;
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...MID);
    doc.text("No conversion trend data available.", 15, y);
    y += 8;
  }

  y += 6;

  // ── SOURCE BREAKDOWN ─────────────────────────────────────────────────────
  checkPage(50);
  sectionTitle("Lead Source Breakdown", "Distribution of leads by acquisition channel");

  const totalLeadsForPct = data.sourceBreakdown.reduce((s, r) => s + r.count, 0);
  const cols2 = ["Source", "Leads", "Share", "Bar"];
  const widths2 = [45, 25, 25, 75];
  tableHeader(cols2, widths2, y);
  y += 8;

  const COLORS = [
    GOLD,
    [80, 150, 200] as const,
    [120, 180, 120] as const,
    [180, 100, 100] as const,
    [150, 100, 180] as const,
  ];

  data.sourceBreakdown.forEach((row, i) => {
    checkPage(10);
    const pct = totalLeadsForPct > 0 ? Math.round((row.count / totalLeadsForPct) * 100) : 0;
    const barW = (pct / 100) * 65;
    const color = COLORS[i % COLORS.length]!;

    if (i % 2 === 0) {
      doc.setFillColor(248, 246, 242);
      doc.rect(15, y - 4, pw - 30, 7, "F");
    }

    let tx = 17;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 38, 48);
    doc.text(row.source, tx, y); tx += widths2[0]!;
    doc.text(String(row.count), tx, y); tx += widths2[1]!;
    doc.text(`${pct}%`, tx, y); tx += widths2[2]!;

    // Bar
    doc.setFillColor(220, 215, 205);
    doc.roundedRect(tx, y - 3.5, 65, 5, 1, 1, "F");
    if (barW > 0) {
      doc.setFillColor(...(color as [number, number, number]));
      doc.roundedRect(tx, y - 3.5, barW, 5, 1, 1, "F");
    }

    y += 8;
  });

  y += 6;

  // ── PAGE 3 — AGENT PERFORMANCE ────────────────────────────────────────────
  checkPage(60);
  if (y > ph / 2) { addPage(); doc.setFillColor(252, 251, 248); doc.rect(0, 8, pw, ph - 8, "F"); }

  sectionTitle("Agent Performance", "Leads handled, deals won, and win rate per agent");

  if (data.agentPerformance.length > 0) {
    const cols3 = ["#", "Agent", "Leads", "Won", "Win Rate", "Avg Score"];
    const widths3 = [12, 55, 22, 20, 30, 30];
    tableHeader(cols3, widths3, y);
    y += 8;

    data.agentPerformance.forEach((row, i) => {
      checkPage(10);
      const rankStr = row.rank === 1 ? "★ 1" : `#${row.rank}`;
      tableRow(
        [rankStr, row.agent, String(row.leads), String(row.won), `${row.winRate}%`, String(row.avgScore)],
        widths3,
        y,
        i % 2 === 0
      );
      y += 8;
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...MID);
    doc.text("No agent performance data available.", 15, y);
    y += 8;
  }

  y += 6;

  // ── DEAL PERFORMANCE ─────────────────────────────────────────────────────
  checkPage(50);
  sectionTitle("Deal Performance by Stage", "Pipeline value distribution across deal stages");

  if (data.dealsByStage.length > 0) {
    const cols4 = ["Stage", "Deals", "Total Value"];
    const widths4 = [60, 40, 70];
    tableHeader(cols4, widths4, y);
    y += 8;

    const totalDealValue = data.dealsByStage.reduce((s, r) => s + r.value, 0);
    data.dealsByStage.forEach((row, i) => {
      checkPage(10);
      tableRow(
        [
          row.stage.charAt(0).toUpperCase() + row.stage.slice(1),
          String(row.count),
          formatCurrency(row.value),
        ],
        widths4,
        y,
        i % 2 === 0
      );
      y += 8;
    });

    y += 4;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(`Total Pipeline Value: ${formatCurrency(totalDealValue)}`, 17, y);
    y += 8;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...MID);
    doc.text("No deal data available.", 15, y);
    y += 8;
  }

  y += 6;

  // ── MESSAGE ACTIVITY ─────────────────────────────────────────────────────
  checkPage(50);
  if (y > ph - 60) { addPage(); doc.setFillColor(252, 251, 248); doc.rect(0, 8, pw, ph - 8, "F"); }

  sectionTitle("Message Activity", "Daily message volume over the last 30 days");

  if (data.messageActivity.length > 0) {
    const maxCount = Math.max(...data.messageActivity.map((r) => r.count), 1);
    const barAreaW = pw - 30;
    const barW2 = Math.max(3, Math.floor(barAreaW / data.messageActivity.length) - 1);
    const chartH = 35;
    const chartBase = y + chartH;
    const startX2 = 15;

    data.messageActivity.forEach((row, i) => {
      const bh = Math.max(1, (row.count / maxCount) * (chartH - 5));
      const bx = startX2 + i * (barW2 + 1);
      doc.setFillColor(...GOLD);
      doc.roundedRect(bx, chartBase - bh, barW2, bh, 0.5, 0.5, "F");
    });

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(15, y, 15, chartBase + 2);
    doc.line(15, chartBase + 2, pw - 15, chartBase + 2);

    // x-axis labels every 5 days
    data.messageActivity.forEach((row, i) => {
      if (i % 5 === 0) {
        const bx = startX2 + i * (barW2 + 1);
        doc.setFontSize(6);
        doc.setTextColor(...MID);
        doc.text(row.day, bx, chartBase + 7);
      }
    });

    y = chartBase + 14;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...MID);
    doc.text("No message activity data available.", 15, y);
    y += 8;
  }

  y += 6;

  // ── STATUS BREAKDOWN ─────────────────────────────────────────────────────
  checkPage(50);
  sectionTitle("Lead Status Distribution", "Current pipeline health across all statuses");

  if (data.statusBreakdown.length > 0) {
    const cols5 = ["Status", "Count", "% of Total"];
    const widths5 = [60, 40, 70];
    tableHeader(cols5, widths5, y);
    y += 8;

    data.statusBreakdown.forEach((row, i) => {
      checkPage(10);
      const pct = data.kpis.totalLeads > 0 ? Math.round((row.count / data.kpis.totalLeads) * 100) : 0;
      tableRow(
        [row.status.charAt(0).toUpperCase() + row.status.slice(1), String(row.count), `${pct}%`],
        widths5,
        y,
        i % 2 === 0
      );
      y += 8;
    });
  }

  y += 8;

  // ── FOOTER on last page ───────────────────────────────────────────────────
  const totalPages = (doc.internal as unknown as { pages: unknown[] }).pages?.length ?? doc.getNumberOfPages();
  for (let p = 2; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(...MID);
    doc.text(
      `CRM Analytics Report · Page ${p} of ${doc.getNumberOfPages()} · ${new Date().toLocaleDateString()}`,
      pw / 2,
      ph - 8,
      { align: "center" }
    );
    doc.setFillColor(...GOLD);
    doc.rect(0, ph - 2, pw, 2, "F");
  }

  doc.save(`CRM-Analytics-${new Date().toISOString().slice(0, 10)}.pdf`);
}
