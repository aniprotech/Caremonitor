// Deterministic, source-linked assistance. No data is sent to an external model.
export function draftHandover(rows) {
  const evidence = rows.slice(0, 20).map(row => ({ entryId: row.id, kind: row.kind,
    title: row.title, createdAt: row.createdAt, excerpt: String(row.body || "").slice(0, 1200) }));
  return { evidence, suggestion: "Handover draft — verify against the original records.\n" + evidence.map((row, i) =>
    `[${i + 1}] ${row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt} · ${row.kind} · ${row.title}\n${row.excerpt}`).join("\n\n") };
}
export function missingInformation(user) {
  return [["firstName", "First name"], ["lastName", "Last name"], ["primaryPhone", "Primary phone"]]
    .filter(([key]) => !String(user[key] || "").trim())
    .map(([field, label]) => ({ field, message: `${label} is missing. Review with the client before updating.`, source: "Client profile" }));
}
export function paymentExplanation(transaction, candidates) {
  if (transaction.paymentId) return "This bank transaction is already matched.";
  if (transaction.isSandbox) return "Test-bank transactions cannot settle invoices.";
  if (Number(transaction.amountPence) <= 0) return "Only incoming payments can be matched.";
  if (candidates.length === 1) return "One issued invoice matches the complete invoice reference and outstanding amount. Verify the payer and date before confirming.";
  if (candidates.length > 1) return "Several invoices match this reference and amount. No invoice has been selected automatically.";
  return "No unique exact reference-and-balance match. Review the payer, reference and invoice balance manually.";
}
