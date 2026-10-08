import React from "react";
import { useFormikContext } from "formik";
import TextAreaField from "../../../../../components/TextInput/TextAreaField";
import TextField from "../../../../../components/TextInput/TextInput";
import useScrollToTop from "../../../../../hooks/useScrollToTop";
import ClinicalAutocomplete from "../../../../../components/ClinicalAutocomplete/ClinicalAutocomplete";
import RadioButtonGroup from "../../../../../components/TextInput/RadioButtonGroup";
import PhoneNumberField from "../../../../../components/DropdownInput/PhoneNumberDropdown";
import { getClientsClinicalMedicalSupportOptions } from "../../../../../constants/clientConstants";
import { useGlobalStore } from "../../../../../stores/useGlobalStore";

const EditClinicalDetails = () => {
    useScrollToTop();
    const { values, setFieldValue } = useFormikContext();
    const clinicalDetails = values.clinicalDetails || {};
    const { clientsPersonalDetailData } = useGlobalStore();
    const clientName = clientsPersonalDetailData ? `${clientsPersonalDetailData.firstName}` : 'the client';

    return (
        <div className="space-y-8 pb-20">
            {/* Health Details Section */}
            <div
                id="health-details-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-2 shadow md:p-6"
            >
                <h2 className="poppins-medium text-xl text-customDefaultTextColor">Health Details</h2>

                <TextField
                    label={`${clientName}'s NHS number`}
                    name="clinicalDetails.nhsNumber"
                    type="text"
                    value={clinicalDetails.nhsNumber || ""}
                    valueChange={(e) => setFieldValue("clinicalDetails.nhsNumber", e.target.value)}
                />
                <p className="text-xs text-gray-600">The 10-digit format and check digit are checked on save. This does not confirm the number belongs to this client; confirm it against an NHS record.</p>

                <ClinicalAutocomplete
                    label={`${clientName}'s medical history`}
                    kind="history"
                    value={clinicalDetails.medicalHistory || []}
                    onChange={(value) => setFieldValue("clinicalDetails.medicalHistory", value)}
                    multiple
                />
                <ClinicalAutocomplete label="Hospital (if applicable)" kind="hospital" value={clinicalDetails.hospitalName || ""} onChange={(value) => setFieldValue("clinicalDetails.hospitalName", value)} />

                <RadioButtonGroup
                    label={`Does ${clientName} require medication support?`}
                    name="clinicalDetails.medicalSupport"
                    value={clinicalDetails.medicalSupport || false}
                    options={getClientsClinicalMedicalSupportOptions(clientName)}
                    valueChange={(e) => setFieldValue("clinicalDetails.medicalSupport", e.target.value)}
                />
            </div>

            {/* Allergies and Intolerances Section */}
            <div
                id="allergies-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-2 shadow md:p-6"
            >
                <h2 className="poppins-medium text-xl text-customDefaultTextColor">Allergies and Intolerances</h2>

                <TextAreaField
                    label={`Does ${clientName} have any allergies or intolerances? How do they impact their care needs?`}
                    name="clinicalDetails.allergiesIntolerances"
                    value={clinicalDetails.allergiesIntolerances || ""}
                    valueChange={(e) => setFieldValue("clinicalDetails.allergiesIntolerances", e.target.value)}
                />
            </div>

            {/* Doctor/GP Section */}
            <div
                id="doctor-gp-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-2 shadow md:p-6"
            >
                <h2 className="poppins-medium text-xl text-customDefaultTextColor">Doctor/GP</h2>

                <TextField
                    label={`${clientName}'s GP practice name`}
                    name="clinicalDetails.gpPracticeName"
                    type="text"
                    value={clinicalDetails.gpPracticeName || ""}
                    valueChange={(e) => setFieldValue("clinicalDetails.gpPracticeName", e.target.value)}
                />

                <TextField
                    label={`${clientName}'s GP practice identifier`}
                    name="clinicalDetails.gpPracticeIdentifier"
                    type="text"
                    value={clinicalDetails.gpPracticeIdentifier || ""}
                    valueChange={(e) => setFieldValue("clinicalDetails.gpPracticeIdentifier", e.target.value)}
                />

                <TextField
                    label={`${clientName}'s GP's name`}
                    name="clinicalDetails.gpName"
                    type="text"
                    value={clinicalDetails.gpName || ""}
                    valueChange={(e) => setFieldValue("clinicalDetails.gpName", e.target.value)}
                />

                <TextField
                    label="Phone number"
                    name="clinicalDetails.gpPhoneNumber"
                    type="tel"
                    value={clinicalDetails.gpPhoneNumber || ""}
                    valueChange={(e) => setFieldValue("clinicalDetails.gpPhoneNumber", e.target.value)}
                />
            </div>

            {/* Pharmacist Section */}
            <div
                id="pharmacist-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-2 shadow md:p-6"
            >
                <h2 className="poppins-medium text-xl text-customDefaultTextColor">Pharmacist</h2>

                <TextField
                    label={`${clientName}'s pharmacy name`}
                    name="clinicalDetails.pharmacyName"
                    type="text"
                    value={clinicalDetails.pharmacyName || ""}
                    valueChange={(e) => setFieldValue("clinicalDetails.pharmacyName", e.target.value)}
                />

                <PhoneNumberField
                    label="Phone number"
                    phoneName="clinicalDetails.pharmacyPhoneNumber"
                    phoneValue={clinicalDetails.pharmacyPhoneNumber || ""}
                    phoneChange={(e) => setFieldValue("clinicalDetails.pharmacyPhoneNumber", e.target.value)}
                    countryValue={clinicalDetails.pharmacyPhoneCode || "+44"}
                    countryChange={(val) => setFieldValue("clinicalDetails.pharmacyPhoneCode", val)}
                />

                <TextField
                    label="Address"
                    name="clinicalDetails.pharmacyAddress"
                    type="text"
                    value={clinicalDetails.pharmacyAddress || ""}
                    valueChange={(e) => setFieldValue("clinicalDetails.pharmacyAddress", e.target.value)}
                />

                <TextField
                    label="Post code"
                    name="clinicalDetails.pharmacyPostCode"
                    type="text"
                    value={clinicalDetails.pharmacyPostCode || ""}
                    valueChange={(e) => setFieldValue("clinicalDetails.pharmacyPostCode", e.target.value)}
                />

                <details className="rounded border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer font-medium text-customTextNavy">Other</summary>
                    <div className="mt-4">
                        <TextAreaField
                            label="Provide more information about medication ordering, collection and storing"
                            name="clinicalDetails.pharmacyOtherInformation"
                            value={clinicalDetails.pharmacyOtherInformation || ""}
                            valueChange={(e) => setFieldValue("clinicalDetails.pharmacyOtherInformation", e.target.value)}
                        />
                    </div>
                </details>
            </div>
        </div>
    );
};

export default EditClinicalDetails;
