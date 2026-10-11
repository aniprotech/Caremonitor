import { Outlet } from "react-router-dom";
import Navbar from "./components/Common/Navbar";

const Layout = () => {
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
