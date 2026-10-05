import { useEffect, useState } from "react";
import { _get } from "../../utils/ApiService";
import { Page, Field, ErrorBox, inputClass, londonToday, displayTime } from "../../components/Operations/common";
export default function LogIndex() {
    const [from, setFrom] = useState(() => londonToday().slice(0, 8) + "01"),
        [to, setTo] = useState(londonToday),
        [search, setSearch] = useState(""),
        [page, setPage] = useState(1),
        [result, setResult] = useState({ entries: [], hasMore: false }),
        [error, setError] = useState(""),
        [loading, setLoading] = useState(false);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");
        const timer = setTimeout(
            () =>
                _get("/api/activity", { params: { from, to, search, page } })
                    .then((r) => {
                        if (active) setResult(r.data.results.data);
                    })
                    .catch((e) => {
                        if (active) setError(e.response?.data?.message || "Unable to load activity");
                    })
                    .finally(() => {
                        if (active) setLoading(false);
                    }),
            250,
        );
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [from, to, search, page]);
    const action = (p) =>
        p
            .replace(/^\/api\//, "")
            .split("/")
            .filter((s) => !/[0-9a-f]{8}-/i.test(s))
            .join(" / ")
            .replaceAll("-", " ");
    return (
        <Page
            title="Activity log"
            description="Read-only history of recorded application requests in your organisation. Times are shown in London time."
        >
            <div className="flex flex-wrap gap-3">
                <Field label="From">
                    <input
                        className={inputClass}
                        type="date"
                        value={from}
                        onChange={(e) => {
                            setFrom(e.target.value);
                            setPage(1);
                        }}
                    />
                </Field>
                <Field label="To">
                    <input
                        className={inputClass}
                        type="date"
                        value={to}
                        onChange={(e) => {
                            setTo(e.target.value);
                            setPage(1);
                        }}
                    />
                </Field>
                <Field label="Filter activity">
                    <input
                        className={inputClass}
                        placeholder="Team, roster, finance..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                </Field>
            </div>
            <ErrorBox error={error} />
            {loading ? (
                <p>Loading activity...</p>
            ) : (
                <div className="overflow-x-auto rounded-xl border bg-white">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {["Time", "Staff member", "Activity", "Request"].map((h) => (
                                    <th
                                        className="p-3"
                                        key={h}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {result.entries.map((e) => (
                                <tr
                                    key={e.id}
                                    className="border-t"
                                >
                                    <td className="p-3">{displayTime(e.createdAt)}</td>
                                    <td className="p-3">{e.actor}</td>
                                    <td className="p-3 capitalize">{action(e.path)}</td>
                                    <td className="p-3">{e.method === "DELETE" ? "Delete" : e.method === "PUT" ? "Update" : "Submit"}</td>
                                </tr>
                            ))}
                            {!result.entries.length && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="p-10 text-center text-gray-500"
                                    >
                                        No recorded activity in this range.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="flex justify-end gap-4">
                <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                >
                    Previous
                </button>
                <span>Page {page}</span>
                <button
                    disabled={!result.hasMore}
                    onClick={() => setPage((p) => p + 1)}
                >
                    Next
                </button>
            </div>
        </Page>
    );
}
