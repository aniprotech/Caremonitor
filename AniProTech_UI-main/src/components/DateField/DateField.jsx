import React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaRegCalendarAlt } from "react-icons/fa";

const parseSelectedDate = (value) => {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

const DateField = ({ name, label, value, onChange, onBlur, style, error, minDate, min, required, disable }) => {
    const handleDateChange = (date) => {
        const formattedDate = date
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
            : "";
        onChange({ target: { name, value: formattedDate } });
    };

    return (
        <div className="mb-4 w-fit">
            <label
                htmlFor={name}
                className={`block ${style === "textSize" ? "text-base poppins-medium text-customNavy" : "text-sm"} poppins-medium text-customTextGrey`}
            >
                {label}
                {required && <span className="text-red-500"> *</span>}
            </label>

            <div className={`relative ${style === "mt" || style === "width" ? "mt-2" : ""}`}>
                <DatePicker
                    selected={parseSelectedDate(value)}
                    onChange={handleDateChange}
                    onBlur={onBlur}
                    dateFormat="dd-MM-yyyy"
                    strictParsing
                    minDate={parseSelectedDate(minDate || min) || undefined}
                    showMonthDropdown
                    showYearDropdown
                    scrollableYearDropdown
                    yearDropdownItemNumber={150}
                    disabled={disable}
                    className={` ${style === "width" ? "w-full" : "min-w-[160px] md:min-w-[180px]"} disabled:cursor-text cursor-pointer rounded border p-3 pr-10 text-sm ${error ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-1`}
                    placeholderText="dd-mm-yyyy (type or choose)"
                    // shouldCloseOnSelect={!access} // Prevent closing on select if access is true
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transform text-customTextGrey">
                    <FaRegCalendarAlt />
                </div>
            </div>

            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
};

export default DateField;
