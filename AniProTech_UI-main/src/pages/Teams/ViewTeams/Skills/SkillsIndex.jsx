import React, { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import EditSkills from "./EditSkills";
import useScrollToTop from "../../../../hooks/useScrollToTop";
import { fetchData } from "../../../../utils/FetchData";
import { useNavigationHelpers } from "../../../../hooks/useNavigationHelpers";
import { _get } from "../../../../utils/ApiService";
import DotLoader from "../../../../components/Loader/DotLoader";
import APIConfig from "../../../../utils/ApiConfig";

const SkillsIndex = () => {
    const { navigate, id } = useNavigationHelpers();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState("");

    const refetch = () => {
        fetchData(() => _get(APIConfig.TEAMS.TEAM_SKILLS_GET_BY_ID(id)), setData, setLoading, null);
    };

    useEffect(() => {
        refetch(); // Initial fetch
    }, [id]);

    useScrollToTop();

        if (loading) {
        return (
            <div className="z-50 flex min-h-screen items-center justify-center">
                <DotLoader loading={loading} />
            </div>
        );
    }

    return (
        <div className="space-y-7 md:mx-20 md:my-10 xl:px-40 ">
            <EditSkills
                name="EditSkills"
                data={data}
                setData={setData}
                setMode={setMode}
                mode={mode}
                refetch={refetch} 
            />
        </div>
    );
};

export default SkillsIndex;
