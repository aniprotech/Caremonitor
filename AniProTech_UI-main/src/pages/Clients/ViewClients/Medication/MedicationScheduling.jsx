import { useEffect, useMemo, useState } from "react";
import { _get } from "../../../../utils/ApiService";
import APIConfig from "../../../../utils/ApiConfig";
import { useNavigationHelpers } from "../../../../hooks/useNavigationHelpers";
import useScrollToTop from "../../../../hooks/useScrollToTop";
import SchedulingHeader from "./SchedulingHeader";
import MedicationSchedulingTable from "./MedicationSchedulingTable";
import { isNotEmpty } from "../../../../utils/common";

const MedicationScheduling = () => {
    const { id, navigate } = useNavigationHelpers();
    const [data, setData] = useState(null);
    useScrollToTop();

    const [filters, setFilters] = useState({
        active: true,
        stopped: true,
    });

    const isAnyFilterSelected = filters.active || filters.stopped;

    const filteredData = useMemo(() => {
        // If no filters are selected, show all data
        if (!isAnyFilterSelected) return data;
        return data?.filter((item) => {
            if (item.isStopped && filters.stopped) return true;
            if (!item.isStopped && filters.active) return true;
            return false;
        });
    }, [data, filters]);

    useEffect(() => {
        const fetchSchedulingData = async () => {
            try {
                const res = await _get(APIConfig.CLIENT_MEDICATION_SCHEDULING.GET_ALL_BY_CLIENT_ID_WITHOUT_FILTER(id));
                if (res?.data?.error === false) {
                    setData(res.data?.results?.data?.medicationSchedules || []);
                }
            } catch (err) {
                console.error("Error fetching scheduling data", err);
            }
        };
        fetchSchedulingData();
    }, [id]);

    const renderNoDataMessage = () => {
        if (!data || data.length === 0) {
            return (
                <>
                    <p className="mb-2 text-base">You haven’t scheduled any medication yet</p>
                    <button
                        onClick={() => navigate(`/admin/clients/${id}/medication`)}
                        type="button"
                        className="text-sm text-customTextLightNavy hover:underline"
                    >
                        Please add a medication.
                    </button>
                </>
            );
        }

        if (filters.active && !filters.stopped) {
            return <p className="mb-2 text-base">No active medication schedules found</p>;
        }

        if (filters.stopped && !filters.active) {
            return <p className="mb-2 text-base">No stopped medication schedules found</p>;
        }

        return <p className="mb-2 text-base">No medication schedules match the selected filters</p>;
    };

    return (
        <div className="p-4">
            <SchedulingHeader
                dataLength={filteredData?.length}
                totalLength={data?.length}
                filters={filters}
                setFilters={setFilters}
            />

            {isNotEmpty(filteredData) ? (
                <MedicationSchedulingTable data={filteredData} />
            ) : (
                <div className="flex min-h-[75vh] flex-col items-center justify-center text-center">
                    {renderNoDataMessage()}
                </div>
            )}
        </div>
    );
};

export default MedicationScheduling;
