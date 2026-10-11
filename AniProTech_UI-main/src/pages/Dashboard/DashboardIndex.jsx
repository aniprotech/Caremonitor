import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, ClipboardList, CreditCard, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { _get } from "../../utils/ApiService";

const londonToday = () => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const value = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, part]));
    return `${value.year}-${value.month}-${value.day}`;
};
const addDays = (date, days) => { const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + days); return next.toISOString().slice(0, 10); };
const selectedPeriod = (range, customFrom, customTo) => {
    const today = londonToday();
    if (range === "yesterday") { const yesterday = addDays(today, -1); return { from: yesterday, to: yesterday, label: "Yesterday" }; }
    if (range === "last7") return { from: addDays(today, -6), to: today, label: "Last 7 days" };
    if (range === "last30") return { from: addDays(today, -29), to: today, label: "Last 30 days" };
    if (range === "lastWeek") { const day = new Date(`${today}T12:00:00Z`).getUTCDay() || 7; const end = addDays(today, -day); return { from: addDays(end, -6), to: end, label: "Last week" }; }
    if (range === "custom" && customFrom && customTo && customFrom <= customTo) return { from: customFrom, to: customTo, label: "Custom range" };
    return { from: today, to: today, label: "Today" };
};

const unwrap = (response) => response?.data?.results?.data;

export default function DashboardIndex() {
    const [summary, setSummary] = useState(null);
    const [reconciliation, setReconciliation] = useState(null);
    const [accounting, setAccounting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [range, setRange] = useState("today");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const period = selectedPeriod(range, customFrom, customTo);

    const load = useCallback(async () => {
        setLoading(true);
        const { from, to } = period;
        const [reportResult, reconciliationResult, accountingResult] = await Promise.allSettled([
            _get("/api/reports/summary", { params: { from, to } }),
            _get("/api/reports/reconciliation", { params: { from, to } }),
            _get("/api/accounting/summary"),
        ]);
        if (reportResult.status === "fulfilled") setSummary(unwrap(reportResult.value));
        if (reconciliationResult.status === "fulfilled") setReconciliation(unwrap(reconciliationResult.value));
        if (accountingResult.status === "fulfilled") setAccounting(unwrap(accountingResult.value));
        setUpdatedAt(new Date());
        setLoading(false);
    }, [period.from, period.to]);

    useEffect(() => { load(); }, [load]);

    const figures = useMemo(() => {
        const statuses = summary?.byStatus || [];
        const visitCount = statuses.filter((row) => row.status !== "CANCELLED").reduce((total, row) => total + Number(row.visits || 0), 0);
        const completed = statuses.find((row) => row.status === "COMPLETED")?.visits || 0;
        const scheduled = statuses.filter((row) => ["SCHEDULED", "IN_PROGRESS", "DRAFT"].includes(row.status)).reduce((total, row) => total + Number(row.visits || 0), 0);
        return { visitCount, completed, scheduled };
    }, [summary]);

    const cards = [
        { label: `${period.label} visits`, value: figures.visitCount, detail: "Scheduled care visits", icon: CalendarDays, tone: "bg-cyan-50 text-cyan-800", to: `/admin/rosters?date=${period.to}` },
        { label: "Completed", value: figures.completed, detail: "Visits recorded as complete", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-800", to: `/admin/reports?from=${period.from}&to=${period.to}&tab=delivery` },
        { label: "Still planned", value: figures.scheduled, detail: "Draft, scheduled or in progress", icon: ClipboardList, tone: "bg-indigo-50 text-indigo-800", to: `/admin/rosters?date=${period.to}` },
        { label: "Needs review", value: reconciliation?.issues?.length ?? "—", detail: "Completed visits requiring finance review", icon: ShieldAlert, tone: "bg-amber-50 text-amber-900", to: `/admin/reports?from=${period.from}&to=${period.to}&tab=finance` },
    ];

    return <main className="min-h-screen bg-[#f5faff] p-4 text-[#10233f] md:p-8">
        <div className="mx-auto max-w-7xl">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-cyan-800">Caremonitor workspace</p>
                    <h1 className="mt-1 text-3xl font-bold">Dashboard</h1>
                    <p className="mt-2 text-slate-600">Care delivery, quality and finance overview for {period.label.toLowerCase()}. Times are shown in Europe/London.</p>
                </div>
                <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#0b294a] bg-white px-4 py-2 font-semibold text-[#0b294a] hover:bg-cyan-50 disabled:opacity-50">
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </header>

            <section aria-label="Dashboard period" className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    {[['today', 'Today'], ['yesterday', 'Yesterday'], ['last7', 'Last 7 days'], ['lastWeek', 'Last week'], ['last30', 'Last 30 days'], ['custom', 'Custom']].map(([value, label]) => <button key={value} type="button" onClick={() => setRange(value)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${range === value ? "border-[#0b294a] bg-[#0b294a] text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-cyan-50"}`}>{label}</button>)}
                    {range === "custom" && <div className="flex flex-wrap items-end gap-2 rounded-lg border border-cyan-200 bg-cyan-50 p-2"><label className="text-xs font-semibold text-slate-700">From<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1 block rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" /></label><label className="text-xs font-semibold text-slate-700">To<input type="date" min={customFrom || undefined} value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-1 block rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" /></label></div>}
                    <span className="ml-auto text-sm text-slate-500">{period.from} to {period.to}</span>
                </div>
                {range === "custom" && customFrom && customTo && customFrom > customTo && <p role="alert" className="mt-2 text-sm text-red-700">The end date must be on or after the start date.</p>}
            </section>

            <section aria-label={`${period.label} overview`} className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ label, value, detail, icon: Icon, tone, to }) => <Link key={label} to={to} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md">
                    <div className={`inline-flex rounded-lg p-2 ${tone}`}><Icon size={20} /></div>
                    <p className="mt-4 text-sm font-medium text-slate-600">{label}</p>
                    <p className="mt-1 text-3xl font-bold">{loading ? "…" : value}</p>
                    <p className="mt-1 text-sm text-slate-500">{detail}</p>
                </Link>)}
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
                <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold">Start work</h2>
                    <p className="mt-2 text-slate-600">Open the area you need without searching through the menu.</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <QuickLink to="/admin/clients" label="Clients" description="Client records, care plans and medication" icon={Users} />
                        <QuickLink to="/admin/rosters" label="Roster" description="Plan and manage care visits" icon={CalendarDays} />
                        <QuickLink to="/admin/inbox" label="Inbox" description="Review messages and alerts" icon={ClipboardList} />
                        <QuickLink to="/admin/accounting" label="Accounting" description="Invoices, payments and reconciliation" icon={CreditCard} />
                    </div>
                </article>
                <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold">Organisation snapshot</h2>
                    <dl className="mt-5 space-y-4 text-sm">
                        <Snapshot label="Active clients" value={summary?.people?.clients ?? "—"} to="/admin/clients" />
                        <Snapshot label="Active team members" value={summary?.people?.staff ?? "—"} to="/admin/teams" />
                        <Snapshot label="Open quality cases" value={summary?.quality?.openCases ?? "—"} emphasis={Number(summary?.quality?.openCases) > 0} to="/admin/governance" />
                        <Snapshot label="Visit invoices" value={accounting?.visitInvoices ?? "—"} to="/admin/accounting" />
                    </dl>
                    <Link to="/admin/reports" className="mt-6 inline-flex font-semibold text-cyan-800 underline underline-offset-4">Open reporting and assurance</Link>
                </aside>
            </section>
            <p className="mt-5 text-sm text-slate-500">{updatedAt ? `Last refreshed ${updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.` : "Loading dashboard data…"}</p>
        </div>
    </main>;
}

function QuickLink({ to, label, description, icon: Icon }) {
    return <Link to={to} className="rounded-lg border border-slate-200 p-4 transition hover:border-cyan-400 hover:bg-cyan-50">
        <Icon size={20} className="text-cyan-800" />
        <p className="mt-3 font-semibold">{label}</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
    </Link>;
}

function Snapshot({ label, value, emphasis, to }) {
    return <Link to={to} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 hover:text-cyan-800"><span className="text-slate-600">{label}</span><strong className={emphasis ? "text-amber-800" : ""}>{value}</strong></Link>;
}
