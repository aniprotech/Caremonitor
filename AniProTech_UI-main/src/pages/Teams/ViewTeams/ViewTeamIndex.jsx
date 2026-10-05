import { useEffect, useState } from "react";
import { Outlet, useParams, useLocation } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import { SidebarItem } from "../../../components/Sidebar/SidebarItem";
import { teamsSidebarItems } from "../../../data/teams";
import { useGlobalStore } from "../../../stores/useGlobalStore";
import { fetchData } from "../../../utils/FetchData";
import { _get } from "../../../utils/ApiService";
import APIConfig from "../../../utils/ApiConfig";

const ViewTeamIndex = () => {
    const { id } = useParams();
    const location = useLocation(); // Get current location/path
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 425); // Detect mobile screen size

    const sidebarItemsWithId = teamsSidebarItems?.map((item) => ({
        ...item,
        to: item.to.replace(":id", id),
    }));

    const { teamsPersonalDetailData, setTeamsPersonalDetailData } = useGlobalStore();

    useEffect(() => {
        fetchData(() => _get(APIConfig.USERS.GET_BY_ID(id)), null, null, setTeamsPersonalDetailData);
    }, [id]);

    // Handle window resize to detect mobile screens
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Check if the current route starts with '/notes' (for mobile screens)
    const isNotesRoute = location.pathname.startsWith('/admin/teams') && location.pathname.includes('/carer-feed/notes');

    return (
        <div className="flex">
            {/* Conditionally render the Sidebar based on the route and screen size */}
            {!isMobile || !isNotesRoute ? (
                <Sidebar data={teamsPersonalDetailData}>
                    {sidebarItemsWithId?.map((item, index) => (
                        <SidebarItem key={index} {...item} />
                    ))}
                </Sidebar>
            ) : null}

            <main className="min-w-0 flex-1 w-full">
                <Outlet />
            </main>
        </div>
    );
};

export default ViewTeamIndex;
