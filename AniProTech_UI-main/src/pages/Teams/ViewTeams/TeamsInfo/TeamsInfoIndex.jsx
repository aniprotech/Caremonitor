import React, { useEffect, useState } from "react";
import SwitchComponents from "../../../../components/SwitchComponent/SwitchComponent";
import TeamsProfileSection from "./TeamsProfileIndex";
import { testClientData } from "../../../../data/clients";
import clsx from "clsx";
import { teamsInfoConfigs } from "../../../../data/teams";
import KeyContactIndex from "./KeyContactIndex";
import AgencyAdminIndex from "./AgencyAdminIndex";
import useScrollToTop from "../../../../hooks/useScrollToTop";
import { _get } from "../../../../utils/ApiService";
import APIConfig from "../../../../utils/ApiConfig";
import { useParams } from "react-router-dom";
import { useGlobalStore } from "../../../../stores/useGlobalStore";
import DotLoader from "../../../../components/Loader/DotLoader";
import { fetchData } from "../../../../utils/FetchData";

const TABS = [
    { label: "Personal Details", value: "TeamsPersonalDetails" },
    { label: "Key Contacts", value: "TeamsKeyContacts" },
    { label: "Agency admin", value: "TeamsAgencyAdmin" },
];

const TeamsInfoIndex = () => {
    const [activeComponent, setActiveComponent] = useState("TeamsPersonalDetails");
    const [mode, setMode] = useState("");
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(false);

    const { id } = useParams();

    const { setTeamsPersonalDetailData } = useGlobalStore();

    useScrollToTop();

    useEffect(() => {
        fetchData(() => _get(APIConfig.USERS.GET_BY_ID(id)), setData, setLoading ,setTeamsPersonalDetailData);
    }, [id]);


    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center z-50">
                <DotLoader loading={loading} />
            </div>
        );
    }

    return (
        <div className="pb-10">
            <div className="md:mx-20 xl:mx-40">
                <div className="sticky top-14 z-30 border-b bg-white px-3 pt-7">
                    <div className="relative border-b border-gray-300">
                        <div className="flex w-52 space-x-6 overflow-x-auto overflow-y-hidden md:w-full md:space-x-12">
                            {TABS?.map((tab) => (
                                <button
                                    key={tab.value}
                                    onClick={() => setActiveComponent(tab.value)}
                                    className={clsx(
                                        "relative whitespace-nowrap pb-2 text-xs font-semibold text-customTextNavy md:text-sm",
                                        activeComponent === tab.value
                                            ? "after:absolute after:inset-x-0 after:-bottom-[1px]  after:h-[4px] after:bg-customTextNavy"
                                            : "hover:text-customTextNavy/80 hover:text-customTextNavy",
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Switch Component */}
                <SwitchComponents active={activeComponent}>
                    <div name="TeamsPersonalDetails">
                        {teamsInfoConfigs?.map((section) => (
                            <TeamsProfileSection
                                key={section?.id}
                                sectionId={section?.id}
                                componentTitle={section?.componentTitle}
                                fields={section?.fields}
                                data={data}
                                setData={setData}
                                mode={mode}
                                setMode={setMode}
                                activeComponent={activeComponent}
                                setActiveComponent={setActiveComponent}
                                pageName="TeamsPersonalDetails"
                            />
                        ))}
                    </div>
                    <div name="TeamsKeyContacts">
                        <KeyContactIndex
                            data={data}
                            setData={setData}
                            mode={mode}
                            setMode={setMode}
                            setActiveComponent={setActiveComponent}
                        />
                    </div>
                    <div name="TeamsAgencyAdmin">
                        <AgencyAdminIndex
                            data={data}
                            setData={setData}
                            mode={mode}
                            setMode={setMode}
                            setActiveComponent={setActiveComponent}
                        />
                    </div>
                </SwitchComponents>
            </div>
        </div>
    );
};

export default TeamsInfoIndex;
