import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { _get, _post, _delete } from "../../utils/ApiService";
import "./roster-board.css";
const add = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const today = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const label = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(d));
const monday = (d) => add(d, -((new Date(d).getUTCDay() + 6) % 7));
const hours = (rows) => (rows.filter((v) => v.status !== "CANCELLED").reduce((n, v) => n + mins(v.endTime) - mins(v.startTime), 0) / 60).toFixed(1);
export default function RosterBoard({ week, setWeek, visits, options, loading, error, reload, onReload, onEdit, onCreate }) {
    const scrollRef = useRef(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [board, setBoard] = useState({ staff: [], assets: [] }),
        [boardError, setBoardError] = useState(""),
        [day, setDay] = useState(today()),
        [perspective, setPerspective] = useState("carer"),
        [view, setView] = useState("timeline"),
        [search, setSearch] = useState(""),
        [group, setGroup] = useState(""),
        [cancelled, setCancelled] = useState(false),
        [unavailable, setUnavailable] = useState(true),
        [travel, setTravel] = useState(true),
        [zoom, setZoom] = useState(120),
        [menu, setMenu] = useState(null),
        [plan, setPlan] = useState(null),
        [name, setName] = useState(""),
        [template, setTemplate] = useState(""),
        [buffer, setBuffer] = useState(15),
        [preview, setPreview] = useState(null),
        [busy, setBusy] = useState(false),
        [planError, setPlanError] = useState(""),
        [selected, setSelected] = useState([]),
        [bulkStaff, setBulkStaff] = useState(""),
        [run, setRun] = useState(""),
        [clock, setClock] = useState(new Date());
    useEffect(() => {
        if (day < week || day > add(week, 6)) setDay(week);
    }, [week, day]);
    useEffect(() => {
        const c = new AbortController();
        setBoardError("");
        _get("/api/roster/board", { params: { from: week }, signal: c.signal })
            .then((r) => {
                if (!c.signal.aborted) setBoard(r.data.results.data);
            })
            .catch((e) => {
                if (!c.signal.aborted) setBoardError(e.response?.data?.message || "Unable to load availability");
            });
        return () => c.abort();
    }, [week, reload]);
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 60000);
        return () => clearInterval(t);
    }, []);
    useEffect(() => {
        setPreview(null);
        setSelected([]);
        setRun("");
    }, [week]);
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = zoom * 7;
    }, [loading, view, zoom]);
    useEffect(() => {
        const close = (e) => {
            if (e.key === "Escape" && !busy) {
                setMenu(null);
                setPlan(null);
            }
        };
        document.addEventListener("keydown", close);
        return () => document.removeEventListener("keydown", close);
    }, [busy]);
    const groups = [...new Set(board.staff.flatMap((s) => s.groups))].sort();
    const runIds = board.assets.find((a) => a.id === run)?.payload.visitIds;
    const filtered = visits.filter((v) => (cancelled || v.status !== "CANCELLED") && (!runIds || runIds.includes(v.id)));
    const rows =
        perspective === "carer"
            ? [
                  { id: null, name: "Unallocated", groups: [] },
                  ...board.staff,
                  ...options.staff.filter((s) => !board.staff.some((p) => p.id === s.id)).map((s) => ({ ...s, groups: [] })),
              ]
            : [...options.clients];
    for (const v of filtered) {
        const id = perspective === "carer" ? v.staffId : v.clientId;
        if (id && !rows.some((p) => p.id === id))
            rows.push({ id, name: (perspective === "carer" ? v.staffName : v.clientName) || "Former team member", groups: [] });
    }
    const hasFreeTime = (p) => {
        const d = p.days?.find((x) => x.date === day);
        let ranges = (p.availabilityRecorded ? d?.available || [] : [{ start: "00:00", end: "24:00" }]).map((a) => [mins(a.start), mins(a.end)]);
        for (const a of d?.absent || [])
            ranges = ranges.flatMap(([s, e]) =>
                e <= mins(a.start) || s >= mins(a.end)
                    ? [[s, e]]
                    : [
                          [s, Math.min(e, mins(a.start))],
                          [Math.max(s, mins(a.end)), e],
                      ].filter(([x, y]) => y > x),
            );
        return ranges.length > 0;
    };
    const shown = rows.filter(
        (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) &&
            (!group || (p.groups || []).includes(group)) &&
            (unavailable ||
                p.id === null ||
                perspective === "client" ||
                filtered.some((v) => v.staffId === p.id && v.date === day) ||
                hasFreeTime(p)),
    );
    const rowVisits = (p) => filtered.filter((v) => (perspective === "carer" ? v.staffId === p.id : v.clientId === p.id));
    const timeParts = Object.fromEntries(
        new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
            .formatToParts(clock)
            .map((p) => [p.type, p.value]),
    );
    const nowMinute = Number(timeParts.hour) * 60 + Number(timeParts.minute);
    const invoke = async (fn) => {
        setBusy(true);
        setPlanError("");
        try {
            await fn();
        } catch (e) {
            setPlanError(e.response?.data?.message || e.message || "Unable to update plan");
        } finally {
            setBusy(false);
        }
    };
    const openPlan = (key) => {
        setPlan(key);
        setPreview(null);
        setName("");
        setBulkStaff("");
        setSelected([]);
        setPlanError("");
        setMenu(null);
    };
    useEffect(() => {
        if (searchParams.get("planning") !== "runs" || !options.canManage) return;
        openPlan("RUN");
        const next = new URLSearchParams(searchParams);
        next.delete("planning");
        setSearchParams(next, { replace: true });
    }, [searchParams, options.canManage, setSearchParams]);
    const previewPlan = () =>
        invoke(async () => {
            const r = await _post("/api/roster/planning/preview", { mode: plan, assetId: template, from: week, buffer: Number(buffer) });
            setPreview(r.data.results.data);
        });
    function draw(p) {
        const all = rowVisits(p),
            daily = all.filter((v) => v.date === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
            ends = [],
            placed = daily.map((v) => {
                let lane = ends.findIndex((end) => end <= mins(v.startTime));
                if (lane < 0) lane = ends.length;
                ends[lane] = mins(v.endTime);
                return { ...v, lane };
            });
        const availability = p.days?.find((d) => d.date === day);
        return (
            <div
                className="rb-row"
                key={p.id || "unallocated"}
                style={{ minHeight: Math.max(64, ends.length * 39 + 18) }}
            >
                <div className="rb-person">
                    <strong>{p.name}</strong>
                    <small>
                        {all.length} visits / {hours(all)} h this week
                    </small>
                </div>
                <div
                    className="rb-track"
                    style={{ width: zoom * 24, "--half-hour": `${zoom / 2}px` }}
                >
                    {perspective === "carer" && p.id && (
                        <>
                            <div
                                className={"rb-base " + (!p.availabilityRecorded ? "rb-unknown" : "")}
                                title={!p.availabilityRecorded ? "No working hours recorded" : "Outside recorded working hours"}
                            />
                            {availability?.available.map((a, i) => (
                                <span
                                    key={i}
                                    className="rb-available"
                                    style={{ left: (mins(a.start) * zoom) / 60, width: ((mins(a.end) - mins(a.start)) * zoom) / 60 }}
                                />
                            ))}
                            {availability?.absent.map((a, i) => (
                                <span
                                    key={i}
                                    className="rb-absent"
                                    title="Time off"
                                    style={{ left: (mins(a.start) * zoom) / 60, width: ((mins(a.end) - mins(a.start)) * zoom) / 60 }}
                                />
                            ))}
                        </>
                    )}
                    {travel &&
                        perspective === "carer" &&
                        p.id &&
                        daily.slice(1).map((v, i) => {
                            const prev = daily[i],
                                gap = mins(v.startTime) - mins(prev.endTime);
                            return gap >= 0 && gap <= 120 && prev.clientId !== v.clientId ? (
                                <span
                                    key={v.id}
                                    className={"rb-gap " + (gap < buffer ? "rb-gap-short" : "")}
                                    title={gap + " min between visits; planning buffer " + buffer + " min. Not a mapped travel estimate."}
                                    style={{ left: (mins(prev.endTime) * zoom) / 60, width: Math.max(3, (gap * zoom) / 60) }}
                                />
                            ) : null;
                        })}
                    {day === today() && (
                        <span
                            className="rb-now"
                            style={{ left: (nowMinute * zoom) / 60 }}
                        />
                    )}
                    {placed.map((v) => (
                        <button
                            key={v.id}
                            data-visit-id={v.id}
                            className={"rb-visit rb-" + v.status}
                            style={{
                                left: (mins(v.startTime) * zoom) / 60,
                                width: Math.max(24, ((mins(v.endTime) - mins(v.startTime)) * zoom) / 60 - 2),
                                top: 10 + v.lane * 39,
                            }}
                            title={v.clientName + " · " + v.startTime + "–" + v.endTime + " · " + v.status.replaceAll("_", " ")}
                            onClick={() => onEdit(v)}
                        >
                            <strong>{perspective === "carer" ? v.clientName : v.staffName || "Unallocated"}</strong>
                            <small>
                                {v.startTime}–{v.endTime}
                                {v.status === "COMPLETED" ? " ✓" : v.status === "IN_PROGRESS" ? " • In progress" : ""}
                                {v.openShift?" · Open shift":""}{v.requiredStaff>1?` · ${v.slotIndex}/${v.requiredStaff} carers`:""}
                            </small>
                        </button>
                    ))}
                </div>
            </div>
        );
    }
    return (
        <div className="roster-board">
            <div className="rb-toolbar">
                <select
                    aria-label="Roster perspective"
                    value={perspective}
                    onChange={(e) => {
                        setPerspective(e.target.value);
                        setSearch("");
                        setGroup("");
                    }}
                >
                    <option value="carer">Carer view</option>
                    <option value="client">Client view</option>
                </select>
                <input
                    aria-label="Search roster"
                    placeholder={"Search for " + perspective}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    aria-label="Group"
                    value={group}
                    disabled={perspective === "client"}
                    onChange={(e) => setGroup(e.target.value)}
                >
                    <option value="">All groups</option>
                    {groups.map((g) => (
                        <option key={g}>{g}</option>
                    ))}
                </select>
                <div className="rb-dropdown">
                    <button
                        aria-expanded={menu === "display"}
                        onClick={() => setMenu(menu === "display" ? null : "display")}
                    >
                        Display options ▾
                    </button>
                    {menu === "display" && (
                        <div className="rb-menu">
                            <label>
                                <input
                                    type="radio"
                                    checked={view === "timeline"}
                                    onChange={() => setView("timeline")}
                                />
                                Timeline
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    checked={view === "day"}
                                    onChange={() => setView("day")}
                                />
                                Day list
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={travel}
                                    onChange={(e) => setTravel(e.target.checked)}
                                />
                                Travel gaps
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={unavailable}
                                    onChange={(e) => setUnavailable(e.target.checked)}
                                />
                                Unavailable carers
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={cancelled}
                                    onChange={(e) => setCancelled(e.target.checked)}
                                />
                                Cancelled visits
                            </label>
                            <label>
                                Zoom
                                <select
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                >
                                    <option value={80}>Compact</option>
                                    <option value={120}>Standard</option>
                                    <option value={160}>Large</option>
                                </select>
                            </label>
                            <button onClick={() => setMenu(null)}>Done</button>
                        </div>
                    )}
                </div>
                <div className="rb-week">
                    <button
                        aria-label="Previous week"
                        onClick={() => setWeek(add(week, -7))}
                    >
                        ‹
                    </button>
                    <label>
                        <span className="sr-only">Week containing</span>
                        <input
                            type="date"
                            value={week}
                            onChange={(e) => e.target.value && setWeek(monday(e.target.value))}
                        />
                    </label>
                    <span>– {label(add(week, 6))}</span>
                    <button
                        aria-label="Next week"
                        onClick={() => setWeek(add(week, 7))}
                    >
                        ›
                    </button>
                    <button
                        onClick={() => {
                            setWeek(monday(today()));
                            setDay(today());
                        }}
                    >
                        Today
                    </button>
                </div>
                <button onClick={onReload}>Refresh</button>
                {options.canManage && (
                    <>
                        <button onClick={() => openPlan("RUN")}>Manage runs</button>
                        <div className="rb-dropdown">
                            <button
                                className="rb-primary"
                                onClick={() => setMenu(menu === "plan" ? null : "plan")}
                            >
                                Plan rota ▾
                            </button>
                            {menu === "plan" && (
                                <div className="rb-menu">
                                    <button
                                        onClick={() => {
                                            setMenu(null);
                                            onCreate(day);
                                        }}
                                    >
                                        Add visit
                                    </button>
                                    <button onClick={() => openPlan("SAVE")}>Save week as template</button>
                                    <button onClick={() => openPlan("TEMPLATE")}>Apply template</button>
                                    <button onClick={() => openPlan("AUTO")}>Suggest assignments</button>
                                    <button onClick={() => openPlan("BULK")}>Bulk allocate visits</button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
            <div className="rb-days">
                {Array.from({ length: 7 }, (_, i) => add(week, i)).map((d) => (
                    <button
                        key={d}
                        aria-pressed={d === day}
                        onClick={() => setDay(d)}
                    >
                        {label(d)}
                    </button>
                ))}
                <select
                    aria-label="Filter run"
                    value={run}
                    onChange={(e) => setRun(e.target.value)}
                >
                    <option value="">All runs</option>
                    {board.assets
                        .filter((a) => a.kind === "RUN")
                        .map((a) => (
                            <option
                                key={a.id}
                                value={a.id}
                            >
                                {a.name}
                            </option>
                        ))}
                </select>
            </div>
            <div className="rb-summary">
                <span>
                    {filtered.length} visits · {hours(filtered)} planned hours
                </span>
                <span>{filtered.filter((v) => !v.staffId && v.status !== "CANCELLED").length} unallocated</span>
                <span className="rb-legend">
                    ● Scheduled · <b>● In progress</b> · <em>● Completed</em>
                </span>
                <small>UK time · Shading: outside working hours / hatched time off · No hours recorded = availability unknown</small>
            </div>
            {(error || boardError) && (
                <p
                    role="alert"
                    className="rb-error"
                >
                    {error || boardError}
                </p>
            )}
            {loading ? (
                <p>Loading roster…</p>
            ) : view === "timeline" ? (
                <div
                    className="rb-scroll"
                    ref={scrollRef}
                >
                    <div
                        className="rb-grid"
                        style={{ width: 190 + zoom * 24 }}
                    >
                        <div className="rb-hour-row">
                            <div className="rb-person">{label(day)}</div>
                            <div
                                className="rb-hours"
                                style={{ width: zoom * 24, "--half-hour": `${zoom / 2}px` }}
                            >
                                {Array.from({ length: 24 }, (_, h) => (
                                    <span
                                        key={h}
                                        style={{ width: zoom }}
                                    >
                                        {String(h).padStart(2, "0")}:00
                                    </span>
                                ))}
                            </div>
                        </div>
                        {shown.map(draw)}
                        {!shown.length && <p>No matching people.</p>}
                    </div>
                </div>
            ) : (
                <div className="rb-day-list">
                    {shown.map((p) => (
                        <section key={p.id || "unallocated"}>
                            <h2>{p.name}</h2>
                            {rowVisits(p)
                                .filter((v) => v.date === day)
                                .map((v) => (
                                    <button
                                        key={v.id}
                                        className={"rb-day-card rb-" + v.status}
                                        onClick={() => onEdit(v)}
                                    >
                                        {v.startTime}–{v.endTime} · {v.clientName} · {v.staffName || "Unallocated"} · {v.status.replaceAll("_", " ")}
                                    </button>
                                ))}
                        </section>
                    ))}
                </div>
            )}
            <p className="rb-help">
                Select a visit to edit, assign or update its status. Travel gaps show time between visits, not driving estimates.{" "}
                <Link to="/admin/teams">Manage working hours and time off in Team</Link>.
            </p>
            {plan && (
                <div className="rb-overlay">
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label="Roster planning"
                        className="rb-plan"
                    >
                        <header>
                            <h2>
                                {plan === "RUN"
                                    ? "Manage runs"
                                    : plan === "SAVE"
                                      ? "Save rota template"
                                      : plan === "AUTO"
                                        ? "Suggest assignments"
                                        : plan === "BULK"
                                          ? "Bulk allocate visits"
                                          : "Apply rota template"}
                            </h2>
                            <button
                                disabled={busy}
                                onClick={() => setPlan(null)}
                            >
                                Close planning
                            </button>
                        </header>
                        <p>
                            Week: {label(week)} – {label(add(week, 6))}
                        </p>
                        {planError && (
                            <p
                                role="alert"
                                className="rb-error"
                            >
                                {planError}
                            </p>
                        )}
                        {plan === "BULK" ? (
                            <>
                                <p>
                                    Select unallocated visits from this week and assign them to one caregiver. Availability, absence, credentials, workload, rest, travel time and clashes are checked before anything is saved.
                                </p>
                                <label>
                                    Caregiver
                                    <select
                                        aria-label="Caregiver for bulk allocation"
                                        value={bulkStaff}
                                        onChange={(e) => setBulkStaff(e.target.value)}
                                    >
                                        <option value="">Choose caregiver</option>
                                        {options.staff.map((staff) => (
                                            <option key={staff.id} value={staff.id}>{staff.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <div className="rb-run-picks">
                                    {visits.filter((v) => !v.staffId && ["DRAFT", "SCHEDULED"].includes(v.status) && v.date >= week && v.date <= add(week, 6)).map((v) => (
                                        <label key={v.id}>
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(v.id)}
                                                onChange={(e) => setSelected((items) => e.target.checked ? [...items, v.id] : items.filter((id) => id !== v.id))}
                                            />
                                            {label(v.date)} {v.startTime}–{v.endTime} · {v.clientName} · {v.title}
                                        </label>
                                    ))}
                                    {!visits.some((v) => !v.staffId && ["DRAFT", "SCHEDULED"].includes(v.status) && v.date >= week && v.date <= add(week, 6)) && (
                                        <p>There are no unallocated visits in this week.</p>
                                    )}
                                </div>
                                <button
                                    className="rb-primary"
                                    disabled={busy || !bulkStaff || !selected.length}
                                    onClick={() => invoke(async () => {
                                        const response = await _post("/api/roster/bulk-assign", { visitIds: selected, staffId: bulkStaff });
                                        setPlan(null);
                                        setSelected([]);
                                        onReload();
                                        return response;
                                    })}
                                >
                                    {busy ? "Checking allocation…" : `Allocate ${selected.length || "selected"} visit${selected.length === 1 ? "" : "s"}`}
                                </button>
                            </>
                        ) : ["RUN", "SAVE"].includes(plan) ? (
                            <>
                                <label>
                                    Name
                                    <input
                                        value={name}
                                        maxLength={100}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </label>
                                {plan === "RUN" && (
                                    <>
                                        <p>Select visits to group into a named run. Grouping does not change times or assignments.</p>
                                        <div className="rb-run-picks">
                                            {visits
                                                .filter((v) => v.status !== "CANCELLED")
                                                .map((v) => (
                                                    <label key={v.id}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selected.includes(v.id)}
                                                            onChange={(e) =>
                                                                setSelected((x) => (e.target.checked ? [...x, v.id] : x.filter((id) => id !== v.id)))
                                                            }
                                                        />
                                                        {label(v.date)} {v.startTime} · {v.clientName}
                                                    </label>
                                                ))}
                                        </div>
                                    </>
                                )}
                                <button
                                    disabled={busy || !name.trim() || (plan === "RUN" && !selected.length)}
                                    onClick={() =>
                                        invoke(async () => {
                                            await _post("/api/roster/assets", {
                                                from: week,
                                                name,
                                                kind: plan === "RUN" ? "RUN" : "TEMPLATE",
                                                visitIds: selected,
                                            });
                                            setName("");
                                            setSelected([]);
                                            onReload();
                                        })
                                    }
                                >
                                    Save {plan === "RUN" ? "run" : "template"}
                                </button>
                                <h3>Saved {plan === "RUN" ? "runs" : "templates"}</h3>
                                {board.assets
                                    .filter((a) => a.kind === (plan === "RUN" ? "RUN" : "TEMPLATE"))
                                    .map((a) => (
                                        <div
                                            className="rb-saved"
                                            key={a.id}
                                        >
                                            <span>{a.name}</span>
                                            <button
                                                disabled={busy}
                                                onClick={() =>
                                                    invoke(async () => {
                                                        await _delete("/api/roster/assets/" + a.id);
                                                        onReload();
                                                    })
                                                }
                                            >
                                                Remove {a.name}
                                            </button>
                                        </div>
                                    ))}
                            </>
                        ) : (
                            <>
                                {plan === "TEMPLATE" && (
                                    <label>
                                        Template
                                        <select
                                            aria-label="Template"
                                            value={template}
                                            onChange={(e) => {
                                                setTemplate(e.target.value);
                                                setPreview(null);
                                            }}
                                        >
                                            <option value="">Choose template</option>
                                            {board.assets
                                                .filter((a) => a.kind === "TEMPLATE")
                                                .map((a) => (
                                                    <option
                                                        value={a.id}
                                                        key={a.id}
                                                    >
                                                        {a.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </label>
                                )}
                                <label>
                                    Travel buffer (minutes)
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={buffer}
                                        onChange={(e) => {
                                            setBuffer(Number(e.target.value));
                                            setPreview(null);
                                        }}
                                    />
                                </label>
                                <p>
                                    {plan === "AUTO"
                                        ? "Suggestions use eligible client care-team members, availability and time off; prioritise continuity, then lower planned workload."
                                        : "Creates draft visits. Unavailable template carers leave visits unallocated; conflicting client visits are skipped."}{" "}
                                    Review the result before applying. No route-distance estimates or skill matching are included.
                                </p>
                                <button
                                    disabled={busy || (plan === "TEMPLATE" && !template)}
                                    onClick={previewPlan}
                                >
                                    {busy ? "Checking…" : "Preview plan"}
                                </button>
                                {preview && (
                                    <>
                                        <h3>
                                            {preview.proposed.length} proposed · {preview.skipped.length} skipped
                                        </h3>
                                        <div className="rb-preview">
                                            {preview.proposed.map((v, i) => (
                                                <article key={i}>
                                                    <strong>
                                                        {v.date} {v.startTime}–{v.endTime} · {v.clientName}
                                                    </strong>
                                                    <p>
                                                        {v.staffName} · {v.reason}
                                                    </p>
                                                </article>
                                            ))}
                                            {preview.skipped.map((v, i) => (
                                                <article key={i}>
                                                    <strong>
                                                        {v.date} · {v.title}
                                                    </strong>
                                                    <p>{v.reason}</p>
                                                </article>
                                            ))}
                                        </div>
                                        <button
                                            className="rb-primary"
                                            disabled={busy || !preview.proposed.length}
                                            onClick={() =>
                                                invoke(async () => {
                                                    await _post("/api/roster/planning/apply", { previewId: preview.id });
                                                    setPlan(null);
                                                    onReload();
                                                })
                                            }
                                        >
                                            Apply reviewed plan
                                        </button>
                                        <p>Preview expires in 10 minutes. All changes are checked again when applied.</p>
                                    </>
                                )}
                            </>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
