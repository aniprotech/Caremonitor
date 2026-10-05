import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { _get, _post } from "../../utils/ApiService";
import { londonToday, money } from "../../components/Operations/common";
import FinanceWorkspace from "./FinanceWorkspace";
import "./finance.css";
const read = async (path, params) => (await _get(path, { params })).data.results.data;
const hours = (minutes = 0) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
function Overview({ overview }) {
    if (!overview) return <p>Loading finance overview…</p>;
    return (
        <div className="fin-content">
            <div className="fin-summary">
                <article><strong>{overview.clients.reduce((n, x) => n + x.visits, 0)}</strong><span>client visits confirmed</span></article>
                <article><strong>{hours(overview.clients.reduce((n, x) => n + x.confirmedMinutes, 0))}</strong><span>invoice time</span></article>
                <article><strong>{hours(overview.staff.reduce((n, x) => n + x.confirmedMinutes, 0))}</strong><span>payroll time</span></article>
            </div>
            <h3>Employee hours</h3>
            <div className="fin-table"><table><thead><tr><th>Employee</th><th>Confirmed</th><th>Contract allowance</th><th>Variance</th><th>Visits</th></tr></thead><tbody>{overview.staff.map(x=><tr key={x.id}><td>{x.name}</td><td>{hours(x.confirmedMinutes)}</td><td>{hours(x.contractMinutes)}</td><td className={x.confirmedMinutes>x.contractMinutes?'fin-warning':''}>{hours(Math.abs(x.confirmedMinutes-x.contractMinutes))} {x.confirmedMinutes>x.contractMinutes?'over':'remaining'}</td><td>{x.visits}</td></tr>)}</tbody></table></div>
            <h3>Client service hours</h3>
            <div className="fin-table"><table><thead><tr><th>Client</th><th>Confirmed</th><th>Service allowance</th><th>Variance</th><th>Visits</th></tr></thead><tbody>{overview.clients.map(x=><tr key={x.id}><td>{x.name}</td><td>{hours(x.confirmedMinutes)}</td><td>{hours(x.serviceMinutes)}</td><td className={x.confirmedMinutes>x.serviceMinutes?'fin-warning':''}>{hours(Math.abs(x.confirmedMinutes-x.serviceMinutes))} {x.confirmedMinutes>x.serviceMinutes?'over':'remaining'}</td><td>{x.visits}</td></tr>)}</tbody></table></div>
        </div>
    );
}
export default function FinanceIndex() {
    const [section, setSection] = useState("VISITS"),
        [from, setFrom] = useState(londonToday),
        [to, setTo] = useState(londonToday),
        [data, setData] = useState({ visits: [], groups: [] }),
        [people, setPeople] = useState([]),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [reload, setReload] = useState(0),
        [selected, setSelected] = useState([]),
        [filter, setFilter] = useState({ client: "", carer: "", completed: "", edited: "", discrepancy: "", group: "" }),
        [folder, setFolder] = useState("ALL"),
        [kind, setKind] = useState("PAY"),
        [basis, setBasis] = useState("ACTUAL"),
        [review, setReview] = useState(null),
        [travelEntry,setTravelEntry]=useState(null),
        [reason, setReason] = useState(""),
        [saved, setSaved] = useState(""),
        [history, setHistory] = useState([]),
        [travel, setTravel] = useState([]),
        [overview, setOverview] = useState(null),
        [services, setServices] = useState([]),
        [serviceRate, setServiceRate] = useState({ userId: "", effectiveFrom: londonToday(), weeklyHours: "", fundingSource: "", reference: "" }),
        [rate, setRate] = useState({ userId: "", effectiveFrom: londonToday(), mileage: "", hourly: "" });
    useEffect(() => {
        let active = true;
        setBusy(true);
        setError("");
        setSelected([]);
        Promise.all([
            read("/api/finance/options"),
            section === "VISITS"
                ? read("/api/finance/visits", { from, to })
                : section === "HISTORY"
                  ? read("/api/finance/history")
                  : section === "TRAVEL"
                    ? read("/api/finance/travel-rates")
                    : section === "OVERVIEW"
                      ? read("/api/finance/overview", { from, to })
                      : section === "SERVICES"
                        ? read("/api/finance/service-hours")
                    : Promise.resolve(null),
        ])
            .then(([o, r]) => {
                if (!active) return;
                setPeople(o.people);
                if (section === "VISITS") setData(r);
                if (section === "HISTORY") setHistory(r);
                if (section === "TRAVEL") setTravel(r);
                if (section === "OVERVIEW") setOverview(r);
                if (section === "SERVICES") setServices(r);
            })
            .catch((e) => {
                if (active) setError(e.response?.data?.message || "Unable to load finance");
            })
            .finally(() => {
                if (active) setBusy(false);
            });
        return () => {
            active = false;
        };
    }, [from, to, section, reload]);
    const decision = (v, k) => v.reviews.find((r) => r.kind === k);
    const label = (v, k) => {
        if (v.locked.includes(k === "PAY" ? "PAYRUN" : "INVOICE")) return "In document";
        const r = decision(v, k);
        return !r
            ? "Needs review"
            : r.visit_revision !== v.revision
              ? "Review again"
              : r.state === "DISCARDED"
                ? "Discarded"
                : `${r.minutes} min · ${r.basis.toLowerCase()}`;
    };
    const rows = data.visits.filter(
        (v) =>
            (!filter.client || v.clientId === filter.client) &&
            (!filter.carer || v.staffId === filter.carer) &&
            (!filter.completed || (v.status === "COMPLETED") === (filter.completed === "yes")) &&
            (!filter.edited || v.edited === (filter.edited === "yes")) &&
            (!filter.discrepancy || (v.actual == null || v.actual !== v.planned) === (filter.discrepancy === "yes")) &&
            (!filter.group || data.groups.some((g) => g.user_id === v.staffId && g.groups.includes(filter.group))) &&
            (folder === "ALL" || label(v, folder) === "Discarded"),
    );
    const selectable = rows.filter((v) => !v.locked.includes(kind === "PAY" ? "PAYRUN" : "INVOICE"));
    const change = (key, value) => {
        setFilter((f) => ({ ...f, [key]: value }));
        setSelected([]);
    };
    async function saveReview() {
        setBusy(true);
        setError("");
        try {
            await _post("/api/finance/visits/review", {
                items: rows
                    .filter((v) => selected.includes(v.id))
                    .map((v) => ({ id: v.id, revision: v.revision, reviewRevision: decision(v, kind)?.revision || 0 })),
                kind,
                basis,
                state: review,
                reason,
            });
            setReview(null);
            setReason("");
            setSaved("Finance review saved.");
            setReload((n) => n + 1);
        } catch (e) {
            setError(e.response?.data?.message || "Unable to save review");
        } finally {
            setBusy(false);
        }
    }
    const go = (s) => {
        setSection(s);
        setSaved("");
        setError("");
    };
    return (
        <div className="finance-shell">
            <aside>
                <h1>Finance</h1>
                {[
                    ["OVERVIEW", "Finance overview"],
                    ["VISITS", "Confirm visits"],
                    ["INVOICE", "Manage invoicing"],
                    ["RATES", "Invoice & pay rates"],
                    ["PAYRUN", "Manage payroll"],
                    ["SERVICES", "Client service hours"],
                    ["TRAVEL", "Travel rates"],
                    ["HISTORY", "Change history"],
                ].map(([key, name]) => (
                    <button
                        key={key}
                        className={section === key ? "active" : ""}
                        onClick={() => go(key)}
                    >
                        {name}
                    </button>
                ))}
            </aside>
            <main>
                <header>
                    <h2>
                        {section === "VISITS"
                            ? "Confirm visits"
                            : section === "OVERVIEW"
                              ? "Employee and client hours"
                              : section === "SERVICES"
                                ? "Client service hours"
                            : section === "TRAVEL"
                              ? "Travel rates"
                              : section === "HISTORY"
                                ? "Change history"
                                : "Finance workspace"}
                    </h2>
                    <span>GBP · Europe/London</span>
                </header>
                {error && (
                    <p
                        className="fin-error"
                        role="alert"
                    >
                        {error}
                    </p>
                )}
                {saved && <p role="status">{saved}</p>}
                {section === "OVERVIEW" ? (
                    <Overview overview={overview} />
                ) : section === "SERVICES" ? (
                    <div className="fin-content">
                        <p>Set each client&apos;s weekly commissioned or private service allowance. Effective dates preserve historical calculations.</p>
                        <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");try{await _post("/api/finance/service-hours",{...serviceRate,weeklyMinutes:Math.round(Number(serviceRate.weeklyHours)*60)});setSaved("Client service hours saved.");setReload(n=>n+1)}catch(e){setError(e.response?.data?.message||"Unable to save service hours")}finally{setBusy(false)}}}>
                            <label>Client<select required value={serviceRate.userId} onChange={e=>setServiceRate({...serviceRate,userId:e.target.value})}><option value="">Select client</option>{people.filter(p=>p.isClient).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                            <label>Effective from<input required type="date" value={serviceRate.effectiveFrom} onChange={e=>setServiceRate({...serviceRate,effectiveFrom:e.target.value})}/></label>
                            <label>Hours per week<input required type="number" min="0" max="168" step="0.25" value={serviceRate.weeklyHours} onChange={e=>setServiceRate({...serviceRate,weeklyHours:e.target.value})}/></label>
                            <label>Funding source<input maxLength={100} placeholder="Council, NHS, private…" value={serviceRate.fundingSource} onChange={e=>setServiceRate({...serviceRate,fundingSource:e.target.value})}/></label>
                            <label>Agreement reference<input maxLength={100} value={serviceRate.reference} onChange={e=>setServiceRate({...serviceRate,reference:e.target.value})}/></label>
                            <button disabled={busy}>Save service hours</button>
                        </form>
                        {services.map(x=><article key={x.id}><strong>{x.name}</strong><p>{hours(x.weeklyMinutes)} per week from {x.effectiveFrom}</p><p>{x.fundingSource||"Funding source not recorded"}{x.reference?` · ${x.reference}`:""}</p></article>)}
                    </div>
                ) : ["INVOICE", "PAYRUN", "RATES"].includes(section) ? (
                    <FinanceWorkspace
                        key={section}
                        initialTab={section}
                    />
                ) : section === "HISTORY" ? (
                    <div className="fin-content">
                        <p>Latest 100 finance decisions and rate changes.</p>
                        {history.map((h, i) => (
                            <article key={i}>
                                <strong>{h.action.replaceAll("_", " ")}</strong>
                                <p>
                                    {h.actor} · {new Date(h.created_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}
                                </p>
                                <p>{h.snapshot.reason || `Effective ${h.snapshot.effectiveFrom}`}</p>
                                <p>
                                    {h.snapshot.kind} {h.snapshot.state} {h.snapshot.basis}{" "}
                                    {h.snapshot.minutes != null ? `${h.snapshot.minutes} minutes` : ""}
                                </p>
                            </article>
                        ))}
                    </div>
                ) : section === "TRAVEL" ? (
                    <div className="fin-content">
                        <p>
                            Effective-dated staff travel rates. Approved mileage and travel time recorded against completed visits are automatically included in pay-run drafts.
                        </p>
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                setBusy(true);
                                setError("");
                                try {
                                    await _post("/api/finance/travel-rates", {
                                        userId: rate.userId,
                                        effectiveFrom: rate.effectiveFrom,
                                        mileagePence: Math.round(Number(rate.mileage) * 100),
                                        hourlyPence: Math.round(Number(rate.hourly) * 100),
                                    });
                                    setSaved("Travel rate saved.");
                                    setReload((n) => n + 1);
                                } catch (e) {
                                    setError(e.response?.data?.message || "Unable to save rate");
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            <label>
                                Carer
                                <select
                                    required
                                    value={rate.userId}
                                    onChange={(e) => setRate({ ...rate, userId: e.target.value })}
                                >
                                    <option value="">Select staff</option>
                                    {people
                                        .filter((p) => !p.isClient)
                                        .map((p) => (
                                            <option
                                                key={p.id}
                                                value={p.id}
                                            >
                                                {p.name}
                                            </option>
                                        ))}
                                </select>
                            </label>
                            <label>
                                Effective from
                                <input
                                    required
                                    type="date"
                                    value={rate.effectiveFrom}
                                    onChange={(e) => setRate({ ...rate, effectiveFrom: e.target.value })}
                                />
                            </label>
                            {[
                                ["mileage", "GBP per mile"],
                                ["hourly", "GBP per travel hour"],
                            ].map(([key, name]) => (
                                <label key={key}>
                                    {name}
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={rate[key]}
                                        onChange={(e) => setRate({ ...rate, [key]: e.target.value })}
                                    />
                                </label>
                            ))}
                            <button disabled={busy}>Save rate</button>
                        </form>
                        {travel.map((r) => (
                            <article key={r.id}>
                                {r.name} · {r.effective_from.slice(0, 10)} · {money(r.mileage_pence)}/mile · {money(r.hourly_pence)}/hour
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="fin-content">
                        <div className="fin-filters">
                            <label>
                                Period from
                                <input
                                    type="date"
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                />
                            </label>
                            <label>
                                Period to
                                <input
                                    type="date"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                />
                            </label>
                            {[
                                ["client", "Care recipient", true],
                                ["carer", "Caregiver", false],
                            ].map(([key, name, isClient]) => (
                                <label key={key}>
                                    {name}
                                    <select
                                        value={filter[key]}
                                        onChange={(e) => change(key, e.target.value)}
                                    >
                                        <option value="">All</option>
                                        {people
                                            .filter((p) => p.isClient === isClient)
                                            .map((p) => (
                                                <option
                                                    key={p.id}
                                                    value={p.id}
                                                >
                                                    {p.name}
                                                </option>
                                            ))}
                                    </select>
                                </label>
                            ))}
                            {[
                                ["completed", "Visit completed"],
                                ["edited", "Timings edited"],
                                ["discrepancy", "Discrepancy / missing actuals"],
                            ].map(([key, name]) => (
                                <label key={key}>
                                    {name}
                                    <select
                                        value={filter[key]}
                                        onChange={(e) => change(key, e.target.value)}
                                    >
                                        <option value="">All</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                </label>
                            ))}
                            <label>
                                Caregiver group
                                <select
                                    value={filter.group}
                                    onChange={(e) => change("group", e.target.value)}
                                >
                                    <option value="">All</option>
                                    {[...new Set(data.groups.flatMap((g) => g.groups))].map((g) => (
                                        <option key={g}>{g}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <nav className="fin-tabs">
                            {[
                                ["ALL", "Scheduled visits"],
                                ["PAY", "Discarded from payroll"],
                                ["BILLING", "Discarded from invoicing"],
                            ].map(([k, n]) => (
                                <button
                                    key={k}
                                    className={folder === k ? "active" : ""}
                                    onClick={() => {
                                        setFolder(k);
                                        setSelected([]);
                                    }}
                                >
                                    {n}
                                </button>
                            ))}
                        </nav>
                        <div className="fin-toolbar">
                            <label>
                                Review for
                                <select
                                    value={kind}
                                    onChange={(e) => {
                                        setKind(e.target.value);
                                        setSelected([]);
                                    }}
                                >
                                    <option value="PAY">Payroll</option>
                                    <option value="BILLING">Invoicing</option>
                                </select>
                            </label>
                            <label>
                                Use time
                                <select
                                    value={basis}
                                    onChange={(e) => setBasis(e.target.value)}
                                >
                                    <option value="ACTUAL">Actuals</option>
                                    <option value="PLANNED">Planned</option>
                                </select>
                            </label>
                            <span>{selected.length} selected</span>
                            <button
                                disabled={!selected.length || busy || !!error}
                                onClick={() => setReview("DISCARDED")}
                            >
                                Discard
                            </button>
                            <button
                                className="primary"
                                disabled={!selected.length || busy || !!error}
                                onClick={() => setReview("CONFIRMED")}
                            >
                                Review & confirm
                            </button>
                        </div>
                        <p className="fin-hint">
                            Confirm payroll and invoicing separately. Changed visits need another review. Visits already in a finance document are
                            locked for that purpose.
                        </p>
                        <div className="fin-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>
                                            <input
                                                aria-label="Select visible visits"
                                                type="checkbox"
                                                checked={selectable.length > 0 && selected.length === Math.min(selectable.length, 100)}
                                                onChange={(e) => setSelected(e.target.checked ? selectable.slice(0, 100).map((v) => v.id) : [])}
                                            />
                                        </th>
                                        {["Date", "People", "Planned", "Actual", "Difference", "Paid time", "Invoiced time", "Status"].map((n) => (
                                            <th key={n}>{n}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {!busy &&
                                        !error &&
                                        rows.map((v) => (
                                            <tr key={v.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Select ${v.client} ${v.date} ${v.startTime}`}
                                                        disabled={v.locked.includes(kind === "PAY" ? "PAYRUN" : "INVOICE")}
                                                        checked={selected.includes(v.id)}
                                                        onChange={(e) =>
                                                            setSelected((ids) =>
                                                                e.target.checked ? [...ids, v.id].slice(0, 100) : ids.filter((id) => id !== v.id),
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    {v.date}
                                                    <br />
                                                    {v.startTime}–{v.endTime}
                                                </td>
                                                <td>
                                                    <Link to={`/admin/clients/${v.clientId}/carer-feed?visit=${v.id}`}>{v.client}</Link>
                                                    <br />
                                                    {v.carer || "Unassigned"}
                                                </td>
                                                <td>{v.planned} min</td>
                                                <td>{v.actual == null ? "Missing" : `${v.actual} min`}</td>
                                                <td className={v.actual !== v.planned ? "fin-warning" : ""}>
                                                    {v.actual == null ? "Needs review" : `${v.actual - v.planned} min`}
                                                </td>
                                                <td>{label(v, "PAY")}</td>
                                                <td>{label(v, "BILLING")}</td>
                                                <td>
                                                    {v.status.replaceAll("_", " ")}
                                                    {v.edited ? " · Edited" : ""}
                                                    {v.travel?<><br/>{v.travel.miles} miles · {v.travel.minutes} travel min</>:null}
                                                    {v.status==="COMPLETED"&&v.staffId&&!v.locked.includes("PAYRUN")&&<><br/><button className="underline" onClick={()=>setTravelEntry({visitId:v.id,miles:String(v.travel?.miles||""),minutes:String(v.travel?.minutes||""),source:v.travel?.source||"ACTUAL",expectedRevision:v.travel?.revision||0,label:`${v.client} · ${v.date}`})}>{v.travel?"Edit travel":"Record travel"}</button></>}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                        {busy ? (
                            <p>Loading…</p>
                        ) : !rows.length ? (
                            <p>No visits match this period and filters.</p>
                        ) : (
                            <p>{rows.length} visits · Select up to 100 per review</p>
                        )}
                    </div>
                )}
                {review && (
                    <div className="fin-overlay">
                        <section
                            role="dialog"
                            aria-modal="true"
                            aria-label="Review finance decisions"
                        >
                            <h2>
                                {review === "CONFIRMED" ? "Confirm" : "Discard"} {selected.length} visits for{" "}
                                {kind === "PAY" ? "payroll" : "invoicing"}
                            </h2>
                            <p>Time basis: {basis.toLowerCase()}. This decision is recorded with your name and reason.</p>
                            <label>
                                Reason
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    maxLength={1000}
                                />
                            </label>
                            {error && <p role="alert">{error}</p>}
                            <button
                                disabled={busy}
                                onClick={() => setReview(null)}
                            >
                                Cancel
                            </button>
                            <button
                                disabled={busy || reason.trim().length < 5}
                                onClick={saveReview}
                            >
                                Save review
                            </button>
                        </section>
                    </div>
                )}
                {travelEntry&&<div className="fin-overlay"><section role="dialog" aria-modal="true" aria-label="Record visit travel"><h2>Record payable travel</h2><p>{travelEntry.label}. Enter verified journey values; these will be snapshotted into the staff pay run.</p><label>Miles<input type="number" min="0" max="10000" step="0.1" value={travelEntry.miles} onChange={e=>setTravelEntry({...travelEntry,miles:e.target.value})}/></label><label>Travel minutes<input type="number" min="0" max="1440" value={travelEntry.minutes} onChange={e=>setTravelEntry({...travelEntry,minutes:e.target.value})}/></label><label>Source<select value={travelEntry.source} onChange={e=>setTravelEntry({...travelEntry,source:e.target.value})}><option value="ACTUAL">Verified actual</option><option value="ESTIMATE">Approved estimate</option></select></label>{error&&<p role="alert">{error}</p>}<button disabled={busy} onClick={()=>setTravelEntry(null)}>Cancel</button><button disabled={busy||!(Number(travelEntry.miles)>=0)||!(Number(travelEntry.minutes)>=0)} onClick={async()=>{setBusy(true);setError("");try{await _post("/api/finance/travel",{visitId:travelEntry.visitId,miles:Number(travelEntry.miles),minutes:Number(travelEntry.minutes),source:travelEntry.source,expectedRevision:travelEntry.expectedRevision});setTravelEntry(null);setSaved("Visit travel saved for payroll.");setReload(n=>n+1)}catch(e){setError(e.response?.data?.message||"Unable to save travel")}finally{setBusy(false)}}}>Save travel</button></section></div>}
            </main>
        </div>
    );
}
