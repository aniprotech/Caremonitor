import { useEffect, useState } from "react";
import { _get, _post } from "../../utils/ApiService";
import { Page, Field, ErrorBox, inputClass, buttonClass, displayTime } from "../../components/Operations/common";
export default function InboxIndex() {
    const [threads, setThreads] = useState([]),
        [people, setPeople] = useState([]),
        [selected, setSelected] = useState(null),
        [messages, setMessages] = useState([]);
    const [archived, setArchived] = useState(false),
        [page, setPage] = useState(1),
        [hasMore, setHasMore] = useState(false),
        [before, setBefore] = useState(null);
    const [error, setError] = useState(""),
        [loading, setLoading] = useState(true),
        [saving, setSaving] = useState(false),
        [refresh, setRefresh] = useState(0),
        [reply, setReply] = useState("");
    const [compose, setCompose] = useState(false),
        [draft, setDraft] = useState({ subject: "", body: "", participantIds: [] });
    useEffect(() => {
        let active = true;
        async function load() {
            try {
                const [t, p] = await Promise.all([_get("/api/inbox/threads", { params: { page, archived } }), _get("/api/inbox/people")]);
                if (active) {
                    setThreads(t.data.results.data.threads);
                    setHasMore(t.data.results.data.hasMore);
                    setPeople(p.data.results.data);
                }
            } catch (e) {
                if (active) setError(e.response?.data?.message || "Unable to load inbox");
            } finally {
                if (active) setLoading(false);
            }
        }
        load();
        const timer = setInterval(() => {
            if (!document.hidden) load();
        }, 15000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [page, archived, refresh]);
    useEffect(() => {
        if (!selected) return;
        let active = true;
        async function load() {
            try {
                const r = await _get(`/api/inbox/threads/${selected.id}/messages`);
                if (!active) return;
                const result = r.data.results.data;
                setMessages((old) =>
                    [...new Map([...old, ...result.messages].map((m) => [m.seq, m])).values()].sort((a, b) =>
                        BigInt(a.seq) < BigInt(b.seq) ? -1 : 1,
                    ),
                );
                setBefore(result.nextBefore);
                if (result.messages.length) await _post(`/api/inbox/threads/${selected.id}/read`, { throughSeq: result.messages.at(-1).seq });
            } catch (e) {
                if (active) setError(e.response?.data?.message || "Unable to load conversation");
            }
        }
        load();
        const timer = setInterval(() => {
            if (!document.hidden) load();
        }, 15000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [selected, refresh]);
    async function send(e) {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
            if (compose) {
                const r = await _post("/api/inbox/threads", draft);
                setSelected(r.data.results.data);
                setMessages([]);
                setCompose(false);
                setDraft({ subject: "", body: "", participantIds: [] });
                setArchived(false);
                setPage(1);
            } else {
                await _post(`/api/inbox/threads/${selected.id}/messages`, { body: reply });
                setReply("");
            }
            setRefresh((n) => n + 1);
        } catch (e) {
            setError(e.response?.data?.message || "Message could not be sent");
        } finally {
            setSaving(false);
        }
    }
    async function archive() {
        setSaving(true);
        try {
            await _post(`/api/inbox/threads/${selected.id}/archive`, { archived: !archived });
            setSelected(null);
            setMessages([]);
            setRefresh((n) => n + 1);
        } catch (e) {
            setError(e.response?.data?.message || "Unable to archive conversation");
        } finally {
            setSaving(false);
        }
    }
    async function older() {
        try {
            const r = await _get(`/api/inbox/threads/${selected.id}/messages`, { params: { before } });
            setMessages((old) => [...new Map([...r.data.results.data.messages, ...old].map((m) => [m.seq, m])).values()]);
            setBefore(r.data.results.data.nextBefore);
        } catch (e) {
            setError("Unable to load older messages");
        }
    }
    return (
        <Page
            title="Inbox"
            description="Private conversations between staff in your organisation. Messages refresh every 15 seconds."
        >
            <ErrorBox error={error} />
            <div className="flex flex-wrap gap-3">
                <button
                    className={buttonClass}
                    onClick={() => {
                        setCompose(true);
                        setSelected(null);
                        setMessages([]);
                        setError("");
                    }}
                >
                    New conversation
                </button>
                <button
                    className="rounded border px-4 py-2"
                    onClick={() => {
                        setArchived(!archived);
                        setPage(1);
                        setSelected(null);
                        setCompose(false);
                    }}
                >
                    {archived ? "Show inbox" : "Show archived"}
                </button>
                <button
                    className="rounded border px-4 py-2"
                    onClick={() => setRefresh((n) => n + 1)}
                >
                    Refresh
                </button>
            </div>
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
                <aside className="space-y-2 rounded-xl border bg-white p-3">
                    {loading ? (
                        <p>Loading...</p>
                    ) : !threads.length ? (
                        <p className="p-5 text-sm text-gray-500">No conversations here yet.</p>
                    ) : (
                        threads.map((t) => (
                            <button
                                key={t.id}
                                className={`w-full rounded border p-3 text-left ${selected?.id === t.id ? "border-cyan-300 bg-cyan-50" : ""}`}
                                onClick={() => {
                                    setSelected(t);
                                    setMessages([]);
                                    setCompose(false);
                                    setReply("");
                                    setError("");
                                }}
                            >
                                <div className="flex justify-between gap-2">
                                    <strong className="break-words text-sm">{t.subject}</strong>
                                    {t.unread > 0 && <span className="rounded bg-cyan-700 px-2 text-xs text-white">{t.unread}</span>}
                                </div>
                                <p className="mt-1 truncate text-xs text-gray-500">{t.preview}</p>
                            </button>
                        ))
                    )}
                    <div className="flex justify-between pt-3">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            Previous
                        </button>
                        <span>{page}</span>
                        <button
                            disabled={!hasMore}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                        </button>
                    </div>
                </aside>
                <section className="rounded-xl border bg-white p-5">
                    {compose ? (
                        <form
                            className="space-y-4"
                            onSubmit={send}
                        >
                            <h2 className="font-semibold">New conversation</h2>
                            <Field label="Recipients">
                                <select
                                    required
                                    multiple
                                    className={inputClass}
                                    value={draft.participantIds}
                                    onChange={(e) => setDraft({ ...draft, participantIds: [...e.target.selectedOptions].map((o) => o.value) })}
                                >
                                    {people.map((p) => (
                                        <option
                                            key={p.id}
                                            value={p.id}
                                        >
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            {!people.length && (
                                <p className="text-sm text-gray-500">Add another active team member before starting a conversation.</p>
                            )}
                            <Field label="Subject">
                                <input
                                    required
                                    maxLength={160}
                                    className={inputClass}
                                    value={draft.subject}
                                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                                />
                            </Field>
                            <Field label="Message">
                                <textarea
                                    required
                                    maxLength={6000}
                                    rows={5}
                                    className={inputClass}
                                    value={draft.body}
                                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                                />
                            </Field>
                            <button
                                disabled={saving || !draft.participantIds.length}
                                className={buttonClass}
                            >
                                Send message
                            </button>
                        </form>
                    ) : selected ? (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="font-semibold">{selected.subject}</h2>
                                <button
                                    disabled={saving}
                                    onClick={archive}
                                    className="text-sm underline"
                                >
                                    {archived ? "Restore" : "Archive"}
                                </button>
                            </div>
                            {before && (
                                <button
                                    className="my-3 text-sm underline"
                                    onClick={older}
                                >
                                    Load older messages
                                </button>
                            )}
                            <div
                                className="my-5 max-h-[480px] space-y-3 overflow-y-auto"
                                aria-live="polite"
                            >
                                {messages.map((m) => (
                                    <article
                                        key={m.id}
                                        className="rounded-lg bg-gray-50 p-3"
                                    >
                                        <div className="text-xs text-gray-500">
                                            {m.sender} · {displayTime(m.createdAt)}
                                        </div>
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.body}</p>
                                    </article>
                                ))}
                            </div>
                            <form
                                onSubmit={send}
                                className="space-y-3"
                            >
                                <Field label="Reply">
                                    <textarea
                                        required
                                        maxLength={6000}
                                        rows={3}
                                        value={reply}
                                        onChange={(e) => setReply(e.target.value)}
                                        className={inputClass}
                                    />
                                </Field>
                                <button
                                    disabled={saving || !reply.trim()}
                                    className={buttonClass}
                                >
                                    Send reply
                                </button>
                            </form>
                        </>
                    ) : (
                        <p className="p-12 text-center text-gray-500">Choose a conversation or start a new one.</p>
                    )}
                </section>
            </div>
        </Page>
    );
}

