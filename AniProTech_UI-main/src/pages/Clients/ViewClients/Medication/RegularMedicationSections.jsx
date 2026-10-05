import { Field } from "formik";
import StatusToggleButtonGroup from "../../../../components/TextInput/StatusToggleButtonGroup";
import TextAreaField from "../../../../components/TextInput/TextAreaField";
import { useEffect, useState } from "react";
import InnerLoader from "../../../../components/Loader/InnerLoader";
import { formatSlotLabel, outcomeOptions, reasonOptionsMap, timeSlotsMap } from "../../../../utils/common";
import DropdownField from "../../../../components/DropdownInput/Dropdown";
import PropTypes from "prop-types";
import MedicationBodyMapEditor from "./MedicationBodyMapEditor";

const RegularMedicationSections = ({
    values,
    setFieldValue,
    unlockedSections,
    openSection,
    setOpenSection,
    moveToNextSection,
    isSubmitting,
    displayValue,
    isEditMode,
}) => {
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [pastDoses, setPastDoses] = useState(values?.pastAdministrations || []);
    const [showPastDosesForm, setShowPastDosesForm] = useState(false);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate());
    const minDate = tomorrow.toISOString().split("T")[0];

    // useEffect(() => {

    //     const now = new Date();
    //     const selectedDate = new Date(values.firstDoseDate);
    //     const isToday = selectedDate.toDateString() === now.toDateString();

    //     const timeKeys = values.timingPreference === "EXACT_TIME"
    //       ? [values.firstDoseTime]
    //       : (values.selectedTimeSlots.length > 0
    //         ? values.selectedTimeSlots
    //         : ["Morning", "Lunch", "Afternoon", "Evening"]);

    //     const past = timeKeys.filter((slot) => {
    //       const hour = timeSlotsMap[slot];
    //       if (!hour) return false;
    //       if (selectedDate < now) return true;
    //       return isToday && now.getHours() >= hour;
    //     });

    //     const pastDosesData = past.map((slot) => ({
    //       slot,
    //       date: values.firstDoseDate,
    //       outcome: "",
    //       reason: "",
    //       note: "",
    //     }));

    //     setPastDoses(pastDosesData);
    //   }, [values.firstDoseDate, values.firstDoseTime]);

    useEffect(() => {
        if (!values.firstDoseDate || !values.timingPreference) {
            setPastDoses([]);
            setFieldValue("pastAdministrations", []);
            return;
        }

        const now = new Date();
        const selectedDate = new Date(values.firstDoseDate);
        const isToday = selectedDate.toDateString() === now.toDateString();

        let timeSlots = [];

        if (values.timingPreference === "EXACT_TIME") {
            // For exact time, get all configured exact times
            timeSlots = Object.values(values.exactTimes).filter(Boolean);
        } else if (values.timingPreference === "TIME_PERIOD") {
            // For time period, use selected time slots
            timeSlots = values.selectedTimeSlots?.length ? values.selectedTimeSlots : [];
        }

        // const past = timeSlots.filter((slot) => {
        //     if (values.timingPreference === "EXACT_TIME") {
        //         // For exact time, parse the time string (HH:MM format)
        //         const [hours, minutes] = slot.split(':').map(Number);
        //         const slotTime = new Date(selectedDate);
        //         slotTime.setHours(hours, minutes, 0, 0);

        //         return selectedDate < now || (isToday && now >= slotTime);
        //     } else {
        //         // For time period, use the timeSlotsMap
        //         const slotHour = timeSlotsMap[slot];
        //         if (!slotHour) return false;
        //         return selectedDate < now || (isToday && now.getHours() >= slotHour);
        //     }
        // });

        const past = timeSlots.filter((slot) => {
            if (values.timingPreference === "EXACT_TIME") {
                // For exact time, parse the time string (HH:MM:SS)
                const [hours, minutes, seconds] = slot.split(":").map(Number);
                const slotTime = new Date(selectedDate);
                slotTime.setHours(hours, minutes, seconds || 0, 0);
                return isToday ? now >= slotTime : selectedDate < now;
            } else {
                // For time periods
                const slotHour = timeSlotsMap[slot];
                if (slotHour == null) return false;

                const slotTime = new Date(selectedDate);
                slotTime.setHours(slotHour, 0, 0, 0);

                return isToday ? now >= slotTime : selectedDate < now;
            }
        });

        const doses = past.map((slot) => {
            const existing = values?.pastAdministrations?.find(
                (d) => d.slot === slot && d.date === values.firstDoseDate
            );
            return {
                date: values.firstDoseDate,
                slot,
                outcome: existing?.outcome || "",
                reason: existing?.reason || "",
                note: existing?.note || "",
            };
        });

        setPastDoses(doses);
        setFieldValue("pastAdministrations", doses);
    }, [values.firstDoseDate, values.firstDoseTime, values.timingPreference, values.selectedTimeSlots, values.exactTimes]);

    const isPastDoseValid = pastDoses.every(
        (dose) =>
            dose.outcome &&
            (!reasonOptionsMap[dose.outcome] || dose.outcome === "NOT_OBSERVED" || (reasonOptionsMap[dose.outcome] && dose.reason)) &&
            dose.note.trim(),
    );

    return (
        <>
            {/* Frequency Section */}
            {values.route && unlockedSections.has("frequency") && (
                <div className="mb-4 rounded border border-gray-200">
                    <button
                        type="button"
                        className="flex w-full items-center justify-between px-6 py-4 text-left focus:outline-none"
                        onClick={() => setOpenSection(openSection === "frequency" ? null : "frequency")}
                    >
                        <div className="flex-1">
                            {openSection === "frequency" ? (
                                <span className="poppins-medium text-sm text-customBlack">
                                    How often is this medication taken? <span className="text-red-500">*</span>
                                </span>
                            ) : (
                                <>
                                    <span className="poppins-medium text-sm text-customBlack">
                                        Frequency <span className="text-red-500">*</span>
                                    </span>
                                    {(values.frequencyType || values.dailyTimes) && (
                                        <div className="mt-1 text-sm text-customGrey1">
                                            {values.frequencyType === "DAILY" && values.dailyTimes
                                                ? `Daily - ${values.dailyTimes} times a day`
                                                : values.frequencyType === "CUSTOM"
                                                  ? `Custom - Every ${values.customRepeat} ${values.customUnit}`
                                                  : ""}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <svg
                            className={`ml-2 h-5 w-5 transition-transform ${openSection === "frequency" ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </button>
                    {((!values.frequencyType && !values.dailyTimes) || openSection === "frequency") && (
                        <div className="border-t border-gray-200 px-6 py-4">
                            <div className="mb-4">
                                <div className="mb-2 text-sm text-customBlack">1. Select frequency...</div>
                                <StatusToggleButtonGroup
                                    label=""
                                    name="frequencyType"
                                    value={values.frequencyType}
                                    options={[
                                        { value: "DAILY", label: "Daily" },
                                        { value: "CUSTOM", label: "Custom" },
                                    ]}
                                    onChange={(e) => setFieldValue("frequencyType", e.target.value)}
                                    style="textSize"
                                />
                            </div>

                            {values.frequencyType === "DAILY" && (
                                <div className="mb-4">
                                    <div className="mb-2 text-sm text-customBlack">2. How many times a day...</div>
                                    <div className="flex flex-wrap gap-2">
                                        {[1, 2, 3, 4].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                className={`h-10 w-10 rounded border text-sm ${values.dailyTimes === num ? "bg-customDropdownBorder text-white" : "border-gray-300 bg-white text-customBlack"}`}
                                                onClick={() => {
                                                                                                setFieldValue("dailyTimes", num);
                                            if (!isEditMode) {
                                                moveToNextSection("frequency", "schedulemedication");
                                            }
                                                }}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {values.frequencyType === "CUSTOM" && (
                                <div className="mb-4">
                                    <div className="mb-2 text-sm text-customBlack">2. Repeat every...</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            value={values.customRepeat}
                                            onChange={(e) => setFieldValue("customRepeat", parseInt(e.target.value))}
                                            className="w-16 rounded border px-2 py-1 text-sm"
                                        />
                                        <select
                                            value={values.customUnit}
                                            onChange={(e) => setFieldValue("customUnit", e.target.value)}
                                            className="rounded border px-2 py-1 text-sm"
                                        >
                                            <option value="days">days</option>
                                            <option value="weeks">weeks</option>
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!values.customRepeat || values.customRepeat < 1}
                                        className="mt-4 rounded bg-customDropdownBorder px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                                        onClick={() => {
                                            if (values.customRepeat && values.customRepeat >= 1 && !isEditMode) {
                                                moveToNextSection("frequency", "schedulemedication");
                                            }
                                        }}
                                    >
                                        Create schedule
                                    </button>
                                </div>
                            )}

                            {!values.frequencyType && (
                                <div className="mb-4">
                                    <div className="text-sm text-customGrey1">Please select a frequency option to continue.</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Schedule Medication Section */}
            {(values.dailyTimes || values.frequencyType === "CUSTOM") && unlockedSections.has("schedulemedication") && (
                <div className="mb-4 rounded border border-gray-200">
                    <button
                        type="button"
                        className="flex w-full items-center justify-between px-6 py-4 text-left focus:outline-none"
                        onClick={() => setOpenSection(openSection === "schedulemedication" ? null : "schedulemedication")}
                    >
                        <div className="flex-1">
                            <span className="poppins-medium text-sm text-customBlack">
                                {openSection === "schedulemedication" ? "Schedule Medication" : "When"}
                                <span className="text-red-500">*</span>
                            </span>
                            {((values.timingPreference === "TIME_PERIOD" && values.selectedTimeSlots.length > 0) ||
                                (values.timingPreference === "EXACT_TIME" && Object.keys(values.exactTimes).length > 0)) &&
                                openSection !== "schedulemedication" && (
                                    <div className="mt-1 text-sm text-customGrey1">
                                        {values.timingPreference === "TIME_PERIOD" && values.selectedTimeSlots.length > 0
                                            ? `Time period - ${values.selectedTimeSlots.join(", ")}`
                                            : values.timingPreference === "EXACT_TIME" && Object.keys(values.exactTimes).length > 0
                                              ? `Exact time - ${Object.values(values.exactTimes)
                                                    .filter((time) => time)
                                                    .map((time) => time.slice(0, 5)) // trim to "HH:mm"
                                                    .join(", ")}`
                                              : ""}
                                    </div>
                                )}
                        </div>
                        <svg
                            className={`ml-2 h-5 w-5 transition-transform ${openSection === "schedulemedication" ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </button>
                    {(!values.timingPreference || openSection === "schedulemedication") && (
                        <div className="border-t border-gray-200 px-6 py-4">
                            <div className="mb-4">
                                <div className="mb-3 text-sm text-customBlack">1. Select preferred timing</div>
                                <StatusToggleButtonGroup
                                    label=""
                                    name="timingPreference"
                                    value={values.timingPreference}
                                    options={[
                                        { value: "TIME_PERIOD", label: "Time period" },
                                        { value: "EXACT_TIME", label: "Exact time" },
                                    ]}
                                    onChange={(e) => {
                                        setFieldValue("timingPreference", e.target.value);
                                        setFieldValue("selectedTimeSlots", []);
                                        setFieldValue("exactTimes", {});
                                    }}
                                    style="textSize"
                                />
                            </div>

                            {values.timingPreference === "TIME_PERIOD" && (
                                <div className="mb-4">
                                    <div className="mb-2 text-sm text-customBlack">2. Select when</div>
                                    <div className="flex flex-wrap gap-2">
                                        {["Morning", "Lunch", "Afternoon", "Evening"].map((timeSlot) => {
                                            const isSelected = values.selectedTimeSlots.includes(timeSlot);
                                            const maxSlots = values.frequencyType === "DAILY" ? values.dailyTimes : 1;
                                            const canSelect = isSelected || values.selectedTimeSlots.length < maxSlots;

                                            return (
                                                <button
                                                    key={timeSlot}
                                                    type="button"
                                                    disabled={!canSelect}
                                                    className={`rounded border px-4 py-2 text-sm ${
                                                        isSelected
                                                            ? "bg-customDropdownBorder text-white"
                                                            : canSelect
                                                              ? "border-gray-300 bg-white text-customBlack hover:bg-gray-50"
                                                              : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                                                    }`}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setFieldValue(
                                                                "selectedTimeSlots",
                                                                values.selectedTimeSlots.filter((slot) => slot !== timeSlot),
                                                            );
                                                        } else if (canSelect) {
                                                            const newTimeSlots = [...values.selectedTimeSlots, timeSlot];
                                                            setFieldValue("selectedTimeSlots", newTimeSlots);

                                                            // Auto-expand to next section if we've selected the required number of slots
                                                            const requiredSlots = values.frequencyType === "DAILY" ? values.dailyTimes : 1;
                                                            if (newTimeSlots.length === requiredSlots) {
                                                                setTimeout(() => {}, 100);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    {timeSlot}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-2 text-xs text-customGrey1">
                                        Select the time slots that apply - e.g., if four times a day, select four of them.
                                        {values.frequencyType === "DAILY" && values.dailyTimes && (
                                            <span className="mt-1 block">
                                                You need to select {values.dailyTimes} time slot{values.dailyTimes > 1 ? "s" : ""}. Currently
                                                selected: {values.selectedTimeSlots.length}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {values.timingPreference === "EXACT_TIME" && (
                                <div className="mb-4">
                                    <div className="mb-2 text-sm text-customBlack">2. Select when</div>
                                    <div className="space-y-3">
                                        {Array.from({ length: values.frequencyType === "DAILY" ? values.dailyTimes || 1 : 1 }, (_, index) => (
                                            <div key={index}>
                                                <div className="mb-2 text-sm text-customBlack">Time of Dose {index + 1}</div>
                                                <div className="flex w-32 items-center gap-2 rounded border px-3 py-2">
                                                    <input
                                                        type="time"
                                                        step="60" // optional, allows minute precision (removes seconds picker)
                                                        lang="en-GB" // forces 24-hour format in most browsers
                                                        className="border-none bg-transparent text-sm outline-none"
                                                        value={
                                                            values.exactTimes[`dose${index + 1}`]
                                                                ? values.exactTimes[`dose${index + 1}`].slice(0, 5) // display only HH:mm
                                                                : ""
                                                        }
                                                        onChange={(e) => {
                                                            const timeValue = e.target.value; // "HH:mm"
                                                            const formattedTime = `${timeValue}:00`; // store as "HH:mm:00"
                                                            const newExactTimes = {
                                                                ...values.exactTimes,
                                                                [`dose${index + 1}`]: formattedTime,
                                                            };
                                                            setFieldValue("exactTimes", newExactTimes);
                                                        }}
                                                    />

                                                    <svg
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <circle
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                        />
                                                        <polyline points="12,6 12,12 16,14" />
                                                    </svg>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={
                                        !values.timingPreference ||
                                        (values.timingPreference === "TIME_PERIOD" &&
                                            (values.selectedTimeSlots.length === 0 ||
                                                (values.frequencyType === "DAILY" && values.dailyTimes !== values.selectedTimeSlots.length))) ||
                                        (values.timingPreference === "EXACT_TIME" &&
                                            (values.frequencyType === "DAILY"
                                                ? Object.keys(values.exactTimes).filter((key) => values.exactTimes[key]).length !== values.dailyTimes
                                                : Object.keys(values.exactTimes).filter((key) => values.exactTimes[key]).length === 0))
                                    }
                                    className="rounded bg-customDropdownBorder px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                                    onClick={() => {
                                        if (
                                            ((values.timingPreference === "TIME_PERIOD" && values.selectedTimeSlots.length > 0) ||
                                            (values.timingPreference === "EXACT_TIME" &&
                                                Object.keys(values.exactTimes).filter((key) => values.exactTimes[key]).length > 0))                                        ) {
                                            moveToNextSection("schedulemedication", "doseschedule");
                                        }
                                    }}
                                >
                                    Add schedule
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* When should the dose be administered Section */}
            {((values.timingPreference === "TIME_PERIOD" && values.selectedTimeSlots.length > 0) ||
                (values.timingPreference === "EXACT_TIME" && Object.keys(values.exactTimes).length > 0)) &&
                unlockedSections.has("doseschedule") && !isEditMode && (
                    <div className="mb-4 rounded border border-gray-200">
                        <button
                            type="button"
                            className="flex w-full items-center justify-between px-6 py-4 text-left focus:outline-none"
                            onClick={() => setOpenSection(openSection === "doseschedule" ? null : "doseschedule")}
                        >
                            <div className="flex-1">
                                <span className="poppins-medium text-sm text-customBlack">
                                    From <span className="text-red-500">*</span>
                                </span>
                                {(values.firstDoseDate || values.firstDoseTime) && openSection !== "doseschedule" && (
                                    <div className="mt-1 text-sm text-customGrey1">
                                        First dose: {values?.firstDoseDate} {values?.firstDoseTime}
                                        {values?.lastDoseDate && (
                                            <>
                                                {" "}
                                                | Last dose: {values?.lastDoseDate} {values?.lastDoseTime}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <svg
                                className={`ml-2 h-5 w-5 transition-transform ${openSection === "doseschedule" ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                        {((!values?.firstDoseDate && !values?.firstDoseTime) || openSection === "doseschedule") && (
                            <div className="border-t border-gray-200 px-6 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* First Dose Section */}
                                    <div>
                                        <div className="mb-2 text-sm text-customBlack">First dose</div>
                                        <div className="mb-2">
                                            <Field
                                                name="firstDoseDate"
                                                type="date"
                                                min={minDate}
                                                className="w-full rounded border px-3 py-2 text-sm"
                                                value={values?.firstDoseDate}
                                            />
                                        </div>

                                        {values.timingPreference === "EXACT_TIME" ? (
                                            <div className="mb-2">
                                                <label className="text-xs text-customGrey1">Select exact time</label>
                                                <select
                                                    name="firstDoseTime"
                                                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                                                    value={values?.firstDoseTime}
                                                    onChange={(e) => setFieldValue("firstDoseTime", e.target.value)}
                                                >
                                                    <option value="">Select time</option>
                                                    {Object.values(values.exactTimes)
                                                        .filter(Boolean)
                                                        .map((time) => {
                                                            const hhmm = time.slice(0, 5); // Extract "HH:mm" from "HH:mm:ss"
                                                            return (
                                                                <option
                                                                    key={time}
                                                                    value={time}
                                                                >
                                                                    {hhmm}
                                                                </option>
                                                            );
                                                        })}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {(values.timingPreference === "TIME_PERIOD" && values.selectedTimeSlots.length > 0
                                                    ? values.selectedTimeSlots
                                                    : ["Morning", "Lunch", "Afternoon", "Evening"]
                                                ).map((timeOption) => (
                                                    <button
                                                        key={timeOption}
                                                        type="button"
                                                        className={`rounded border px-4 py-2 text-sm ${
                                                            values?.firstDoseTime === timeOption
                                                                ? "bg-customDropdownBorder text-white"
                                                                : "border-gray-300 bg-white text-customBlack hover:bg-gray-50"
                                                        }`}
                                                        onClick={() => setFieldValue("firstDoseTime", timeOption)}
                                                    >
                                                        {timeOption}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Last Dose Section */}
                                    <div>
                                        <div className="mb-2 text-sm text-customBlack">Last dose (optional)</div>
                                        <div className="mb-2">
                                            <Field
                                                name="lastDoseDate"
                                                type="date"
                                                className="w-full rounded border px-3 py-2 text-sm"
                                                value={values?.lastDoseDate}
                                                min={minDate}
                                            />
                                        </div>

                                        {values.timingPreference === "EXACT_TIME" ? (
                                            <div className="mb-2">
                                                <label className="text-xs text-customGrey1">Select exact time</label>
                                                <select
                                                    name="lastDoseTime"
                                                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                                                    value={values?.lastDoseTime}
                                                    onChange={(e) => setFieldValue("lastDoseTime", e.target.value)}
                                                >
                                                    <option value="">Select time</option>
                                                    {Object.values(values.exactTimes)
                                                        .filter(Boolean)
                                                        .map((time) => (
                                                            <option
                                                                key={time}
                                                                value={time}
                                                            >
                                                                {time}
                                                            </option>
                                                        ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {(values.timingPreference === "TIME_PERIOD" && values.selectedTimeSlots.length > 0
                                                    ? values.selectedTimeSlots
                                                    : ["Morning", "Lunch", "Afternoon", "Evening"]
                                                ).map((timeOption) => (
                                                    <button
                                                        key={timeOption}
                                                        type="button"
                                                        className={`rounded border px-4 py-2 text-sm ${
                                                            values?.lastDoseTime === timeOption
                                                                ? "bg-customDropdownBorder text-white"
                                                                : "border-gray-300 bg-white text-customBlack hover:bg-gray-50"
                                                        }`}
                                                        onClick={() => setFieldValue("lastDoseTime", timeOption)}
                                                    >
                                                        {timeOption}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 flex items-start text-sm text-customGrey1">
                                    <span className="mr-2">&#9432;</span>
                                    <span>
                                        Start and end dates are inclusive - any doses planned for that time will be included in the MAR chart.
                                    </span>
                                </div>

                                <div className="mt-4 flex gap-2">
                                    <button
                                        type="button"
                                        disabled={!values?.firstDoseDate || !values?.firstDoseTime}
                                        className="rounded bg-customDropdownBorder px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                                        onClick={() => {
                                            if (values.firstDoseDate && values.firstDoseTime) {
                                                if (pastDoses.length > 0) {
                                                    moveToNextSection("doseschedule", "pastadministrations");
                                                } else {
                                                    moveToNextSection("doseschedule", "additionalInstructions");
                                                }
                                            }
                                        }}
                                    >
                                        Continue
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            {pastDoses.length > 0 && !isEditMode && unlockedSections.has("pastadministrations") && (
                <div className="mb-4 rounded border border-gray-200">
                    {/* Header */}
                    <button
                        type="button"
                        className="flex w-full items-center justify-between px-6 py-4 text-left focus:outline-none"
                        onClick={() => {
                            const isOpen = openSection === "pastadministrations";
                            setOpenSection(isOpen ? null : "pastadministrations");

                            // 👉 If section was collapsed and is now being opened, show form again
                            if (!isOpen && pastDoses.every((d) => d.outcome && d.note)) {
                                setShowPastDosesForm(true);
                            }
                        }}
                    >
                        <div className="flex-1">
                            <span className="poppins-medium text-sm text-customBlack">
                                Past administrations <span className="text-red-500">*</span>
                            </span>
                            {pastDoses.length > 0 && openSection !== "pastadministrations" && (
                                <div className="mt-1 text-sm text-customGrey1">
                                    {pastDoses.length} past dose{pastDoses.length > 1 ? "s" : ""}
                                </div>
                            )}
                        </div>
                        <svg
                            className={`ml-2 h-5 w-5 transition-transform ${openSection === "pastadministrations" ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </button>

                    {/* Body */}
                    {openSection === "pastadministrations" && (
                        <div className="border-t border-gray-200 px-6 py-4">
                            {/* Alert */}
                            {!isEditMode && (
                                <div className="my-4 mb-6 space-y-1 rounded border-l-4 border-[#976811] bg-yellow-50 px-4 py-3 text-sm text-[#976811]">
                                    <strong className="font-medium">⚠️ This medication schedule starts in the past 24 hours.</strong>
                                    <div>
                                        Please provide an outcome for each of the administrations that have already taken place. Outcomes can be
                                        updated later in the MAR chart.
                                    </div>
                                </div>
                            )}

                            {/* Continue button */}
                            {!showPastDosesForm && !isEditMode && pastDoses.some((dose) => !dose.outcome || !dose.note) && (
                                <button
                                    type="button"
                                    className="rounded bg-customDropdownBorder px-5 py-2 text-sm font-medium text-white"
                                    onClick={() => setShowPastDosesForm(true)}
                                >
                                    Continue
                                </button>
                            )}

                            {/* Past Doses Form */}
                            {showPastDosesForm  ? (
                                <>
                                    {pastDoses?.map((dose, idx) => {
                                        const outcome = dose.outcome;
                                        const showReason = outcome && Object.prototype.hasOwnProperty.call(reasonOptionsMap, outcome);
                                        const reasonRequired = showReason && outcome !== "NOT_OBSERVED";

                                        return (
                                            <div
                                                key={idx}
                                                className="mb-6 space-y-5 rounded border border-gray-200 bg-gray-50 p-4"
                                            >
                                                <h4 className="mb-3 text-sm font-semibold text-customBlack">
                                                    {new Date(dose.date).toLocaleDateString("en-GB")} – {formatSlotLabel(dose.slot)}
                                                </h4>

                                                <DropdownField
                                                    label="Outcome"
                                                    name={`pastDoses[${idx}].outcome`}
                                                    value={dose.outcome}
                                                    valueChange={(opt) => {
                                                        const selectedValue = typeof opt === "string" ? opt : opt?.value;
                                                        const updated = [...pastDoses];
                                                        updated[idx].outcome = selectedValue;
                                                        updated[idx].reason = reasonOptionsMap[selectedValue] ? "" : undefined;
                                                        setPastDoses(updated);
                                                    }}
                                                    options={outcomeOptions}
                                                    required
                                                    error={!dose.outcome ? "Required" : ""}
                                                />

                                                {showReason && (
                                                    <DropdownField
                                                        label="Reason"
                                                        name={`pastDoses[${idx}].reason`}
                                                        value={dose.reason}
                                                        valueChange={(opt) => {
                                                            const selectedValue = typeof opt === "string" ? opt : opt?.value;
                                                            const updated = [...pastDoses];
                                                            updated[idx].reason = selectedValue;
                                                            setPastDoses(updated);
                                                        }}
                                                        options={reasonOptionsMap[outcome]}
                                                        required={reasonRequired}
                                                        error={reasonRequired && !dose.reason ? "Required" : ""}
                                                    />
                                                )}

                                                <TextAreaField
                                                    label="Note"
                                                    name={`pastDoses[${idx}].note`}
                                                    value={dose.note}
                                                    valueChange={(e) => {
                                                        const updated = [...pastDoses];
                                                        updated[idx].note = e.target.value;
                                                        setPastDoses(updated);
                                                    }}
                                                    required
                                                    error={!dose.note ? "Required" : ""}
                                                />
                                            </div>
                                        );
                                    })}

                                    <button
                                        type="button"
                                        disabled={!isPastDoseValid}
                                        className={`mt-3 rounded px-5 py-2 text-sm font-medium text-white ${
                                            !isPastDoseValid ? "cursor-not-allowed bg-gray-400" : "bg-customDropdownBorder hover:bg-opacity-90"
                                        }`}
                                        onClick={() => {
                                            setShowPastDosesForm(false);
                                            setOpenSection(null);
                                            if (!isEditMode) {
                                                moveToNextSection("pastadministrations", "additionalInstructions");
                                            }
                                        }}
                                    >
                                        Continue
                                    </button>
                                </>
                            ) : (
                                <>
                                    {pastDoses.every((dose) => dose.outcome && dose.note) &&
                                        pastDoses.map((dose, idx) => (
                                            <div
                                                key={idx}
                                                className="mb-4 rounded border border-gray-100 bg-gray-50 p-4"
                                            >
                                                <div className="mb-2 text-sm font-medium text-customBlack">
                                                    {new Date(dose.date).toLocaleDateString("en-GB")} – {formatSlotLabel(dose.slot)}
                                                </div>
                                                <div className="text-sm text-customGrey1">
                                                    <strong>Outcome:</strong> {dose.outcome}
                                                </div>
                                                {dose.reason && (
                                                    <div className="text-sm text-customGrey1">
                                                        <strong>Reason:</strong> {dose.reason}
                                                    </div>
                                                )}
                                                <div className="text-sm text-customGrey1">
                                                    <strong>Note:</strong> {dose.note}
                                                </div>
                                            </div>
                                        ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Additional Instructions Section */}
            {values.firstDoseDate && values.firstDoseTime && unlockedSections.has("additionalInstructions") && (
                <div className="mb-4 mt-6 rounded border border-gray-200">
                    <button
                        type="button"
                        className="flex w-full items-center justify-between px-6 py-4 text-left focus:outline-none"
                        onClick={() => setOpenSection(openSection === "additionalInstructions" ? null : "additionalInstructions")}
                    >
                        <div className="flex-1">
                            <span className="poppins-medium text-sm text-customBlack">Are there any additional instructions?</span>
                            {openSection !== "additionalInstructions" && values.additionalInstructions && (
                                <div className="mt-1 text-sm text-customGrey1">{values.additionalInstructions}</div>
                            )}
                        </div>
                        <svg
                            className={`ml-2 h-5 w-5 transition-transform ${openSection === "additionalInstructions" ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </button>
                    {openSection === "additionalInstructions" && (
                        <div className="space-y-4 border-t border-gray-200 px-6 py-4">
                            {/* Create body map */}
                            <div>
                                <div className="mb-2 text-sm text-customBlack">Create a body map (optional)</div>
                                <button
                                    type="button"
                                    className="rounded border border-gray-300 px-4 py-2 text-sm text-customBlack hover:bg-gray-50"
                                    onClick={() => setFieldValue("showBodyMapModal", true)}
                                >
                                    Create body map
                                </button>
                            </div>

                            {/* Add additional instructions */}
                            <div>
                                <div className="mb-2 text-sm text-customBlack">Add additional instructions (optional)</div>
                                <TextAreaField
                                    name="additionalInstructions"
                                    value={values.additionalInstructions}
                                    placeHolder="Add a note...."
                                    valueChange={(e) => setFieldValue("additionalInstructions", e.target.value)}
                                />
                            </div>

                            {/* Confirm instructions button */}
                            <button
                                type="button"
                                className="rounded bg-customDropdownBorder px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-400"
                                onClick={() => {
                                    setShowConfirmation(true);
                                    setOpenSection(null);
                                }}
                            >
                                {isEditMode ? "Confirm amended instructions" : "Confirm instructions"}
                            </button>

                            {/* Help text */}
                            <div className="mt-4 flex items-start text-sm text-customGrey1">
                                <span className="mr-2">&#9432;</span>
                                <div>
                                    <p className="mb-1">
                                        Please record any additional directions from the prescription and dispensing label on how the medicine should
                                        be taken or given.
                                    </p>
                                    <p>
                                        For example: medication purpose, medication appearance, minimum time between doses, the maximum number of
                                        doses to be given (in 24 hrs) etc. For more information please review the{" "}
                                        <a
                                            href="https://www.nice.org.uk/"
                                            className="text-customNavy hover:underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            NICE guidelines
                                        </a>
                                        .
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showConfirmation && (
                <div className="mt-6">
                    <div className="flex items-start rounded-md border-l-4 border-[#976811] bg-[#FFF8EB] p-4 text-sm text-[#976811]">
                        <span className="mr-2 text-lg">⚠️</span>
                        <p>
                            These changes will not be synced to the mobile app automatically. Caregivers must manually refresh the visits list in the
                            mobile application to receive the latest changes. If you are concerned that carers may not see this change then contact
                            them directly.
                        </p>
                    </div>

                    <div className="mt-4 flex gap-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            // onClick={() => setShowConfirmation(false)}
                            className="poppins-semibold rounded bg-customDropdownBorder px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-opacity-80"
                        >
                            {isSubmitting ? (
                                <InnerLoader
                                    loading={isSubmitting}
                                    text={isEditMode ? "Updating..." : "Scheduling..."}
                                />
                            ) : (
                                isEditMode ? "Yes, amend schedule" : "Yes, create schedule"
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowConfirmation(false)}
                            className="poppins-semibold text-sm text-customTextLightNavy underline"
                        >
                            Cancel changes
                        </button>
                    </div>
                </div>
            )}

            {/* Body Map Modal */}
            {values.showBodyMapModal && <MedicationBodyMapEditor value={values.bodyMapData || ""} onChange={(value) => setFieldValue("bodyMapData", value)} onClose={() => setFieldValue("showBodyMapModal", false)} />}
        </>
    );
};

RegularMedicationSections.propTypes = {
    values: PropTypes.object.isRequired,
    setFieldValue: PropTypes.func.isRequired,
    unlockedSections: PropTypes.instanceOf(Set).isRequired,
    openSection: PropTypes.string.isRequired,
    setOpenSection: PropTypes.func.isRequired,
    moveToNextSection: PropTypes.func.isRequired,
    isSubmitting: PropTypes.bool.isRequired,
    displayValue: PropTypes.func.isRequired,
    isEditMode: PropTypes.bool.isRequired,
};
export default RegularMedicationSections;
