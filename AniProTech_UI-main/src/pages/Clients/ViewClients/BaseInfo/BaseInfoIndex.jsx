import React, { useEffect, useState } from "react";
import SwitchComponents from "../../../../components/SwitchComponent/SwitchComponent";
import CreateClientIndex from "../../CreateClients/CreateClientIndex";
import { clientData, testClientData } from "../../../../data/clients";
import BaseInfoSection from "./BaseInfoSection";
import EditBaseInfo from "./EditBaseInfo";
import { useParams } from "react-router-dom";
import { useGlobalStore } from "../../../../stores/useGlobalStore";
import useScrollToTop from "../../../../hooks/useScrollToTop";
import { fetchData } from "../../../../utils/FetchData";
import { _get } from "../../../../utils/ApiService";
import APIConfig from "../../../../utils/ApiConfig";
import DotLoader from "../../../../components/Loader/DotLoader";

const BaseInfoIndex = () => {
    const [activeComponent, setActiveComponent] = useState("BaseInfoDetails");
    const [mode, setMode] = useState("");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const { id } = useParams();

    const { setTeamsPersonalDetailData } = useGlobalStore();

    useScrollToTop();

    useEffect(() => {
        fetchData(() => _get(APIConfig?.CLIENTS?.GET_BY_ID(id)), setData, setLoading, setTeamsPersonalDetailData);
    }, [id]);

    if (loading) {
        return (
            <div className="z-50 flex min-h-screen items-center justify-center">
                <DotLoader loading={loading} />
            </div>
        );
    }

    return (
        <div>
            <SwitchComponents active={activeComponent}>
                <div
                    className="space-y-7 md:m-5 md:mx-20 md:my-10 xl:mx-40"
                    name="BaseInfoDetails"
                >
                    {["details", "contact", "address", "highlights"].map((sectionId) => (
                        <BaseInfoSection
                            key={sectionId}
                            data={data}
                            setData={setData}
                            mode={mode}
                            setMode={setMode}
                            activeComponent={activeComponent}
                            setActiveComponent={setActiveComponent}
                            sectionId={sectionId}
                        />
                    ))}
                </div>
                <div name="EditBaseInfoDetails">
                    <EditBaseInfo
                        data={data}
                        setData={setData}
                        mode={mode}
                        setMode={setMode}
                        activeComponent={activeComponent}
                        setActiveComponent={setActiveComponent}
                    />
                </div>
            </SwitchComponents>
        </div>
    );
};

export default BaseInfoIndex;
