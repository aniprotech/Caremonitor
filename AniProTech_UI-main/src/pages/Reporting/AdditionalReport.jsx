import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { _get } from "../../utils/ApiService";
import { buttonClass, downloadCsv } from "../../components/Operations/common";
import { additionalReportIds } from "./additionalReportIds";
import { ReportBars, ReportDonut } from "./ReportCharts";

const EMPTY = [];
const unwrap = (response) => response.data.results.data;
const percent = (part, total) => total ? `${Math.round(part * 100 / total)}%` : "—";
const total = (rows, field) => rows.reduce((value, row) => value + Number(row[field] || 0), 0);

function Table({ headers, rows, empty = "No records in the selected period." }) {
    return <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{headers.map((header) => <th key={header} className="whitespace-nowrap p-3">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-t" key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td className="p-3" key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="p-4 text-sm text-slate-600">{empty}</p>}</div>;
}

function Metric({ label, value, note }) {
    return <div className="rounded-xl border bg-white p-4"><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-600">{note}</p></div>;
}

export default function AdditionalReport({ reportId, from, to, graceMinutes }) {
    const [data, setData] = useState(null), [summary, setSummary] = useState(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        setLoading(true); setError("");
        Promise.all([_get("/api/reports/library", { params: { from, to } }), reportId === "pir-evidence" ? _get("/api/reports/summary", { params: { from, to } }) : Promise.resolve(null)])
            .then(([library, overview]) => { if (active) { setData(unwrap(library)); setSummary(overview ? unwrap(overview) : null); } })
            .catch((reason) => { if (active) setError(reason.response?.data?.message || "Unable to load report data"); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [from, to, reportId]);

    const visits = data?.visits || EMPTY, alerts = data?.alerts || EMPTY, groups = data?.groups || EMPTY;
    const completed = visits.filter((visit) => visit.status === "COMPLETED");
    const byClient = useMemo(() => {
        const map = new Map();
        for (const visit of visits) {
            if (!map.has(visit.clientId)) map.set(visit.clientId, { id: visit.clientId, name: visit.clientName, observations: 0, alerts: 0, activities: 0, completedActivities: 0 });
            const row = map.get(visit.clientId);
            row.observations += visit.observations;
            row.activities += visit.activities;
            row.completedActivities += visit.completedActivities;
        }
        for (const alert of alerts) {
            if (!map.has(alert.clientId)) map.set(alert.clientId, { id: alert.clientId, name: alert.clientName, observations: 0, alerts: 0, activities: 0, completedActivities: 0 });
            map.get(alert.clientId).alerts += 1;
        }
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [visits, alerts]);
    const rowLink = (client) => <Link className="font-medium text-teal-800 underline" to={`/admin/clients/${client.id}/visits`}>{client.name}</Link>;
    const warning = data?.truncated && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This period exceeds the 10,000-record report limit. Select a shorter range before using or exporting these figures.</p>;
    const exportData = (name, headers, rows) => downloadCsv(`caremonitor-${name}-${from}-${to}.csv`, [headers, ...rows]);

    if (!additionalReportIds.has(reportId)) return <p role="alert">Report not found.</p>;
    if (loading) return <p className="text-sm text-slate-600">Loading report…</p>;
    if (error) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>;

    if (reportId === "clinical-review") {
        const rows = byClient.filter((client) => client.observations || client.alerts);
        return <section className="space-y-5"><header><h2 className="text-xl font-semibold">Clinical record activity</h2><p className="text-sm text-slate-600">Recorded visit observations and alerts during {from} to {to}. This is an activity review, not a medical-history or risk-score change report.</p></header>{warning}<div className="grid gap-3 sm:grid-cols-3"><Metric label="Observations" value={total(visits, "observations")} note="Visit-linked records" /><Metric label="Alerts raised" value={alerts.length} note="Created in this period" /><Metric label="Clients with records" value={rows.length} note="Observations or alerts" /></div><div className="grid gap-4 lg:grid-cols-2"><ReportDonut title="Recorded event types" rows={[{ label: "Observations", value: total(visits, "observations") }, { label: "Alerts", value: alerts.length }]} /><ReportBars title="Events by client" rows={rows.map((client) => ({ label: client.name, value: client.observations + client.alerts })).sort((a, b) => b.value - a.value)} note="Top 12 clients by recorded events" /></div><button className={buttonClass} disabled={data.truncated} onClick={() => exportData("clinical-record-activity", ["Client", "Observations", "Alerts"], rows.map((client) => [client.name, client.observations, client.alerts]))}>Export records</button><Table headers={["Client", "Observations", "Alerts"]} rows={rows.map((client) => [rowLink(client), client.observations, client.alerts])} /><p className="text-xs text-slate-600">Risk and Waterlow score changes require versioned assessment values; they are not inferred from observations or alerts.</p></section>;
    }
    if (reportId === "quality-indicators") {
        const withStart = completed.filter((visit) => visit.actualStart);
        const onTime = withStart.filter((visit) => new Date(visit.actualStart) - new Date(visit.scheduledStart) <= graceMinutes * 60000);
        const withNotes = completed.filter((visit) => visit.notes > 0);
        const rows = [["Visit completion", percent(completed.length, visits.length), `${completed.length} of ${visits.length} non-cancelled visits`], ["On-time check-in", percent(onTime.length, withStart.length), `${onTime.length} of ${withStart.length} completed visits with a check-in`], ["Visit notes recorded", percent(withNotes.length, completed.length), `${withNotes.length} of ${completed.length} completed visits`], ["Medication exceptions", total(visits, "medicationExceptions"), "Recorded visit eMAR exceptions"], ["Open alerts raised in period", alerts.filter((alert) => alert.status === "OPEN").length, "Alerts created in this period that remain open"]];
        return <section className="space-y-5"><header><h2 className="text-xl font-semibold">Quality indicators</h2><p className="text-sm text-slate-600">Separate, auditable measures from Caremonitor records. No combined or clinical quality score is calculated.</p></header>{warning}<div className="grid gap-3 sm:grid-cols-3"><Metric label={rows[0][0]} value={rows[0][1]} note={rows[0][2]} /><Metric label={rows[1][0]} value={rows[1][1]} note={rows[1][2]} /><Metric label={rows[2][0]} value={rows[2][1]} note={rows[2][2]} /></div><div className="grid gap-4 lg:grid-cols-2"><ReportDonut title="Visit completion" rows={[{ label: "Completed", value: completed.length }, { label: "Other status", value: visits.length - completed.length }]} /><ReportBars title="Percentage indicators" rows={rows.slice(0, 3).filter(([, value]) => value !== "—").map(([label, value]) => ({ label, value: Number.parseInt(value, 10) }))} note="Indicators without a denominator are omitted from the chart" /></div><button className={buttonClass} disabled={data.truncated} onClick={() => exportData("quality-indicators", ["Indicator", "Value", "Definition"], rows)}>Export indicators</button><Table headers={["Indicator", "Value", "Definition"]} rows={rows} /></section>;
    }
    if (reportId === "pir-evidence") {
        const rows = [["Active clients", summary?.people.clients ?? "—", "Current active count; not historical"], ["Active staff", summary?.people.staff ?? "—", "Current active count; not historical"], ["Recorded visits", visits.length, "Non-cancelled visits in selected period"], ["Completed visits", completed.length, "Visits marked completed in selected period"], ["Recorded care hours", (total(completed, "actualMinutes") / 60).toFixed(1), "Completed visits with recorded start and end"], ["Quality cases raised", summary?.quality.openCases ?? "—", "Cases raised in period that remain open"]];
        return <section className="space-y-5"><header><h2 className="text-xl font-semibold">Provider return evidence</h2><p className="text-sm text-slate-600">An evidence summary for your organisation to review when preparing a Provider Information Return. It is not a completed regulatory return or submission.</p></header>{warning}<div className="grid gap-4 lg:grid-cols-2"><ReportDonut title="Visit outcomes" rows={[{ label: "Completed", value: completed.length }, { label: "Other status", value: visits.length - completed.length }]} /><ReportBars title="Recorded visit counts" rows={[{ label: "Visits", value: visits.length }, { label: "Completed", value: completed.length }]} note="The completed count is included in the visit total" /></div><button className={buttonClass} disabled={data.truncated} onClick={() => exportData("provider-return-evidence", ["Measure", "Value", "Definition"], rows)}>Export evidence</button><Table headers={["Measure", "Value", "Definition"]} rows={rows} /><p className="text-xs text-slate-600">Confirm the regulator’s reporting period, eligibility and question definitions before using these figures in a return.</p></section>;
    }
    if (reportId === "recorded-tasks") {
        const rows = byClient.filter((client) => client.activities);
        const recorded = total(visits, "activities"), done = total(visits, "completedActivities");
        return <section className="space-y-5"><header><h2 className="text-xl font-semibold">Recorded task outcomes</h2><p className="text-sm text-slate-600">Visit activities entered in Caremonitor during {from} to {to}. These counts do not represent every task expected from a care schedule.</p></header>{warning}<div className="grid gap-3 sm:grid-cols-3"><Metric label="Activities recorded" value={recorded} note="Visit-linked activity entries" /><Metric label="Marked complete" value={done} note="Completed activity entries" /><Metric label="Not marked complete" value={recorded - done} note="Recorded entries with another status" /></div><div className="grid gap-4 lg:grid-cols-2"><ReportDonut title="Recorded activity status" rows={[{ label: "Marked complete", value: done }, { label: "Other status", value: recorded - done }]} /><ReportBars title="Completed activities by client" rows={rows.map((client) => ({ label: client.name, value: client.completedActivities })).sort((a, b) => b.value - a.value)} note="Top 12 clients by completed entries" /></div><button className={buttonClass} disabled={data.truncated} onClick={() => exportData("recorded-task-outcomes", ["Client", "Recorded activities", "Completed", "Not marked complete"], rows.map((client) => [client.name, client.activities, client.completedActivities, client.activities - client.completedActivities]))}>Export outcomes</button><Table headers={["Client", "Recorded", "Completed", "Not marked complete"]} rows={rows.map((client) => [rowLink(client), client.activities, client.completedActivities, client.activities - client.completedActivities])} /></section>;
    }
    const rows = groups.map((group) => [group.name, group.staff, group.visits, group.completed, percent(group.completed, group.visits)]);
    return <section className="space-y-5"><header><h2 className="text-xl font-semibold">Team group comparison</h2><p className="text-sm text-slate-600">Care delivery by configured staff group during {from} to {to}. Groups are not treated as geographic branches or regions.</p></header>{warning}<div className="grid gap-4 lg:grid-cols-2"><ReportDonut title="Organisation visit outcomes" rows={[{ label: "Completed", value: completed.length }, { label: "Other status", value: visits.length - completed.length }]} note="Unique visit records across the organisation" /><ReportBars title="Completed visits by team group" rows={groups.map((group) => ({ label: group.name, value: group.completed })).sort((a, b) => b.value - a.value)} note="Group totals may overlap when staff belong to more than one group" /></div><button className={buttonClass} disabled={data.truncated} onClick={() => exportData("team-group-comparison", ["Group", "Staff", "Visits", "Completed", "Completion"], rows)}>Export groups</button><Table headers={["Group", "Staff", "Visits", "Completed", "Completion"]} rows={rows} empty="No staff groups are configured for this organisation." /><p className="text-xs text-slate-600">A staff member may belong to more than one group, so group totals can overlap.</p></section>;
}
