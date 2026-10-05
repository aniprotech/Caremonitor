import { useState, useEffect, useRef } from "react";
import ClientCareRecipientTable from "./ClientCareRecipientTable";
import useScrollToTop from "../../../../hooks/useScrollToTop";
import { useParams } from "react-router-dom";
import { _post } from "../../../../utils/ApiService";
import APIConfig from "../../../../utils/ApiConfig";
import { showError } from "../../../../utils/toaster";
import DotLoader from "../../../../components/Loader/DotLoader";

const ClientsIndex = () => {
    const [mode, setMode] = useState("");
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("All");
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [searchTerm, setSearchTerm] = useState("");
    const searchTimerRef = useRef(null);

    const { id: clientId } = useParams();

    useScrollToTop();

    const fetchCareTeamData = async (searchValue = searchTerm) => {
        setLoading(true);
        const payload = {
            filter: activeTab,
            page,
            size: pageSize,
            search: searchValue,
        };

        try {
            const response = await _post(APIConfig.TEAMS.TEAM_CLIENTS_GET_BY_CLIENT(clientId), payload);
            const careTeamData = response?.data?.results?.data?.data?.teamClients || [];
            setData(careTeamData);
            setTotalCount(response?.data?.results?.data?.data?.totalCount || 0);
        } catch (e) {
            console.log(e || "Network Error, please try again later.");
            showError(e?.response?.data?.message);
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    };

    const handleSearch = (value) => {
        setSearchTerm(value);

        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        searchTimerRef.current = setTimeout(() => {
            fetchCareTeamData(value);
        }, 500);
    };

    useEffect(() => {
        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (clientId) {
            fetchCareTeamData();
        }
    }, [clientId, activeTab, page, pageSize]);

    if (initialLoading && !data.length) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <DotLoader loading={initialLoading} />
            </div>
        );
    }

    return (
        <div className="space-y-7">
            <h2 className="poppins-medium mb-4 px-5 pt-10 text-base text-customTextGrey md:px-20 md:text-xl">Care recipients</h2>
            <hr />
            <div className="px-5 pt-3 md:px-20">
                <ClientCareRecipientTable
                    name="ClientCareRecipientTable"
                    data={data}
                    setData={setData}
                    mode={mode}
                    setMode={setMode}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    totalCount={totalCount}
                    page={page}
                    setPage={setPage}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    loading={loading}
                    clientId={clientId}
                    refetchData={fetchCareTeamData}
                    searchTerm={searchTerm}
                    setSearchTerm={handleSearch}
                />
            </div>
        </div>
    );
};

export default ClientsIndex;
