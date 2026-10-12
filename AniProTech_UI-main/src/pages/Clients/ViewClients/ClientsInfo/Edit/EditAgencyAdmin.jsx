import TextField from "../../../../../components/TextInput/TextInput";
import TextAreaField from "../../../../../components/TextInput/TextAreaField";
import CheckboxButtonGroup from "../../../../../components/TextInput/CheckboxButtonGroup";
import StatusToggleButtonGroup from "../../../../../components/TextInput/StatusToggleButtonGroup";
import RadioButtonGroup from "../../../../../components/TextInput/RadioButtonGroup";
import DateField from "../../../../../components/DateField/DateField";
import { useState } from "react";
import {
    clientsCarerPreferencesOptions,
    clientsCommunicationSupportOptions,
    clientsContactMethodOptions,
    clientsFamilyInvolvementOptions,
    clientsFundingOptions,
    clientsRegulatedCareOptions,
    clientsRiskLevelOptions,
} from "../../../../../constants/clientConstants";
import { useFormikContext } from "formik";
import { ScheduleInactivityDialog } from "./ScheduleInactivityDialog";
import { useGlobalStore } from "../../../../../stores/useGlobalStore";
import { CirclePlus, Pencil, Trash2 } from "lucide-react";
import DeleteDialog from "./DeleteDialog";
import { capitalizeFirstLetter, formatDisplayName, isNotEmpty } from "../../../../../utils/common";

const EditAgencyAdmin = () => {
    const { values, setFieldValue } = useFormikContext();
    const agencyAdmin = values?.agencyAdmin || {};
    const clientInactivity = values?.clientInactivity || [];
    const [selectedInactivity, setSelectedInactivity] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const { clientsPersonalDetailData } = useGlobalStore();
    const clientName = clientsPersonalDetailData ? `${clientsPersonalDetailData.firstName}` : "the client";

    const handleSchedule = (data) => {
        if (selectedInactivity) {
            const updatedInactivity = clientInactivity.map((item) => (item === selectedInactivity ? data : item));
            setFieldValue("clientInactivity", updatedInactivity);
        } else {
            setFieldValue("clientInactivity", [...clientInactivity, data]);
        }
        setDialogOpen(false);
        setSelectedInactivity(null);
    };

    const getCurrentStatus = () => {
        if (!clientInactivity || clientInactivity.length === 0) {
            return {
                text: "Active",
                bgColor: "bg-green-300 border text-green-900 poppins-semibold border-green-500",
            };
        }

        const currentDate = new Date();

        const activeInactivity = clientInactivity.find((item) => {
            const startDate = new Date(item.startDate);

            if (item.type === "PERMANENT") {
                return startDate <= currentDate;
            } else if (item.type === "TEMPORARY") {
                const endDate = item.endDate ? new Date(item.endDate) : null;
                // If endDate is provided, check if currentDate is within range
                if (endDate) {
                    return startDate <= currentDate && currentDate <= endDate;
                } else {
                    // No endDate means it's still considered active
                    return startDate <= currentDate;
                }
            }

            return false;
        });

        if (activeInactivity) {
            if (activeInactivity.type === "PERMANENT") {
                return {
                    text: "Inactive",
                    bgColor: "bg-red-300 text-red-800 poppins-semibold border border-red-500",
                };
            } else if (activeInactivity.type === "TEMPORARY") {
                return {
                    text: "Inactive",
                    bgColor: "bg-yellow-100 border border-yellow-500 text-yellow-800",
                };
            }
        }

        return {
            text: "Active",
            bgColor: "bg-green-300 border text-green-900 poppins-semibold border-green-500",
        };
    };

    const currentStatus = getCurrentStatus();

    return (
        <div className="space-y-8 pb-20">
            {/* Status Section */}
            <div
                id="identifiers"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow"
            >
                <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-lg font-medium text-gray-900">Identifiers</h2>
                    <p className="mt-1 text-sm text-gray-500">Unique identifiers for the client in your system.</p>
                </div>

                <TextField
                    label="Unique client identifier"
                    name="agencyAdmin.uniqueClientIdentifier"
                    type="text"
                    value={agencyAdmin?.uniqueClientIdentifier || ""}
                    valueChange={(e) => setFieldValue("agencyAdmin.uniqueClientIdentifier", e.target.value)}
                />
            </div>

            <div
                id="status-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow"
            >
                <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-lg font-medium text-gray-900">Status</h2>
                    <p className="mt-1 text-sm text-gray-500">Current status and scheduling information for the client.</p>
                </div>

                <div className="space-y-6">
                    <DateField
                        label="Service start date"
                        name="agencyAdmin.serviceStartDate"
                        value={agencyAdmin?.serviceStartDate || ""}
                        onChange={(e) => setFieldValue("agencyAdmin.serviceStartDate", e.target.value)}
                    />

                    {/* <RadioButtonGroup
                        label="Current Status"
                        name="currentStatus"
                        value={agencyAdmin?.currentStatus || ""}
                        options={clientsStatusOptions}
                        onChange={(e) => setFieldValue("currentStatus", e.target.value)}
                    /> */}

                    <div className="flex items-center space-x-2 border-b pb-5">
                        <span className="text-sm font-medium text-customTextGrey">
                            Current Status<span className="text-red-500">*</span>
                        </span>
                        <span className={`rounded-full ${currentStatus.bgColor} px-3 py-1 text-xs`}>{currentStatus.text}</span>
                    </div>

                    {/* Inactivity Section */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="mb-4 text-sm font-medium text-customTextGrey">Upcoming periods of inactivity</h3>

                            {clientInactivity?.length === 0 ? (
                                <p className="pb-4 pt-7 text-center text-gray-700">There are no upcoming periods of inactivity</p>
                            ) : (
                                <div className="space-y-4 pb-4">
                                    {clientInactivity?.map((item, index) => (
                                        <div
                                            key={index}
                                            className="flex justify-between rounded border border-gray-200 p-4"
                                        >
                                            {/* Left section */}
                                            <div>
                                                <p className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-sm font-medium text-gray-800">
                                                    {capitalizeFirstLetter(item.type)}{" "}
                                                    {item.type === "TEMPORARY" && isNotEmpty(item.reason)
                                                        ? `- ${formatDisplayName(item.reason)}`
                                                        : ""}{" "}
                                                    {item.type === "PERMANENT" && isNotEmpty(item.reason)
                                                        ? `- ${formatDisplayName(item.reason)}`
                                                        : ""}{" "}
                                                    {item.leavingReason ? `- ${formatDisplayName(item.leavingReason)}` : ""}
                                                </p>
                                                <div className="mt-2 text-sm text-gray-900">
                                                    <div className="flex space-x-4">
                                                        <div>
                                                            <p className="text-xs font-semibold text-gray-500">Starting</p>
                                                            <p>
                                                                {item.startDate}, {item.startTime}
                                                            </p>
                                                        </div>
                                                        {item.type === "TEMPORARY" && item.endDate && (
                                                            <div>
                                                                <p className="text-xs font-semibold text-gray-500">Ending</p>
                                                                <p>
                                                                    {item.endDate}, {item.endTime}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {item.note && (
                                                        <p className="mt-2 whitespace-pre-wrap text-xs text-gray-500">
                                                            <span className="font-medium text-gray-600">Note</span>
                                                            <br />
                                                            {item.note}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right section (actions) */}
                                            <div className="flex items-start gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedInactivity(item); // set current item
                                                        setDialogOpen(true);
                                                    }}
                                                    className="text-gray-600 hover:text-blue-600"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedInactivity(item);
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                    className="text-gray-600 hover:text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className={`flex ${clientInactivity?.length === 0 ? "justify-center" : ""}`}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedInactivity(null);
                                        setDialogOpen(true);
                                    }}
                                    className={`inline-flex items-center justify-center ${
                                        clientInactivity?.length === 0 ? "border border-customNavy" : "border-0"
                                    } rounded bg-white px-4 py-2 text-sm font-medium text-customNavy hover:bg-customCarerFeedBg`}
                                >
                                    {clientInactivity?.length !== 0 && (
                                        <span className="mb-0.5 mr-2 font-medium">
                                            <CirclePlus size={16} />
                                        </span>
                                    )}
                                    Schedule new inactivity
                                </button>
                            </div>
                        </div>

                        <DeleteDialog
                            open={deleteDialogOpen}
                            onClose={() => {
                                setDeleteDialogOpen(false);
                                setSelectedInactivity(null);
                            }}
                            data={selectedInactivity}
                            onDelete={() => {
                                const updated = clientInactivity.filter((i) => i !== selectedInactivity);
                                setFieldValue("clientInactivity", updated);
                            }}
                        />

                        <ScheduleInactivityDialog
                            open={dialogOpen}
                            onClose={() => {
                                setDialogOpen(false);
                                setSelectedInactivity(null); // Reset selected item when closing
                            }}
                            onSchedule={handleSchedule}
                            clientInactivityData={selectedInactivity}
                        />
                    </div>
                </div>
            </div>

            {/* Regulated Care Section */}
            <div
                id="regulated-care-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow"
            >
                <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-lg font-medium text-gray-900">Regulated Care</h2>
                    <p className="mt-1 text-sm text-gray-500">Information about regulated care services.</p>
                </div>

                <StatusToggleButtonGroup
                    label="Does the client receive regulated care?"
                    name="agencyAdmin.receivesRegulatedCare"
                    value={agencyAdmin?.receivesRegulatedCare || false}
                    options={clientsRegulatedCareOptions}
                    onChange={(e) => setFieldValue("agencyAdmin.receivesRegulatedCare", e.target.value)}
                />
            </div>

            {/* Risk Management Section */}
            <div
                id="risk-management-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow"
            >
                <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-lg font-medium text-gray-900">Risk Management</h2>
                    <p className="mt-1 text-sm text-gray-500">Risk assessment and management information.</p>
                </div>

                <div className="space-y-6">
                    <RadioButtonGroup
                        label="Assign an overall risk level to the client in line with your contingency plan"
                        name="agencyAdmin.overallRiskLevel"
                        value={agencyAdmin?.overallRiskLevel || ""}
                        options={clientsRiskLevelOptions}
                        valueChange={(e) => setFieldValue("agencyAdmin.overallRiskLevel", e.target.value)}
                    />

                    <TextAreaField
                        label="Risk level details"
                        name="agencyAdmin.riskLevelDetails"
                        value={agencyAdmin?.riskLevelDetails || ""}
                        valueChange={(e) => setFieldValue("agencyAdmin.riskLevelDetails", e.target.value)}
                    />

                    <RadioButtonGroup
                        label="Family involvement level"
                        name="agencyAdmin.familyInvolvementLevel"
                        value={agencyAdmin?.familyInvolvementLevel || ""}
                        options={clientsFamilyInvolvementOptions}
                        valueChange={(e) => setFieldValue("agencyAdmin.familyInvolvementLevel", e.target.value)}
                    />

                    <TextAreaField
                        label="What is the contingency plan for the client's care, in the case of a staffing crisis?"
                        name="agencyAdmin.staffingCrisisPlan"
                        value={agencyAdmin?.staffingCrisisPlan || ""}
                        valueChange={(e) => setFieldValue("agencyAdmin.staffingCrisisPlan", e.target.value)}
                    />

                    <TextAreaField
                        label="What is the contingency plan for the client's care, in the case of adverse weather conditions?"
                        name="agencyAdmin.weatherConditionsPlan"
                        value={agencyAdmin?.weatherConditionsPlan || ""}
                        valueChange={(e) => setFieldValue("agencyAdmin.weatherConditionsPlan", e.target.value)}
                    />
                </div>
            </div>

            {/* Accessible Information Standard Section */}
            <div
                id="accessible-info-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow"
            >
                <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-lg font-medium text-gray-900">Accessible Information Standard</h2>
                    {/* <p className="mt-1 text-sm text-gray-500">Communication preferences and accessibility requirements.</p> */}
                </div>

                <CheckboxButtonGroup
                    label={`Does ${clientName} have any communication or information needs?`}
                    name="agencyAdmin.communicationOrInformationNeeds"
                    value={agencyAdmin?.communicationOrInformationNeeds || []}
                    options={clientsCommunicationSupportOptions}
                    exclusiveValue="NO_REQUIREMENTS"
                    valueChange={(e) => setFieldValue("agencyAdmin.communicationOrInformationNeeds", e.target.value)}
                />

                <div className="space-y-6">
                    <TextAreaField
                        label="Additional details"
                        name="agencyAdmin.additionalDetails"
                        value={agencyAdmin?.additionalDetails || ""}
                        valueChange={(e) => setFieldValue("agencyAdmin.additionalDetails", e.target.value)}
                    />

                    <RadioButtonGroup
                        label="Preferred method of contact"
                        name="agencyAdmin.preferredContactMethod"
                        value={agencyAdmin?.preferredContactMethod || ""}
                        options={clientsContactMethodOptions}
                        valueChange={(e) => setFieldValue("agencyAdmin.preferredContactMethod", e.target.value)}
                    />
                </div>
            </div>

            {/* Funding Arrangements Section */}
            <div
                id="funding-arrangements-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow"
            >
                <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-lg font-medium text-gray-900">Funding Arrangements</h2>
                    <p className="mt-1 text-sm text-gray-500">Information about funding sources and arrangements.</p>
                </div>

                <CheckboxButtonGroup
                    label="Funding options"
                    name="agencyAdmin.fundingOption"
                    value={agencyAdmin?.fundingOption || []}
                    options={clientsFundingOptions}
                    valueChange={(e) => setFieldValue("agencyAdmin.fundingOption", e.target.value)}
                />

                <TextField
                    label="Local authority ID"
                    name="agencyAdmin.localAuthorityId"
                    type="text"
                    placeHolder="eg: 63 001 20190626"
                    value={agencyAdmin?.localAuthorityId || ""}
                    valueChange={(e) => setFieldValue("agencyAdmin.localAuthorityId", e.target.value)}
                />
            </div>

            {/* Matching Section */}
            <div
                id="matching-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow"
            >
                <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-lg font-medium text-gray-900">Matching</h2>
                    <p className="mt-1 text-sm text-gray-500">Preferences for matching care providers.</p>
                </div>

                <div className="space-y-6">
                    <RadioButtonGroup
                        label="Carer preferences"
                        name="agencyAdmin.carerPreferences"
                        value={agencyAdmin?.carerPreferences || ""}
                        options={clientsCarerPreferencesOptions}
                        valueChange={(e) => setFieldValue("agencyAdmin.carerPreferences", e.target.value)}
                    />

                    <TextAreaField
                        label="Other preferences"
                        name="agencyAdmin.otherPreferences"
                        value={agencyAdmin?.otherPreferences || ""}
                        valueChange={(e) => setFieldValue("agencyAdmin.otherPreferences", e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};

export default EditAgencyAdmin;
