import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowRight, BarChart3, BellRing, CalendarDays, Check, CheckCircle2, ClipboardCheck, HeartPulse, MapPin, Menu, ShieldCheck, Sparkles, Smartphone, UsersRound, WalletCards, X } from "lucide-react";
import SeoMeta from "../../components/Common/SeoMeta";

const siteUrl = "https://caremonitor.aniprotech.com";
const description = "Caremonitor by Aniprotech brings visits, care records, eMAR, rostering, finance, workforce and quality oversight into one connected care platform.";
const publicAddress = {
    streetAddress: import.meta.env.VITE_PUBLIC_STREET_ADDRESS,
    addressLocality: import.meta.env.VITE_PUBLIC_CITY,
    addressRegion: import.meta.env.VITE_PUBLIC_REGION,
    postalCode: import.meta.env.VITE_PUBLIC_POSTCODE,
    addressCountry: import.meta.env.VITE_PUBLIC_COUNTRY_CODE,
};
const hasPublicAddress = Object.values(publicAddress).some(Boolean);
const publicPhone = import.meta.env.VITE_PUBLIC_PHONE;
const sameAs = (import.meta.env.VITE_PUBLIC_SOCIAL_URLS || "").split(",").map((value) => value.trim()).filter(Boolean);
const organization = {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "Aniprotech",
    url: siteUrl,
    logo: `${siteUrl}/brand-logo.png`,
    email: "info@aniprotech.com",
    contactPoint: { "@type": "ContactPoint", email: "info@aniprotech.com", ...(publicPhone ? { telephone: publicPhone } : {}), contactType: "customer support", availableLanguage: ["English"] },
    ...(hasPublicAddress ? { address: { "@type": "PostalAddress", ...Object.fromEntries(Object.entries(publicAddress).filter(([, value]) => value)) } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
};
const schema = {
    "@context": "https://schema.org",
    "@graph": [
        organization,
        { "@type": "SoftwareApplication", "@id": `${siteUrl}/#software`, name: "Caremonitor by Aniprotech", url: siteUrl, applicationCategory: "BusinessApplication", operatingSystem: "Web, Android, iOS", description, publisher: { "@id": `${siteUrl}/#organization` }, offers: { "@type": "Offer", category: "Business care management software" } },
        { "@type": "WebSite", "@id": `${siteUrl}/#website`, name: "Caremonitor by Aniprotech", url: siteUrl, publisher: { "@id": `${siteUrl}/#organization` }, inLanguage: "en" },
    ],
};

const modules = [
    { icon: HeartPulse, title: "Care management", path: "/platform/care-management", text: "Person-centred profiles, assessments, care plans, tasks, observations, incidents and a complete client timeline.", color: "bg-cyan-50 text-cyan-700" },
    { icon: CalendarDays, title: "Rostering", path: "/platform/rostering", text: "Plan visits, assign caregivers and keep schedules connected to the care that must be delivered.", color: "bg-violet-50 text-violet-700" },
    { icon: Smartphone, title: "Carer mobile app", path: "/platform/carer-mobile-app", text: "Give caregivers assigned visits, secure client context, eMAR, notes, evidence and visit actions in their pocket.", color: "bg-blue-50 text-blue-700" },
    { icon: WalletCards, title: "Finance", path: "/platform/finance", text: "Move completed and confirmed visit time into invoicing and staff-pay review with a clear evidence trail.", color: "bg-emerald-50 text-emerald-700" },
    { icon: UsersRound, title: "Workforce", path: "/platform/workforce", text: "Manage team profiles, availability, onboarding, skills, time off and operational history in one workspace.", color: "bg-amber-50 text-amber-700" },
    { icon: ClipboardCheck, title: "Quality & governance", path: "/platform/quality-governance", text: "Bring policies, credentials, privacy requests, audit evidence and release controls into everyday operations.", color: "bg-rose-50 text-rose-700" },
];

const journeys = [
    { number: "01", title: "Plan with context", text: "Build the care record, medication support and visit tasks around the person—not around disconnected paperwork." },
    { number: "02", title: "Deliver with confidence", text: "Caregivers check in, follow the assigned plan, capture outcomes and escalate concerns from the mobile app." },
    { number: "03", title: "See what needs attention", text: "Office teams receive live records, alerts and evidence so they can review exceptions while they still matter." },
    { number: "04", title: "Confirm and improve", text: "Approved actual time supports finance, while reporting and governance turn activity into accountable improvement." },
];

const audiences = [
    ["Care managers", "See visits, risks, records and actions across your service without chasing paper or switching systems.", BarChart3],
    ["Care professionals", "Start each visit with the right client context and finish with a clear, complete record.", Smartphone],
    ["Operations & finance", "Connect rosters and verified actuals to review, invoicing and staff-pay workflows.", WalletCards],
];

function SectionLabel({ children }) {
    return <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#008dbd]">{children}</p>;
}

export default function PublicHomePage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const workspaceLink = localStorage.getItem("access_token") ? "/admin/dashboard" : "/login";
    const workspaceLabel = localStorage.getItem("access_token") ? "Dashboard" : "Sign in";
    return <main className="min-h-screen overflow-hidden bg-white font-poppins text-[#071A33]">
        <SeoMeta title="Caremonitor by Aniprotech | Connected care management" description={description} path="/" schema={schema} />

        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#071A33] shadow-lg shadow-slate-950/10">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
                <Link to="/" aria-label="Caremonitor home"><img src="/brand-logo.png" alt="Caremonitor by Aniprotech" className="w-32 rounded-lg sm:w-40 md:w-48" /></Link>
                <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-semibold text-slate-200 lg:flex">
                    <Link to="/products" className="transition hover:text-[#45dcff]">Products</Link>
                    <Link to="/solutions" className="transition hover:text-[#45dcff]">Solutions</Link>
                    <Link to="/case-studies" className="transition hover:text-[#45dcff]">Case studies</Link>
                    <Link to="/resources" className="transition hover:text-[#45dcff]">Resources</Link>
                    <Link to="/about" className="transition hover:text-[#45dcff]">About us</Link>
                </nav>
                <div className="flex items-center gap-3">
                    <Link to="/support" className="hidden px-3 py-2 text-sm font-semibold text-slate-200 transition hover:text-white sm:block">Talk to us</Link>
                    <button type="button" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-white transition hover:border-cyan-300 hover:text-cyan-300 lg:hidden">{mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
                    <Link to={workspaceLink} className="hidden items-center gap-2 rounded-full bg-[#00b8e9] px-5 py-3 text-sm font-bold text-[#071A33] transition hover:bg-[#45dcff] min-[390px]:inline-flex">{workspaceLabel} <ArrowRight size={16} /></Link>
                </div>
            </div>
            {mobileMenuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-white/10 bg-[#071A33] px-5 pb-5 pt-3 text-white lg:hidden">
                <div className="mx-auto flex max-w-7xl flex-col gap-1">
                    {[['Products', '/products'], ['Solutions', '/solutions'], ['Case studies', '/case-studies'], ['Resources', '/resources'], ['About us', '/about']].map(([label, to]) => <Link key={to} to={to} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 font-semibold transition hover:bg-white/10 hover:text-cyan-300">{label}</Link>)}
                    <Link to="/support" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 font-semibold transition hover:bg-white/10 hover:text-cyan-300">Talk to us</Link>
                    <Link to={workspaceLink} onClick={() => setMobileMenuOpen(false)} className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-[#00b8e9] px-5 py-3 font-bold text-[#071A33] min-[390px]:hidden">{workspaceLabel} <ArrowRight size={16} /></Link>
                </div>
            </nav>}
        </header>

        <section className="relative bg-[#eefbff]">
            <div aria-hidden="true" className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
            <div aria-hidden="true" className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
            <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-12 sm:py-16 lg:grid-cols-[0.93fr_1.07fr] lg:px-8 lg:py-24">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#087b9d] shadow-sm sm:px-4 sm:py-2 sm:text-sm"><Sparkles size={15} /> One connected platform for modern care</div>
                    <h1 className="mt-6 max-w-3xl text-3xl font-bold leading-[1.08] tracking-tight text-[#071A33] sm:mt-7 sm:text-5xl lg:text-[4.25rem]">Make every care visit <span className="text-[#00aeeB]">clear, connected</span> and accountable.</h1>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:mt-6 sm:text-lg sm:leading-8">Bring care plans, rostering, mobile visit delivery, medication records, alerts, finance and quality oversight together—so your team spends less time piecing information together and more time acting on it.</p>
                    <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-4">
                        <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00b8e9] px-5 py-3 font-bold text-[#071A33] shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-[#20c9f2] sm:px-6 sm:py-3.5">Open Caremonitor <ArrowRight size={18} /></Link>
                        <a href="#platform" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 font-bold text-[#071A33] transition hover:border-cyan-400 sm:px-6 sm:py-3.5">Explore the platform</a>
                    </div>
                    <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-600">
                        {["Role-based access", "Auditable records", "Human-reviewed assistance"].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-600" />{item}</span>)}
                    </div>
                </div>

                <div className="relative min-h-0 sm:min-h-[540px] lg:min-h-[620px]">
                    <div className="relative rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_30px_80px_rgba(15,57,85,0.18)] sm:absolute sm:inset-x-0 sm:top-6 sm:p-7">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4 sm:pb-5">
                            <div><p className="text-[10px] font-bold uppercase tracking-widest text-[#008dbd] sm:text-xs">Live operations</p><h2 className="mt-1 text-lg font-bold sm:text-xl">Today at a glance</h2></div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Service connected</span>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
                            {[["18", "Visits"], ["14", "Completed"], ["2", "Need review"]].map(([value, label], index) => <div key={label} className={`rounded-2xl p-3 sm:p-4 ${index === 2 ? "bg-amber-50" : "bg-slate-50"}`}><p className="text-xl font-bold sm:text-2xl">{value}</p><p className="mt-1 text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">{label}</p></div>)}
                        </div>
                        <div className="mt-4 space-y-3">
                            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 p-3 sm:gap-4 sm:p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 sm:h-11 sm:w-11"><MapPin size={17} /></span><div className="min-w-0 flex-1"><p className="text-[13px] font-semibold leading-5 sm:text-base">Attendance verified</p><p className="text-[11px] leading-4 text-slate-500 sm:text-sm sm:leading-normal">Location and time recorded</p></div><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 sm:px-3 sm:text-xs">Complete</span></div>
                            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 p-3 sm:gap-4 sm:p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 sm:h-11 sm:w-11"><BellRing size={17} /></span><div className="min-w-0 flex-1"><p className="text-[13px] font-semibold leading-5 sm:text-base">Medication review</p><p className="text-[11px] leading-4 text-slate-500 sm:text-sm sm:leading-normal">Care manager action needed</p></div><span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 sm:px-3 sm:text-xs">Action</span></div>
                        </div>
                        <div className="mt-4 min-h-0 rounded-2xl bg-gradient-to-r from-[#071A33] to-[#0c5780] p-3 text-white sm:mt-5 sm:min-h-20 sm:p-4"><p className="text-[11px] text-cyan-100 sm:text-xs">Connected workflow</p><p className="mt-1 text-sm font-semibold sm:mt-2 sm:text-base">Roster → Visit → Evidence → Finance</p></div>
                    </div>
                    <div className="relative z-10 mx-auto mt-6 w-[168px] overflow-hidden rounded-[2rem] border-[6px] border-[#071A33] bg-white shadow-2xl sm:absolute sm:-bottom-2 sm:right-10 sm:mt-0 sm:w-[205px]"><img src="/caremonitor-mobile-visit.png" alt="Caremonitor mobile verified visit screen" className="h-auto w-full" /></div>
                    <div className="absolute bottom-16 left-0 hidden max-w-[220px] rounded-2xl border border-cyan-100 bg-white p-4 shadow-xl sm:block"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-cyan-50 text-cyan-700"><ShieldCheck size={20} /></span><div><p className="text-sm font-bold">Evidence connected</p><p className="text-xs text-slate-500">Ready for authorised review</p></div></div></div>
                </div>
            </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-7">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-5 text-sm font-semibold text-slate-500">
                <span className="text-[#071A33]">Built around the whole care journey</span>
                {["Care delivery", "Rostering", "Workforce", "Finance", "Quality"].map((item) => <span key={item}>{item}</span>)}
            </div>
        </section>

        <section id="platform" className="scroll-mt-24 bg-white py-14 sm:py-20 lg:py-28">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
                <div className="max-w-3xl"><SectionLabel>The Caremonitor platform</SectionLabel><h2 className="mt-3 text-2xl font-bold tracking-tight sm:mt-4 sm:text-5xl">Everything your care operation needs to work as one.</h2><p className="mt-4 text-base leading-7 text-slate-600 sm:mt-5 sm:text-lg sm:leading-8">Information entered once can support the people who plan, deliver, review and account for care—without losing the context around the person.</p></div>
                <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {modules.map(({ icon: Icon, title, path, text, color }) => <article key={title} className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl sm:p-7"><span className={`grid h-10 w-10 place-items-center rounded-2xl sm:h-12 sm:w-12 ${color}`}><Icon size={20} className="sm:hidden" /><Icon size={23} className="hidden sm:block" /></span><h3 className="mt-4 text-lg font-bold sm:mt-6 sm:text-xl">{title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-600 sm:mt-3 sm:text-base sm:leading-7">{text}</p><Link to={path} aria-label={`Learn more about ${title}`} className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg py-1 text-sm font-bold text-[#008dbd] transition hover:text-[#006d93] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 sm:mt-5 sm:py-2">Explore {title} <ArrowRight size={15} className="transition group-hover:translate-x-1" /></Link></article>)}
                </div>
            </div>
        </section>

        <section id="workflow" className="scroll-mt-24 bg-[#071A33] py-14 text-white sm:py-20 lg:py-28">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
                <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
                    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300 sm:text-sm">One connected workflow</p><h2 className="mt-3 text-2xl font-bold sm:mt-4 sm:text-5xl">From the care plan to the completed visit.</h2><p className="mt-4 text-base leading-7 text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">Keep operational decisions attached to the records and evidence that explain them.</p></div>
                    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                        {journeys.map(({ number, title, text }) => <article key={number} className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 sm:p-6"><p className="text-xs font-bold text-cyan-300 sm:text-sm">{number}</p><h3 className="mt-3 text-lg font-bold sm:mt-5 sm:text-xl">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-300 sm:mt-3 sm:text-base sm:leading-7">{text}</p></article>)}
                    </div>
                </div>
            </div>
        </section>

        <section id="teams" className="scroll-mt-24 bg-[#f6fbfd] py-14 sm:py-20 lg:py-28">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
                <div className="text-center"><SectionLabel>Useful for every role</SectionLabel><h2 className="mx-auto mt-3 max-w-3xl text-2xl font-bold sm:mt-4 sm:text-5xl">The right view for the work in front of you.</h2></div>
                <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-6 lg:grid-cols-3">
                    {audiences.map(([title, text, Icon]) => <article key={title} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8"><Icon className="text-[#00aeeB]" size={25} /><h3 className="mt-4 text-xl font-bold sm:mt-7 sm:text-2xl">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7">{text}</p><Link to="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#008dbd] sm:mt-7 sm:text-base">Go to Caremonitor <ArrowRight size={17} /></Link></article>)}
                </div>
            </div>
        </section>

        <section className="bg-white py-14 sm:py-20 lg:py-28">
            <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:gap-14 lg:grid-cols-2 lg:px-8">
                <div className="relative mx-auto max-w-[260px] sm:max-w-sm">
                    <div className="absolute -inset-8 rounded-full bg-cyan-100 blur-3xl" />
                    <div className="relative grid grid-cols-2 gap-4">
                        <img src="/caremonitor-mobile-visit.png" alt="Caremonitor visit attendance workflow" className="mt-12 rounded-[2rem] border-4 border-[#071A33] shadow-2xl" />
                        <img src="/caremonitor-mobile-inbox.png" alt="Caremonitor mobile team inbox" className="rounded-[2rem] border-4 border-[#071A33] shadow-2xl" />
                    </div>
                </div>
                <div><SectionLabel>Made for care in motion</SectionLabel><h2 className="mt-3 text-2xl font-bold sm:mt-4 sm:text-5xl">A professional mobile workflow, not a smaller office screen.</h2><p className="mt-4 text-base leading-7 text-slate-600 sm:mt-5 sm:text-lg sm:leading-8">Caregivers see the assigned visit first, verify arrival, complete the plan and record outcomes before checking out. The web application receives the same visit evidence for authorised follow-up.</p><ul className="mt-6 space-y-3 sm:mt-7 sm:space-y-4">{["Assigned client context appears after visit selection", "Check-in and check-out create actual service time", "Care tasks, eMAR, notes, incidents and photos stay with the visit", "Offline retry and clear verification states reduce uncertainty"].map((item) => <li key={item} className="flex gap-3 text-sm text-slate-700 sm:text-base"><span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-emerald-100 text-emerald-700 sm:h-6 sm:w-6"><Check size={13} /></span>{item}</li>)}</ul></div>
            </div>
        </section>

        <section id="trust" className="scroll-mt-24 bg-[#e9f9fd] py-14 sm:py-20 lg:py-24">
            <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
                <div className="rounded-3xl bg-[#00b8e9] p-6 text-[#071A33] sm:p-8 lg:p-10"><ShieldCheck size={30} /><h2 className="mt-4 text-2xl font-bold sm:mt-6 sm:text-3xl">Responsible by design.</h2><p className="mt-3 text-sm leading-6 text-[#083a52] sm:mt-4 sm:text-base sm:leading-7">Caremonitor combines operational visibility with controls for access, privacy, evidence and human accountability.</p></div>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                    {[["Role-based access", "Users see the functions and records permitted for their role and organisation."], ["Auditable actions", "Important operational and governance actions retain an accountable history."], ["Human-reviewed assistance", "Suggestions support qualified review; they do not replace care judgement."], ["Privacy controls", "Retention, export, correction, erasure and legal-hold workflows support governed handling."]].map(([title, text]) => <article key={title} className="rounded-3xl bg-white p-5 ring-1 ring-cyan-100 sm:p-6"><h3 className="text-sm font-bold sm:text-base">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">{text}</p></article>)}
                </div>
            </div>
        </section>

        <section className="bg-white px-5 py-20 lg:py-28">
            <div className="mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-[#071A33] px-6 py-14 text-center text-white shadow-2xl md:px-12 md:py-20">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">Ready when your team is</p>
                <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-bold sm:text-5xl">Connect the work around every visit.</h2>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">Open your secure workspace or contact Aniprotech to discuss Caremonitor for your organisation.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-4"><Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-[#00b8e9] px-6 py-3.5 font-bold text-[#071A33]">Sign in to Caremonitor <ArrowRight size={18} /></Link><Link to="/support" className="rounded-full border border-white/30 px-6 py-3.5 font-bold">Contact support</Link></div>
            </div>
        </section>

        <footer className="border-t border-slate-200 bg-slate-50">
            <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
                <div><img src="/brand-logo.png" alt="Caremonitor by Aniprotech" className="w-44 rounded-lg" /><p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">Connected care management for authorised organisations, care professionals and operational teams.</p></div>
                <div><h2 className="text-sm font-bold uppercase tracking-wider">Explore</h2><div className="mt-4 flex flex-col gap-3 text-sm text-slate-600"><Link to="/products">Products</Link><Link to="/solutions">Solutions</Link><Link to="/case-studies">Case studies</Link><Link to="/resources">Resources</Link><Link to="/about">About us</Link></div></div>
                <div><h2 className="text-sm font-bold uppercase tracking-wider">Trust & support</h2><div className="mt-4 flex flex-col gap-3 text-sm text-slate-600"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/account-deletion">Account deletion</Link><Link to="/support">Support</Link><Link to="/login">Sign in</Link></div></div>
            </div>
            <div className="border-t border-slate-200"><div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 py-5 text-xs text-slate-500 lg:px-8"><span>© {new Date().getFullYear()} Aniprotech. All rights reserved.</span><span>Caremonitor is not an emergency or clinical advice service.</span></div></div>
        </footer>
    </main>;
}
