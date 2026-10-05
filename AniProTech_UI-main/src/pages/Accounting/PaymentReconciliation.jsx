import { useEffect, useMemo, useState } from "react";
import { _get, _post } from "../../utils/ApiService";

const money = (pence) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(pence || 0) / 100);
const invoiceName = (invoice) => `INV-${String(invoice.number).padStart(5, "0")}`;
const message = (error) => error.response?.data?.message || "Unable to complete this action";

export default function PaymentReconciliation() {
  const [data, setData] = useState(null);
  const [chosen, setChosen] = useState({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reverseId, setReverseId] = useState("");
  const [reason, setReason] = useState("");
  const [manual, setManual] = useState({ invoiceId: "", amount: "", receivedOn: new Date().toISOString().slice(0, 10), method: "BANK_TRANSFER", reference: "", note: "" });
  const load = async () => setData((await _get("/api/accounting/reconciliation")).data.results.data);
  useEffect(() => { let live = true; _get("/api/accounting/reconciliation")
    .then(result => { if (live) setData(result.data.results.data); })
    .catch(err => { if (live) setError(message(err)); });
    return () => { live = false; }; }, []);
  const invoices = useMemo(() => data?.invoices || [], [data?.invoices]);
  const transactions = data?.transactions || [];
  const availableInvoices = useMemo(() => invoices.filter(invoice => ["ISSUED", "PAID"].includes(invoice.status) && invoice.outstandingPence > 0), [invoices]);
  const shownInvoices = invoices.filter(invoice => `${invoiceName(invoice)} ${invoice.recipientName}`.toLowerCase().includes(query.toLowerCase()));
  const unmatched = transactions.filter(tx => !tx.paymentId && tx.amountPence > 0);
  const suggestions = unmatched.filter(tx => tx.suggestedInvoiceId);
  const perform = async (action, success) => {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await load(); setNotice(success); }
    catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  };
  const sync = () => perform(async () => { const result = await _post("/api/accounting/reconciliation/sync", {});
    setNotice(`${result.data.results.data.imported} new bank transactions imported.`); }, "Bank transactions refreshed.");
  const match = (tx, invoiceId) => {
    const invoice = invoices.find(item => item.id === invoiceId);
    if (!invoice) return;
    if (!window.confirm(`Match ${money(tx.amountPence)} received on ${tx.date || "an unknown date"} to ${invoiceName(invoice)}?`)) return;
    perform(() => _post("/api/accounting/reconciliation/matches", { invoiceId, transactionId: tx.id }),
      `Payment matched to ${invoiceName(invoice)}.`);
  };
  const reverse = () => {
    if (reason.trim().length < 5) { setError("Enter at least five characters explaining the reversal."); return; }
    const payment = data?.payments?.find(item => item.id === reverseId);
    const endpoint = payment?.source === "MANUAL" ? "manual-payments" : "matches";
    perform(() => _post(`/api/accounting/reconciliation/${endpoint}/${reverseId}/reverse`, { reason: reason.trim() }),
      "Payment match reversed. The invoice balance has been recalculated.");
    setReverseId(""); setReason("");
  };
  const recordManual = (event) => {
    event.preventDefault();
    const amountPence = Math.round(Number(manual.amount) * 100);
    const invoice = availableInvoices.find(item => item.id === manual.invoiceId);
    if (!invoice || !Number.isSafeInteger(amountPence) || amountPence <= 0 || amountPence > invoice.outstandingPence) {
      setError("Choose an invoice and a positive amount no greater than its outstanding balance."); return;
    }
    if (manual.note.trim().length < 5) { setError("Enter a note describing the payment evidence."); return; }
    if (!window.confirm(`Record ${money(amountPence)} against ${invoiceName(invoice)} as an administrator-entered payment? This is not bank verified.`)) return;
    perform(() => _post("/api/accounting/reconciliation/manual-payments", { ...manual, amountPence, note: manual.note.trim() }),
      `Manual payment recorded against ${invoiceName(invoice)}. This is not bank verified.`);
    setManual({ ...manual, amount: "", reference: "", note: "" });
  };
  return <div className="space-y-5">
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Invoice payment reconciliation</h2>
      <p className="mt-2 text-sm text-slate-600">Import booked GBP transactions, review suggested matches, and confirm each payment. A bank transaction is never applied to an invoice automatically. Fake Bank transactions cannot settle live invoices.</p>
      <button type="button" disabled={busy} onClick={sync} className="mt-4 rounded-lg bg-[#0b294a] px-4 py-2 font-semibold text-white disabled:opacity-50">Sync bank transactions</button>
      {data && <p className="mt-3 text-sm text-slate-600">{unmatched.length} unmatched incoming transactions · {suggestions.length} exact-reference suggestions · {availableInvoices.length} invoices with a balance</p>}
    </section>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Record a payment manually</h2>
      <p className="mt-2 text-sm text-slate-600">Use this when you have checked a real payment outside the connected bank feed. This is an admin record, not a bank-verified match. Keep a reference and evidence note for the audit.</p>
      <form onSubmit={recordManual} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm">Invoice<select required className="mt-1 block w-full rounded border p-2" value={manual.invoiceId} onChange={e => setManual({ ...manual, invoiceId: e.target.value })}><option value="">Choose invoice</option>{availableInvoices.map(invoice => <option key={invoice.id} value={invoice.id}>{invoiceName(invoice)} · {invoice.recipientName} · due {money(invoice.outstandingPence)}</option>)}</select></label>
        <label className="text-sm">Amount received (£)<input required type="number" min="0.01" step="0.01" className="mt-1 block w-full rounded border p-2" value={manual.amount} onChange={e => setManual({ ...manual, amount: e.target.value })} /></label>
        <label className="text-sm">Date received<input required type="date" className="mt-1 block w-full rounded border p-2" value={manual.receivedOn} onChange={e => setManual({ ...manual, receivedOn: e.target.value })} /></label>
        <label className="text-sm">Method<select className="mt-1 block w-full rounded border p-2" value={manual.method} onChange={e => setManual({ ...manual, method: e.target.value })}><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="CHEQUE">Cheque</option><option value="OTHER">Other</option></select></label>
        <label className="text-sm">Payment reference<input className="mt-1 block w-full rounded border p-2" maxLength={200} value={manual.reference} onChange={e => setManual({ ...manual, reference: e.target.value })} /></label>
        <label className="text-sm">Evidence note<input required className="mt-1 block w-full rounded border p-2" maxLength={1000} value={manual.note} onChange={e => setManual({ ...manual, note: e.target.value })} placeholder="Where and how was this payment confirmed?" /></label>
        <div className="md:col-span-2"><button type="submit" disabled={busy || !availableInvoices.length} className="rounded-lg bg-[#0b294a] px-4 py-2 font-semibold text-white disabled:opacity-50">Record payment</button></div>
      </form>
    </section>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">{notice}</p>}
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Invoices</h2>
      <label className="mt-3 block text-sm">Search invoice or client<input className="mt-1 block w-full max-w-md rounded border p-2" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="mt-4 max-h-96 overflow-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b"><th className="p-2">Invoice</th><th className="p-2">Client</th><th className="p-2">Total</th><th className="p-2">Received</th><th className="p-2">Outstanding</th><th className="p-2">Payment status</th></tr></thead><tbody>{shownInvoices.map(invoice => <tr key={invoice.id} className="border-b"><td className="p-2 font-semibold">{invoiceName(invoice)}</td><td className="p-2">{invoice.recipientName}</td><td className="p-2">{money(invoice.totalPence)}</td><td className="p-2">{money(invoice.paidPence)}</td><td className="p-2">{money(invoice.outstandingPence)}</td><td className="p-2">{invoice.paymentStatus === "UNVERIFIED_PAID" ? "Marked paid previously · bank evidence not matched" : invoice.paymentStatus.replaceAll("_", " ")}{invoice.overpaymentPence > 0 && ` · ${money(invoice.overpaymentPence)} to review`}</td></tr>)}</tbody></table>{!shownInvoices.length && <p className="p-3 text-slate-600">No invoices found.</p>}</div>
    </section>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">Incoming bank payments</h2>
      <p className="mt-2 text-sm text-slate-600">Only a unique invoice reference and exact outstanding amount are suggested. You may choose a different invoice after checking the evidence; payments larger than its balance are blocked.</p>
      <div className="mt-4 space-y-3">{unmatched.map(tx => {
        const selected = chosen[tx.id] ?? tx.suggestedInvoiceId ?? "";
        return <article key={tx.id} className="rounded-lg border p-4"><div className="flex flex-wrap justify-between gap-2"><div><strong>{money(tx.amountPence)}</strong><span className="ml-3 text-sm text-slate-600">{tx.date || "Date unavailable"}</span><p className="mt-1 break-words text-sm">{tx.description || "No bank reference"}</p></div>{tx.suggestionReason && <p className="mt-2 text-sm text-slate-600">{tx.suggestionReason}</p>}{tx.suggestedInvoiceId && <span className="h-fit rounded bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-900">Exact reference and amount</span>}</div>
          {tx.isSandbox ? <p className="mt-3 text-sm font-medium text-amber-800">Fake Bank test transaction · cannot be matched to a live invoice</p> :
          <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-sm">Match to invoice<select className="mt-1 block min-w-56 rounded border p-2" value={selected} onChange={e => setChosen({ ...chosen, [tx.id]: e.target.value })}><option value="">Choose invoice</option>{availableInvoices.map(invoice => <option key={invoice.id} value={invoice.id}>{invoiceName(invoice)} · {invoice.recipientName} · due {money(invoice.outstandingPence)}</option>)}</select></label><button type="button" disabled={busy || !selected} onClick={() => match(tx, selected)} className="rounded-lg bg-[#0b294a] px-4 py-2 font-semibold text-white disabled:opacity-50">Confirm match</button></div>}
        </article>; })}{!unmatched.length && <p className="text-slate-600">No unmatched incoming payments. Sync the bank to check for new transactions.</p>}</div>
    </section>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Payment audit</h2><div className="mt-3 max-h-80 overflow-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b"><th className="p-2">Invoice</th><th className="p-2">Date</th><th className="p-2">Amount</th><th className="p-2">Source</th><th className="p-2">State</th><th className="p-2">Action</th></tr></thead><tbody>{(data?.payments || []).map(payment => { const invoice = invoices.find(item => item.id === payment.invoiceId); return <tr key={payment.id} className="border-b"><td className="p-2">{invoice ? invoiceName(invoice) : "Invoice"}</td><td className="p-2">{payment.paidOn || "—"}</td><td className="p-2">{money(payment.amountPence)}</td><td className="p-2">{payment.source === "MANUAL" ? `Admin entered · ${payment.method?.replaceAll("_", " ")}` : "Bank verified"}</td><td className="p-2">{payment.reversedAt ? `Reversed: ${payment.reversalReason || ""}` : "Active"}</td><td className="p-2">{!payment.reversedAt && <button type="button" className="text-red-700 underline" onClick={() => { setReverseId(payment.id); setReason(""); }}>Reverse</button>}</td></tr>; })}</tbody></table>{!data?.payments?.length && <p className="p-3 text-slate-600">No payments recorded yet.</p>}</div></section>
    {reverseId && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-label="Reverse payment" className="w-full max-w-md rounded-xl bg-white p-6"><h2 className="text-xl font-semibold">Reverse payment</h2><p className="mt-2 text-sm text-slate-600">This recalculates the invoice balance. The original payment remains in the audit.</p><label className="mt-4 block text-sm">Reason<textarea className="mt-1 w-full rounded border p-2" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} /></label><div className="mt-4 flex gap-2"><button type="button" className="rounded border px-4 py-2" onClick={() => setReverseId("")}>Cancel</button><button type="button" disabled={busy} className="rounded bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={reverse}>Reverse</button></div></section></div>}
  </div>;
}
