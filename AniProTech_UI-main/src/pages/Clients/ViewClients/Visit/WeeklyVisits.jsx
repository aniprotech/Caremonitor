import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Bell, CheckSquare, Clock, ChevronLeft, ChevronRight, Plus, Download, X } from "lucide-react";
import { _get, _post, _put } from "../../../../utils/ApiService";
import { useGlobalStore } from "../../../../stores/useGlobalStore";
import { addDays, londonToday, monday, bands, bandFor, demoSchedule, demoDetail } from "./visit-demo";
import "./weekly-visits.css";
import HourlyCalendar from "../Calendar/HourlyCalendar";
const statuses = { DRAFT: "Draft", SCHEDULED: "Scheduled", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const label = (d, options = { day: "numeric", month: "short" }) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(new Date(d));
const stamp = (v) =>
    v ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }).format(new Date(v)) : "Not recorded";
const duration = (m) => (m == null ? "Not recorded" : m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
const reason = (v) =>
    [
        v.status === "DRAFT" ? "Draft needs scheduling" : null,
        !v.staffId && ["DRAFT", "SCHEDULED", "IN_PROGRESS"].includes(v.status) ? "No carer assigned" : null,
        v.alerts ? `${v.alerts} open alerts` : null,
        v.overdue ? "Start time has passed" : null,
    ]
        .filter(Boolean)
        .join(" · ");
const errorText = (e) => e.response?.data?.message || "Unable to load visits. Please retry.";
const tabs = ["Details", "Alerts", "Activities", "Observations", "Care team", "Timeline"];
function VisitEditor({ initial, staff, onSave, onClose }) {
    const [v, set] = useState(initial),
        [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    const change = (key, value) => set((x) => ({ ...x, [key]: value }));
    return (
        <div className="wv-overlay">
            <form
                className="wv-editor"
                role="dialog"
                aria-modal="true"
                aria-label={v.id ? "Edit visit" : "Add visit"}
                onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                        await onSave(v);
                    } catch (e) {
                        setError(errorText(e));
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <header>
                    <h2>{v.id ? "Edit visit" : "Add visit"}</h2>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onClose}
                        aria-label="Close visit form"
                    >
                        <X size={18} />
                    </button>
                </header>
                <div className="wv-form-body">
                    <label>
                        Visit title
                        <input
                            required
                            maxLength={160}
                            value={v.title}
                            onChange={(e) => change("title", e.target.value)}
                        />
                    </label>
                    <label>
                        Date
                        <input
                            required
                            type="date"
                            value={v.date}
                            onChange={(e) => change("date", e.target.value)}
                        />
                    </label>
                    <div className="wv-two">
                        <label>
                            Start time
                            <input
                                required
                                type="time"
                                value={v.startTime}
                                onChange={(e) => change("startTime", e.target.value)}
                            />
                        </label>
                        <label>
                            End time
                            <input
                                required
                                type="time"
                                value={v.endTime}
                                onChange={(e) => change("endTime", e.target.value)}
                            />
                        </label>
                    </div>
                    <label>
                        Assigned carer
                        <select
                            aria-label="Assigned carer"
                            value={v.staffId || ""}
                            onChange={(e) => change("staffId", e.target.value || null)}
                        >
                            <option value="">Unassigned</option>
                            {staff.map((s) => (
                                <option
                                    key={s.id}
                                    value={s.id}
                                >
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Status
                        <select
                            aria-label="Visit status"
                            value={v.status}
                            onChange={(e) => change("status", e.target.value)}
                        >
                            <option value="DRAFT">Draft</option>
                            <option value="SCHEDULED">Scheduled</option>
                        </select>
                    </label>
                    {!v.id && (
                        <fieldset className="wv-recurrence">
                            <legend>Select frequency</legend>
                            <div className="wv-frequency" role="group" aria-label="Visit frequency">
                                {["DAILY", "WEEKLY", "CUSTOM"].map((frequency) => (
                                    <button type="button" key={frequency} className={v.frequency === frequency ? "active" : ""} onClick={() => change("frequency", frequency)}>
                                        {frequency[0] + frequency.slice(1).toLowerCase()}
                                    </button>
                                ))}
                            </div>
                            {v.frequency !== "DAILY" && (
                                <div className="wv-days" role="group" aria-label="Repeat on days">
                                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((short, index) => {
                                        const day = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"][index];
                                        const selected = v.selectedDays?.includes(day);
                                        return <button type="button" key={day} className={selected ? "active" : ""} onClick={() => change("selectedDays", selected ? v.selectedDays.filter((x) => x !== day) : [...v.selectedDays, day])}>{short}</button>;
                                    })}
                                </div>
                            )}
                            <div className="wv-two">
                                <label>Repeats every<input type="number" min={1} max={12} value={v.repeatEvery} onChange={(e) => change("repeatEvery", Number(e.target.value))} /></label>
                                <label>Unit<select value={v.repeatUnit} onChange={(e) => change("repeatUnit", e.target.value)}><option value="DAYS">Days</option><option value="WEEKS">Weeks</option></select></label>
                            </div>
                            <div className="wv-end-date">
                                <div className="wv-end-date-heading">
                                    <label htmlFor="visit-end-date">Ends (optional)</label>
                                    {v.endDate && <button type="button" className="wv-clear-date" onClick={() => change("endDate", null)}>Clear date</button>}
                                </div>
                                <input id="visit-end-date" type="date" min={v.date} value={v.endDate || ""} onChange={(e) => change("endDate", e.target.value || null)} />
                            </div>
                            {!v.endDate && <p className="wv-muted">No end date creates visits for the next 12 weeks. You can add future schedules later.</p>}
                        </fieldset>
                    )}
                    <label>
                        Visit instructions
                        <textarea
                            rows={5}
                            maxLength={4000}
                            value={v.notes || ""}
                            onChange={(e) => change("notes", e.target.value)}
                        />
                    </label>
                    <p className="wv-muted">Europe/London time. Availability and overlapping visits are checked when saving.</p>
                    {error && (
                        <p
                            role="alert"
                            className="wv-error"
                        >
                            {error}
                        </p>
                    )}
                </div>
                <footer>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        disabled={busy}
                        className="wv-primary"
                    >
                        {busy ? "Saving…" : "Save visit"}
                    </button>
                </footer>
            </form>
        </div>
    );
}
export default function WeeklyVisits({ calendar = false }) {
    const { id } = useParams(),
        { clientsPersonalDetailData: client } = useGlobalStore();
    const [searchParams] = useSearchParams();
    const requestedDate = searchParams.get("date");
    const requestedVisit = searchParams.get("visit");
    const openedVisit = useRef(null);
    const [week, setWeek] = useState(() => monday(/^\d{4}-\d{2}-\d{2}$/.test(requestedDate || "") ? requestedDate : londonToday())),
        [data, setData] = useState({ visits: [], plannedTasks: [], canManage: false }),
        [staffOptions, setStaffOptions] = useState([]),
        [loading, setLoading] = useState(true),
        [error, setError] = useState(""),
        [version, setVersion] = useState(0);
    const [demo, setDemo] = useState(false),
        [status, setStatus] = useState(""),
        [staff, setStaff] = useState(""),
        [onlyReview, setOnlyReview] = useState(false),
        [showTasks, setShowTasks] = useState(true),
        [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null),
        [detail, setDetail] = useState(null),
        [detailError, setDetailError] = useState(""),
        [tab, setTab] = useState("Details"),
        [editor, setEditor] = useState(null),
        [notice, setNotice] = useState("");
    useEffect(() => {
        setSelected(null);
        setEditor(null);
        setDemo(false);
        setStaff("");
        setStatus("");
        setSearch("");
        setOnlyReview(false);
    }, [id]);
    useEffect(() => {
        const c = new AbortController();
        setLoading(true);
        setError("");
        _get(`/api/clients/${id}/visit-schedule`, { params: { from: week, to: addDays(week, 6) }, signal: c.signal })
            .then((r) => {
                if (!c.signal.aborted) setData(r.data.results.data);
            })
            .catch((e) => {
                if (!c.signal.aborted) setError(errorText(e));
            })
            .finally(() => {
                if (!c.signal.aborted) setLoading(false);
            });
        return () => c.abort();
    }, [id, week, version]);
    useEffect(() => {
        if (requestedVisit && openedVisit.current !== `${id}:${requestedVisit}`) {
            const matching = data.visits.find((visit) => visit.id === requestedVisit);
            if (matching) {
                openedVisit.current = `${id}:${requestedVisit}`;
                setSelected(matching);
            }
        }
    }, [data.visits, id, requestedVisit]);
    useEffect(() => {
        const c = new AbortController();
        _get("/api/roster/options", { signal: c.signal })
            .then((r) => {
                if (!c.signal.aborted) setStaffOptions(r.data.results.data.staff);
            })
            .catch(() => {});
        return () => c.abort();
    }, [id]);
    useEffect(() => {
        setDetail(null);
        setDetailError("");
        if (!selected) return;
        if (selected.demo) {
            setDetail(demoDetail(selected));
            return;
        }
        const c = new AbortController();
        _get(`/api/clients/${id}/visits/${selected.id}`, { signal: c.signal })
            .then((r) => {
                if (!c.signal.aborted) setDetail(r.data.results.data);
            })
            .catch((e) => {
                if (!c.signal.aborted) setDetailError(errorText(e));
            });
        return () => c.abort();
    }, [id, selected, version]);
    const shown = useMemo(() => (demo ? demoSchedule(week) : data), [demo, week, data]);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(week, i));
    const visits = shown.visits.filter(
        (v) =>
            (!status || v.status === status) &&
            (!staff || (staff === "unassigned" ? !v.staffId : v.staffId === staff)) &&
            (!onlyReview || reason(v)) &&
            `${v.title} ${v.staffName || ""} ${v.notes || ""}`.toLowerCase().includes(search.toLowerCase()),
    );
    const carers = [...new Map(shown.visits.filter((v) => v.staffId).map((v) => [v.staffId, { id: v.staffId, name: v.staffName }])).values()];
    const changeWeek = (d) => {
        setWeek(monday(d));
        setSelected(null);
    };
    const download = () => {
        const cell = (v) =>
            '"' +
            String(v ?? "")
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
            '"';
        const rows = [
            [
                "Date",
                "Start (Europe/London)",
                "End",
                "Visit",
                "Status",
                "Carer",
                "Completed activities",
                "Total activities",
                "Planned minutes",
                "Actual minutes",
                "Review reasons",
                "Demo",
            ],
            ...visits.map((v) => [
                v.date,
                v.startTime,
                v.endTime,
                v.title,
                statuses[v.status],
                v.staffName || "Unassigned",
                v.taskDone,
                v.taskTotal,
                v.plannedMinutes,
                v.actualMinutes,
                reason(v),
                demo ? "Yes" : "No",
            ]),
        ];
        const url = URL.createObjectURL(
            new Blob(["\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `${demo ? "demo-" : ""}visits-${week}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const v = detail?.visit;
    return (
        <section className="weekly-visits">
            <header className="wv-toolbar">
                <div className="wv-title">
                    <h1>
                        {client?.firstName || "Client"}’s {calendar ? "calendar" : "visit schedule"}
                    </h1>
                    <button
                        className={"wv-review " + (onlyReview ? "active" : "")}
                        aria-pressed={onlyReview}
                        onClick={() => setOnlyReview((x) => !x)}
                    >
                        {shown.visits.filter((x) => reason(x)).length} visits need reviewing ▾
                    </button>
                </div>
                <div className="wv-controls">
                    <button
                        aria-label="Previous week"
                        onClick={() => changeWeek(addDays(week, -7))}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        aria-label="Next week"
                        onClick={() => changeWeek(addDays(week, 7))}
                    >
                        <ChevronRight size={18} />
                    </button>
                    <span className="wv-week-label">
                        {label(week)} – {label(addDays(week, 6))}
                    </span>
                    <button onClick={() => changeWeek(londonToday())}>Today</button>
                    {data.canManage && !demo && (
                        <button
                            className="wv-primary"
                            onClick={() =>
                                setEditor({
                                    clientId: id,
                                    date: week,
                                    startTime: "07:00",
                                    endTime: "08:00",
                                    staffId: null,
                                    title: "Care visit",
                                    notes: "",
                                    status: "DRAFT",
                                    repeatWeeks: 1,
                                    frequency: "WEEKLY",
                                    selectedDays: [],
                                    repeatEvery: 1,
                                    repeatUnit: "WEEKS",
                                    endDate: null,
                                })
                            }
                        >
                            <Plus size={15} />
                            Add visit
                        </button>
                    )}
                    <button
                        className="wv-primary"
                        onClick={download}
                        disabled={(!demo && loading) || !visits.length}
                    >
                        <Download size={15} />
                        Download visits
                    </button>
                </div>
            </header>
            <div className="wv-filters">
                <label>
                    Week containing
                    <input
                        type="date"
                        value={week}
                        onChange={(e) => e.target.value && changeWeek(e.target.value)}
                    />
                </label>
                <label>
                    Search visits
                    <input
                        placeholder="Visit or carer name"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
                <label>
                    Status
                    <select
                        aria-label="Filter status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="">All statuses</option>
                        {Object.entries(statuses).map(([s, n]) => (
                            <option
                                key={s}
                                value={s}
                            >
                                {n}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Carer
                    <select
                        aria-label="Filter carer"
                        value={staff}
                        onChange={(e) => setStaff(e.target.value)}
                    >
                        <option value="">All carers</option>
                        <option value="unassigned">Unassigned</option>
                        {carers.map((c) => (
                            <option
                                key={c.id}
                                value={c.id}
                            >
                                {c.name}
                            </option>
                        ))}
                    </select>
                </label>
                {!calendar && (
                    <label className="wv-check">
                        <input
                            type="checkbox"
                            checked={showTasks}
                            onChange={(e) => setShowTasks(e.target.checked)}
                        />
                        Show planned tasks
                    </label>
                )}
                <button
                    aria-pressed={demo}
                    className={demo ? "wv-primary" : ""}
                    onClick={() => {
                        setDemo((x) => !x);
                        setSelected(null);
                        setStaff("");
                        setStatus("");
                        setOnlyReview(false);
                        setSearch("");
                    }}
                >
                    {demo ? "Exit demo" : "Demo schedule"}
                </button>
            </div>
            {demo && (
                <p
                    className="wv-demo"
                    role="status"
                >
                    Demo schedule · fictional visits and carers for preview only. Changes are disabled.
                </p>
            )}
            {notice && (
                <p
                    className="wv-notice"
                    role="status"
                >
                    {notice}
                </p>
            )}
            {error && !demo && (
                <p
                    className="wv-error"
                    role="alert"
                >
                    {error} <button onClick={() => setVersion((x) => x + 1)}>Retry</button>
                </p>
            )}
            <div className="wv-summary">
                <span>{visits.length} visits shown</span>
                <span>{duration(visits.reduce((s, x) => s + x.plannedMinutes, 0))} planned</span>
                <span>{visits.filter((x) => x.status === "COMPLETED").length} completed</span>
                <span>Europe/London</span>
                {onlyReview && <button onClick={() => setOnlyReview(false)}>Clear review filter</button>}
            </div>
            {!demo && loading ? (
                <p className="wv-loading">Loading visit schedule…</p>
            ) : !error || demo ? (
                calendar ? (
                    <HourlyCalendar
                        dates={dates}
                        visits={visits}
                        selectedId={selected?.id}
                        onSelect={(visit) => {
                            setSelected(visit);
                            setTab("Details");
                            setDetail(null);
                        }}
                    />
                ) : (
                    <div
                        className="wv-scroll"
                        aria-label="Weekly visit schedule"
                        tabIndex={0}
                    >
                        <table className="wv-grid">
                            <thead>
                                <tr>
                                    <th aria-label="Time of day" />
                                    {dates.map((d) => (
                                        <th
                                            key={d}
                                            className={d === londonToday() ? "wv-today" : ""}
                                        >
                                            {label(d, { weekday: "long" })}
                                            <small>
                                                <span>{label(d, { day: "numeric" })}</span>
                                            </small>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {bands.map(([key, name, hours]) => (
                                    <tr key={key}>
                                        <th scope="row">
                                            {name}
                                            <small>{hours}</small>
                                        </th>
                                        {dates.map((d) => {
                                            const daily = visits.filter((x) => x.date === d && bandFor(x.startTime) === key),
                                                tasks = showTasks ? shown.plannedTasks.filter((t) => t.date === d && t.sessions.includes(key)) : [];
                                            return (
                                                <td
                                                    key={d}
                                                    className={key === "ANYTIME" ? "wv-anytime" : ""}
                                                >
                                                    {daily.map((x) => (
                                                        <button
                                                            className={"wv-card " + (selected?.id === x.id ? "selected" : "")}
                                                            data-visit-id={x.id}
                                                            aria-label={`${x.title}, ${d}, ${x.startTime}, ${statuses[x.status]}`}
                                                            key={x.id}
                                                            onClick={() => {
                                                                setSelected(x);
                                                                setTab("Details");
                                                                setDetail(null);
                                                            }}
                                                        >
                                                            <div className="wv-card-body">
                                                                <strong>
                                                                    {label(d, { weekday: "short" })}{" "}
                                                                    <span>
                                                                        {x.startTime} – {x.endTime}
                                                                    </span>
                                                                </strong>
                                                                <p className="wv-card-title">{x.title}</p>
                                                                <div className="wv-metrics">
                                                                    <span title="Recorded completed / total activities">
                                                                        <CheckSquare size={17} />
                                                                        {x.taskDone}/{x.taskTotal}
                                                                    </span>
                                                                    <span title="Planned duration">
                                                                        <Clock size={17} />
                                                                        {duration(x.plannedMinutes)}
                                                                    </span>
                                                                    {x.alerts > 0 && (
                                                                        <span title="Open alerts">
                                                                            <Bell size={16} />
                                                                            {x.alerts}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className={`wv-card-footer wv-${x.status}`}>
                                                                <span>{statuses[x.status]}</span>
                                                                <span>{x.staffName || "Unassigned"}</span>
                                                            </div>
                                                            {reason(x) && <div className="wv-card-review">{reason(x)}</div>}
                                                        </button>
                                                    ))}
                                                    {tasks.length > 0 && (
                                                        <div className="wv-planned">
                                                            <small>Planned tasks</small>
                                                            {tasks.map((t) => (
                                                                <details
                                                                    key={t.id}
                                                                    className="wv-task"
                                                                >
                                                                    <summary>
                                                                        <CheckSquare size={14} />
                                                                        {t.name}
                                                                        {t.essential && <span title="Essential task">*</span>}
                                                                    </summary>
                                                                    <p>{t.details || "No additional instructions."}</p>
                                                                    <small>
                                                                        {t.timesPerDay} time{t.timesPerDay === 1 ? "" : "s"} per day
                                                                    </small>
                                                                </details>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : null}
            {selected && (
                <div className="wv-overlay">
                    <aside
                        className="wv-detail"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Visit details"
                    >
                        <header>
                            <div>
                                <h2>{selected.title}</h2>
                                <p>
                                    {label(selected.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {selected.startTime}{" "}
                                    – {selected.endTime}
                                </p>
                                <span className={`wv-badge wv-${selected.status}`}>{statuses[selected.status]}</span>
                                {demo && <span className="wv-muted"> · Demo</span>}
                            </div>
                            <button
                                aria-label="Close visit details"
                                onClick={() => setSelected(null)}
                            >
                                <X size={19} />
                            </button>
                        </header>
                        <nav aria-label="Visit tabs">
                            {tabs.map((t) => (
                                <button
                                    key={t}
                                    aria-pressed={tab === t}
                                    className={tab === t ? "active" : ""}
                                    onClick={() => setTab(t)}
                                >
                                    {t}
                                </button>
                            ))}
                        </nav>
                        <div className="wv-detail-body">
                            {detailError ? (
                                <p
                                    className="wv-error"
                                    role="alert"
                                >
                                    {detailError}
                                    <button onClick={() => setVersion((x) => x + 1)}>Retry</button>
                                </p>
                            ) : !detail ? (
                                <p>Loading visit details…</p>
                            ) : (
                                <>
                                    {tab === "Details" && (
                                        <>
                                            <div className="wv-detail-grid">
                                                <article>
                                                    <h3>Planned</h3>
                                                    <p>
                                                        {selected.startTime} – {selected.endTime}
                                                    </p>
                                                    <h3>Actual duration</h3>
                                                    <p>{duration(selected.actualMinutes)}</p>
                                                </article>
                                                <article>
                                                    <h3>Client location</h3>
                                                    {detail.addresses.length ? (
                                                        detail.addresses.map((a, i) => (
                                                            <p key={i}>
                                                                {[a.addressLine1, a.addressLine2, a.city, a.postCode || a.postalCode]
                                                                    .filter(Boolean)
                                                                    .join(", ")}
                                                            </p>
                                                        ))
                                                    ) : (
                                                        <p>No address recorded</p>
                                                    )}
                                                </article>
                                                <article>
                                                    <h3>Alerts</h3>
                                                    <p>{selected.alerts ? `${selected.alerts} open alerts` : "No open alerts"}</p>
                                                </article>
                                                <article>
                                                    <h3>Care team</h3>
                                                    <p>{selected.staffName || "Unassigned"}</p>
                                                </article>
                                                <article>
                                                    <h3>Check in</h3>
                                                    <p>{stamp(v.actual_start || v.actualStart)}</p>
                                                </article>
                                                <article>
                                                    <h3>Check out</h3>
                                                    <p>{stamp(v.actual_end || v.actualEnd)}</p>
                                                </article>
                                            </div>
                                            <h3>Visit instructions</h3>
                                            <p className="wv-pre">{v.notes || "No instructions recorded."}</p>
                                            {reason(selected) && <p className="wv-error">{reason(selected)}</p>}
                                            {!demo && data.canManage && ["DRAFT", "SCHEDULED"].includes(selected.status) && (
                                                <button
                                                    onClick={() => {
                                                        setEditor({ ...selected, clientId: id, repeatWeeks: 1 });
                                                        setSelected(null);
                                                    }}
                                                >
                                                    Edit schedule / carer
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {["Alerts", "Activities", "Observations"].includes(tab) &&
                                        (() => {
                                            const kinds =
                                                    tab === "Alerts" ? ["ALERT"] : tab === "Activities" ? ["ACTIVITY"] : ["NOTE", "OBSERVATION"],
                                                entries = detail.entries.filter((e) => kinds.includes(e.kind));
                                            return entries.length ? (
                                                entries.map((e) => (
                                                    <article
                                                        className="wv-entry"
                                                        key={e.id}
                                                    >
                                                        <h3>{e.title}</h3>
                                                        <small>
                                                            {e.status.replaceAll("_", " ")} · {e.author}
                                                        </small>
                                                        <p className="wv-pre">{e.body || "No additional details."}</p>
                                                    </article>
                                                ))
                                            ) : (
                                                <p>No {tab.toLowerCase()} recorded for this visit.</p>
                                            );
                                        })()}
                                    {tab === "Care team" && (
                                        <>
                                            <h3>Assigned</h3>
                                            <article className="wv-entry">
                                                <p>{selected.staffName || "No carer assigned"}</p>
                                                {v.staffPhone && <p>{v.staffPhone}</p>}
                                            </article>
                                            <h3>Client care team</h3>
                                            {detail.careTeam.length ? (
                                                detail.careTeam.map((c) => (
                                                    <article
                                                        key={c.id}
                                                        className="wv-entry"
                                                    >
                                                        {c.firstName} {c.lastName}
                                                        {c.preferred ? " · Preferred" : ""}
                                                    </article>
                                                ))
                                            ) : (
                                                <p>No additional care team members recorded.</p>
                                            )}
                                        </>
                                    )}
                                    {tab === "Timeline" &&
                                        (detail.events.length ? (
                                            <ol className="wv-timeline">
                                                {detail.events.map((e) => (
                                                    <li key={e.id}>
                                                        <strong>{e.description || e.event_type || e.title}</strong>
                                                        <p>
                                                            {e.author} · {stamp(e.created_at)}
                                                        </p>
                                                    </li>
                                                ))}
                                            </ol>
                                        ) : (
                                            <p>No timeline events recorded.</p>
                                        ))}
                                </>
                            )}
                        </div>
                        <footer>
                            <button onClick={() => setSelected(null)}>Close</button>
                        </footer>
                    </aside>
                </div>
            )}
            {editor && (
                <VisitEditor
                    initial={editor}
                    staff={staffOptions}
                    onClose={() => setEditor(null)}
                    onSave={async (value) => {
                        const body = { ...value, clientId: id, staffId: value.staffId || null };
                        await (value.id ? _put(`/api/roster/visits/${value.id}`, body) : _post("/api/roster/visits", body));
                        setEditor(null);
                        setWeek(monday(value.date));
                        setVersion((x) => x + 1);
                        setNotice("Visit saved.");
                    }}
                />
            )}
        </section>
    );
}
