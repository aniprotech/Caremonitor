import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Common/Navbar";

const sectionTitles = {
    dashboard: "Dashboard",
    clients: "Clients",
    teams: "Team",
    roster: "Roster",
    rosters: "Roster",
    inbox: "Inbox",
    log: "Care log",
    logs: "Care log",
    finances: "Finance",
    accounting: "Accounting",
    reports: "Reporting",
    governance: "Governance",
    platform: "Platform admin",
    settings: "Settings",
    account: "Account settings",
};

function pageTitle(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    const adminSection = parts[0] === "admin" ? parts[1] : parts[0];
    const title = sectionTitles[adminSection] || "Caremonitor";
    if (adminSection === "clients" && parts.includes("visits")) return "Visits | Caremonitor";
    if (adminSection === "clients" && parts.includes("care-plan")) return "Care plan | Caremonitor";
    if (adminSection === "clients" && parts.includes("medication")) return "Medication | Caremonitor";
    if (adminSection === "teams" && parts.includes("onboarding")) return "Carer onboarding | Caremonitor";
    return `${title} | Caremonitor`;
}

const Layout = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        document.title = pageTitle(pathname);
    }, [pathname]);

    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">
                <Outlet />
            </main>
            <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500 md:px-8">
                Caremonitor 1.0.9 (Build 14) · Managed by Aniprotech
            </footer>
        </div>
    );
};

export default Layout;
