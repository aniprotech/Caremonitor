import React, { useState, useEffect } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import CareCircleTable from "./CareCircleTable";
import { fetchData } from "../../../../utils/FetchData";
import { _get } from "../../../../utils/ApiService";
import APIConfig from "../../../../utils/ApiConfig";
import CareCircleHeader from "./CareCircleHeader";
import CreateCareCircle from "./CreateCareCircle";

const CareCircleIndex = () => {
    const { id } = useParams();
    const [careCircleMembers, setCareCircleMembers] = useState([]);
    const [accessLogs, setAccessLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchCareCircleData = () => {
        setLoading(true);

        fetchData(
            () => _get(APIConfig?.CLIENT_CARE_CIRCLE?.GET_ALL_BY_CLIENT_ID(id)),
            (data) => {
                const members = Array.isArray(data) ? data : [];
                setCareCircleMembers(members);

                const allLogs = [];

                members.forEach((member) => {
                    if (member.client_care_circle_member_logs) {
                        Object.keys(member.client_care_circle_member_logs).forEach((date) => {
                            const logsForDate = member.client_care_circle_member_logs[date] || [];

                            logsForDate.forEach((log) => {
                                allLogs.push({
                                    date: date,
                                    action: `${log.at} ${log.member.firstName} ${log.member.lastName} ${getActionText(log.action)} by ${log.by.firstName} ${log.by.lastName}`,
                                });
                            });
                        });
                    }
                });

                allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

                setAccessLogs(allLogs);
                setLoading(false);
            },
            setLoading,
            null,
        );
    };

    useEffect(() => {
        fetchCareCircleData();
    }, [id]);

    const getActionText = (action) => {
        switch (action) {
            case "INVITE_SENT":
                return "invitation was sent";
            case "INVITE_CANCELED":
                return "invitation was canceled";
            case "CREATED":
                return "was created";
            case "UPDATED":
                return "was updated";
            case "DELETED":
                return "was deleted";
            default:
                return action.toLowerCase().replace("_", " ");
        }
    };

    return (
        <Routes>
            <Route
                path="/"
                element={
                    <div
                        className="px-6 py-4"
                        style={{ maxWidth: "100%", overflowX: "hidden" }}
                    >
                        <CareCircleHeader />
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
                            </div>
                        ) : (
                            <div style={{ width: "100%", overflowX: "auto" }}>
                                <CareCircleTable
                                    careCircleMembers={careCircleMembers}
                                    accessLogs={accessLogs}
                                    refreshData={fetchCareCircleData}
                                />
                            </div>
                        )}
                    </div>
                }
            />
            <Route
                path="/create"
                element={<CreateCareCircle />}
            />
            <Route
                path="/edit/:memberId"
                element={<CreateCareCircle />}
            />
        </Routes>
    );
};

export default CareCircleIndex;
