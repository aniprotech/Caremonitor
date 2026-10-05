import { useState, useMemo } from "react";
import { Info, X } from "lucide-react";
import { isToday } from "date-fns";
import DateField from "../../../../components/DateField/DateField";
import { getTodayDate } from "../../../../utils/common";
import { _put } from "../../../../utils/ApiService";
import APIConfig from "../../../../utils/ApiConfig";
import InnerLoader from "../../../../components/Loader/InnerLoader";
import { showSuccess, showError } from "../../../../utils/toaster";
import { useNavigate } from "react-router-dom";

const StopScheduleDialog = ({ scheduleId, onClose }) => {
    const [mode, setMode] = useState("IMMEDIATELY");
    const [selectedDate, setSelectedDate] = useState(getTodayDate());
    const [selectedTime, setSelectedTime] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const now = new Date();
    const currentHour = now.getHours();

    const timeOptions = useMemo(() => {
        const times = [];
        for (let hour = 0; hour < 24; hour++) {
            const label = `${hour.toString().padStart(2, "0")}:00`;
            if (!isToday(new Date(selectedDate)) || hour >= currentHour) {
                times.push(label);
            }
        }
        return times;
    }, [selectedDate]);

    const handleSubmit = async () => {
        const url = APIConfig.CLIENT_MEDICATION_SCHEDULING.STOP_SCHEDULING(scheduleId);

        const payload =
            mode === "IMMEDIATELY"
                ? { stopType: "IMMEDIATELY" }
                : {
                      stopType: "SCHEDULED",
                      endDate: selectedDate,
                      endTime: selectedTime,
                  };

        setLoading(true);
        try {
            const response = await _put(url, payload);
            if (response?.data?.error === false) {
                showSuccess(response?.data?.message || "Schedule stopped successfully");
                onClose();
                navigate(-1);
            } else {
                showError(response?.data?.message || "Failed to stop schedule");
            }
        } catch (error) {
            console.error("Stop scheduling failed:", error);
            showError("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-md w-full max-w-md mx-4 shadow-lg">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-300" >
                    <h2 className="md:text-base text-sm text-customBlack poppins-semibold">Stop a medication schedule</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500"
                        aria-label="Close dialog"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={(e) => e.preventDefault()} className="p-6 space-y-6">
                    <p className="flex items-center gap-2 text-sm text-customTextGrey">
                        <Info className="text-customBlack" size={32} />
                        Carers that are offline won’t be informed of the changes, please contact them directly.
                    </p>

                    {/* Mode Selection */}
                    <div className="space-y-3">
                        <h3 className="text-sm text-customBlack poppins-semibold">When should the medication be stopped?</h3>
                        <div className="flex flex-col gap-2 text-customBlack1 space-y-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="IMMEDIATELY"
                                    checked={mode === "IMMEDIATELY"}
                                    onChange={() => setMode("IMMEDIATELY")}
                                    className="w-4 h-4 accent-customDropdownBorder"
                                />
                                Immediately
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="SCHEDULED"
                                    checked={mode === "SCHEDULED"}
                                    onChange={() => setMode("SCHEDULED")}
                                    className="w-4 h-4 accent-customDropdownBorder"
                                />
                                Specific date and time
                            </label>
                        </div>
                    </div>

                    {/* Date & Time Picker */}
                    {mode === "SCHEDULED" && (
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End date*</label>
                                <DateField
                                    name="endDate"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    minDate={getTodayDate()}
                                    style="mt"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Time*</label>
                                <select
                                    value={selectedTime}
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                >
                                    <option value="">Select time</option>
                                    {timeOptions.map((time) => (
                                        <option key={time} value={time}>
                                            {time}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 px-6 border-t border-gray-300 pb-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm poppins-semibold text-customTextGrey hover:text-gray-800 bg-white border border-gray-300 rounded hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || (mode === "SCHEDULED" && (!selectedDate || !selectedTime))}
                        className="px-4 py-2 text-sm poppins-semibold text-white bg-customDropdownBorder hover:bg-customDropdownBorder/90 rounded disabled:opacity-60"
                    >
                        {loading ? <InnerLoader loading={loading} text="Saving..." /> : "Stop medication schedule"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StopScheduleDialog;
