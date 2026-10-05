import React, { useState, useEffect } from "react";
import SwitchComponents from "../../components/SwitchComponent/SwitchComponent";
import ClientFilterControls from "./ClientFilterControls";
import { useNavigate } from "react-router-dom";
import AddClients from "./AddClients";
import { _post } from "../../utils/ApiService";
import APIConfig from "../../utils/ApiConfig";
import { showError } from "../../utils/toaster";

const ClientIndex = () => {
    const [activeComponent, setActiveComponent] = useState("ClientFilterControls");
    const [mode, setMode] = useState("");
    const [data, setData] = useState([]);
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [totalCount, setTotalCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");

    const handleCreate = () => {
        setMode("create");
        navigate("/admin/clients/add-clients");
    };

    const handleClientAPI = async () => {
        setLoading(true);
        const payload = {
            search: searchTerm,
            status: isActive,
            page,
            size: pageSize,
        };
        try {
            const response = await _post(APIConfig.CLIENTS?.GET_ALL, payload);
            const clientData = response?.data?.results?.data?.users;
            setData(clientData);
            setTotalCount(response?.data?.results?.data?.totalCount || 0);
        } catch (e) {
            console.log(e || "Network Error, please try again later.");
            showError(e?.response?.data?.message);
        } finally {
            setInterval(() => {
                setLoading(false);
            }, 1000);
        }
    };

    useEffect(() => {
        handleClientAPI();
    }, [isActive, page, searchTerm]);

    return (
        <div>
            <SwitchComponents active={activeComponent}>
                <div
                    className="md:mx-20 md:my-10 lg:mx-40 m-5"
                    name="ClientFilterControls"
                >
                    <ClientFilterControls
                        isActive={isActive}
                        setIsActive={setIsActive}
                        handleCreate={handleCreate}
                        data={data}
                        setData={setData}
                        mode={mode}
                        setMode={setMode}
                        setActiveComponent={setActiveComponent}
                        loading={loading}
                        setLoading={setLoading}
                        page={page}
                        setPage={setPage}
                        pageSize={pageSize}
                        setPageSize={setPageSize}
                        totalCount={totalCount}
                        setTotalCount={setTotalCount}
                        setSearchTerm={setSearchTerm}
                        searchTerm={searchTerm}
                    />
                </div>
                <AddClients
                    name="AddClients"
                    data={data}
                    setData={setData}
                    mode={mode}
                    setMode={setMode}
                    setActiveComponent={setActiveComponent}
                />
            </SwitchComponents>
        </div>
    );
};

export default ClientIndex;
