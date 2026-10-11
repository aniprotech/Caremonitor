import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import SeoMeta from "../../components/Common/SeoMeta";

const products = {
    "care-management": {
        title: "Care management",
        intro: "Keep the complete care record centred on the person and available to the authorised team.",
        points: ["Client profiles, assessments and care plans", "Tasks, observations, incidents and notes", "Medication support and complete timelines", "Shared context across office and mobile workflows"],
    },
    rostering: {
        title: "Rostering",
        intro: "Plan visits, assign the right caregivers and follow delivery from schedule to verified actual time.",
        points: ["Create recurring and one-off visits", "Assign caregivers using availability and service context", "See scheduled, in-progress and completed work", "Connect verified visit time to finance review"],
    },
    "carer-mobile-app": {
        title: "Carer mobile app",
        intro: "Give care professionals the visit information and recording tools they need while working in the community.",
        points: ["Assigned visits and secure client context", "Location-aware check-in and check-out", "Care tasks, eMAR, notes, incidents and photos", "Offline retry with clear synchronisation status"],
    },
    finance: {
        title: "Finance",
        intro: "Turn approved delivery evidence into clear invoicing and staff-pay review workflows.",
        points: ["Review scheduled and actual visit time", "Resolve discrepancies before confirmation", "Maintain client and caregiver rates", "Preserve an auditable path from visit to payment"],
    },
    workforce: {
        title: "Workforce",
        intro: "Manage the people, availability and assurance information behind reliable care delivery.",
        points: ["Team profiles, roles and employment details", "Availability, time off and assigned clients", "Onboarding, skills and credentials", "Operational history and accountable updates"],
    },
    "quality-governance": {
        title: "Quality & governance",
        intro: "Bring quality evidence, privacy controls and human oversight into normal daily operations.",
        points: ["Cases, policies, credentials and audit evidence", "Role-based access and accountable actions", "Privacy, retention and subject-request workflows", "Human-reviewed assistance and release controls"],
    },
};

export default function PublicPlatformPage() {
    const { product } = useParams();
    const detail = products[product];
    const signedIn = localStorage.getItem("access_token");
    if (!detail) return <Navigate to="/" replace />;
    const description = `${detail.title} in Caremonitor by Aniprotech. ${detail.intro}`;

    return <main className="min-h-screen bg-[#f5fbfd] font-poppins text-[#071A33]">
        <SeoMeta title={`${detail.title} | Caremonitor by Aniprotech`} description={description} path={`/platform/${product}`} />
        <header className="border-b border-white/10 bg-[#071A33]">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
                <Link to="/" aria-label="Caremonitor home"><img src="/brand-logo.png" alt="Caremonitor by Aniprotech" className="w-32 rounded-lg sm:w-44" /></Link>
                <Link to={signedIn ? "/admin/dashboard" : "/login"} className="inline-flex items-center gap-2 rounded-full bg-[#00b8e9] px-5 py-3 text-sm font-bold text-[#071A33]">{signedIn ? "Dashboard" : "Sign in"} <ArrowRight size={16} /></Link>
            </div>
        </header>
        <section className="relative overflow-hidden bg-[#071A33] px-5 py-16 text-white sm:py-24">
            <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
            <div className="relative mx-auto max-w-6xl">
                <Link to="/#platform" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-300"><ArrowLeft size={16} /> Back to platform</Link>
                <p className="mt-12 text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">Caremonitor platform</p>
                <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">{detail.title}</h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">{detail.intro}</p>
            </div>
        </section>
        <section className="px-5 py-16 sm:py-20">
            <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 sm:p-10">
                    <h2 className="text-2xl font-bold sm:text-3xl">What your team can do</h2>
                    <ul className="mt-8 grid gap-5 sm:grid-cols-2">{detail.points.map((point) => <li key={point} className="flex gap-3 rounded-2xl bg-slate-50 p-5"><CheckCircle2 className="mt-0.5 flex-none text-emerald-600" size={21} /><span className="leading-7 text-slate-700">{point}</span></li>)}</ul>
                </div>
                <aside className="rounded-3xl bg-[#00b8e9] p-7 text-[#071A33] sm:p-10">
                    <h2 className="text-2xl font-bold">See it in your workflow</h2>
                    <p className="mt-4 leading-7 text-[#083a52]">Open your secure workspace or contact our team to discuss how this module supports your organisation.</p>
                    <div className="mt-8 flex flex-col gap-3"><Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#071A33] px-5 py-3 font-bold text-white">Open Caremonitor <ArrowRight size={17} /></Link><Link to="/support" className="inline-flex items-center justify-center rounded-full border border-[#071A33]/30 px-5 py-3 font-bold">Contact support</Link></div>
                </aside>
            </div>
        </section>
    </main>;
}
