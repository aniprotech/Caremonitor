const pdfText = (value) => String(value ?? "")
  .replaceAll("\\", "\\\\")
  .replaceAll("(", "\\(")
  .replaceAll(")", "\\)")
  .replace(/[\r\n]+/g, " ");

// A compact, dependency-free PDF for scheduled operational summaries. It deliberately
// contains aggregate data only; client-identifiable care information stays in Caremonitor.
export function scheduledReportPdf({ name, cadence, generatedAt, visits, cases, documents }) {
  const lines = [
    "Caremonitor scheduled report",
    name,
    `Cadence: ${String(cadence).toLowerCase()}`,
    `Generated: ${new Date(generatedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} (UK time)`,
    "",
    "Last 30 days",
    `Visits: ${visits.total} total; ${visits.completed} completed`,
    `Quality cases: ${cases.total} total; ${cases.open} open; ${cases.overdue} overdue`,
    `Finance documents: ${documents.total}`,
    "",
    "This summary contains aggregate operational data only.",
    "Sign in to Caremonitor for protected details and reconciliation.",
  ];
  const stream = ["BT", "/F1 18 Tf", "54 790 Td"];
  lines.forEach((line, index) => {
    if (index) stream.push("0 -24 Td");
    stream.push(`(${pdfText(line)}) Tj`);
    if (index === 0) stream.push("/F1 12 Tf");
  });
  stream.push("ET");
  const content = stream.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}
