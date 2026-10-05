import React, { useEffect, useState } from "react";
import TextField from "../../../../../components/TextInput/TextInput";
import DropdownField from "../../../../../components/DropdownInput/Dropdown";
import { onBoardingDocumentCategoryOptions } from "../../../../../data/teams";
import FileUploadField from "../../../../../components/FileUploads/FileUploadField";
import ExpirySelector from "../../../../../components/DateRange/ExpirySelector";
import dayjs from "dayjs";
import { formatDisplayName, getCleanFileName } from "../../../../../utils/common";

const AdditionalDocumentsForm = ({
    values,
    handleChange,
    setFieldValue,
    uploadedList,
    setUploadedList,
    errors,
    paramsData,
    finalDocuments,
    setFinalDocuments,
}) => {
    const isUploadDisabled = !values?.additionalDocumentDescription;

    // State for documents returned from API
    const [apiDocumentList, setApiDocumentList] = useState(paramsData?.teamOnboardingAdditionalDocuments || []);

    // Track deleted document IDs from API response (optional for backend use)
    const [deletedDocumentIds, setDeletedDocumentIds] = useState([]);

    const handleAutoUpload = (file) => {
        if (!file || !values?.additionalDocumentDescription) return;

        const newEntry = {
            additionalDocumentDescription: values.additionalDocumentDescription,
            additionalDocumentCategory: values.additionalDocumentCategory,
            additionalDocumentFiles: file,
            uploadedAt: dayjs().format("MMMM D, YYYY"),
            additionalDocumentExpires: values.additionalDocumentExpires,
            additionalDocumentExpiresOn: values.additionalDocumentExpiresOn,
        };

        setUploadedList((prev) => [...prev, newEntry]);

        // Clear fields
        setFieldValue("additionalDocumentDescription", "");
        setFieldValue("additionalDocumentCategory", "");
        setFieldValue("additionalDocumentFiles", null);
        setFieldValue("additionalDocumentExpires", false);
        setFieldValue("additionalDocumentExpiresOn", null);
    };

    const handleDelete = (doc, index, source) => {
        if (source === "api") {
            setApiDocumentList((prev) => prev.filter((_, i) => i !== index));
            if (doc?.id) setDeletedDocumentIds((prev) => [...prev, doc.id]);
        } else if (source === "uploaded") {
            setUploadedList((prev) => prev.filter((_, i) => i !== index));
        }
    };

    // Combined list with source tags
    const combinedDocs = [
        ...apiDocumentList.map((doc, index) => ({ ...doc, __index: index, __source: "api" })),
        ...uploadedList.map((doc, index) => ({ ...doc, __index: index, __source: "uploaded" })),
    ];
    useEffect(() => {
        setFinalDocuments(combinedDocs);
    }, [apiDocumentList, deletedDocumentIds, uploadedList]);
    return (
        <>
            <h2 className="poppins-medium text-base text-customTextColor md:text-xl">Additional documents</h2>

            {combinedDocs?.length > 0 && (
                <div className="mt-6 space-y-4 py-5">
                    {combinedDocs.map((doc, idx) => (
                        <div
                            key={doc.id || `uploaded-${idx}`}
                            className="rounded border p-4 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {doc?.additionalDocumentDescription}
                                        {doc?.additionalDocumentCategory ? (
                                            <span className="ml-2 rounded-full border border-customBorder bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                                                {formatDisplayName(doc.additionalDocumentCategory)}
                                            </span>
                                        ) : null}
                                    </p>
                                    <p className="pt-2 text-sm text-gray-500">
                                        {getCleanFileName(doc?.additionaDocumentFilePath) ||
                                            getCleanFileName(doc?.additionalDocumentFiles?.name) ||
                                            "No file name"}
                                    </p>
                                    <p className="pb-1 text-xs text-gray-400">
                                        Uploaded{" "}
                                        {doc?.uploadedAt ? doc.uploadedAt : doc?.createdAt ? dayjs(doc.createdAt).format("MMMM D, YYYY") : "-"}
                                    </p>
                                    {doc.additionalDocumentExpires || doc.expires ? (
                                        <p className="poppins-medium mt-1 border-t pt-1 text-xs text-customTextColor">
                                            Expires on {dayjs(doc.additionalDocumentExpiresOn || doc.expiresOn).format("MMMM D, YYYY")}
                                        </p>
                                    ) : (
                                        <p className="poppins-medium mt-1 border-t pt-1 text-xs text-customTextColor">Never Expires</p>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleDelete(doc, doc.__index, doc.__source)}
                                    className="text-sm text-red-600 hover:underline"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <TextField
                label="Add an additional document"
                name="additionalDocumentDescription"
                value={values?.additionalDocumentDescription}
                valueChange={handleChange}
                componentName="FormikValidation"
                placeHolder="Add a description"
            />

            <DropdownField
                label="Document category"
                name="additionalDocumentCategory"
                value={values?.additionalDocumentCategory}
                valueChange={handleChange}
                options={onBoardingDocumentCategoryOptions}
                componentName="FormikValidation"
            />

            <ExpirySelector
                dueDate={values?.additionalDocumentExpiresOn}
                isNever={values?.additionalDocumentExpires}
                onNeverChange={(val) => setFieldValue("additionalDocumentExpires", val)}
                onDateChange={(date) => setFieldValue("additionalDocumentExpiresOn", date)}
            />

            <div
                className={`mt-4 ${isUploadDisabled ? "pointer-events-none opacity-80" : ""}`}
                title="Please add a description"
            >
                <FileUploadField
                    label=""
                    name="additionalDocumentFiles"
                    file={values?.additionalDocumentFiles}
                    setFile={(file) => {
                        setFieldValue("additionalDocumentFiles", file);
                        handleAutoUpload(file);
                    }}
                    accept="application/pdf,image/*"
                    error={errors?.additionalDocumentFiles}
                    description="Please make sure the description is added before uploading the file."
                />
            </div>
        </>
    );
};

export default AdditionalDocumentsForm;
