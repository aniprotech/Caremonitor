import PropTypes from "prop-types";
import { SquarePen } from "lucide-react";
import { capitalizeFirstLetter, isEmpty, isNotEmpty } from "../../../../utils/common";
import { clientsInfoConfigs } from "../../../../data/clients/clientInfoData";
import { useNavigationHelpers } from "../../../../hooks/useNavigationHelpers";
import useScrollToTop from "../../../../hooks/useScrollToTop";
import { clinicalDetailsConfig, futurePlanningConfig, keyContactsConfig, agencyAdminConfig } from "../../../../data/clients/clinicalDetailsConfig";
import { enumMappings } from "../../../../constants/clientConstants";
import { useGlobalStore } from "../../../../stores/useGlobalStore";
import { getCurrentStatus, renderStatusBadge } from "../../../../data/clients/clientMedication";

const ClientsInfoSection = ({ data, sectionId, componentName }) => {
    const { id, navigate } = useNavigationHelpers();
    useScrollToTop();
    const { clientsPersonalDetailData } = useGlobalStore();
    const clientName = clientsPersonalDetailData ? `${clientsPersonalDetailData.firstName}` : "the client";

    const getConfigByComponentName = () => {
        switch (componentName) {
            case "EditClinicalDetails":
                return clinicalDetailsConfig;
            case "EditFuturePlanning":
                return futurePlanningConfig;
            case "EditClientKeyContact":
                return keyContactsConfig;
            case "EditClientAgencyAdmin":
                return agencyAdminConfig;
            case "ClientsInfoSection":
            default:
                return clientsInfoConfigs;
        }
    };

    const config = getConfigByComponentName()?.find((section) => section.id === sectionId);

    if (!config || !data) return null;

    const prettifyText = (text) => {
        if (typeof text === "boolean") return text ? "Yes" : "No";
        if (Array.isArray(text)) return text.map(prettifyText).join(", ");
        if (typeof text !== "string") return text;

        const upperText = text.toUpperCase();

        if (text.toLowerCase() === "yes") return "Yes";
        if (text.toLowerCase() === "no") return "No";
        if (upperText === "DONT_KNOW") return enumMappings?.DONT_KNOW;
        if (["RED", "AMBER", "GREEN"].includes(text)) return capitalizeFirstLetter(text);
        if (enumMappings[upperText]) return enumMappings[upperText];

        if (!/^[A-Z_]+$/.test(text)) return text;
        const words = text
            ?.split("_")
            ?.map((word) => word.trim())
            .filter((word) => word.length > 0);

        return words
            ?.map((word) => {
                if (word.length <= 3 && word.toUpperCase() === word) return word.toUpperCase();
                return word?.charAt(0).toUpperCase() + word?.slice(1);
            })
            .join(" ");
    };

    const hasValue = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== null && obj[key] !== undefined;

    const renderContactList = (contacts, fields) => {
        if (!Array.isArray(contacts) || contacts.length === 0) return null;
        return contacts.map((contact, contactIndex) => (
            <div
                key={contact.id || contactIndex}
                className="mb-4 rounded-lg border border-customBorder/40 p-4"
            >
                {fields.map((field, fieldIndex) => {
                    let value = contact[field.key];

                    if (Array.isArray(value)) {
                        value = value.join(", ");
                    }

                    if (typeof value === "boolean") {
                        value = value ? "Yes" : "No";
                    }

                    const displayValue = value === null || value === "" || isEmpty(value) ? "-" : prettifyText(value);
                    const fieldLabel = typeof field.label === "function" ? field.label(clientName) : field.label;

                    return (
                        <div
                            key={fieldIndex}
                            className="poppins-medium flex flex-col border-b border-customBorder/40 px-3 py-4 text-base last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <p className="text-sm text-customTextGrey sm:w-1/2">{fieldLabel}</p>
                            <p className="mt-1 text-left text-sm whitespace-pre-wrap break-words text-customTextGrey1 sm:mt-0 sm:w-1/2">{displayValue}</p>
                        </div>
                    );
                })}
            </div>
        ));
    };

    return (
        <div className="mt-6 w-full rounded-lg border border-customBorder/40 bg-white p-5 shadow">
            <div className="mb-6 flex items-center justify-between text-base md:text-xl">
                <h2 className="poppins-medium text-customTextGrey">{config.componentTitle}</h2>
                <button
                    type="button"
                    className="flex items-center text-base font-medium text-customTextNavy hover:underline"
                    onClick={() => {
                        const tab = {
                            EditClinicalDetails: "clinical-details",
                            EditClientKeyContact: "key-contacts",
                            EditFuturePlanning: "future-planning",
                            EditClientAgencyAdmin: "agency-admin",
                        }[componentName];
                        navigate(`/admin/clients/${id}/client-info/edit${tab ? `?tab=${tab}` : ""}`, {
                            state: { data },
                        });
                    }}
                >
                    <SquarePen className="mr-1 h-4 w-4" />
                    Edit
                </button>
            </div>

            {config?.componentDescription && <p className="mb-4 text-sm text-customTextGrey1">{config?.componentDescription}</p>}

            <div className="pb-2 pt-2">
                {sectionId === "nok-emergency" && renderContactList(data.clientEmergencyContacts, config.fields)}
                {sectionId === "other-professionals" && renderContactList(data.clientProfessionals, config.fields)}

                {!["nok-emergency", "other-professionals"].includes(sectionId) &&
                    config?.fields?.map((field, index) => {
                        let value = "-";

                        if (isNotEmpty(data)) {
                            if (Array.isArray(field.key)) {
                                const combined = field.key
                                    .map((key) => data[key])
                                    .filter((v) => isNotEmpty(v))
                                    .join(", ");
                                value = combined || "-";
                            } else if (field.key === "clientInactivity") {
                                const status = getCurrentStatus(data?.clientInactivity);
                                value = renderStatusBadge(status);
                            } else if (hasValue(data, field.key)) {
                                value = data[field.key];
                            }
                        }

                        const displayValue =
                            field.key === "clientInactivity"
                                ? value
                                : typeof value === "boolean"
                                  ? (value ? "Yes" : "No")
                                  : value === null || value === "" || isEmpty(value)
                                  ? "-"
                                  : prettifyText(value);
                        const fieldLabel = typeof field.label === "function" ? field.label(clientName) : field.label;

                        return (
                            <div
                                key={index}
                                className="poppins-medium flex flex-col border border-customBorder/40 px-3 py-4 text-base sm:flex-row sm:items-center sm:justify-between"
                            >
                                <p className="text-sm text-customTextGrey md:w-72">{fieldLabel}</p>
                                <p className="mt-1 text-left text-sm whitespace-pre-wrap break-words text-customTextGrey1 sm:mt-0 sm:w-1/2">{displayValue}</p>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};

ClientsInfoSection.propTypes = {
    data: PropTypes.object.isRequired,
    sectionId: PropTypes.string.isRequired,
    componentName: PropTypes.string.isRequired,
};

export default ClientsInfoSection;
