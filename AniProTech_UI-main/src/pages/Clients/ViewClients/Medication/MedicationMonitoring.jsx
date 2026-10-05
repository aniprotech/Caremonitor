import {useSearchParams} from "react-router-dom";
import MedicationMonitoringHeader from "./MedicationMonitoringHeader"
import { useNavigationHelpers } from "../../../../hooks/useNavigationHelpers";
import useScrollToTop from "../../../../hooks/useScrollToTop";
import { _get } from "../../../../utils/ApiService";
import APIConfig from "../../../../utils/ApiConfig";
import { useEffect, useState } from "react";
import { generateMonthOptions } from "../../../../utils/dateAndTimeUtil";
import DotLoader from "../../../../components/Loader/DotLoader";

const MedicationMonitoring = () => {

    const { id } = useNavigationHelpers();
    const [params]=useSearchParams();
    const requestedMonth=params.get('month');
    const validMonth=/^(January|February|March|April|May|June|July|August|September|October|November|December)_\d{4}$/.test(requestedMonth||'');
    const [selectedMonth, setSelectedMonth] = useState(validMonth?requestedMonth:generateMonthOptions().slice(-4, -3)[0]?.value);
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(null);
    useScrollToTop();


    const fetchSchedulingData = async () => {
        setIsLoading(true);
        try {
            const res = await _get(APIConfig.CLIENT_MEDICATION_SCHEDULING.GET_ALL_BY_CLIENT_ID(id, selectedMonth));
            if (res?.data?.error === false) {
                setData(res.data?.results?.data || []);
            }
        } catch (err) {
            console.error("Error fetching scheduling data", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedulingData();
    }, [id, selectedMonth]);
    
  return (
    <div>
        {isLoading && <DotLoader loading={isLoading} style="bg-slate-100/20" />}
        <MedicationMonitoringHeader data={data} setData={setData} fetchSchedulingData={fetchSchedulingData} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
    </div>
  )
}

export default MedicationMonitoring