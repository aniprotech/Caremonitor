import React, { useMemo, useState } from "react";
import { Formik, Form, useFormikContext } from "formik";
import { teamsValidationSchema } from "../../../utils/validationSchema";
import TeamPersonalDetails from "./TeamPersonalDetails";
import { teamsInitialValues } from "../../../data/teams";
import { _post } from "../../../utils/ApiService";
import APIConfig from "../../../utils/ApiConfig";
import { showError, showSuccess } from "../../../utils/toaster";
import InnerLoader from "../../../components/Loader/InnerLoader";
import { useNavigate } from "react-router-dom";
import FormDraftAutosave, { clearFormDraft, readFormDraft, saveFormDraft } from "../../../components/Common/FormDraftAutosave";

function TeamDraftControls({ storageKey, status, setStatus }) {
    const { values } = useFormikContext();
    const saveDraft = () => setStatus(saveFormDraft(storageKey, values) ? "Draft saved" : "Draft could not be saved in this browser");
    return <div className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"><span aria-live="polite">{status || "Drafts save automatically in this browser"}</span><button type="button" className="font-medium text-blue-800 underline" onClick={saveDraft}>Save draft</button></div>;
}

const CreateTeamIndex = () => {
    const [mode, setMode] = useState("create");
    const [data, setData] = useState([]);
    const [activeComponent, setActiveComponent] = useState("TeamPersonalDetails");
    const [loading, setLoading] = useState(false);
    const draftKey = "caremonitor:carer-create-draft";
    const [draftStatus, setDraftStatus] = useState(() => readFormDraft(draftKey) ? "Draft recovered from this browser" : "");
    const navigate = useNavigate();

    const initialValues = useMemo(() => ({ ...teamsInitialValues(data), ...(readFormDraft(draftKey)?.values || {}) }), [data]);

    const handleCreateTeam = async (values) => {
        if (!values.email?.trim() && !String(values.primaryPhone || "").trim()) {
            showError("Enter at least an email address or a mobile number.");
            return;
        }
        setLoading(true);
        try {
            const response = await _post(APIConfig?.USERS?.CREATE, values);
            if(response?.data?.error === false){
                clearFormDraft(draftKey);
                navigate("/admin/teams")
            }
            setLoading(false);
            showSuccess(response?.data?.message)
        } catch (e) {
            setLoading(false);
            console.log(e?.response?.data?.message || "Network Error, please try again later.");
            showError(e?.response?.data?.message);
        }
    };

    const handleSubmit = (values) => {
        handleCreateTeam(values);
    };

    return (
        <Formik
            initialValues={initialValues}
            onSubmit={handleSubmit}
            validationSchema={teamsValidationSchema}
            validateOnChange={true}
            validateOnBlur={false}
        >
            <Form>
                <FormDraftAutosave storageKey={draftKey} onStatusChange={setDraftStatus} />
                <div className="relative flex min-h-screen flex-col gap-8 scroll-smooth bg-customBgGrey px-4 pb-10 md:px-12 md:py-10 lg:flex-row lg:px-40 lg:py-24 xl:px-64">
                    <div className="flex-1 space-y-10 bg-customBgGrey">
                        {/* Header */}
                        <div className="sticky:py-10 relative sticky top-14 z-10 flex items-center justify-between bg-customBgGrey py-5 xl:static xl:bg-customBgGrey xl:py-0">
                            <h1 className="text-2xl poppins-semibold text-gray-900 md:text-2xl">Personal Details</h1>
                        </div>

                        {/* Form Sections */}
                        <div className="">
                            <TeamPersonalDetails
                                name="TeamPersonalDetails"
                                id="TeamPersonalDetails"
                                activeComponent={activeComponent}
                                setActiveComponent={setActiveComponent}
                                mode={mode}
                                setMode={setMode}
                                data={data}
                                setData={setData}
                            />
                        </div>

                        <TeamDraftControls storageKey={draftKey} status={draftStatus} setStatus={setDraftStatus} />

                        <div className="w-full space-y-4">
                            <p className="text-sm italic text-customTextGrey1">
                                <span className="text-red-500">*</span> Note: Please make sure the required fields are filled.
                            </p>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full max-w-60 bg-customNavy1 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-80"
                            >
                                {loading ? (
                                    <InnerLoader
                                        loading={loading}
                                        text="Submitting..."
                                    />
                                ) : (
                                    "Submit"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </Form>
        </Formik>
    );
};

export default CreateTeamIndex;
