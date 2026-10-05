import { Link, useParams, useSearchParams } from "react-router-dom";
import { Field, inputClass, londonToday, Page } from "../../components/Operations/common";
import ReportLibrary from "./ReportLibrary";
import AdditionalReport from "./AdditionalReport";
import { additionalReportIds } from "./additionalReportIds";

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

export default function ReportDetail() {
    const { reportId } = useParams();
    const [params, setParams] = useSearchParams();
    const today = londonToday();
    const from = validDate(params.get("from")) ? params.get("from") : `${today.slice(0, 8)}01`;
    const to = validDate(params.get("to")) ? params.get("to") : today;
    const grace = params.has("graceMinutes") ? Number(params.get("graceMinutes")) : 5;
    const graceMinutes = [0, 5, 10, 15, 30, 60].includes(grace) ? grace : 5;
    const update = (key, value) => {
        const next = new URLSearchParams(params);
        next.set(key, value);
        setParams(next);
    };
    return <Page title="Caremonitor report" description="Report details from your organisation’s records. Times use Europe/London.">
        <Link to={`/admin/reports?${new URLSearchParams({ from, to })}`} className="inline-flex text-sm font-semibold text-teal-800 underline">← All reports</Link>
        <section className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
            <Field label="From"><input className={inputClass} type="date" value={from} onChange={(event) => update("from", event.target.value)} /></Field>
            <Field label="To"><input className={inputClass} type="date" value={to} onChange={(event) => update("to", event.target.value)} /></Field>
            <Field label="Late grace (minutes)"><select className={inputClass} value={graceMinutes} onChange={(event) => update("graceMinutes", event.target.value)}>{[0, 5, 10, 15, 30, 60].map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
        </section>
        {additionalReportIds.has(reportId) ? <AdditionalReport reportId={reportId} from={from} to={to} graceMinutes={graceMinutes} /> : <ReportLibrary reportId={reportId} from={from} to={to} graceMinutes={graceMinutes} />}
    </Page>;
}
