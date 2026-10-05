import PropTypes from "prop-types";
import { Formik, Form } from "formik";
import AssessmentFormField from "../../../../../../components/FormFields/AssessmentFormField";
import { useEffect, useState, useRef } from "react";
import { SquarePen, X } from "lucide-react";
import TextAreaField from "../../../../../../components/TextInput/TextAreaField";
import RadioButtonGroup from "../../../../../../components/TextInput/RadioButtonGroup";
import { generateInitialValues, shouldShowQuestion, shouldShowDetails } from "../AssessmentFormUtils";
import { _post, _get, _delete } from "../../../../../../utils/ApiService";
import { showError, showSuccess } from "../../../../../../utils/toaster";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { createOrUpdateInitialAssessmentAPI, getAssessmentByIdAPI, deleteAssessmentAPI } from "../initialAssessmentApiEndpoint/initialAssessmentAPI";
import InnerLoader from "../../../../../../components/Loader/InnerLoader";
import DotLoader from "../../../../../../components/Loader/DotLoader";
import { createOrUpdateAdditionalAssessmentAPI, deleteAdditionalAssessmentAPI, getAdditionalAssessmentByIdAPI } from "../additionalAssessmentAPIEndpoint/assessmentAPIEndpoint";

const AssessmentForm = ({
    isUpdateMode = false,
    assessmentType,
    initialData = {},
    onSubmit,
    clientName,
    sections,
    assessmentName,
    onAssessmentNameChange,
    assessmentId = null,
    onAssessmentUpdate,
    assessmentPageType,
}) => {
    const { id: clientId } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const questions = sections.reduce((acc, section) => [...acc, ...section.questions], []);
    const [localAssessmentName, setLocalAssessmentName] = useState(assessmentName || "");
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [tempAssessmentName, setTempAssessmentName] = useState("");
    const [reviewDetails, setReviewDetails] = useState(null);
    const [reviewAdditionalDetails, setReviewAdditionalDetails] = useState("");
    const [isSubmittingAPI, setIsSubmittingAPI] = useState(false);
    const [formData, setFormData] = useState(initialData);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const mode = searchParams.get("mode");
    const urlAssessmentId = searchParams.get("id");
    const urlUpdateId = searchParams.get("updateId");
    const isReviewMode = mode === "review";
    const isCreateMode = mode === "create";

    const dataLoadingId = isCreateMode ? null : urlAssessmentId;
    const currentAssessmentId = assessmentId || urlUpdateId || urlAssessmentId;

    const assessmentTypeOnPage = assessmentPageType;

    useEffect(() => {
        const loadAssessmentData = async () => {
            if ((isUpdateMode || isReviewMode) && dataLoadingId) {
                try {
                    setIsLoadingData(true);
                    const endpoint = assessmentTypeOnPage === "Additional_Assessment" ? getAdditionalAssessmentByIdAPI(assessmentType, dataLoadingId) : getAssessmentByIdAPI(assessmentType, dataLoadingId);

                    if (!endpoint) {
                        throw new Error("API endpoint not configured for this assessment type");
                    }

                    const response = await _get(endpoint);

                    if (response?.data?.error === false) {
                        const assessmentData = response.data.results.data;

                        const transformedData = {};

                        questions.forEach((question) => {
                            const questionData = assessmentData[question.id];
                            if (questionData) {
                                transformedData[question.id] = questionData.answer || "";

                                if (questionData.details) {
                                    transformedData[`${question.id}_details`] = questionData.details;
                                }
                            }
                        });

                        setFormData(transformedData);

                        isInitializedRef.current = false;

                        const assessmentName =
                            assessmentData?.name ||
                            assessmentData?.assessmentName ||
                            assessmentData?.title ||
                            assessmentData?.conditionName ||
                            assessmentData?.productName;

                        if (assessmentName) {
                            setLocalAssessmentName(assessmentName);
                        }

                        if (assessmentData.reviewOutcome && assessmentData.reviewInprogress === false) {
                            setReviewDetails(assessmentData.reviewOutcome);
                        }

                        if (assessmentData.reviewDetails && assessmentData.reviewInprogress === false) {
                            setReviewAdditionalDetails(assessmentData.reviewDetails);
                        }

                        autoSaveOriginalData(assessmentData);
                    } else {
                        throw new Error(response?.data?.message || "No assessment data found");
                    }
                } catch (error) {
                    console.error("Error loading assessment data:", error);
                    const errorMessage = error?.response?.data?.message || error?.message || "Failed to load assessment data. Please try again.";
                    showError(errorMessage);
                } finally {
                    setIsLoadingData(false);
                }
            }
        };

        loadAssessmentData();
    }, [isUpdateMode, isReviewMode, dataLoadingId, assessmentType]);

    useEffect(() => {
        if (!currentAssessmentId || (!isUpdateMode && !isReviewMode && !isCreateMode)) return;

        if (isCreateMode) {
            const initialValues = generateInitialValues(questions);
            autoSave(initialValues);
        }
    }, [currentAssessmentId, isUpdateMode, isReviewMode, isCreateMode]);

    useEffect(() => {
        setLocalAssessmentName(assessmentName || "");
    }, [assessmentName]);

    useEffect(() => {
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, []);

    const handleNameChange = (e) => {
        const newName = e.target.value;
        setTempAssessmentName(newName);
    };

    const handleEditClick = () => {
        setTempAssessmentName(localAssessmentName);
        setIsEditDialogOpen(true);
    };

    const handleEditConfirm = () => {
        if (tempAssessmentName.trim()) {
            setLocalAssessmentName(tempAssessmentName);
            onAssessmentNameChange(tempAssessmentName);
            setIsEditDialogOpen(false);
        }
    };

    const autoSaveOriginalData = async (originalData) => {
        if (!currentAssessmentId || isAutoSaving) return;

        try {
            setIsAutoSaving(true);

            const dataToSave = {
                ...originalData,
                id: currentAssessmentId,
            };

            if (isReviewMode) {
                dataToSave.assessmentInprogress = null;
                dataToSave.reviewInprogress = true;
            }

            if (isUpdateMode || isCreateMode) {
                dataToSave.assessmentInprogress = true;
                dataToSave.reviewInprogress = null;
            }

            const endpoint = assessmentTypeOnPage === "Additional_Assessment" ? createOrUpdateAdditionalAssessmentAPI(assessmentType, "update", currentAssessmentId, clientId) : createOrUpdateInitialAssessmentAPI(assessmentType, "update", currentAssessmentId, clientId);
            await _post(endpoint, dataToSave);

        } catch (error) {
            console.error("Auto-save original data error:", error);
            showError("Failed to auto-save assessment. Please try again later.");
        } finally {
            setIsAutoSaving(false);
        }
    };

    const autoSave = async (values) => {
        if (!currentAssessmentId || isAutoSaving) return;

        try {
            setIsAutoSaving(true);

            const transformedData = {};
            questions.forEach((question) => {
                let answer = values[question.id];

                if (answer && typeof answer === "object" && answer.answer !== undefined) {
                    answer = answer.answer;
                }

                if (answer instanceof Date) {
                    answer = answer.toISOString();
                } else if (typeof answer === "object" && answer !== null && !Array.isArray(answer)) {
                    try {
                        answer = JSON.stringify(answer);
                    } catch {
                        console.warn("Could not serialize answer object:", answer);
                        answer = "";
                    }
                }

                const details = question.show_details || question.has_note ? values[`${question.id}_details`] || "" : "";

                transformedData[question.id] = {
                    answer: answer !== undefined && answer !== null ? answer : "",
                    details: details,
                };
            });

            if (isReviewMode) {
                transformedData.assessmentInprogress = null;
                transformedData.reviewInprogress = true;
            }

            if (localAssessmentName?.trim() && (isUpdateMode || isCreateMode)) {
                transformedData.name = localAssessmentName;
              }

            if (isUpdateMode || isCreateMode) {
                transformedData.assessmentInprogress = true;
                transformedData.reviewInprogress = null;
            }

            transformedData.id = currentAssessmentId;

            const endpoint = assessmentTypeOnPage === "Additional_Assessment" ? createOrUpdateAdditionalAssessmentAPI(assessmentType, "update", currentAssessmentId, clientId) : createOrUpdateInitialAssessmentAPI(assessmentType, "update", currentAssessmentId, clientId);
            await _post(endpoint, transformedData);
        } catch (error) {
            console.error("Auto-save error:", error);
            showError("Failed to auto-save assessment. Please try again later.");
        } finally {
            setIsAutoSaving(false);
        }
    };

    const handleDeleteAssessment = () => {
        setShowDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (!currentAssessmentId) {
            showError("No assessment ID available for deletion");
            return;
        }

        try {
            setIsDeleting(true);
            const endpoint = assessmentTypeOnPage === "Additional_Assessment" ? deleteAdditionalAssessmentAPI(assessmentType, currentAssessmentId) : deleteAssessmentAPI(assessmentType, currentAssessmentId);

            if (!endpoint) {
                throw new Error("Delete API endpoint not configured");
            }

            const response = await _delete(endpoint);

            if (response?.data?.error === false) {
                showSuccess("Assessment deleted successfully");
                setShowDeleteDialog(false);

                if (onAssessmentUpdate) {
                    onAssessmentUpdate();
                }

                navigate(-1);
            } else {
                throw new Error(response?.data?.message || "Failed to delete assessment");
            }
        } catch (error) {
            console.error("Error deleting assessment:", error);
            const errorMessage = error?.response?.data?.message || error?.message || "Failed to delete assessment. Please try again.";
            showError(errorMessage);
        } finally {
            setIsDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteDialog(false);
    };

    const canSubmit = () => {
        if (
            (assessmentType === "condition-specific" || assessmentType === "control-substances" || assessmentType === "mental-capacity") &&
            !localAssessmentName.trim()
        ) {
            return false;
        }

        if (isReviewMode && !reviewDetails) {
            return false;
        }

        return true;
    };

    const getSubmitButtonText = () => {
        if (isUpdateMode) return "Update";
        if (isReviewMode) return "Complete Review";
        if (isCreateMode) return "Submit";
        return "Submit";
    };

    const getLoadingText = () => {
        if (isUpdateMode) return "Updating...";
        if (isReviewMode) return "Reviewing...";
        if (isCreateMode) return "Submitting...";
        return "Creating...";
    };

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            if (
                (assessmentType === "condition-specific" || assessmentType === "control-substances" || assessmentType === "mental-capacity") &&
                !localAssessmentName.trim()
            ) {
                showError("Please enter a name for this assessment");
                setSubmitting(false);
                return;
            }

            if (isReviewMode && !reviewDetails) {
                showError("Please select a review outcome before completing the review");
                setSubmitting(false);
                return;
            }

            setIsSubmittingAPI(true);

            const transformedData = {};
            questions.forEach((question) => {
                let answer = values[question.id];

                if (answer && typeof answer === "object" && answer.answer !== undefined) {
                    answer = answer.answer;
                }

                if (answer instanceof Date) {
                    answer = answer.toISOString();
                } else if (typeof answer === "object" && answer !== null && !Array.isArray(answer)) {
                    try {
                        answer = JSON.stringify(answer);
                    } catch {
                        console.warn("Could not serialize answer object:", answer);
                        answer = "";
                    }
                }

                const details = question.show_details || question.has_note ? values[`${question.id}_details`] || "" : "";

                transformedData[question.id] = {
                    answer: answer !== undefined && answer !== null ? answer : "",
                    details: details,
                };
            });

            transformedData.reviewInprogress = isReviewMode ? false : null;
            transformedData.assessmentInprogress = isUpdateMode || isCreateMode ? false : null;
            if (localAssessmentName?.trim() && (isUpdateMode || isCreateMode)) {
                transformedData.name = localAssessmentName;
              }
              
            if (isReviewMode) {
                transformedData.reviewOutcome = reviewDetails;
                transformedData.reviewDetails = reviewAdditionalDetails;
            }

            const apiPayload = transformedData;

            if ((isUpdateMode || isReviewMode || isCreateMode) && currentAssessmentId) {
                apiPayload.id = currentAssessmentId;
            }

            const operation = isUpdateMode || isReviewMode || isCreateMode ? "update" : "create";
            const endpoint = assessmentTypeOnPage === "Additional_Assessment" ? createOrUpdateAdditionalAssessmentAPI(assessmentType, operation, currentAssessmentId, clientId) : createOrUpdateInitialAssessmentAPI(assessmentType, operation, currentAssessmentId, clientId);

            const response = operation === "update" ? await _post(endpoint, apiPayload) : await _post(endpoint, apiPayload);

            if (response?.data?.error === false) {
                const successMessage = isUpdateMode
                    ? "Assessment updated successfully"
                    : isReviewMode
                      ? "Assessment review completed successfully"
                      : isCreateMode
                        ? "Assessment submitted successfully"
                        : "Assessment created successfully";
                showSuccess(successMessage);

                if (onSubmit) {
                    onSubmit(transformedData);
                }

                if (onAssessmentUpdate) {
                    onAssessmentUpdate();
                }
            } else {
                throw new Error(response?.data?.message || `Failed to ${operation} assessment`);
            }
        } catch (error) {
            console.error("Error submitting assessment:", error);
            const errorMessage =
                error?.response?.data?.message ||
                error.message ||
                `Failed to ${isUpdateMode ? "update" : isReviewMode ? "review" : isCreateMode ? "submit" : "create"} assessment`;
            showError(errorMessage);
        } finally {
            setSubmitting(false);
            setIsSubmittingAPI(false);
            navigate(`/admin/clients/${clientId}/care-plan/${assessmentType}`);
        }
    };

    const isReviewTrue = isReviewMode;
    const [formValues, setFormValues] = useState({});
    const autoSaveTimeoutRef = useRef(null);
    const prevValuesRef = useRef({});
    const isInitializedRef = useRef(false);

    const FormObserver = ({ values }) => {
        useEffect(() => {
            if (!currentAssessmentId || (!isUpdateMode && !isReviewMode && !isCreateMode)) return;

            if (isCreateMode) {
                if (!isInitializedRef.current) {
                    isInitializedRef.current = true;
                    prevValuesRef.current = { ...values };
                    return;
                }
            } else {
                if (!isInitializedRef.current || !formData || Object.keys(formData).length === 0) {
                    isInitializedRef.current = true;
                    prevValuesRef.current = { ...values };
                    return;
                }
            }

            try {
                const safeStringify = (obj) => {
                    return JSON.stringify(obj, (key, value) => {
                        if (value instanceof Date) {
                            return value.toISOString();
                        }
                        if (typeof value === "object" && value !== null) {
                            if (seen.has(value)) {
                                return "[Circular]";
                            }
                            seen.add(value);
                        }
                        return value;
                    });
                };

                let seen = new Set();
                const valuesString = safeStringify(values);
                seen = new Set();
                const prevValuesString = safeStringify(prevValuesRef.current);

                if (valuesString !== prevValuesString && Object.keys(values).length > 0) {
                    prevValuesRef.current = { ...values };

                    if (autoSaveTimeoutRef.current) {
                        clearTimeout(autoSaveTimeoutRef.current);
                    }

                    autoSaveTimeoutRef.current = setTimeout(() => {
                        setFormValues({ ...values });
                    }, 1000);
                }
            } catch (error) {
                console.error("Error in FormObserver:", error);
            }
        }, [values]);

        return null;
    };

    FormObserver.propTypes = {
        values: PropTypes.object.isRequired,
    };

    useEffect(() => {
        if (!currentAssessmentId || (!isUpdateMode && !isReviewMode && !isCreateMode) || !Object.keys(formValues).length) return;

        if (isCreateMode) {
            const initialValues = generateInitialValues(questions);

            try {
                const isInitialValues = JSON.stringify(formValues) === JSON.stringify(initialValues);
                if (isInitialValues) {
                    return;
                }

                autoSave(formValues);
            } catch (error) {
                console.error("Error in auto-save effect (create mode):", error);
            }
        } else {
            if (!isInitializedRef.current || !formData || Object.keys(formData).length === 0) return;

            const initialValues = generateInitialValues(questions);

            try {
                const isInitialValues = JSON.stringify(formValues) === JSON.stringify(initialValues);
                const isUnchangedFromLoadedData =
                    formData && Object.keys(formData).length > 0 && JSON.stringify(formValues) === JSON.stringify(formData);

                if (isInitialValues || isUnchangedFromLoadedData) {
                    return;
                }

                autoSave(formValues);
            } catch (error) {
                console.error("Error in auto-save effect:", error);
            }
        }
    }, [formValues, formData, isCreateMode]);

    if (isLoadingData) {
        return <DotLoader loading={true} />;
    }

    return (
        <>
            <Formik
                initialValues={
                    formData && Object.keys(formData).length > 0
                        ? formData
                        : initialData && Object.keys(initialData).length > 0
                          ? initialData
                          : generateInitialValues(questions)
                }
                onSubmit={handleSubmit}
                enableReinitialize
            >
                {({ isSubmitting, values }) => {
                    return (
                        <Form className="space-y-8 rounded-lg bg-white p-6">
                            <FormObserver values={values} />
                            {(assessmentType === "control-substances" ||
                                assessmentType === "condition-specific" ||
                                assessmentType === "mental-capacity") && (
                                <div className="mb-6 rounded-lg bg-gray-50 p-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">
                                                    {assessmentType === "control-substances"
                                                        ? "Product Name"
                                                        : assessmentType === "mental-capacity"
                                                          ? "What decision needs to be made that requires a mental capacity assessment?"
                                                          : "Condition Name"}
                                                </label>
                                                <p className="text-base font-medium text-gray-900">{localAssessmentName ? localAssessmentName : "-"}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleEditClick}
                                                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                                            >
                                                <SquarePen size={16} />
                                                <span>Edit</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isEditDialogOpen && (
                                <div className="fixed inset-0 z-50 overflow-y-auto">
                                    <div className="flex min-h-screen items-center justify-center">
                                        <div
                                            className="fixed inset-0 bg-black opacity-30"
                                            onClick={() => setIsEditDialogOpen(false)}
                                        />

                                        <div className="relative mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
                                            <div className="mb-4 flex items-center justify-between">
                                                <h3 className="text-lg font-medium">
                                                    Edit{" "}
                                                    {assessmentType === "control-substances"
                                                        ? "Product Name"
                                                        : assessmentType === "mental-capacity"
                                                          ? "Decision"
                                                          : "Condition Name"}
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditDialogOpen(false)}
                                                    className="text-gray-400 hover:text-gray-500"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                <input
                                                    type="text"
                                                    value={tempAssessmentName}
                                                    onChange={handleNameChange}
                                                    placeholder={`Enter ${assessmentType === "control-substances" ? "product" : "condition"} name`}
                                                    className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-customFeedCardBlueText focus:outline-none"
                                                />

                                                <div className="flex justify-end space-x-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsEditDialogOpen(false)}
                                                        className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleEditConfirm}
                                                        className="rounded bg-customNavy px-4 py-2 text-sm text-white hover:bg-customNavy/90"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {sections.map(({ id: sectionId, label: sectionLabel, questions: sectionQuestions }) => (
                                <div
                                    key={sectionId}
                                    id={sectionId}
                                    className="space-y-6"
                                >
                                    <div className="border-b border-gray-200 pb-4">
                                        <h2 className="text-lg font-medium capitalize text-gray-900">{sectionLabel}</h2>
                                    </div>

                                    <div className="space-y-6">
                                        {sectionQuestions.map((question) => {
                                            if (!shouldShowQuestion(question, values)) {
                                                return null;
                                            }

                                            return (
                                                <div key={question.id}>
                                                    <AssessmentFormField
                                                        field={{
                                                            ...question,
                                                            section: sectionId,
                                                            showDetails: shouldShowDetails(question, values),
                                                        }}
                                                        clientName={clientName}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {isReviewTrue && (
                                <>
                                    <div className="">
                                        <h2 className="poppins-medium mb-2 text-base text-customBlack">Review details</h2>
                                        <p className="mb-6 text-sm text-customGrey1">
                                            Review details will only be visible on the agency hub. This section will not be displayed in the carer app
                                            or care plan PDF.
                                        </p>
                                    </div>

                                    <RadioButtonGroup
                                        label={"How would you define the outcome of this review?"}
                                        name={"review_details"}
                                        value={reviewDetails}
                                        options={[
                                            {
                                                value: "NO_CHANGES",
                                                label: "No changes required",
                                            },
                                            {
                                                value: "MINOR_CHANGES",
                                                label: "Minor changes required",
                                            },
                                            {
                                                value: "MAJOR_CHANGES",
                                                label: "Major changes required",
                                            },
                                        ]}
                                        valueChange={(e) => setReviewDetails(e.target.value)}
                                        error={!reviewDetails && isReviewMode}
                                    />

                                    {!reviewDetails && isReviewMode && (
                                        <div className="mt-2 text-sm text-red-600">Please select a review outcome before completing the review</div>
                                    )}

                                    <TextAreaField
                                        label="Additional details"
                                        name={"review_details_details"}
                                        value={reviewAdditionalDetails}
                                        valueChange={(e) => setReviewAdditionalDetails(e.target.value)}
                                        placeHolder={
                                            "Add any additional details that will be helpful when auditing, eg: Significant changes, actions taken"
                                        }
                                    />
                                </>
                            )}

                            <div className="mt-8 flex justify-end space-x-4">
                                {currentAssessmentId && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteAssessment}
                                        className="rounded border border-gray-300 px-4 py-2 text-sm text-customTextNavy hover:text-customTextNavy/80"
                                        disabled={isSubmitting || isSubmittingAPI}
                                    >
                                        Delete Assessment
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSubmitting || isSubmittingAPI || !canSubmit()}
                                    className="poppins-semibold flex min-w-[120px] items-center justify-center rounded bg-customDropdownBorder px-6 py-2 text-sm text-white transition-colors hover:bg-customDropdownBorder/90 disabled:opacity-50"
                                >
                                    {isSubmitting || isSubmittingAPI ? (
                                        <InnerLoader
                                            loading={true}
                                            text={getLoadingText()}
                                        />
                                    ) : (
                                        <>
                                            <span>{getSubmitButtonText()}</span>
                                            {isAutoSaving && (
                                                <div className="ml-2 h-3 w-3 animate-spin rounded-full border-2 border-white/50 border-t-transparent"></div>
                                            )}
                                        </>
                                    )}
                                </button>
                            </div>
                        </Form>
                    );
                }}
            </Formik>

            {/* Delete Confirmation Dialog - Same design as NeedsAssessment */}
            {showDeleteDialog && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex min-h-screen items-center justify-center">
                        <div
                            className="fixed inset-0 bg-black opacity-30"
                            onClick={handleDeleteCancel}
                        />

                        <div className="relative mx-auto w-full max-w-xl rounded border border-gray-300 bg-white px-6 py-3 shadow-lg">
                            <div className="mb-4 flex items-center justify-between border-b border-gray-300 pb-2 pt-3">
                                <h3 className="text-base font-medium text-customBlack">Delete assessment</h3>
                                <button
                                    type="button"
                                    onClick={handleDeleteCancel}
                                    className="text-gray-400 hover:text-gray-500"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="mb-6 py-4">
                                <p className="text-sm text-customBlack2">
                                    Are you sure you want to delete this assessment? Any changes you have made will be lost.
                                </p>
                            </div>

                            <div className="flex justify-end space-x-3 border-t border-gray-300 pt-3">
                                <button
                                    type="button"
                                    onClick={handleDeleteCancel}
                                    className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteConfirm}
                                    className="flex min-w-[80px] items-center justify-center rounded bg-customDropdownBorder px-4 py-2 text-sm text-white hover:bg-customDropdownBorder/90 disabled:opacity-50"
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <InnerLoader
                                            loading={true}
                                            text="Deleting..."
                                        />
                                    ) : (
                                        "Delete"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

AssessmentForm.propTypes = {
    isUpdateMode: PropTypes.bool,
    assessmentType: PropTypes.string.isRequired,
    initialData: PropTypes.object,
    onSubmit: PropTypes.func,
    clientName: PropTypes.string,
    sections: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
            questions: PropTypes.arrayOf(PropTypes.object).isRequired,
        }),
    ).isRequired,
    assessmentName: PropTypes.string,
    onAssessmentNameChange: PropTypes.func.isRequired,
    assessmentId: PropTypes.string,
    onAssessmentUpdate: PropTypes.func,
    assessmentPageType: PropTypes.string,
};

export default AssessmentForm;
