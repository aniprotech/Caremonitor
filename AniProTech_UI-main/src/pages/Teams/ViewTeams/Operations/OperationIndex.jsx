import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { _get, _post, _put } from "../../../../utils/ApiService";
import useAuthStore from "../../../../stores/authStore";
import "./operations.css";
const names = { CAR: "Car", BICYCLE: "Bicycle", WALKING: "Walking" };
const display = (v) =>
    v
        ? v
              .replaceAll("_", " ")
              .toLowerCase()
              .replace(/^./, (c) => c.toUpperCase())
        : "N/A";
const rateUnitLabel = (unit) => ({ HOURLY: "Per hour", DAILY: "Per day", WEEKLY: "Per week", YEARLY: "Per year" }[unit] || "Per hour");
const todayInLondon = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
export default function OperationIndex({ initialSection = null }) {
    const { id } = useParams(),
        navigate = useNavigate(),
        role = useAuthStore((s) => s.userData?.user?.role);
    const canEdit = ["ADMIN", "SUPERADMIN"].includes(role);
    const [data, setData] = useState(null),
        [section, setSection] = useState(null),
        [draft, setDraft] = useState({}),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [notice, setNotice] = useState(""),
        [staffRates, setStaffRates] = useState([]),
        [travelRates, setTravelRates] = useState([]);
    const begin = (key, values) => {
        setDraft(key === "rate" ? {
            rateUnit: activeRate?.rateUnit || "HOURLY",
            amount: activeRate ? ((activeRate.ratePence ?? activeRate.hourlyPence) / 100).toFixed(2) : "",
            effectiveFrom: activeRate?.effectiveFrom || todayInLondon(),
        } : key === "travel-rate" ? {
            mileage: activeTravelRate ? (Number(activeTravelRate.mileage_pence) / 100).toFixed(2) : "",
            hourly: activeTravelRate ? (Number(activeTravelRate.hourly_pence) / 100).toFixed(2) : "",
            effectiveFrom: todayInLondon(),
            effectiveTo: "",
        } : { address: values.address || "", transportMethod: values.transportMethod || "" });
        setSection(key);
        setError("");
    };
    useEffect(() => {
        const c = new AbortController();
        setData(null);
        setSection(null);
        setError("");
        Promise.all([_get(`/api/team-operations/get/${id}`, { signal: c.signal }), _get("/api/finance/rates", { signal: c.signal }), _get("/api/finance/travel-rates", { signal: c.signal })])
            .then(([r, rates, travel]) => {
                if (!c.signal.aborted) {
                    const value = r.data.results.data;
                    setData(value);
                    setStaffRates(rates.data.results.data.filter((rate) => rate.userId === id && rate.kind === "PAY"));
                    setTravelRates(travel.data.results.data.filter((rate) => rate.user_id === id));
                    if (initialSection === "travel") begin("travel", value);
                    if (initialSection === "rates") begin("rate", value);
                }
            })
            .catch((e) => {
                if (!c.signal.aborted) setError(e.response?.data?.message || "Unable to load operations");
            });
        return () => c.abort();
    }, [id, initialSection]);
    const close = () => {
        setSection(null);
        if (initialSection) navigate(`/admin/teams/${id}/operations`);
    };
    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            const r = await _put(`/api/team-operations/update/${id}`, draft);
            setData(r.data.results.data);
            setNotice("Operations saved.");
            close();
        } catch (e) {
            setError(e.response?.data?.message || "Unable to save operations");
        } finally {
            setBusy(false);
        }
    };
    const saveRate = async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
            await _post("/api/finance/rates", { userId: id, kind: "PAY", rateUnit: draft.rateUnit, effectiveFrom: draft.effectiveFrom, ratePence: Math.round(Number(draft.amount) * 100) });
            const rates = await _get("/api/finance/rates");
            setStaffRates(rates.data.results.data.filter((rate) => rate.userId === id && rate.kind === "PAY"));
            setNotice("Staff pay rate saved. Finance will use it automatically from its effective date."); close();
        } catch (e) { setError(e.response?.data?.message || "Unable to save staff pay rate"); }
        finally { setBusy(false); }
    };
    const saveTravelRate = async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
            await _post("/api/finance/travel-rates", {
                userId: id,
                effectiveFrom: draft.effectiveFrom,
                effectiveTo: draft.effectiveTo || null,
                mileagePence: Math.round(Number(draft.mileage) * 100),
                hourlyPence: Math.round(Number(draft.hourly) * 100),
            });
            const response = await _get("/api/finance/travel-rates");
            setTravelRates(response.data.results.data.filter((rate) => rate.user_id === id));
            setNotice("Travel reimbursement rate saved. Finance and pay-run previews will use it automatically for visits on or after its effective date.");
            close();
        } catch (e) { setError(e.response?.data?.message || "Unable to save travel reimbursement rate"); }
        finally { setBusy(false); }
    };
    const table = (key, title, rows) => (
        <section aria-label={title}>
            <header>
                <h2>{title}</h2>
                {canEdit && (
                    <button
                        aria-label={`Edit ${title.toLowerCase()}`}
                        onClick={() => begin(key, data)}
                    >
                        Edit
                    </button>
                )}
            </header>
            <dl>
                {rows.map(([label, value]) => (
                    <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
    const activeRate = staffRates
        .filter((rate) => rate.effectiveFrom <= todayInLondon())
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
    const activeTravelRate = travelRates
        .filter((rate) => rate.effective_from <= todayInLondon() && (!rate.effective_to || rate.effective_to >= todayInLondon()))
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];
    return (
        <main className="team-operations">
            {error && <p role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            {!data ? (
                <p>Loading operations…</p>
            ) : (
                <>
                    {table("travel", "Travel information", [
                        ["Address", data.address || "None"],
                        ["Transport method", names[data.transportMethod] || "None"],
                    ])}
                    <section aria-label="Staff pay rate">
                        <header>
                            <h2>Staff pay rate</h2>
                            {canEdit && <button aria-label="Edit staff pay rate" onClick={() => begin("rate", data)}>Edit</button>}
                        </header>
                        <dl>
                            <div><dt>Active rate</dt><dd>{activeRate ? `£${((activeRate.ratePence ?? activeRate.hourlyPence) / 100).toFixed(2)} ${rateUnitLabel(activeRate.rateUnit)}` : "Not set"}</dd></div>
                            <div><dt>Effective from</dt><dd>{activeRate?.effectiveFrom || "—"}</dd></div>
                            <div><dt>Travel rate card</dt><dd>{display(data.travelRateCard)}</dd></div>
                        </dl>
                        <p className="op-help">Choose a rate unit and amount here. Finance automatically uses the latest rate effective on each visit date when preparing a pay run.</p>
                    </section>
                    <section aria-label="Travel reimbursement rate">
                        <header>
                            <h2>Travel reimbursement rate</h2>
                            {canEdit && <button aria-label="Edit travel reimbursement rate" onClick={() => begin("travel-rate", data)}>Edit</button>}
                        </header>
                        <dl>
                            <div><dt>GBP per mile</dt><dd>{activeTravelRate ? `£${(Number(activeTravelRate.mileage_pence) / 100).toFixed(2)}` : "Not set"}</dd></div>
                            <div><dt>GBP per travel hour</dt><dd>{activeTravelRate ? `£${(Number(activeTravelRate.hourly_pence) / 100).toFixed(2)}` : "Not set"}</dd></div>
                            <div><dt>Effective from</dt><dd>{activeTravelRate?.effective_from?.slice(0, 10) || "—"}</dd></div>
                        </dl>
                        <p className="op-help">These are the carer&apos;s separate mileage and paid travel-time amounts. Finance automatically pre-fills them when this carer is selected and uses them in pay-run previews for approved travel.</p>
                    </section>
                </>
            )}
            {section && canEdit && (
                <div className="op-overlay">
                    <form
                        role="dialog"
                        aria-modal="true"
                        aria-label={section === "rate" ? "Edit staff pay rate" : section === "travel-rate" ? "Edit travel reimbursement rate" : "Edit travel information"}
                        onSubmit={section === "rate" ? saveRate : section === "travel-rate" ? saveTravelRate : save}
                    >
                        <h2>{section === "rate" ? "Staff pay rate" : section === "travel-rate" ? "Travel reimbursement rate" : "Travel information"}</h2>
                        {section === "rate" ? <>
                            <label>Rate unit<select value={draft.rateUnit} onChange={(e) => setDraft({ ...draft, rateUnit: e.target.value })}><option value="HOURLY">Per hour</option><option value="DAILY">Per day</option><option value="WEEKLY">Per week</option><option value="YEARLY">Per year</option></select></label>
                            <label>Rate (GBP)<input required type="number" min="0" max="1000000" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></label>
                            <label>Effective from<input required type="date" value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} /></label>
                        </> : section === "travel-rate" ? <>
                            <label>GBP per mile<input required type="number" min="0" max="1000" step="0.01" value={draft.mileage} onChange={(e) => setDraft({ ...draft, mileage: e.target.value })} /></label>
                            <label>GBP per travel hour<input required type="number" min="0" max="10000" step="0.01" value={draft.hourly} onChange={(e) => setDraft({ ...draft, hourly: e.target.value })} /></label>
                            <label>Effective from<input required type="date" value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} /></label>
                            <label>Effective to (optional)<input type="date" min={draft.effectiveFrom} value={draft.effectiveTo} onChange={(e) => setDraft({ ...draft, effectiveTo: e.target.value })} /></label>
                        </> : <>
                                <label>
                                    Address
                                    <textarea
                                        maxLength={1000}
                                        value={draft.address}
                                        onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                                    />
                                </label>
                                <label>
                                    Transport method
                                    <select
                                        value={draft.transportMethod}
                                        onChange={(e) => setDraft({ ...draft, transportMethod: e.target.value })}
                                    >
                                        <option value="">None</option>
                                        {Object.entries(names).map(([v, n]) => (
                                            <option
                                                key={v}
                                                value={v}
                                            >
                                                {n}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                        </>}
                        {error && <p role="alert">{error}</p>}
                        <footer>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={close}
                            >
                                Cancel
                            </button>
                            <button
                                className="op-save"
                                disabled={busy}
                            >
                                {busy ? "Saving…" : "Save changes"}
                            </button>
                        </footer>
                    </form>
                </div>
            )}
        </main>
    );
}
