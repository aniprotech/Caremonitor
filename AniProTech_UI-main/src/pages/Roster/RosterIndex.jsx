import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import RosterBoard from "./RosterBoard";
import { _get, _post, _put } from "../../utils/ApiService";
import { showSuccess } from "../../utils/toaster";
const addDays = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
const today = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const monday = (d) => addDays(d, -((new Date(d).getUTCDay() + 6) % 7));
const names = { DRAFT: "Draft", SCHEDULED: "Scheduled", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const blank = (date) => ({
    date,
    clientId: "",
    staffId: "",
    title: "Care visit",
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
    status: "DRAFT",
    repeatWeeks: 1,
    requiredStaff: 1,
    openShift: false,
});
const control = "mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 text-sm disabled:bg-gray-100";
function Field({ label, children }) {
    return (
        <label className="block text-sm font-medium text-gray-700">
            {label}
            {children}
        </label>
    );
}
export default function RosterIndex() {
    const [searchParams] = useSearchParams();
    const requestedDate = searchParams.get("date");
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || "") ? requestedDate : today();
    const [week, setWeek] = useState(() => monday(selectedDate)),
        [options, setOptions] = useState({ staff: [], clients: [], canManage: false });
    const [visits, setVisits] = useState([]),
        [loading, setLoading] = useState(true),
        [error, setError] = useState("");
    const [editor, setEditor] = useState(null),
        [showRules,setShowRules]=useState(false),
        [rules,setRules]=useState({maxDailyMinutes:720,maxWeeklyMinutes:3600,minRestMinutes:660,travelSpeedMph:25,travelBufferMinutes:10}),
        [saving, setSaving] = useState(false),
        [formError, setFormError] = useState(""),
        [reload, setReload] = useState(0);
    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        setLoading(true);
        setError("");
        Promise.all([
            _get("/api/roster/options", { signal: controller.signal }),
            _get("/api/roster/visits", { params: { from: week, to: addDays(week, 6) }, signal: controller.signal }),
            _get("/api/roster/workforce-rules",{signal:controller.signal}),
        ])
            .then(([o, v,r]) => {
                if (active) {
                    setOptions(o.data.results.data);
                    setVisits(v.data.results.data.visits);
                    setRules(r.data.results.data);
                }
            })
            .catch((e) => {
                if (active) setError(e.response?.data?.message || "Unable to load roster. Please retry.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
            controller.abort();
        };
    }, [week, reload]);
    const edit = (visit) => {
        setFormError("");
        setEditor({ ...visit, staffId: visit.staffId || "", notes: visit.notes || "", repeatWeeks: 1 });
    };
    const update = (key, value) => setEditor((v) => ({ ...v, [key]: value }));
    const editable = options.canManage && editor && ["DRAFT", "SCHEDULED"].includes(editor.status);
    async function save(event) {
        event.preventDefault();
        setSaving(true);
        setFormError("");
        try {
            const payload = { ...editor, staffId: editor.staffId || null, repeatWeeks: Number(editor.repeatWeeks),requiredStaff:Number(editor.requiredStaff||1),openShift:!!editor.openShift };
            if (editor.id) await _put("/api/roster/visits/" + editor.id, payload);
            else await _post("/api/roster/visits", payload);
            showSuccess("Visit saved");
            setEditor(null);
            setReload((n) => n + 1);
        } catch (e) {
            setFormError(e.response?.data?.message || "Unable to save visit");
        } finally {
            setSaving(false);
        }
    }
    async function transition(status) {
        setSaving(true);
        setFormError("");
        try {
            const response = await _post("/api/roster/visits/" + editor.id + "/status", { status, revision: editor.revision });
            edit(response.data.results.data);
            setReload((n) => n + 1);
            showSuccess("Visit updated");
        } catch (e) {
            setFormError(e.response?.data?.message || "Unable to update visit");
        } finally {
            setSaving(false);
        }
    }
    return (
        <main className="roster-workspace">
            <RosterBoard
                week={week}
                setWeek={setWeek}
                visits={visits}
                options={options}
                loading={loading}
                error={error}
                reload={reload}
                onReload={() => setReload((n) => n + 1)}
                onEdit={edit}
                onCreate={(date) => edit(blank(date))}
            />{" "}
            {options.canManage&&<button className="m-3 rounded-lg border bg-white px-4 py-2" onClick={()=>setShowRules(true)}>Workforce & travel rules</button>}
            {showRules && (
                <section role="dialog" aria-modal="true" aria-label="Workforce and travel rules" className="roster-edit-panel rounded-xl border border-cyan-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex justify-between">
                        <h2 className="text-lg font-semibold">Workforce and travel rules</h2>
                        <button onClick={() => setShowRules(false)}>Close</button>
                    </div>
                    <p className="mb-4 text-sm text-gray-600">Assignments are blocked when these limits or the location-based travel estimate cannot be met.</p>
                    {formError && <p className="mb-3 text-sm text-red-700">{formError}</p>}
                    <form
                        className="grid gap-4 md:grid-cols-2"
                        onSubmit={async (event) => {
                            event.preventDefault();
                            setSaving(true);
                            setFormError("");
                            try {
                                await _put("/api/roster/workforce-rules", Object.fromEntries(Object.entries(rules).map(([key, value]) => [key, Number(value)])));
                                showSuccess("Workforce rules saved");
                                setShowRules(false);
                            } catch (requestError) {
                                setFormError(requestError.response?.data?.message || "Unable to save workforce rules");
                            } finally {
                                setSaving(false);
                            }
                        }}
                    >
                        {[["maxDailyMinutes", "Maximum daily work (minutes)"], ["maxWeeklyMinutes", "Maximum weekly work (minutes)"], ["minRestMinutes", "Minimum rest between days (minutes)"], ["travelSpeedMph", "Planning speed (mph)"], ["travelBufferMinutes", "Travel contingency (minutes)"]].map(([key, label]) => (
                            <Field key={key} label={label}>
                                <input required type="number" min="0" className={control} value={rules[key]} onChange={(event) => setRules({ ...rules, [key]: event.target.value })} />
                            </Field>
                        ))}
                        <button disabled={saving} className="rounded bg-blue-800 px-4 py-2 text-white">Save rules</button>
                    </form>
                </section>
            )}
            {editor && (
                <section
                    id="visit-editor"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Visit details"
                    className="roster-edit-panel rounded-xl border border-cyan-200 bg-white p-5 shadow-sm"
                >
                    <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">{editor.id ? "Visit details" : "Create visit"}</h2>
                        <button
                            disabled={saving}
                            onClick={() => setEditor(null)}
                            className="rounded border px-3 py-1"
                        >
                            Close
                        </button>
                    </div>
                    {formError && (
                        <p
                            role="alert"
                            className="mb-4 rounded bg-red-50 p-3 text-red-800"
                        >
                            {formError}
                        </p>
                    )}
                    {editor.id && (
                        <Link
                            className="mb-4 block text-blue-800 underline"
                            to={`/admin/clients/${editor.clientId}/client-feed?visit=${editor.id}`}
                        >
                            Open visit care record: alerts, activities, observations and timeline
                        </Link>
                    )}
                    <form
                        onSubmit={save}
                        className="space-y-4"
                    >
                        <fieldset
                            disabled={!editable || saving}
                            className="grid gap-4 md:grid-cols-3"
                        >
                            <Field label="Client">
                                <select
                                    required
                                    className={control}
                                    value={editor.clientId}
                                    onChange={(e) => update("clientId", e.target.value)}
                                >
                                    <option value="">Choose client</option>
                                    {!options.clients.some((c) => c.id === editor.clientId) && editor.clientId && (
                                        <option value={editor.clientId}>{editor.clientName}</option>
                                    )}
                                    {options.clients.map((c) => (
                                        <option
                                            key={c.id}
                                            value={c.id}
                                        >
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Staff member">
                                <select
                                    className={control}
                                    value={editor.staffId}
                                    onChange={(e) => update("staffId", e.target.value)}
                                >
                                    <option value="">Unassigned</option>
                                    {!options.staff.some((s) => s.id === editor.staffId) && editor.staffId && (
                                        <option value={editor.staffId}>{editor.staffName}</option>
                                    )}
                                    {options.staff.map((s) => (
                                        <option
                                            key={s.id}
                                            value={s.id}
                                        >
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Visit title">
                                <input
                                    required
                                    maxLength={160}
                                    className={control}
                                    value={editor.title}
                                    onChange={(e) => update("title", e.target.value)}
                                />
                            </Field>
                            <Field label="Date">
                                <input
                                    required
                                    className={control}
                                    type="date"
                                    value={editor.date}
                                    onChange={(e) => update("date", e.target.value)}
                                />
                            </Field>
                            <Field label="Start time (London)">
                                <input
                                    required
                                    className={control}
                                    type="time"
                                    value={editor.startTime}
                                    onChange={(e) => update("startTime", e.target.value)}
                                />
                            </Field>
                            <Field label="End time (same day)">
                                <input
                                    required
                                    className={control}
                                    type="time"
                                    value={editor.endTime}
                                    onChange={(e) => update("endTime", e.target.value)}
                                />
                            </Field>
                            <Field label="Status">
                                <select
                                    className={control}
                                    value={editor.status}
                                    onChange={(e) => update("status", e.target.value)}
                                >
                                    <option value="DRAFT">Draft</option>
                                    <option value="SCHEDULED">Scheduled</option>
                                    {!["DRAFT", "SCHEDULED"].includes(editor.status) && <option value={editor.status}>{names[editor.status]}</option>}
                                </select>
                            </Field>
                            {!editor.id && (
                                <Field label="Repeat weekly">
                                    <select
                                        className={control}
                                        value={editor.repeatWeeks}
                                        onChange={(e) => update("repeatWeeks", e.target.value)}
                                    >
                                        {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                                            <option
                                                key={n}
                                                value={n}
                                            >
                                                {n === 1 ? "This visit only" : `${n} visits, one per week`}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            )}
                            {!editor.id&&<Field label="Caregivers required"><select className={control} value={editor.requiredStaff||1} onChange={e=>update("requiredStaff",e.target.value)}>{[1,2,3,4].map(n=><option key={n} value={n}>{n}{n>1?" (double-up/multi-carer)":""}</option>)}</select></Field>}
                            {!editor.staffId&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editor.openShift} onChange={e=>update("openShift",e.target.checked)}/>Publish as an open shift for eligible care-team members</label>}
                            <div className="md:col-span-3">
                                <Field label="Visit notes">
                                    <textarea
                                        maxLength={4000}
                                        rows={3}
                                        className={control}
                                        value={editor.notes}
                                        onChange={(e) => update("notes", e.target.value)}
                                    />
                                </Field>
                            </div>
                        </fieldset>
                        {editable && (
                            <>
                                <p className="text-xs text-gray-500">
                                    Overlapping visits, recorded absence and availability are checked when saving. Repeated visits are saved together
                                    and can then be edited individually.
                                </p>
                                <button
                                    disabled={saving}
                                    type="submit"
                                    className="rounded-lg bg-customNavy px-5 py-2 text-white disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : "Save visit"}
                                </button>
                            </>
                        )}
                    </form>
                    {editor.id && (
                        <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">
                            {editor.status === "SCHEDULED" && (
                                <button
                                    disabled={saving}
                                    onClick={() => transition("IN_PROGRESS")}
                                    className="rounded border border-blue-300 px-4 py-2 text-blue-800"
                                >
                                    Start visit
                                </button>
                            )}
                            {editor.status === "IN_PROGRESS" && (
                                <button
                                    disabled={saving}
                                    onClick={() => transition("COMPLETED")}
                                    className="rounded border border-emerald-300 px-4 py-2 text-emerald-800"
                                >
                                    Complete visit
                                </button>
                            )}
                            {options.canManage && ["DRAFT", "SCHEDULED", "IN_PROGRESS"].includes(editor.status) && (
                                <button
                                    disabled={saving}
                                    onClick={() => {
                                        if (window.confirm("Cancel this visit? It will remain in the roster history.")) transition("CANCELLED");
                                    }}
                                    className="rounded border border-red-200 px-4 py-2 text-red-700"
                                >
                                    Cancel visit
                                </button>
                            )}
                        </div>
                    )}
                </section>
            )}
        </main>
    );
}
