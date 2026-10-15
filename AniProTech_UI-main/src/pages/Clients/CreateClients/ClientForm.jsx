import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { _get, _post } from "../../../utils/ApiService";
import { showSuccess } from "../../../utils/toaster";
import { clientsProfileTitleOptions, clientsContactAddressTypes, clientsContactPhoneTypes } from "../../../constants";
import { loadGoogleMapScript } from "../../../utils/loadGoogleMapScript";
import DateField from "../../../components/DateField/DateField";

const blankAddress = () => ({
    addressType: "PERMANENT_RESIDENCE",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    country: "United Kingdom",
    postalCode: "",
    secureCheckin: "false",
    accessDetails: "",
    latitude: "",
    longitude: "",
    checkinRadius: 200,
    isPrimary: true,
});
const blank = () => ({
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    preferredName: "",
    referredAs: "HE_HIM",
    dateOfBirth: "",
    email: "",
    primaryPhone: "",
    primaryPhoneCode: "+44",
    primaryPhoneType: "",
    secondaryPhone: "",
    secondaryPhoneCode: "+44",
    secondaryPhoneType: "",
    highlights: "",
    initialRateAmount: "",
    initialRateUnit: "HOURLY",
    initialRateEffectiveFrom: new Date().toISOString().slice(0, 10),
    addresses: [blankAddress()],
});
const scalar = [
    "title",
    "firstName",
    "middleName",
    "lastName",
    "preferredName",
    "referredAs",
    "dateOfBirth",
    "email",
    "primaryPhone",
    "primaryPhoneCode",
    "primaryPhoneType",
    "secondaryPhone",
    "secondaryPhoneCode",
    "secondaryPhoneType",
    "highlights",
    "initialRateAmount",
    "initialRateUnit",
    "initialRateEffectiveFrom",
];
export default function ClientForm({ editing = false }) {
    const { id } = useParams(),
        navigate = useNavigate();
    const [values, setValues] = useState(blank),
        [loading, setLoading] = useState(editing),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [locatingAddress, setLocatingAddress] = useState(null),
        [photo, setPhoto] = useState(null),
        [removePhoto, setRemovePhoto] = useState(false);
    useEffect(() => {
        if (!editing) return;
        const controller = new AbortController();
        setLoading(true);
        _get(`/api/client/get-client/${id}`, { signal: controller.signal })
            .then((r) => {
                const d = r.data.results.data;
                setValues({ ...blank(), ...d, addresses: d.addresses?.length ? d.addresses : [blankAddress()] });
            })
            .catch((e) => {
                if (!controller.signal.aborted) setError(e.response?.data?.message || "Unable to load client");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [id, editing]);
    const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
    const addr = (index, key, value) =>
        setValues((v) => ({ ...v, addresses: v.addresses.map((a, i) => (i === index ? { ...a, [key]: value } : a)) }));
    async function locateAddress(index) {
        const address = values.addresses[index], query = [address.addressLine1, address.addressLine2, address.city, address.county, address.postalCode, address.country].filter(Boolean).join(", ");
        if (!query.trim()) return setError("Enter the client address before finding its check-in location.");
        setError(""); setLocatingAddress(index);
        try {
            await loadGoogleMapScript(import.meta.env.VITE_APP_MAP_API_KEY);
            const response = await new window.google.maps.Geocoder().geocode({ address: query });
            const location = response.results?.[0]?.geometry?.location;
            if (!location) throw new Error("Address not found");
            setValues((current) => ({ ...current, addresses: current.addresses.map((item, i) => i === index ? { ...item, latitude: location.lat().toFixed(7), longitude: location.lng().toFixed(7), secureCheckin: "true", checkinRadius: item.checkinRadius || 200 } : item) }));
        } catch (geocodeError) {
            setError(geocodeError?.message === "Address not found" ? "The address could not be located. Check the postcode and address, then retry." : "Google Maps could not locate this address. Check the browser map key and its domain restrictions.");
        } finally { setLocatingAddress(null); }
    }
    const field = (key, label, type = "text", required = false) => (
        <label
            className="block text-sm"
            key={key}
        >
            {label}
            {required ? " *" : ""}
            <input
                className="mt-2 w-full rounded border p-3"
                type={type}
                required={required}
                maxLength={type === "email" ? 254 : 100}
                max={type === "date" ? new Date().toISOString().slice(0, 10) : undefined}
                value={values[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
            />
        </label>
    );
    const select = (key, label, options) => (
        <label
            className="block text-sm"
            key={key}
        >
            {label}
            <select
                className="mt-2 w-full rounded border p-3"
                value={values[key] || ""}
                onChange={(e) => set(key, e.target.value)}
            >
                {options.map((o) => (
                    <option
                        key={o.value}
                        value={o.value}
                    >
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
    async function save(e) {
        e.preventDefault();
        setError("");
        if (!values.firstName.trim() || !values.lastName.trim()) return setError("First name and last name are required.");
        for (const prefix of ["primary", "secondary"])
            if (values[prefix + "Phone"] && !values[prefix + "PhoneType"]) return setError(`Select the ${prefix} phone number type.`);
        setBusy(true);
        try {
            const body = new FormData();
            if (editing) body.append("id", id);
            for (const k of scalar) body.append(k, typeof values[k] === "string" ? values[k].trim() : (values[k] ?? ""));
            body.append("addresses", JSON.stringify(values.addresses.map((a, i) => ({ ...a, isPrimary: i === 0 }))));
            body.append("filesToRemove", JSON.stringify(removePhoto ? ["profileImage"] : []));
            if (photo) body.append("profileImage", photo);
            await _post("/api/client/create", body);
            showSuccess("Client saved");
            navigate(editing ? `/admin/clients/${id}/basic-info` : "/admin/clients");
        } catch (e) {
            setError(e.response?.data?.message || "Unable to save client");
        } finally {
            setBusy(false);
        }
    }
    if (loading) return <p className="p-8">Loading client…</p>;
    return (
        <form
            onSubmit={save}
            className="mx-auto max-w-5xl space-y-6 p-5 pb-16 text-slate-800"
        >
            <h1 className="text-2xl font-semibold">{editing ? "Edit client" : "Add client"}</h1>
            <nav className="flex flex-wrap gap-5">
                {["Personal details", "Contact details", "Addresses", "Billing rate", "Highlights"].map((t, i) => (
                    <a
                        key={t}
                        href={`#client-section-${i}`}
                        className="text-blue-800 underline"
                    >
                        {t}
                    </a>
                ))}
            </nav>
            <section
                id="client-section-0"
                className="scroll-mt-20 space-y-5 rounded-xl border bg-white p-6"
            >
                <h2 className="text-xl font-semibold">Personal details</h2>
                {values.profileImagePath && !removePhoto && (
                    <div>
                        <img
                            alt="Client profile"
                            className="mb-3 h-24 w-24 rounded-full object-cover"
                            src={
                                /^https?:/.test(values.profileImagePath)
                                    ? values.profileImagePath
                                    : `${(import.meta.env.VITE_APP_BASE_LIVE_URL || "https://backend.aniprotech.com").replace(/\/$/, "")}/${values.profileImagePath.replace(/^\//, "")}`
                            }
                        />
                        <button
                            type="button"
                            className="text-red-700 underline"
                            onClick={() => {
                                setRemovePhoto(true);
                                setPhoto(null);
                            }}
                        >
                            Remove photograph
                        </button>
                    </div>
                )}
                <label className="block text-sm">
                    Profile picture (JPG or PNG, up to 12 MB)
                    <input
                        className="mt-2 block"
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(e) => {
                            const file = e.target.files[0];
                            if (file && (!["image/jpeg", "image/png"].includes(file.type) || file.size > 12 * 1024 * 1024)) {
                                setError("Choose a JPG or PNG under 12 MB");
                                e.target.value = "";
                                return;
                            }
                            setPhoto(file || null);
                            setRemovePhoto(false);
                        }}
                    />
                </label>
                <div className="grid gap-5 md:grid-cols-2">
                    {select("title", "Title", clientsProfileTitleOptions)}
                    {field("firstName", "First name", "text", true)}
                    {field("middleName", "Middle name")}
                    {field("lastName", "Last name", "text", true)}
                    {field("preferredName", "Preferred name")}
                    {select("referredAs", "Pronouns", [
                        { value: "HE_HIM", label: "He/Him" },
                        { value: "SHE_HER", label: "She/Her" },
                        { value: "THEY_THEM", label: "They/Them" },
                    ])}
                    {field("dateOfBirth", "Date of birth", "date", true)}
                </div>
            </section>
            <section
                id="client-section-1"
                className="scroll-mt-20 space-y-5 rounded-xl border bg-white p-6"
            >
                <h2 className="text-xl font-semibold">Contact details</h2>
                {field("email", "Email address", "email", true)}
                {["primary", "secondary"].map((prefix) => (
                    <div
                        key={prefix}
                        className="grid gap-5 md:grid-cols-3"
                    >
                        {field(prefix + "PhoneCode", `${prefix === "primary" ? "Primary" : "Secondary"} country code`)}
                        {field(prefix + "Phone", "Phone number", "tel")}
                        {select(prefix + "PhoneType", "Phone type", clientsContactPhoneTypes)}
                    </div>
                ))}
            </section>
            <section
                id="client-section-2"
                className="scroll-mt-20 space-y-5 rounded-xl border bg-white p-6"
            >
                <h2 className="text-xl font-semibold">Addresses</h2>
                {values.addresses.map((a, i) => (
                    <fieldset
                        key={a.id || i}
                        className="space-y-4 rounded border p-4"
                    >
                        <legend className="px-2 font-medium">{i === 0 ? "Primary address" : `Additional address ${i}`}</legend>
                        <label className="block text-sm">
                            Address type
                            <select
                                className="mt-2 w-full rounded border p-3"
                                value={a.addressType || ""}
                                onChange={(e) => addr(i, "addressType", e.target.value)}
                            >
                                {clientsContactAddressTypes.map((o) => (
                                    <option
                                        key={o.value}
                                        value={o.value}
                                    >
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="grid gap-4 md:grid-cols-2">
                            {[
                                ["addressLine1", "Address line 1"],
                                ["addressLine2", "Address line 2"],
                                ["city", "Town / city"],
                                ["county", "County"],
                                ["postalCode", "Postcode"],
                                ["country", "Country"],
                            ].map(([k, label]) => (
                                <label
                                    className="text-sm"
                                    key={k}
                                >
                                    {label}
                                    <input
                                        className="mt-2 w-full rounded border p-3"
                                        value={a[k] || ""}
                                        onChange={(e) => addr(i, k, e.target.value)}
                                        maxLength={200}
                                    />
                                </label>
                            ))}
                        </div>
                        <label className="block text-sm">
                            Access details
                            <textarea
                                className="mt-2 w-full rounded border p-3"
                                rows={3}
                                maxLength={4000}
                                value={a.accessDetails || ""}
                                onChange={(e) => addr(i, "accessDetails", e.target.value)}
                            />
                        </label>
                        <label className="flex gap-2">
                            <input
                                type="checkbox"
                                checked={a.secureCheckin === true || a.secureCheckin === "true"}
                                onChange={(e) => addr(i, "secureCheckin", String(e.target.checked))}
                            />
                            Record a secure check-in zone
                        </label>
                        {(a.secureCheckin === true || a.secureCheckin === "true") && (
                            <>
                                <p className="text-sm text-slate-600">
                                    Find the address coordinates and choose the permitted radius. Mobile check-in and check-out use these values to verify attendance.
                                </p>
                                <button type="button" disabled={locatingAddress === i} onClick={() => void locateAddress(i)} className="rounded bg-cyan-600 px-4 py-2 font-medium text-white disabled:opacity-50">
                                    {locatingAddress === i ? "Finding address…" : "Find coordinates from address"}
                                </button>
                                <div className="grid gap-4 md:grid-cols-3">
                                    {[
                                        ["latitude", "Latitude", -90, 90],
                                        ["longitude", "Longitude", -180, 180],
                                        ["checkinRadius", "Radius (metres)", 10, 5000],
                                    ].map(([k, label, min, max]) => (
                                        <label key={k}>
                                            {label}
                                            <input
                                                className="mt-2 w-full rounded border p-3"
                                                type="number"
                                                step={k === "checkinRadius" ? 1 : "any"}
                                                min={min}
                                                max={max}
                                                required
                                                value={a[k] ?? ""}
                                                onChange={(e) => addr(i, k, e.target.value)}
                                            />
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}
                        {i > 0 && (
                            <button
                                type="button"
                                className="text-red-700 underline"
                                onClick={() =>
                                    set(
                                        "addresses",
                                        values.addresses.filter((_, n) => n !== i),
                                    )
                                }
                            >
                                Remove address
                            </button>
                        )}
                    </fieldset>
                ))}
                <button
                    type="button"
                    className="rounded border px-4 py-2"
                    onClick={() => set("addresses", [...values.addresses, blankAddress()])}
                >
                    Add another address
                </button>
            </section>
            <section
                id="client-section-3"
                className="scroll-mt-20 space-y-4 rounded-xl border bg-white p-6"
            >
                <h2 className="text-xl font-semibold">Client billing rate</h2>
                <p className="text-sm text-slate-600">Optional now. If set, invoice previews automatically use this rate for completed visits from the effective date. A Finance administrator can change it later without altering earlier invoices.</p>
                <div className="grid gap-5 md:grid-cols-3">
                    <label className="block text-sm">Rate unit<select className="mt-2 w-full rounded border p-3" value={values.initialRateUnit} onChange={(e) => set("initialRateUnit", e.target.value)}><option value="HOURLY">Per hour</option><option value="HALF_DAY">Half day</option><option value="FULL_DAY">Full day</option><option value="SESSION_3H">Session (3 hours)</option><option value="SESSION_6H">Session (6 hours)</option><option value="WEEKLY">Per week</option></select></label>
                    <label className="block text-sm">Rate (GBP)<input className="mt-2 w-full rounded border p-3" type="number" min="0" max="1000000" step="0.01" value={values.initialRateAmount} onChange={(e) => set("initialRateAmount", e.target.value)} placeholder="Optional" /></label>
                    <DateField
                        name="initialRateEffectiveFrom"
                        label="Effective from"
                        value={values.initialRateEffectiveFrom}
                        onChange={(event) => set("initialRateEffectiveFrom", event.target.value)}
                        style="width"
                    />
                </div>
            </section>
            <section
                id="client-section-4"
                className="scroll-mt-20 space-y-4 rounded-xl border bg-white p-6"
            >
                <h2 className="text-xl font-semibold">Highlights and past history</h2>
                <p className="text-sm text-slate-600">
                    Record the client’s life story, important people, past experiences, routines, interests and what matters to them. Clinical history
                    can also be recorded under Client information → Clinical details.
                </p>
                <textarea
                    aria-label="Highlights and past history"
                    className="w-full rounded border p-3"
                    rows={14}
                    maxLength={20000}
                    value={values.highlights || ""}
                    onChange={(e) => set("highlights", e.target.value)}
                />
                <p className="text-sm text-slate-500">{(values.highlights || "").length.toLocaleString()} / 20,000 characters</p>
            </section>
            {error && (
                <p
                    role="alert"
                    className="rounded border border-red-300 bg-red-50 p-4 text-red-800"
                >
                    {error}
                </p>
            )}
            <div className="flex gap-3">
                <button
                    disabled={busy}
                    type="submit"
                    className="rounded bg-blue-900 px-6 py-3 text-white disabled:opacity-50"
                >
                    {busy ? "Saving…" : "Save client"}
                </button>
                <button
                    type="button"
                    disabled={busy}
                    className="rounded border px-6 py-3"
                    onClick={() => navigate(editing ? `/admin/clients/${id}/basic-info` : "/admin/clients")}
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
