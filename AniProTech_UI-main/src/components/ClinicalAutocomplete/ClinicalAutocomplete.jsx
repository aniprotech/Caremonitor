import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { _get, _post } from "../../utils/ApiService";

export default function ClinicalAutocomplete({ kind, label, value, onChange, multiple = false }) {
    const [query, setQuery] = useState("");
    const [terms, setTerms] = useState([]);
    const [warnings, setWarnings] = useState([]);
    const [coverageNote, setCoverageNote] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        let active = true;
        const timer = setTimeout(async () => {
            try {
                const response = await _get(`/api/clinical-catalog?kind=${kind}&q=${encodeURIComponent(query)}`);
                if (active) {
                    const data = response?.data?.results?.data;
                    setTerms(data?.terms || []);
                    setWarnings(data?.warnings || []);
                    setCoverageNote(data?.coverageNote || "");
                }
            } catch { if (active) { setTerms([]); setWarnings(["Search could not be loaded. Please try again."]); } }
        }, 250);
        return () => { active = false; clearTimeout(timer); };
    }, [kind, query]);
    const selected = multiple ? (Array.isArray(value) ? value : []) : [];
    const choose = (name, term) => {
        if (multiple) onChange(selected.some(item => item.toLowerCase() === name.toLowerCase()) ? selected : [...selected, name]);
        else onChange(name, term);
        setQuery("");
        setError("");
    };
    const add = async () => {
        const name = query.trim();
        if (name.length < 2) return setError("Enter at least two characters.");
        setBusy(true);
        try {
            const response = await _post("/api/clinical-catalog", { kind, name });
            choose(response?.data?.results?.data?.name || name);
        } catch (e) { setError(e.response?.data?.message || "Could not add this term."); }
        finally { setBusy(false); }
    };
    return <div className="space-y-2">
        <label className="block text-sm font-medium text-customTextGrey" htmlFor={`${kind}-clinical-search`}>{label}</label>
        {!multiple && !!value && <p className="rounded border bg-blue-50 px-3 py-2 text-sm">Selected: {value}</p>}
        {multiple && selected.length > 0 && <div className="flex flex-wrap gap-2">{selected.map(item => <button type="button" key={item} className="rounded border bg-blue-50 px-3 py-1 text-sm" onClick={() => onChange(selected.filter(name => name !== item))}>{item} ×</button>)}</div>}
        <input id={`${kind}-clinical-search`} className="w-full rounded border p-3 text-sm" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${label.toLowerCase()} or type a new entry`} maxLength={120}/>
        {!!query && <div className="max-h-48 overflow-y-auto rounded border bg-white">{terms.map(term => <button type="button" key={`${term.source}-${term.name}-${term.postcode || ""}`} className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-blue-50" onClick={() => choose(term.name, term)}>{term.name} {term.postcode && <small className="text-gray-500">({term.postcode})</small>} <small className="text-gray-500">{term.source}{term.code && ` · ${term.code}`}</small></button>)}</div>}
        {!!query.trim() && !terms.some(term => term.name.toLowerCase() === query.trim().toLowerCase()) && <button type="button" disabled={busy} className="rounded border border-blue-700 px-3 py-2 text-sm text-blue-800" onClick={add}>+ Add “{query.trim()}” as an option</button>}
        {!!query.trim() && <p className="text-xs text-slate-600">Administrator-added options are shared across organisations. Do not enter client details here.</p>}
        {coverageNote && <p className="text-xs text-slate-600">{coverageNote}</p>}
        {warnings.map(message => <p key={message} role="status" className="text-sm text-amber-800">{message}</p>)}
        {!!error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>;
}

ClinicalAutocomplete.propTypes = { kind: PropTypes.oneOf(["history", "medicine", "hospital"]).isRequired, label: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]), onChange: PropTypes.func.isRequired, multiple: PropTypes.bool };
