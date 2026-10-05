import { useEffect, useState } from "react";
import { _get, _post } from "../../utils/ApiService";
import { Link } from "react-router-dom";
import { Page, Field, ErrorBox, inputClass, buttonClass, londonToday, money, downloadCsv } from "../../components/Operations/common";
export default function FinanceWorkspace({ initialTab = "INVOICE" }) {
    const [tab, setTab] = useState(initialTab),
        [people, setPeople] = useState([]),
        [rates, setRates] = useState([]),
        [documents, setDocuments] = useState([]),[credits,setCredits]=useState([]);
    const [from, setFrom] = useState(() => londonToday().slice(0, 8) + "01"),
        [to, setTo] = useState(londonToday),
        [recipient, setRecipient] = useState("");
    const [preview, setPreview] = useState(null),
        [detail, setDetail] = useState(null),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [reload, setReload] = useState(0);
    const [reconciliation,setReconciliation]=useState(null),[credit,setCredit]=useState(null);
    const [rate, setRate] = useState({ userId: "", kind: "BILLING", effectiveFrom: londonToday(), amount: "" });
    useEffect(() => {
        let active = true;
        setError("");
        Promise.all([
            _get("/api/finance/options"),
            _get("/api/finance/rates"),
            _get("/api/finance/documents", { params: { from, to, kind: tab === "RATES" ? "INVOICE" : tab } }),
            _get("/api/finance/credit-notes"),
        ])
            .then(([o, r, d,c]) => {
                if (active) {
                    setPeople(o.data.results.data.people);
                    setRates(r.data.results.data);
                    setDocuments(d.data.results.data);
                    setCredits(c.data.results.data);
                }
            })
            .catch((e) => {
                if (active) setError(e.response?.data?.message || "Unable to load finance");
            });
        return () => {
            active = false;
        };
    }, [tab, from, to, reload]);
    async function run(fn) {
        setBusy(true);
        setError("");
        try {
            await fn();
        } catch (e) {
            setError(e.response?.data?.message || "Unable to complete this action");
        } finally {
            setBusy(false);
        }
    }
    const show = (id) => run(async () => {const [d,r]=await Promise.all([_get(`/api/finance/documents/${id}`),_get(`/api/finance/documents/${id}/reconcile`)]);setDetail(d.data.results.data);setReconciliation(r.data.results.data)});
    async function saveRate(e) {
        e.preventDefault();
        await run(async () => {
            await _post("/api/finance/rates", { ...rate, hourlyPence: Math.round(Number(rate.amount) * 100) });
            setReload((n) => n + 1);
            setPreview(null);
        });
    }
    const calculate = () =>
        run(async () => {
            setDetail(null);
            setPreview((await _get("/api/finance/preview", { params: { kind: tab, recipientId: recipient, from, to } })).data.results.data);
        });
    const create = () =>
        run(async () => {
            const r = await _post("/api/finance/documents", { kind: tab, recipientId: recipient, from, to });
            setPreview(null);
            setDetail((await _get(`/api/finance/documents/${r.data.results.data.id}`)).data.results.data);
            setReconciliation((await _get(`/api/finance/documents/${r.data.results.data.id}/reconcile`)).data.results.data);
            setReload((n) => n + 1);
        });
    const transition = (status) =>
        run(async () => {
            if (!window.confirm(`Mark this document as ${status.toLowerCase()}?`)) return;
            await _post(`/api/finance/documents/${detail.id}/status`, { status, expectedStatus: detail.status });
            setDetail((await _get(`/api/finance/documents/${detail.id}`)).data.results.data);
            setReconciliation((await _get(`/api/finance/documents/${detail.id}/reconcile`)).data.results.data);
            setReload((n) => n + 1);
        });
    const record = detail || preview;
    const documentName = (d) => `${d.kind === "INVOICE" ? "INV" : "PAY"}-${String(d.number).padStart(5, "0")}`;
    const paymentSummary = (d) => {
        if (d.kind !== "INVOICE" || !["ISSUED", "PAID"].includes(d.status)) return d.status;
        const paid = Number(d.paidPence || 0), credited = Number(d.creditedPence || 0);
        const due = Math.max(0, Number(d.totalPence) - paid - credited);
        if (d.status === "PAID" && paid === 0 && due > 0)
            return "PAID previously · bank payment not matched";
        if (due > 0) return `${paid > 0 ? "PART PAID" : "UNPAID"} · ${money(due)} due`;
        return `${paid > 0 ? "PAID" : "CREDITED"} · ${money(due)} due`;
    };
    const exportDocument=()=>run(async()=>{const result=(await _post(`/api/finance/documents/${detail.id}/export`,{format:"CSV"})).data.results.data;downloadCsv(documentName(detail)+".csv",[["Date","Type","Visit","Minutes","Hourly GBP","Amount GBP"],...result.lines.map(l=>[l.date,l.component,l.title,l.minutes,(l.hourlyPence/100).toFixed(2),(l.amountPence/100).toFixed(2)])]);setReconciliation(result.reconciliation)});
    const transitionCredit=(item,status)=>run(async()=>{await _post(`/api/finance/credit-notes/${item.id}/status`,{expectedStatus:item.status,status});setReload(n=>n+1)});
    return (
        <Page
            title="Finance"
            description="GBP client invoices and gross staff pay. Amounts use separately confirmed visit durations; tax and payroll deductions are not included."
        >
            <ErrorBox error={error} />
            <div className="flex flex-wrap gap-2">
                {[
                    ["INVOICE", "Client invoices"],
                    ["PAYRUN", "Staff pay"],
                    ["RATES", "Hourly rates"],
                ].map(([k, n]) => (
                    <button
                        key={k}
                        className={tab === k ? buttonClass : "rounded-lg border px-4 py-2"}
                        onClick={() => {
                            setTab(k);
                            setRecipient("");
                            setPreview(null);
                            setDetail(null);
                        }}
                    >
                        {n}
                    </button>
                ))}
            </div>
            {tab === "RATES" ? (
                <>
                    <form
                        className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5"
                        onSubmit={saveRate}
                    >
                        <Field label="Rate type">
                            <select
                                className={inputClass}
                                value={rate.kind}
                                onChange={(e) => setRate({ ...rate, kind: e.target.value, userId: "" })}
                            >
                                <option value="BILLING">Client billing</option>
                                <option value="PAY">Staff pay</option>
                            </select>
                        </Field>
                        <Field label="Person">
                            <select
                                required
                                className={inputClass}
                                value={rate.userId}
                                onChange={(e) => setRate({ ...rate, userId: e.target.value })}
                            >
                                <option value="">Select person</option>
                                {people
                                    .filter((p) => p.isClient === (rate.kind === "BILLING"))
                                    .map((p) => (
                                        <option
                                            key={p.id}
                                            value={p.id}
                                        >
                                            {p.name}
                                        </option>
                                    ))}
                            </select>
                        </Field>
                        <Field label="Effective from">
                            <input
                                required
                                type="date"
                                className={inputClass}
                                value={rate.effectiveFrom}
                                onChange={(e) => setRate({ ...rate, effectiveFrom: e.target.value })}
                            />
                        </Field>
                        <Field label="Hourly rate (GBP)">
                            <input
                                required
                                type="number"
                                min="0"
                                max="10000"
                                step="0.01"
                                className={inputClass}
                                value={rate.amount}
                                onChange={(e) => setRate({ ...rate, amount: e.target.value })}
                            />
                        </Field>
                        <button
                            disabled={busy}
                            className={buttonClass}
                        >
                            Save rate
                        </button>
                    </form>
                    <p className="text-xs text-gray-500">
                        A new effective date preserves earlier rates. Saving the same person, type and date updates that rate. Existing document
                        totals remain unchanged.
                    </p>
                    <div className="overflow-auto rounded-xl border bg-white">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr>
                                    {["Person", "Type", "Effective from", "Per hour"].map((h) => (
                                        <th
                                            className="p-3"
                                            key={h}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rates.map((r) => (
                                    <tr
                                        key={r.id}
                                        className="border-t"
                                    >
                                        <td className="p-3">{r.name}</td>
                                        <td className="p-3">{r.kind === "BILLING" ? "Client billing" : "Staff pay"}</td>
                                        <td className="p-3">{r.effectiveFrom}</td>
                                        <td className="p-3">{money(r.hourlyPence)}</td>
                                    </tr>
                                ))}
                                {!rates.length && (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="p-8 text-center"
                                        >
                                            No rates set yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5">
                        <Field label="From">
                            <input
                                type="date"
                                className={inputClass}
                                value={from}
                                onChange={(e) => {
                                    setFrom(e.target.value);
                                    setPreview(null);
                                }}
                            />
                        </Field>
                        <Field label="To">
                            <input
                                type="date"
                                className={inputClass}
                                value={to}
                                onChange={(e) => {
                                    setTo(e.target.value);
                                    setPreview(null);
                                }}
                            />
                        </Field>
                        <Field label={tab === "INVOICE" ? "Client" : "Staff member"}>
                            <select
                                className={inputClass}
                                value={recipient}
                                onChange={(e) => {
                                    setRecipient(e.target.value);
                                    setPreview(null);
                                }}
                            >
                                <option value="">Choose person</option>
                                {people
                                    .filter((p) => p.isClient === (tab === "INVOICE"))
                                    .map((p) => (
                                        <option
                                            key={p.id}
                                            value={p.id}
                                        >
                                            {p.name}
                                        </option>
                                    ))}
                            </select>
                        </Field>
                        <button
                            disabled={busy || !recipient}
                            className={buttonClass}
                            onClick={calculate}
                        >
                            Preview completed visits
                        </button>
                    </div>
                    {record && (
                        <section
                            id="finance-document"
                            className="space-y-4 rounded-xl border bg-white p-6"
                        >
                            <h2 className="text-xl font-semibold">
                                {detail ? documentName(detail) : "Preview"} · {record.recipientName}
                            </h2>
                            <p className="text-sm">
                                {record.from} to {record.to}
                                {detail && ` · ${paymentSummary(detail)}`}
                            </p>
                            <div className="overflow-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr>
                                            {["Date", "Visit", "Hours", "Hourly rate", "Amount"].map((h) => (
                                                <th
                                                    className="p-2"
                                                    key={h}
                                                >
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                            {record.lines.map((l, i) => (
                                            <tr
                                                key={i}
                                                className="border-t"
                                            >
                                                <td className="p-2">{l.date}</td>
                                                <td className="p-2">{l.title}{l.component&&l.component!=="CARE"?<small className="block text-gray-500">{l.component.replaceAll("_"," ")}</small>:null}</td>
                                                <td className="p-2">{(l.minutes / 60).toFixed(2)}</td>
                                                <td className="p-2">{l.hourlyPence === null ? "Rate missing" : money(l.hourlyPence)}</td>
                                                <td className="p-2">{l.amountPence === null ? "-" : money(l.amountPence)}</td>
                                            </tr>
                                        ))}
                                        {!record.lines.length && (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="p-5"
                                                >
                                                    No unprocessed completed visits in this period.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-right text-lg font-semibold">Total: {money(record.totalPence)}</p>
                            {detail&&reconciliation&&<p className={reconciliation.balanced?"rounded bg-green-50 p-3 text-green-800":"rounded bg-red-50 p-3 text-red-800"}>{reconciliation.balanced?`Reconciled: ${reconciliation.lineCount} immutable source lines match the confirmed visit revisions.`:"Reconciliation failed: a source visit or review changed. Void this draft and create a replacement."}</p>}
                            <p className="text-xs text-gray-500">
                                Currency GBP. Based on completed visits and their scheduled duration. No tax, payroll deductions or bank transfer is
                                applied by this document.
                            </p>
                            <div className="flex flex-wrap gap-3 print:hidden">
                                {preview && !detail && (
                                    <button
                                        disabled={busy || !preview.lines.length || preview.missingRates > 0}
                                        className={buttonClass}
                                        onClick={create}
                                    >
                                        Create draft
                                    </button>
                                )}
                                {detail && (
                                    <>
                                        <button
                                            className="rounded border px-3 py-2"
                                            onClick={() => window.print()}
                                        >
                                            Print / Save PDF
                                        </button>
                                        <button
                                            className="rounded border px-3 py-2"
                                            onClick={exportDocument}
                                        >
                                            Export CSV
                                        </button>
                                        {detail.status === "DRAFT" && (
                                            <button
                                                disabled={busy}
                                                className={buttonClass}
                                                onClick={() => transition(detail.kind === "INVOICE" ? "ISSUED" : "APPROVED")}
                                            >
                                                {detail.kind === "INVOICE" ? "Mark issued" : "Approve pay run"}
                                            </button>
                                        )}
                                        {detail.kind==="INVOICE"&&["ISSUED","PAID"].includes(detail.status)&&<button className="rounded border px-3 py-2" onClick={()=>setCredit({financeLineId:detail.lines[0]?.id||"",amount:"",reason:""})}>Create credit note</button>}
                                        {detail.kind === "INVOICE" && detail.status === "ISSUED" &&
                                          <Link className={buttonClass} to="/admin/accounting?section=reconciliation">Reconcile payment</Link>}
                                        {detail.kind === "PAYRUN" && detail.status === "APPROVED" && (
                                            <button
                                                disabled={busy}
                                                className={buttonClass}
                                                onClick={() => transition("PAID")}
                                            >
                                                Record as paid
                                            </button>
                                        )}
                                        {["DRAFT", "ISSUED", "APPROVED"].includes(detail.status) && (
                                            <button
                                                disabled={busy}
                                                className="rounded border border-red-300 px-3 py-2 text-red-800"
                                                onClick={() => transition("VOID")}
                                            >
                                                Void document
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                            {detail && (
                                <style>{`@media print {body *{visibility:hidden} #finance-document,#finance-document *{visibility:visible} #finance-document{position:absolute;left:0;top:0;width:100%;border:0} #finance-document button{display:none}}`}</style>
                            )}
                        </section>
                    )}
                    <h2 className="text-lg font-semibold">Documents covering this period</h2>
                    <div className="overflow-auto rounded-xl border bg-white">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr>
                                    {["Number", "Person", "Period", "Total", "Status", ""].map((h, i) => (
                                        <th
                                            key={i}
                                            className="p-3"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map((d) => (
                                    <tr
                                        key={d.id}
                                        className="border-t"
                                    >
                                        <td className="p-3">{documentName(d)}</td>
                                        <td className="p-3">{d.recipientName}</td>
                                        <td className="p-3">
                                            {d.from} to {d.to}
                                        </td>
                                        <td className="p-3">{money(d.totalPence)}</td>
                                        <td className="p-3">{paymentSummary(d)}</td>
                                        <td className="p-3">
                                            <button
                                                className="underline"
                                                onClick={() => {
                                                    setPreview(null);
                                                    show(d.id);
                                                }}
                                            >
                                                Open
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {!documents.length && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="p-8 text-center text-gray-500"
                                        >
                                            No documents in this period.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {tab==="INVOICE"&&<><h2 className="text-lg font-semibold">Credit notes</h2><div className="overflow-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Number</th><th className="p-3">Invoice</th><th className="p-3">Reason</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{credits.map(c=><tr className="border-t" key={c.id}><td className="p-3">CRN-{String(c.number).padStart(5,"0")}</td><td className="p-3">INV-{String(c.invoiceNumber).padStart(5,"0")}</td><td className="p-3">{c.reason}</td><td className="p-3">-{money(c.totalPence)}</td><td className="p-3">{c.status}</td><td className="p-3"><div className="flex gap-2">{c.status==="DRAFT"&&<button className="underline" onClick={()=>transitionCredit(c,"ISSUED")}>Issue</button>}{c.status==="ISSUED"&&<button className="underline" onClick={()=>transitionCredit(c,"APPLIED")}>Apply</button>}{["DRAFT","ISSUED"].includes(c.status)&&<button className="text-red-700 underline" onClick={()=>transitionCredit(c,"VOID")}>Void</button>}</div></td></tr>)}{!credits.length&&<tr><td colSpan={6} className="p-8 text-center text-gray-500">No credit notes yet.</td></tr>}</tbody></table></div></>}
                    {credit&&detail&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><section className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6" role="dialog" aria-modal="true" aria-label="Create credit note"><h2 className="text-xl font-semibold">Credit {documentName(detail)}</h2><Field label="Invoice line"><select className={inputClass} value={credit.financeLineId} onChange={e=>setCredit({...credit,financeLineId:e.target.value})}>{detail.lines.map(l=><option key={l.id} value={l.id}>{l.date} · {l.title} · {money(l.amountPence)}</option>)}</select></Field><Field label="Credit amount (GBP)"><input className={inputClass} type="number" min="0.01" step="0.01" value={credit.amount} onChange={e=>setCredit({...credit,amount:e.target.value})}/></Field><Field label="Reason"><textarea className={inputClass} minLength={5} maxLength={1000} value={credit.reason} onChange={e=>setCredit({...credit,reason:e.target.value})}/></Field><div className="flex gap-3"><button className="rounded border px-3 py-2" onClick={()=>setCredit(null)}>Cancel</button><button className={buttonClass} disabled={busy||!credit.financeLineId||credit.reason.trim().length<5||!(Number(credit.amount)>0)} onClick={()=>run(async()=>{await _post("/api/finance/credit-notes",{invoiceId:detail.id,reason:credit.reason,lines:[{financeLineId:credit.financeLineId,amountPence:Math.round(Number(credit.amount)*100)}]});setCredit(null);setReload(n=>n+1)})}>Create draft credit note</button></div></section></div>}
                </>
            )}
        </Page>
    );
}
