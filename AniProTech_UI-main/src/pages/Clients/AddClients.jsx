import { Outlet, useLocation } from "react-router-dom";
import { SidebarItem } from "../../components/Sidebar/SidebarItem";
import Sidebar from "../../components/Sidebar/Sidebar";
import { clientSidebarItems } from "../../constants";
import { useGlobalStore } from "../../stores/useGlobalStore";
import { useEffect, useState } from "react";
import { _get } from "../../utils/ApiService";
import APIConfig from "../../utils/ApiConfig";
import { useNavigationHelpers } from "../../hooks/useNavigationHelpers";

export default function AddClients() {
    const { id, navigate } = useNavigationHelpers();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const { pathname } = useLocation();

    const { clientsPersonalDetailData, setClientsPersonalDetailData } = useGlobalStore();
    const [clientSettings, setClientSettings] = useState(null);

    // Fetch client personal details
    useEffect(() => {
        const fetchClientData = async () => {
            try {
                const res = await _get(APIConfig.CLIENTS.GET_BY_ID(id));
                if (res?.data?.error === false) {
                    setClientsPersonalDetailData(res.data.results?.data);
                }
            } catch (err) {
                console.error("Failed to fetch client details", err);
            }
        };
        fetchClientData();
    }, [pathname]);

    // Fetch client settings (for visitPlanning)
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await _get(APIConfig.CLIENT_SETTINGS.GET_BY_ID(id));
                if (res?.data?.error === false) {
                    setClientSettings(res.data.results?.data || {});
                }
            } catch (err) {
                console.error("Failed to fetch client settings", err);
            }
        };
        fetchSettings();
    }, [pathname]);

    // Handle window resize for mobile detection
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const isNotesRoute = pathname.startsWith("/admin/clients") && pathname.includes("/client-feed/notes");
    const carePlanBasePath = `/admin/clients/${id}/care-plan`;
    const isCarePlanSubRoute = pathname.startsWith(`${carePlanBasePath}/`);
    const isScheduleEditRoute = pathname.startsWith("/admin/clients") && pathname.includes("/visits/schedule-edit");
    const shouldShowSidebar = (!isMobile || !isNotesRoute) && !isCarePlanSubRoute && !isScheduleEditRoute;

    const sidebarItemsWithId = clientSidebarItems
        ?.filter((item) => {
            if (item.text === "Visits" && clientSettings?.visitPlanning === false) return false;
            return true;
        })
        ?.map((item) => ({
            ...item,
            to: item.to.replace(":id", id),
        }));

    return (
        <div className="flex flex-col md:flex-row">
            {shouldShowSidebar && !isMobile && (
                <Sidebar data={clientsPersonalDetailData}>
                    {sidebarItemsWithId?.map((item, index) => (
                        <SidebarItem key={index} {...item} />
                    ))}
                </Sidebar>
            )}

            {shouldShowSidebar && isMobile && <nav aria-label="Client section" className="border-b bg-white p-3">
                <label className="text-sm font-medium">Client section
                    <select className="mt-2 w-full rounded border p-3" value={sidebarItemsWithId?.find(item=>pathname.startsWith(item.to))?.to||''} onChange={e=>navigate(e.target.value)}>
                        {sidebarItemsWithId?.map(item=><option key={item.to} value={item.to}>{item.text}</option>)}
                    </select>
                </label>
            </nav>}
            <main className="min-w-0 flex-1">
                <Outlet />
            </main>
        </div>
    );
}
