import React from "react";
import { useFormikContext } from "formik";
import useScrollToTop from "../../../../../hooks/useScrollToTop";
import RadioButtonGroup from "../../../../../components/TextInput/RadioButtonGroup";
import TextField from "../../../../../components/TextInput/TextInput";
import { clientsYesNoOptions } from "../../../../../constants/clientConstants";
import { useGlobalStore } from "../../../../../stores/useGlobalStore";

const EditFuturePlanning = () => {
    useScrollToTop();
    const { values, setFieldValue } = useFormikContext();
    const futurePlanning = values.futurePlanning || {};
    const { clientsPersonalDetailData } = useGlobalStore();
    const clientName = clientsPersonalDetailData ? `${clientsPersonalDetailData.firstName}` : 'the client';
    const lpaDetails = (prefix, label) => <div className="ml-0 grid gap-4 rounded border border-slate-200 bg-slate-50 p-4 md:ml-6 md:grid-cols-3">
        <TextField label={`${label} reference number (if known)`} name={`futurePlanning.${prefix}Reference`} value={futurePlanning[`${prefix}Reference`] || ""} valueChange={(e) => setFieldValue(`futurePlanning.${prefix}Reference`, e.target.value)} />
        <TextField label="Registered date (if known)" type="date" name={`futurePlanning.${prefix}Date`} value={futurePlanning[`${prefix}Date`] || ""} valueChange={(e) => setFieldValue(`futurePlanning.${prefix}Date`, e.target.value)} />
        <TextField label="End or revocation date (if applicable)" type="date" name={`futurePlanning.${prefix}Expiry`} value={futurePlanning[`${prefix}Expiry`] || ""} valueChange={(e) => setFieldValue(`futurePlanning.${prefix}Expiry`, e.target.value)} />
        <p className="text-xs text-slate-600 md:col-span-3">These optional details help staff find the verified LPA record. They do not confirm that an attorney has authority for a specific decision.</p>
    </div>;

    return (
        <div className="space-y-8 pb-20">
            {/* Capacity and Documentation Section */}
            <div
                id="capacity-documentation-section"
                className="scroll-mt-40 space-y-6 rounded-lg border border-gray-200 bg-white p-2 shadow md:p-6"
            >
                <h2 className="poppins-medium text-xl text-customDefaultTextColor">Capacity and Documentation</h2>

                <div className="space-y-6">
                    <RadioButtonGroup
                        label={`Has ${clientName} been assessed as having capacity to make decisions about their health and care?`}
                        name="futurePlanning.healthCapacityDecision"
                        value={futurePlanning.healthCapacityDecision || ""}
                        options={clientsYesNoOptions}
                        valueChange={(e) => setFieldValue("futurePlanning.healthCapacityDecision", e.target.value)}
                    />

                    <RadioButtonGroup
                        label={`Does ${clientName} have a health and welfare lasting power of attorney?`}
                        name="futurePlanning.healthWelfareLpa"
                        value={futurePlanning.healthWelfareLpa || ""}
                        options={clientsYesNoOptions}
                        valueChange={(e) => setFieldValue("futurePlanning.healthWelfareLpa", e.target.value)}
                    />
                    {futurePlanning.healthWelfareLpa === "YES" && lpaDetails("healthWelfareLpa", "Health and welfare LPA / POA")}

                    <RadioButtonGroup
                        label={`Does ${clientName} have a property and financial lasting power of attorney?`}
                        name="futurePlanning.propertyFinancialLpa"
                        value={futurePlanning.propertyFinancialLpa || ""}
                        options={clientsYesNoOptions}
                        valueChange={(e) => setFieldValue("futurePlanning.propertyFinancialLpa", e.target.value)}
                    />
                    {futurePlanning.propertyFinancialLpa === "YES" && lpaDetails("propertyFinancialLpa", "Property and financial LPA / POA")}

                    <RadioButtonGroup
                        label={`Does ${clientName} have a DNACPR (Do Not Attempt Cardiopulmonary Resuscitation) form?`}
                        name="futurePlanning.dnacpr"
                        value={futurePlanning.dnacpr || ""}
                        options={clientsYesNoOptions}
                        valueChange={(e) => setFieldValue("futurePlanning.dnacpr", e.target.value)}
                    />

                    <RadioButtonGroup
                        label={`Does ${clientName} have an ADRT (Advance Decision to Refuse Treatment)?`}
                        name="futurePlanning.adrt"
                        value={futurePlanning.adrt || ""}
                        options={clientsYesNoOptions}
                        valueChange={(e) => setFieldValue("futurePlanning.adrt", e.target.value)}
                    />

                    <RadioButtonGroup
                        label={`Does ${clientName} have a ReSPECT (Recommended Summary Plan for Emergency Care and Treatment) form?`}
                        name="futurePlanning.respect"
                        value={futurePlanning.respect || ""}
                        options={clientsYesNoOptions}
                        valueChange={(e) => setFieldValue("futurePlanning.respect", e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};

export default EditFuturePlanning;
