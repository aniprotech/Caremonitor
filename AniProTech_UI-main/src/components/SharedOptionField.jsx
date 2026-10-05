import { useEffect, useMemo, useState } from "react";
import { _get, _post } from "../utils/ApiService";

export default function SharedOptionField({ kind, label, value, onChange, builtIn = [], radio = false }) {
  const [shared, setShared] = useState([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    _get(`/api/onboarding-options?kind=${encodeURIComponent(kind)}`)
      .then(response => { if (active) setShared(response?.data?.results?.data?.options || []); })
      .catch(() => { if (active) setError("Shared options could not be loaded. Built-in choices remain available."); });
    return () => { active = false; };
  }, [kind]);
  const choices = useMemo(() => {
    const result = [], seen = new Set();
    for (const option of [...builtIn, ...shared.map(text => ({ label: text, value: text }))]) {
      if (!option.value || seen.has(String(option.value).toLowerCase())) continue;
      seen.add(String(option.value).toLowerCase());
      result.push(option);
    }
    if (value && !seen.has(String(value).toLowerCase())) result.push({ label: value, value });
    return result;
  }, [builtIn, shared, value]);
  const add = async () => {
    const text = name.trim();
    if (text.length < 2) { setError("Enter at least two characters."); return; }
    setBusy(true); setError("");
    try {
      const response = await _post("/api/onboarding-options", { kind, name: text });
      const saved = response?.data?.results?.data?.name || text;
      setShared(items => items.some(item => item.toLowerCase() === saved.toLowerCase()) ? items : [...items, saved]);
      onChange(saved);
      setName(""); setAdding(false);
    } catch (requestError) { setError(requestError?.response?.data?.message || "Could not add this option."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    <label className="block text-sm font-medium text-customTextGrey">{label}</label>
    {radio ? <div className="space-y-2">{choices.map(option => <label key={option.value} className="flex items-center gap-3 rounded border px-4 py-3 text-sm"><input type="radio" name={kind} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />{option.label}</label>)}</div> :
      <select className="w-full rounded border bg-white px-3 py-3 text-sm" value={value || ""} onChange={event => onChange(event.target.value)}>
        <option value="">Select an option (optional)</option>
        {choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>}
    <button type="button" className="text-sm font-medium text-blue-800 underline" onClick={() => { setAdding(!adding); setError(""); }}>+ Add option</button>
    {adding && <div className="flex flex-wrap items-end gap-2 rounded border bg-slate-50 p-3">
      <label className="min-w-56 flex-1 text-sm">New reusable option
        <input className="mt-1 block w-full rounded border p-2" value={name} onChange={event => setName(event.target.value)} maxLength={120} />
      </label>
      <button type="button" disabled={busy} className="rounded bg-customNavy px-4 py-2 text-sm text-white disabled:opacity-50" onClick={add}>Save option</button>
      <p className="w-full text-xs text-slate-600">Options are shared with other organisations. Do not enter a client's name or personal details.</p>
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
