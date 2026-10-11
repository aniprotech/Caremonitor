import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, BookOpen, Building2, CheckCircle2, ClipboardList, HeartHandshake, ShieldCheck, Smartphone, UsersRound, WalletCards } from "lucide-react";
import SeoMeta from "../../components/Common/SeoMeta";

const productCards = [
    ["Care management", "Person-centred records, care plans, eMAR, observations and timelines.", "/platform/care-management"],
    ["Rostering", "Plan visits, assign caregivers and connect schedules to delivery.", "/platform/rostering"],
    ["Carer mobile app", "Check in, complete care tasks, record evidence and check out.", "/platform/carer-mobile-app"],
    ["Finance", "Review actual time before invoicing and staff-pay processing.", "/platform/finance"],
    ["Workforce", "Manage profiles, availability, onboarding, skills and credentials.", "/platform/workforce"],
    ["Quality & governance", "Connect policies, cases, privacy controls and audit evidence.", "/platform/quality-governance"],
];

const pages = {
    products: {
        eyebrow: "One connected platform", title: "Products built around the complete care journey.",
        intro: "Caremonitor connects the office, care professional and operational record so teams can plan, deliver, review and account for care in one place.",
        cards: productCards, note: "Choose a product to see its connected capabilities.",
    },
    solutions: {
        eyebrow: "Solutions by role", title: "Give every team the right view of care delivery.",
        intro: "Each role works from the same governed record while seeing the actions, evidence and decisions relevant to their responsibilities.",
        cards: [
            ["Care providers", "Bring client records, visits, workforce, finance and quality oversight into one operation.", "/products"],
            ["Care managers", "Review exceptions, risks, medication outcomes, incidents and service evidence.", "/platform/care-management"],
            ["Care professionals", "Use the mobile workflow for assigned visits, tasks, notes and attendance.", "/platform/carer-mobile-app"],
            ["Coordinators", "Build schedules around client needs, caregiver availability and continuity.", "/platform/rostering"],
            ["Finance teams", "Reconcile planned and actual time before billing and staff-pay review.", "/platform/finance"],
            ["Quality teams", "Maintain policies, credentials, privacy workflows and auditable decisions.", "/platform/quality-governance"],
        ],
    },
    "case-studies": {
        eyebrow: "Implementation scenarios", title: "See how connected workflows can improve daily care operations.",
        intro: "These illustrative scenarios show how organisations can use Caremonitor. They are workflow examples, not customer endorsements or measured customer claims.",
        cards: [
            ["From paper notes to a live care record", "A growing provider standardises care plans and visit records so managers can review the same evidence captured by the care team.", "/platform/care-management"],
            ["From scheduled hours to verified actuals", "A coordinator follows visits from roster through check-in and check-out, then sends approved time for finance review.", "/platform/finance"],
            ["From scattered checks to governance evidence", "A quality lead links credentials, policies, cases and accountable actions within one governed workspace.", "/platform/quality-governance"],
        ],
        note: "Real customer stories and independently verified outcomes will be published here when approved.",
    },
    resources: {
        eyebrow: "Resources", title: "Practical information for teams using Caremonitor.",
        intro: "Find product guidance, trust information and the routes your organisation needs for support and account management.",
        cards: [
            ["Product overview", "Explore all connected Caremonitor modules and workflows.", "/products"],
            ["Support", "Contact the Caremonitor support team and find service information.", "/support"],
            ["Privacy", "Understand how personal information is handled and governed.", "/privacy"],
            ["Terms", "Read the terms that apply to the public website and service.", "/terms"],
            ["Account deletion", "Find the process for requesting account and personal-data deletion.", "/account-deletion"],
            ["Secure access", "Open the Caremonitor sign-in page for authorised users.", "/login"],
        ],
    },
    about: {
        eyebrow: "About Caremonitor", title: "Technology that keeps care work connected and accountable.",
        intro: "Caremonitor is developed by Aniprotech to help care organisations reduce fragmented administration and maintain a clearer operational record around every visit.",
        cards: [
            ["Our purpose", "Help care teams spend less time piecing information together and more time acting on complete, timely records.", "/products"],
            ["Our approach", "Build connected workflows with role-based access, auditable actions and clear human responsibility.", "/platform/quality-governance"],
            ["Our product", "Bring care management, rostering, mobile delivery, finance, workforce and governance into one platform.", "/solutions"],
            ["Work with us", "Contact Aniprotech to discuss Caremonitor for your organisation.", "/support"],
        ],
        note: "Caremonitor supports operational work; it does not replace professional care judgement or emergency services.",
    },
};

const icons = [Building2, ClipboardList, Smartphone, WalletCards, UsersRound, ShieldCheck, HeartHandshake, BookOpen];

function PublicHeader() {
    const signedIn = localStorage.getItem("access_token");
    return <header className="border-b border-white/10 bg-[#071A33]"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8"><Link to="/" aria-label="Caremonitor home"><img src="/brand-logo.png" alt="Caremonitor by Aniprotech" className="w-32 rounded-lg sm:w-44" /></Link><nav aria-label="Public navigation" className="hidden items-center gap-6 text-sm font-semibold text-slate-200 lg:flex"><Link to="/products">Products</Link><Link to="/solutions">Solutions</Link><Link to="/case-studies">Case studies</Link><Link to="/resources">Resources</Link><Link to="/about">About us</Link></nav><Link to={signedIn ? "/admin/dashboard" : "/login"} className="inline-flex items-center gap-2 rounded-full bg-[#00b8e9] px-5 py-3 text-sm font-bold text-[#071A33]">{signedIn ? "Dashboard" : "Sign in"} <ArrowRight size={16} /></Link></div></header>;
}

export default function PublicContentPage({ page: configuredPage }) {
    const { page: routePage } = useParams();
    const pageKey = configuredPage || routePage;
    const content = pages[pageKey];
    if (!content) return <Navigate to="/" replace />;
    const pageTitle = pageKey === "about" ? "About us" : pageKey.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
    return <main className="min-h-screen bg-[#f5fbfd] font-poppins text-[#071A33]">
        <SeoMeta title={`${pageTitle} | Caremonitor by Aniprotech`} description={content.intro} path={`/${pageKey}`} />
        <PublicHeader />
        <section className="relative overflow-hidden bg-[#071A33] px-5 py-16 text-white sm:py-24"><div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" /><div className="relative mx-auto max-w-7xl"><p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">{content.eyebrow}</p><h1 className="mt-5 max-w-5xl text-4xl font-bold tracking-tight sm:text-6xl">{content.title}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">{content.intro}</p></div></section>
        <section className="px-5 py-16 sm:py-20"><div className="mx-auto max-w-7xl"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{content.cards.map(([title, text, to], index) => { const Icon = icons[index % icons.length]; return <article key={title} className="flex flex-col rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><Icon size={23} /></span><h2 className="mt-6 text-xl font-bold">{title}</h2><p className="mt-3 flex-1 leading-7 text-slate-600">{text}</p><Link to={to} className="mt-6 inline-flex w-fit items-center gap-2 py-2 font-bold text-[#008dbd]">Learn more <ArrowRight size={16} /></Link></article>; })}</div>{content.note && <div className="mt-10 flex gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm leading-6 text-[#07516b]"><CheckCircle2 className="mt-0.5 flex-none" size={19} />{content.note}</div>}</div></section>
        <section className="px-5 pb-20"><div className="mx-auto max-w-7xl rounded-[2rem] bg-[#00b8e9] px-6 py-12 text-center sm:px-10"><h2 className="text-3xl font-bold">Ready to connect your care operation?</h2><p className="mx-auto mt-4 max-w-2xl leading-7 text-[#083a52]">Open your workspace or contact Aniprotech to discuss the right Caremonitor workflow for your organisation.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/login" className="rounded-full bg-[#071A33] px-6 py-3 font-bold text-white">Open Caremonitor</Link><Link to="/support" className="rounded-full border border-[#071A33]/30 px-6 py-3 font-bold">Contact us</Link></div></div></section>
        <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-slate-600 lg:px-8"><span>© {new Date().getFullYear()} Aniprotech. Caremonitor is not an emergency or clinical advice service.</span><div className="flex flex-wrap gap-5"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/support">Support</Link></div></div></footer>
    </main>;
}
