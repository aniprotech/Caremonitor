import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { _get, _put } from "../../../../utils/ApiService";
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
        [staffRates, setStaffRates] = useState([]);
    const begin = (key, values) => {
        setDraft(
            { address: values.address || "", transportMethod: values.transportMethod || "" },
        );
        setSection(key);
        setError("");
    };
    useEffect(() => {
        const c = new AbortController();
        setData(null);
        setSection(null);
        setError("");
        Promise.all([_get(`/api/team-operations/get/${id}`, { signal: c.signal }), _get("/api/finance/rates", { signal: c.signal })])
            .then(([r, rates]) => {
                if (!c.signal.aborted) {
                    const value = r.data.results.data;
                    setData(value);
                    setStaffRates(rates.data.results.data.filter((rate) => rate.userId === id && rate.kind === "PAY"));
                    if (initialSection === "travel") begin(initialSection, value);
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
                            {canEdit && <Link className="op-link-button" to={`/admin/finances?section=RATES&person=${id}&kind=PAY`}>Manage in Finance</Link>}
                        </header>
                        <dl>
                            <div><dt>Active rate</dt><dd>{activeRate ? `£${((activeRate.ratePence ?? activeRate.hourlyPence) / 100).toFixed(2)} ${rateUnitLabel(activeRate.rateUnit)}` : "Not set"}</dd></div>
                            <div><dt>Effective from</dt><dd>{activeRate?.effectiveFrom || "—"}</dd></div>
                            <div><dt>Travel rate card</dt><dd>{display(data.travelRateCard)}</dd></div>
                        </dl>
                        <p className="op-help">Staff pay rates are set in Finance by an administrator. The latest rate effective on the visit date is used automatically when a pay run is prepared.</p>
                    </section>
                </>
            )}
            {section && canEdit && (
                <div className="op-overlay">
                    <form
                        role="dialog"
                        aria-modal="true"
                        aria-label="Edit travel information"
                        onSubmit={save}
                    >
                        <h2>Travel information</h2>
                        <>
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
                        </>
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
