import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, ClipboardList, CreditCard, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { _get } from "../../utils/ApiService";

const londonToday = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const unwrap = (response) => response?.data?.results?.data;

export default function DashboardIndex() {
    const [summary, setSummary] = useState(null);
    const [reconciliation, setReconciliation] = useState(null);
    const [accounting, setAccounting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const today = londonToday();
        const [reportResult, reconciliationResult, accountingResult] = await Promise.allSettled([
            _get("/api/reports/summary", { params: { from: today, to: today } }),
            _get("/api/reports/reconciliation", { params: { from: today, to: today } }),
            _get("/api/accounting/summary"),
        ]);
        if (reportResult.status === "fulfilled") setSummary(unwrap(reportResult.value));
        if (reconciliationResult.status === "fulfilled") setReconciliation(unwrap(reconciliationResult.value));
        if (accountingResult.status === "fulfilled") setAccounting(unwrap(accountingResult.value));
        setUpdatedAt(new Date());
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const figures = useMemo(() => {
        const statuses = summary?.byStatus || [];
        const visitCount = statuses.filter((row) => row.status !== "CANCELLED").reduce((total, row) => total + Number(row.visits || 0), 0);
        const completed = statuses.find((row) => row.status === "COMPLETED")?.visits || 0;
        const scheduled = statuses.filter((row) => ["SCHEDULED", "IN_PROGRESS", "DRAFT"].includes(row.status)).reduce((total, row) => total + Number(row.visits || 0), 0);
        return { visitCount, completed, scheduled };
    }, [summary]);

    const cards = [
        { label: "Today's visits", value: figures.visitCount, detail: "Scheduled care visits", icon: CalendarDays, tone: "bg-cyan-50 text-cyan-800" },
        { label: "Completed", value: figures.completed, detail: "Visits recorded as complete", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-800" },
        { label: "Still planned", value: figures.scheduled, detail: "Draft, scheduled or in progress", icon: ClipboardList, tone: "bg-indigo-50 text-indigo-800" },
        { label: "Needs review", value: reconciliation?.issues?.length ?? "—", detail: "Completed visits requiring finance review", icon: ShieldAlert, tone: "bg-amber-50 text-amber-900" },
    ];

    return <main className="min-h-screen bg-[#f5faff] p-4 text-[#10233f] md:p-8">
        <div className="mx-auto max-w-7xl">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-cyan-800">Caremonitor workspace</p>
                    <h1 className="mt-1 text-3xl font-bold">Dashboard</h1>
                    <p className="mt-2 text-slate-600">Today’s care delivery, quality and finance overview. Times are shown in Europe/London.</p>
                </div>
                <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#0b294a] bg-white px-4 py-2 font-semibold text-[#0b294a] hover:bg-cyan-50 disabled:opacity-50">
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </header>

            <section aria-label="Today’s overview" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ label, value, detail, icon: Icon, tone }) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className={`inline-flex rounded-lg p-2 ${tone}`}><Icon size={20} /></div>
                    <p className="mt-4 text-sm font-medium text-slate-600">{label}</p>
                    <p className="mt-1 text-3xl font-bold">{loading ? "…" : value}</p>
                    <p className="mt-1 text-sm text-slate-500">{detail}</p>
                </article>)}
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
                        <Snapshot label="Active clients" value={summary?.people?.clients ?? "—"} />
                        <Snapshot label="Active team members" value={summary?.people?.staff ?? "—"} />
                        <Snapshot label="Open quality cases" value={summary?.quality?.openCases ?? "—"} emphasis={Number(summary?.quality?.openCases) > 0} />
                        <Snapshot label="Visit invoices" value={accounting?.visitInvoices ?? "—"} />
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

function Snapshot({ label, value, emphasis }) {
    return <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0"><dt className="text-slate-600">{label}</dt><dd className={emphasis ? "font-bold text-amber-800" : "font-bold"}>{value}</dd></div>;
}
