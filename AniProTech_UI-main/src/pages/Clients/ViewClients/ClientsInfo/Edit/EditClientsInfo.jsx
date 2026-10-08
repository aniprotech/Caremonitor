import React, { useState, useEffect, useRef } from "react";
import { Formik, Form } from "formik";
import clsx from "clsx";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import EditPersonalIdentity from "./EditPersonalIdentity";
import EditClinicalDetails from "./EditClinicalDetails";
import EditFuturePlanning from "./EditFuturePlanning";
import EditKeyContacts from "./EditKeyContacts";
import EditAgencyAdmin from "./EditAgencyAdmin";
import {
    agencyAdminData,
    clinicalDetailsData,
    futurePlanningData,
    keyContactsEmergencyContactsData,
    keyContactsOtherProfessionalsData,
    personalIdentityData,
    sectionHeaders,
} from "../../../../../data/clients/clientInfoData";
import APIConfig from "../../../../../utils/ApiConfig";
import { _get, _post } from "../../../../../utils/ApiService";
import { showError, showSuccess } from "../../../../../utils/toaster";
import clientsBaseInfoValidation from "../../../../../utils/validations/clients/clientsBaseInfoValidation";
import { fetchData } from "../../../../../utils/FetchData";
import InnerLoader from "../../../../../components/Loader/InnerLoader";
import { useGlobalStore } from "../../../../../stores/useGlobalStore";
import { normaliseNhsNumber } from "../../../../../utils/nhsNumber";

const clientInfoTabs = [
    { name: "Personal Identity", component: EditPersonalIdentity },
    { name: "Clinical Details", component: EditClinicalDetails },
    { name: "Key Contacts", component: EditKeyContacts },
    { name: "Future Planning", component: EditFuturePlanning },
    { name: "Agency Admin", component: EditAgencyAdmin },
];

const EditClientsInfo = () => {
    const [searchParams] = useSearchParams();
    const tabPanelRef = useRef(null);
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { id } = useParams();
    const { clientsPersonalDetailData } = useGlobalStore();
    const clientName = clientsPersonalDetailData ? `${clientsPersonalDetailData.firstName}` : "the client";

    useEffect(() => {
        fetchData(() => _get(APIConfig?.CLIENTS?.CLIENT_INFO_GET_BY_ID(id)), setData, setLoading, null);
    }, [id]);

    const tabKeyMap = {
        "Personal Identity": "personalIdentity",
        "Clinical Details": "clinicalDetails",
        "Future Planning": "futurePlanning",
        "Key Contacts": "keyContacts",
        "Agency Admin": "agencyAdmin",
    };

    const requestedTab = searchParams.get("tab");
    const [activeTab, setActiveTab] = useState(() => {
        const index = clientInfoTabs.findIndex((tab) => tab.name.toLowerCase().replace(/\s+/g, "-") === requestedTab);
        return index >= 0 ? index : 0;
    });

    useEffect(() => {
        const index = clientInfoTabs.findIndex((tab) => tab.name.toLowerCase().replace(/\s+/g, "-") === requestedTab);
        if (index >= 0) setActiveTab(index);
    }, [requestedTab]);

    const initialValues = {
        personalIdentity: personalIdentityData(data),
        clinicalDetails: clinicalDetailsData(data),
        futurePlanning: futurePlanningData(data),
        keyContacts: {
            clientEmergencyContacts: Array.isArray(data?.clientEmergencyContacts)
                ? data.clientEmergencyContacts.map((contact) => ({
                      id: contact.id || undefined,
                      firstName: contact.firstName || "",
                      lastName: contact.lastName || "",
                      relationShip: contact.relationShip || null,
                      phoneNumber: contact.phoneNumber || "",
                      phoneCode: contact.phoneCode || "+44",
                      email: contact.email || "",
                      typeOfContact: contact.typeOfContact || [],
                      careMattersDiscussionAgreement: contact.careMattersDiscussionAgreement || false,
                  }))
                : [],
            clientProfessionals: Array.isArray(data?.clientProfessionals)
                ? data.clientProfessionals.map((professional) => ({
                      id: professional.id || undefined,
                      firstName: professional.firstName || "",
                      lastName: professional.lastName || "",
                      role: professional.role || "",
                      serviceName: professional.serviceName || "",
                      phoneNumber: professional.phoneNumber || "",
                      phoneCode: professional.phoneCode || "+44",
                      email: professional.email || "",
                      careMattersDiscussionAgreement: professional.careMattersDiscussionAgreement || false,
                  }))
                : [],
        },
        agencyAdmin: {
            ...agencyAdminData(data),
        },
        clientInactivity: data?.clientInactivity|| [],
    };

    useEffect(() => {
        if (tabPanelRef.current) {
            tabPanelRef.current.scrollTop = 0;
        }
    }, [activeTab]);

    const handleSectionClick = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            const headerOffset = 130;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth",
            });
        }
    };

    const handleSubmit = async (values, { setSubmitting }) => {
        const nhsNumber = normaliseNhsNumber(values.clinicalDetails.nhsNumber);
        if (nhsNumber === null) {
            showError("Enter a valid 10-digit NHS number with a correct check digit, or leave it blank.");
            setActiveTab(1);
            setSubmitting(false);
            return;
        }
        const payload = {
            ...values.personalIdentity,
            ...values.clinicalDetails,
            nhsNumber: nhsNumber || null,
            ...values.futurePlanning,
            clientEmergencyContacts: values?.keyContacts?.clientEmergencyContacts?.map((contact) => ({
                id: contact.id || undefined,
                firstName: contact.firstName,
                lastName: contact.lastName,
                relationShip: contact.relationShip,
                phoneNumber: contact.phoneNumber,
                phoneCode: contact.phoneCode || "+44",
                email: contact.email,
                typeOfContact: contact.typeOfContact || [],
                careMattersDiscussionAgreement: contact.careMattersDiscussionAgreement,
            })),
            clientProfessionals: values.keyContacts.clientProfessionals.map((professional) => ({
                id: professional.id || undefined,
                firstName: professional.firstName,
                lastName: professional.lastName,
                role: professional.role,
                serviceName: professional.serviceName,
                phoneNumber: professional.phoneNumber,
                phoneCode: professional.phoneCode || "+44",
                email: professional.email,
                careMattersDiscussionAgreement: professional.careMattersDiscussionAgreement,
            })),
            ...values?.agencyAdmin,
            clientInactivity: values?.clientInactivity?.map((item) => ({
                startDate: item.startDate,
                endDate: item.endDate,
                startTime: item.startTime,
                endTime: item.endTime,
                reason: item.reason,
                type: item.type,
                note: item.note,
            })),
        };

        const response = await fetchData((data) => _post(APIConfig?.CLIENTS.CLIENT_INFO_UPDATE(id), data), null, setLoading, null, payload, false);

        if (response?.data?.error === false) {
            showSuccess(response?.data?.message || "Client information updated successfully");
            navigate(-1);
        }
    };

    return (
        <Formik
            initialValues={initialValues}
            // validationSchema={clientsBaseInfoValidation}
            onSubmit={handleSubmit}
            enableReinitialize
        >
            {({ values, setFieldValue, errors, touched }) => (
                <Form className="relative min-h-screen bg-white md:mx-5 lg:mx-20 xl:mx-40">
                    {/* Top Navigation */}
                    <div className="sticky top-14 z-30 border-b bg-white pt-7 md:px-3">
                        <div className="relative border-b border-gray-300">
                            <div className="flex w-52 space-x-6 overflow-x-auto overflow-y-hidden md:w-full md:space-x-12">
                                {clientInfoTabs.map((tab, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => setActiveTab(index)}
                                        className={clsx(
                                            "relative whitespace-nowrap pb-2 text-xs font-semibold text-customTextNavy md:text-sm",
                                            activeTab === index
                                                ? "after:absolute after:inset-x-0 after:-bottom-[1px] after:h-[4px] after:bg-customTextNavy"
                                                : "hover:text-customTextNavy/80",
                                        )}
                                    >
                                        {tab.name}
                                        {errors[tabKeyMap[tab.name]] && touched[tabKeyMap[tab.name]] && <span className="ml-2 text-red-500">*</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex flex-col pt-3 lg:flex-row">
                        <div
                            className="flex-1 py-6 md:px-4"
                            ref={tabPanelRef}
                        >
                            {clientInfoTabs.map((tab, index) =>
                                activeTab === index ? (
                                    <div
                                        key={tab.name}
                                        className="rounded-xl bg-white focus:outline-none"
                                    >
                                        <tab.component />
                                    </div>
                                ) : null,
                            )}
                        </div>

                        {/* Right Navigation */}
                        <div className="py-6 lg:w-64 lg:flex-shrink-0 lg:px-4">
                            <div className="sticky top-36">
                                <div className="rounded-lg border border-gray-200 bg-white md:p-4">
                                    <h3 className="poppins-medium mb-4 text-lg text-customTextGrey">{tabs[activeTab]?.name}</h3>
                                    <nav className="space-y-2">
                                        {sectionHeaders[tabKeyMap[tabs[activeTab]?.name]]?.map((section) => (
                                            <button
                                                key={section.id}
                                                type="button"
                                                onClick={() => handleSectionClick(section.id)}
                                                className="w-full rounded-md px-4 py-2 text-left text-sm text-customNavy hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                                            >
                                                {section.title}
                                            </button>
                                        ))}
                                    </nav>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="fixed bottom-0 left-0 right-2 border-t border-gray-200 bg-white py-5 pr-10 shadow-lg">
                        <button
                            type="submit"
                            disabled={loading}
                            className="float-right rounded-md bg-customDropdownBorder px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-opacity-80 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? <InnerLoader loading={loading} /> : "Submit"}
                        </button>
                    </div>
                </Form>
            )}
        </Formik>
    );
};

export default EditClientsInfo;
