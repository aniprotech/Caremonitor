import React, { useEffect, useRef, useState } from "react";
import useScrollToTop from "../../../../hooks/useScrollToTop";
import AvailabilityHeader from "./AvailabilityHeader";
import ShowAvailabilityDetails from "./ShowAvailabilityDetails";
import CustomWeekCalendar from "./BigWeekCalendar";
import { addDays, format, startOfWeek } from "date-fns";
import { useLocation, useParams } from "react-router-dom";
import { _post } from "../../../../utils/ApiService";
import APIConfig from "../../../../utils/ApiConfig";
import { fetchData } from "../../../../utils/FetchData";
import DotLoader from "../../../../components/Loader/DotLoader";

const AvailabilityIndex = () => {
    const { id } = useParams();
    const location = useLocation();

    const [mode, setMode] = useState("");
    const [availabilityData, setAvailabilityData] = useState([]);
    const [bookingData, setBookingData] = useState([]);
    const [showPopup, setShowPopup] = useState(false);
    const [viewMode, setViewMode] = useState("availability");

    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [loadingBooking, setLoadingBooking] = useState(false);

    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    const [startDate, setStartDate] = useState(startOfCurrentWeek);
    const endDate = addDays(startDate, 6);

    const payload = {
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
    };

    useScrollToTop();

    const fetchAvailability = async () => {
        setLoadingAvailability(true);
        await fetchData(
            () => _post(APIConfig.TEAMS.TEAM_AVAILABILITY_GET_ALL(id), payload),
            setAvailabilityData,
            setLoadingAvailability,
            null,
            payload,
            false
        );
    };

    const fetchBookingAbsence = async () => {
        setLoadingBooking(true);
        await fetchData(
            () => _post(APIConfig.TEAMS.TEAM_AVAILABILITY_BOOKING_GET_ALL(id), payload),
            setBookingData,
            setLoadingBooking,
            null,
            payload,
            false
        );
    };

    const prevSearchRef = useRef(location.search);

    useEffect(() => {
        const prevSearch = prevSearchRef.current;
        const currentSearch = location.search;
        if (prevSearch === "?add=new" && currentSearch === "") {
            fetchAvailability();
        }
        prevSearchRef.current = currentSearch;
    }, [location.search]);

    useEffect(() => {
        fetchAvailability();
        fetchBookingAbsence();
    }, [id, payload.startDate, payload.endDate]);

    const loading = loadingAvailability || loadingBooking;
    const hasAvailability = availabilityData?.length > 0;
    const hasBooking = bookingData?.length > 0;

    return (
        <div className="space-y-7">
            {/* Header Section */}
            <AvailabilityHeader
                name="AvailabilityHeader"
                mode={mode}
                setMode={setMode}
                startDate={startDate}
                setStartDate={setStartDate}
                showPopup={showPopup}
                setShowPopup={setShowPopup}
            />

            {/* View Toggle (Left Aligned, Simplified) */}
            {(hasAvailability || hasBooking) && (
            <div className="pt-3">
                <div className="relative bg-gray-200 rounded-lg flex w-[260px] h-8 overflow-hidden">
                    <div
                        className={`absolute top-0 left-0 h-full w-1/2 bg-customDropdownBorder rounded-lg transition-transform duration-300 ${
                            viewMode === "booking" ? "translate-x-full" : ""
                        }`}
                    ></div>
                    <button
                        onClick={() => setViewMode("availability")}
                        className={`relative z-10 w-1/2 text-xs poppins-semibold transition-colors duration-200 ${
                            viewMode === "availability" ? "text-white" : "text-gray-800"
                        }`}
                    >
                        Availability
                    </button>
                    <button
                        onClick={() => setViewMode("booking")}
                        className={`relative z-10 w-1/2 text-xs poppins-semibold transition-colors duration-200 ${
                            viewMode === "booking" ? "text-white" : "text-gray-800"
                        }`}
                    >
                        Booking Absence
                        </button>
                    </div>
                </div>
            )}

            {/* Calendar or Empty State */}
            <div className="min-h-[40vh] overflow-y-auto">
                {loading ? (
                    <div className="z-10 flex min-h-[40vh] items-center justify-center px-5 md:px-20">
                        <DotLoader loading={loading} style={true} />
                    </div>
                ) : !hasAvailability && !hasBooking ? (
                    <div className="px-5 pt-5 md:px-20">
                        <ShowAvailabilityDetails
                            name="ShowAvailabilityDetails"
                            availabilityData={availabilityData}
                            setAvailabilityData={setAvailabilityData}
                            mode={mode}
                            setMode={setMode}
                            startDate={startDate}
                            setStartDate={setStartDate}
                            showPopup={showPopup}
                            setShowPopup={setShowPopup}
                            fetchAvailability={fetchAvailability}
                        />
                    </div>
                ) : (
                    <div className="">
                        <CustomWeekCalendar
                            name="CustomWeekCalendar"
                            availabilityData={viewMode === "availability" ? availabilityData : []}
                            setAvailabilityData={setAvailabilityData}
                            bookingData={viewMode === "booking" ? bookingData : []}
                            setBookingData={setBookingData}
                            mode={mode}
                            setMode={setMode}
                            startDate={startDate}
                            setStartDate={setStartDate}
                            showPopup={showPopup}
                            setShowPopup={setShowPopup}
                            fetchAvailability={fetchAvailability}
                            fetchBookingAbsence={fetchBookingAbsence}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AvailabilityIndex;
