import { useState } from "react";
import { useParams } from "react-router-dom";
import { _post } from "../../../../utils/ApiService";
import { normaliseNhsNumber } from "../../../../utils/nhsNumber";
export default function ClientIdentifiers({ data, onSaved }) {
    const { id } = useParams(),
        [editing, setEditing] = useState(false),
        [v, set] = useState({}),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    const fields = [
        ["uniqueClientIdentifier", "Client identifier"],
        ["nhsNumber", "NHS number"],
        ["localAuthorityId", "Local authority identifier"],
    ];
    return (
        <section className="mt-6 rounded-lg border bg-white p-6">
            <div className="flex justify-between">
                <h2 className="text-xl font-medium">Identifiers</h2>
                {!editing && (
                    <button
                        className="text-blue-900"
                        onClick={() => {
                            set(Object.fromEntries(fields.map(([k]) => [k, String(data[k] ?? "")])));
                            setError("");
                            setEditing(true);
                        }}
                    >
                        {fields.some(([k]) => data[k]) ? "Edit" : "＋ Add details"}
                    </button>
                )}
            </div>
            {editing ? (
                <form
                    className="mt-5 space-y-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setError("");
                        const nhsNumber = normaliseNhsNumber(v.nhsNumber);
                        if (nhsNumber === null)
                            return setError("Enter a valid 10-digit NHS number with a correct check digit, or leave it blank.");
                        setBusy(true);
                        try {
                            const r = await _post(`/api/client-information/update/${id}`, {
                                ...v,
                                nhsNumber: nhsNumber || null,
                            });
                            onSaved(r.data.results.data);
                            setEditing(false);
                        } catch (e) {
                            setError(e.response?.data?.message || "Unable to save identifiers");
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    {fields.map(([k, label]) => (
                        <label
                            className="block"
                            key={k}
                        >
                            {label}
                            <input
                                className="mt-2 w-full rounded border p-3"
                                maxLength={100}
                                value={v[k]}
                                onChange={(e) => set({ ...v, [k]: e.target.value })}
                            />
                        </label>
                    ))}
                    <p className="text-sm text-gray-600">The NHS-number check confirms format and check digit only. Confirm the number belongs to this client against an NHS record before using it for care.</p>
                    {error && (
                        <p
                            role="alert"
                            className="text-red-700"
                        >
                            {error}
                        </p>
                    )}
                    <div className="flex gap-4">
                        <button
                            disabled={busy}
                            className="rounded bg-blue-900 px-4 py-2 text-white"
                        >
                            {busy ? "Saving…" : "Save identifiers"}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setEditing(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            ) : (
                <dl className="mt-4">
                    {fields.map(([k, label]) => (
                        <div
                            className="grid gap-2 border-b py-4 md:grid-cols-2"
                            key={k}
                        >
                            <dt>{label}</dt>
                            <dd>{data[k] || "Not recorded"}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </section>
    );
}
