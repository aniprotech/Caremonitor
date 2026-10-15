import { Dialog } from "@headlessui/react";
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Info } from "lucide-react";
import TextAreaField from "../../../../../components/TextInput/TextAreaField";
import DateField from "../../../../../components/DateField/DateField";
import { permanentReasons, temporaryReasons, leavingServiceReasons, inactivityTypes } from "../../../../../data/clients/clientInfoData";

export const ScheduleInactivityDialog = ({ open, onClose, onSchedule, clientInactivityData }) => {
    const [formData, setFormData] = useState({
        startDate: clientInactivityData?.startDate || "",
        endDate: clientInactivityData?.endDate || "",
        startTime: clientInactivityData?.startTime || "",
        endTime: clientInactivityData?.endTime || "",
        reason: clientInactivityData?.reason || "",
        leavingReason: clientInactivityData?.leavingReason || "",
        type: clientInactivityData?.type || "",
        note: clientInactivityData?.note || "",
    });

    useEffect(() => {
        if (clientInactivityData) {
            setFormData({
                startDate: clientInactivityData.startDate || "",
                endDate: clientInactivityData.endDate || "",
                startTime: clientInactivityData.startTime || "",
                endTime: clientInactivityData.endTime || "",
                reason: clientInactivityData.reason || "",
                leavingReason: clientInactivityData.leavingReason || "",
                type: clientInactivityData.type || "",
                note: clientInactivityData.note || "",
            });
        } else {
            setFormData({
                startDate: "",
                endDate: "",
                startTime: "",
                endTime: "",
                reason: "",
                leavingReason: "",
                type: "",
                note: "",
            });
        }
    }, [clientInactivityData]);

    const handleSubmit = (e) => {
        e.preventDefault();

        const payload = { ...formData };

        if (payload.type === "PERMANENT") {
            delete payload.endDate;
            delete payload.endTime;
        }

        onSchedule(payload);

        setFormData({
            startDate: "",
            endDate: "",
            startTime: "",
            endTime: "",
            reason: "",
            leavingReason: "",
            type: "",
            note: "",
        });
    };

    const handleChange = (name, value) => {
        if (name === "type") {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
                reason: "",
                leavingReason: "",
            }));
        } else if (name === "reason") {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
                leavingReason: "",
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const getInfoText = () => {
        if (formData.type === "TEMPORARY") {
            return "Any visits scheduled to start during the period of inactivity will be cancelled automatically. Visits that are due to start before this period of inactivity will not be cancelled.";
        } else if (formData.type === "PERMANENT") {
            return "All visit schedules will be stopped when the permanent inactivity starts. Any visits that are due to start before this period of inactivity will not be cancelled.";
        }
        return "";
    };

    const currentReasons = formData.type === "TEMPORARY" ? temporaryReasons : permanentReasons;

    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            className="relative z-50"
        >
            <div
                className="fixed inset-0 bg-black/30"
                aria-hidden="true"
            />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto w-full max-w-lg rounded-lg bg-white p-6">
                    <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-4">
                        <Dialog.Title className="text-lg font-medium text-gray-900">Schedule new inactivity</Dialog.Title>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500"
                        >
                            ×
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="mt-4 space-y-4"
                    >
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Type<span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.type}
                                onChange={(e) => handleChange("type", e.target.value)}
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                                required
                            >
                                <option value="">Select type</option>
                                {inactivityTypes.map((type) => (
                                    <option
                                        key={type.value}
                                        value={type.value}
                                    >
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {formData.type && (
                            <div className="flex items-start gap-2 rounded border border-customNavy bg-customCarerFeedBg p-3 text-sm text-customNavy">
                                <Info className="mt-0.5 h-5 w-5" />
                                <span>{getInfoText()}</span>
                            </div>
                        )}

                        {formData.type && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Reason<span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.reason}
                                    onChange={(e) => handleChange("reason", e.target.value)}
                                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                                    required
                                >
                                    <option value="">Select reason</option>
                                    {currentReasons.map((reason) => (
                                        <option
                                            key={reason.value}
                                            value={reason.value}
                                        >
                                            {reason.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {formData.reason === "LEFT_SERVICE" && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Reason for leaving service<span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.leavingReason}
                                    onChange={(e) => handleChange("leavingReason", e.target.value)}
                                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                                    required
                                >
                                    <option value="">Select reason</option>
                                    {leavingServiceReasons.map((reason) => (
                                        <option
                                            key={reason.value}
                                            value={reason.value}
                                        >
                                            {reason.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {formData.reason && (
                            <TextAreaField
                                name="note"
                                value={formData.note}
                                rows={4}
                                placeHolder="Additional details"
                                valueChange={(e) => handleChange("note", e.target.value)}
                            />
                        )}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                Starting<span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <DateField
                                    name="startDate"
                                    label=""
                                    value={formData.startDate}
                                    onChange={(event) => handleChange("startDate", event.target.value)}
                                    style="width"
                                />
                                <div className="flex gap-2">
                                    <select
                                        value={formData.startTime}
                                        onChange={(e) => handleChange("startTime", e.target.value)}
                                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                                        // required
                                    >
                                        <option value="">Select time</option>
                                        {Array.from({ length: 24 }, (_, i) => {
                                            const hour = i.toString().padStart(2, "0");
                                            return (
                                                <option
                                                    key={hour}
                                                    value={`${hour}:00:00`}
                                                >
                                                    {`${hour}:00`}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleChange("startTime", "");
                                            handleChange("startDate", "");
                                        }}
                                        className="text-customActiveBg hover:text-customActiveBg/80"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        </div>

                        {formData.type === "TEMPORARY" && (
                            <div>
                                <label className="mb-2 block text-sm font-medium text-gray-700">Ending</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <DateField
                                        name="endDate"
                                        label=""
                                        value={formData.endDate}
                                        onChange={(event) => handleChange("endDate", event.target.value)}
                                        style="width"
                                        required={formData.type === "TEMPORARY"}
                                    />
                                    <div className="flex gap-2">
                                        <select
                                            value={formData.endTime}
                                            onChange={(e) => handleChange("endTime", e.target.value)}
                                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                                            required={formData.type === "TEMPORARY"}
                                        >
                                            <option value="">Select time</option>
                                            {Array.from({ length: 24 }, (_, i) => {
                                                const hour = i.toString().padStart(2, "0");
                                                return (
                                                    <option
                                                        key={hour}
                                                        value={`${hour}:00:00`}
                                                    >
                                                        {`${hour}:00`}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleChange("endTime", "");
                                                handleChange("endDate", "");
                                            }}
                                            className="text-customActiveBg hover:text-customActiveBg/80"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end space-x-3 border-t border-gray-200 pt-5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Discard changes
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                            >
                                Apply changes
                            </button>
                        </div>
                    </form>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

ScheduleInactivityDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSchedule: PropTypes.func.isRequired,
    clientInactivityData: PropTypes.object,
};

export default ScheduleInactivityDialog;
