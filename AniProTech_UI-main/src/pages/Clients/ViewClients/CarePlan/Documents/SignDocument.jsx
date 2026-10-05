import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, Trash2, Calendar, PlusCircle, FileText } from "lucide-react";
import { useFormik } from "formik";
import useScrollToTop from "../../../../../hooks/useScrollToTop";
import TextField from "../../../../../components/TextInput/TextInput";
import DropdownField from "../../../../../components/DropdownInput/Dropdown";
import { useGlobalStore } from "../../../../../stores/useGlobalStore";
import { signatureRoleOptions } from "../../../../../data/clients/clientCarePlanData";
import { signatureValidationSchema } from "../../../../../utils/validations/clients/clientsCarePlanValidation";
import APIConfig from "../../../../../utils/ApiConfig";
import { _get, _post, _delete } from "../../../../../utils/ApiService";
import { showError, showSuccess } from "../../../../../utils/toaster";
import DotLoader from "../../../../../components/Loader/DotLoader";
import ConfirmationDialog from "../../../../../components/shared/ConfirmationDialog";

const SignDocument = () => {
    const navigate = useNavigate();
    const { id: clientIdFromParams } = useParams();
    const { clientsPersonalDetailData } = useGlobalStore();
    const clientId = clientIdFromParams || clientsPersonalDetailData?.id;
    const clientName = clientsPersonalDetailData?.firstName || "the client";

    useScrollToTop();

    const [isLoading, setIsLoading] = useState(true);
    const [pack, setPack] = useState(null);
    const [filteredDocs, setFilteredDocs] = useState([]);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [currentNote, setCurrentNote] = useState("");
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [saving, setSaving] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [hasPackResponse, setHasPackResponse] = useState(false);
    const [documentNotes, setDocumentNotes] = useState({});
    const [signedSignatories, setSignedSignatories] = useState({});
    const [selectedDocForNote, setSelectedDocForNote] = useState(null);

    useEffect(() => {
        fetchPack();
    }, [clientId]);

    const fetchPack = async () => {
        setIsLoading(true);
        try {
            const packRes = await _get(APIConfig.CLIENT_SIGNATURE_DOCUMENTS.GET_PACK_DETAILS(clientId));
            const uploadedDocsRes = await _get(APIConfig.CLIENT_SIGNATURE_DOCUMENTS.GET_ALL_UPLOADED_DOCUMENTS(clientId));

            if (!packRes?.data || packRes?.data?.results?.data?.status !== "IN_PROGRESS") {
                navigate(`/admin/clients/${clientId}/care-plan/signature-document`);
                return;
            }

            const packData = packRes.data.results.data;
            const allUploadedDocs = uploadedDocsRes.data.results.data || [];

            const selectedDocIds = packData.documents || [];
            const filteredDocuments = allUploadedDocs.filter((doc) => selectedDocIds.includes(doc.id));

            setPack(packData);
            setFilteredDocs(filteredDocuments);
            setHasPackResponse(true);
        } catch (err) {
            console.log(err);
            navigate(`/admin/clients/${clientId}/care-plan/signature-document`);
        } finally {
            setIsLoading(false);
        }
    };

    const formik = useFormik({
        initialValues: {
            signatories: [{ type: "main", name: "", role: "",note : "", agreed: false }],
        },
        validationSchema: signatureValidationSchema,
        onSubmit: async (values) => {
            setSaving(true);
            try {
                const notesArray =
                    filteredDocs?.map((doc) => ({
                        documentId: doc.id,
                        notes: documentNotes[doc.id] || "No Notes Available",
                    })) || [];

                await _post(APIConfig.CLIENT_SIGNATURE_DOCUMENTS.SAVE_SIGNED_DOCUMENT(), {
                    clientId,
                    documentPackId: pack.id,
                    signatories: values.signatories.map(({ name, role, note }) => ({ 
                        name, 
                        role, 
                        note: role === "Other" ? note : null 
                    })),
                    documentNotes: notesArray,
                });
                showSuccess("Document signed successfully");
                await _delete(APIConfig.CLIENT_SIGNATURE_DOCUMENTS.DELETE_PACK(pack.id));
                navigate(`/admin/clients/${clientId}/care-plan/signature-document`);
            } catch (err) {
                showError(err?.response?.data?.message || "Failed to sign document");
            } finally {
                setSaving(false);
            }
        },
    });

    const signatureCount = formik.values.signatories.filter((sig) => sig.agreed).length;

    const handleAddSignatory = () => {
        const newSignatories = [
            ...formik.values.signatories,
            {
                id: Date.now(),
                type: "additional",
                name: "",
                role: "",
                agreed: false,
            },
        ];
        formik.setFieldValue("signatories", newSignatories);
    };

    const handleRemoveSignatory = (id) => {
        const newSignatories = formik.values.signatories.filter((sig) => sig.id !== id || sig.type === "main");
        formik.setFieldValue("signatories", newSignatories);
    };

    const handleSignOff = (signatoryId) => {
        const signatory = formik.values.signatories.find((sig) => sig.id === signatoryId || (sig.type === "main" && !signatoryId));
        if (signatory?.name && signatory?.role && signatory?.agreed) {
            const key = signatoryId || "main";
            setSignedSignatories((prev) => ({
                ...prev,
                [key]: {
                    name: signatory.name,
                    date: getTodayDate(),
                },
            }));
        }
    };

    const handleCancelSigning = async () => {
        if (!hasPackResponse) {
            navigate(`/admin/clients/${clientId}/care-plan/signature-document`);
            return;
        }

        setCancelling(true);
        try {
            await _delete(APIConfig.CLIENT_SIGNATURE_DOCUMENTS.DELETE_PACK(pack?.id));
            showSuccess("Signing cancelled");
            navigate(`/admin/clients/${clientId}/care-plan/signature-document`);
        } catch (err) {
            showError(err?.response?.data?.message || "Failed to cancel signing");
        } finally {
            setCancelling(false);
            setShowCancelDialog(false);
        }
    };

    const handleBackClick = () => {
        if (hasPackResponse) {
            setShowCancelDialog(true);
        } else {
            navigate(`/admin/clients/${clientId}/care-plan/signature-document`);
        }
    };

    const getTodayDate = () => {
        const today = new Date();
        return today.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const handleNoteChange = (docId, note) => {
        setDocumentNotes((prev) => ({
            ...prev,
            [docId]: note,
        }));
    };

    const openNoteModal = (doc) => {
        setSelectedDocForNote(doc);
        setCurrentNote(documentNotes[doc.id] || "");
        setIsNoteModalOpen(true);
    };

    const saveNote = () => {
        if (selectedDocForNote) {
            handleNoteChange(selectedDocForNote.id, currentNote);
            showSuccess("Notes added successfully");
        }
        setIsNoteModalOpen(false);
        setSelectedDocForNote(null);
        setCurrentNote("");
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <DotLoader
                    loading={isLoading}
                    style="bg-white"
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <div className="sticky top-[60px] z-50 border-b bg-white shadow-sm">
                <div className="mx-auto px-6 py-5 md:px-20 xl:px-32">
                    <button
                        onClick={handleBackClick}
                        className="mb-3 flex items-center text-sm text-customFeedCardBlueText transition-colors hover:text-customTextLightNavy/80"
                    >
                        <ArrowLeftIcon className="mr-1 h-5 w-5" />
                        Back to {clientName}&apos;s care plan
                    </button>
                    <div>
                        <h1 className="poppins-medium text-lg text-customBlack1">Signature documents</h1>
                    </div>
                </div>
            </div>

            <form onSubmit={formik.handleSubmit}>
                <div className="mx-auto px-6 py-8 md:px-20 xl:px-32">
                    <div className="flex flex-col gap-8 lg:flex-row">
                        <div className="w-full rounded-lg bg-[#E9EEF5] p-6 lg:w-1/3">
                            <h2 className="poppins-medium mb-2 text-base text-customBlack">Summary of documents attached</h2>
                            <p className="mb-4 text-sm text-customFeedCardGreyText1">Click to see preview or select icon to add a note.</p>
                            {filteredDocs?.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="mb-4"
                                >
                                    <div className="flex items-center justify-between gap-3 rounded-md bg-white p-4">
                                        <div className="flex items-center gap-3">
                                            <FileText className="h-5 w-5 text-gray-400" />
                                            <div>
                                                <p className="break-all text-xs text-gray-700">{doc.fileName}</p>
                                                <p className="text-xs text-gray-500">ID {doc.documentUniqueId}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openNoteModal(doc)}
                                            className="text-customTextLightNavy hover:text-customTextLightNavy/80"
                                        >
                                            <Calendar className="h-5 w-5" />
                                        </button>
                                    </div>
                                    {documentNotes[doc.id] && (
                                        <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-600">
                                            <strong>Note:</strong> {documentNotes[doc.id]}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="w-full flex-1">
                            <h2 className="poppins-medium mb-2 text-base text-customBlack">Signature</h2>
                            <p className="mb-6 text-sm text-customFeedCardGreyText1">Tick the checkbox and add a signature to confirm it.</p>

                            <div className="relative">  
                                <div className="absolute bottom-0 left-2 top-2 w-0.5 bg-[#E2E8F0]"></div>

                                {formik.values.signatories.map((signatory, index) => (
                                    <div
                                        key={signatory.id || index}
                                        className="relative mb-12"
                                    >
                                        <div className="absolute left-1 top-0 h-2.5 w-2.5 rounded-full border-2 border-[#E2E8F0] bg-customGrey1/50"></div>

                                        <div className="relative ml-8">
                                            <div className="mb-4 flex items-start justify-between">
                                                <h3 className="text-sm font-medium text-customGrey1">
                                                    {signatory.type === "main" ? "Main signature" : "Additional signature"}
                                                </h3>
                                                {signatory.type === "additional" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveSignatory(signatory.id)}
                                                        className="text-gray-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-4">
                                                <TextField
                                                    label="Client / person authorised to sign"
                                                    name={`signatories.${index}.name`}
                                                    type="text"
                                                    value={signatory.name}
                                                    valueChange={formik.handleChange}
                                                    placeHolder="e.g. Kesav"
                                                    required
                                                    error={formik.touched.signatories?.[index]?.name && formik.errors.signatories?.[index]?.name}
                                                />

                                                <DropdownField
                                                    label="Role"
                                                    required
                                                    options={signatureRoleOptions}
                                                    value={signatory.role}
                                                    valueChange={(value) => formik.setFieldValue(`signatories.${index}.role`, value)}
                                                    placeholder="Select from the options..."
                                                    error={formik.touched.signatories?.[index]?.role && formik.errors.signatories?.[index]?.role}
                                                />

                                                {signatory.role === "Other" && (
                                                    <TextField
                                                        label="Please state your other role"
                                                        name={`signatories.${index}.note`}
                                                        type="text"
                                                        value={signatory.note}
                                                        valueChange={formik.handleChange}
                                                        placeHolder=""
                                                        required
                                                        error={formik.touched.signatories?.[index]?.note && formik.errors.signatories?.[index]?.note}
                                                    />
                                                )}

                                                <div className="rounded border border-gray-400 bg-white p-3 shadow-md">
                                                    <label className="mt-3 flex items-start gap-2">
                                                        <input
                                                            type="checkbox"
                                                            name={`signatories.${index}.agreed`}
                                                            checked={signatory.agreed}
                                                            onChange={formik.handleChange}
                                                            className="mt-1 h-4 w-4 rounded border-gray-300 text-customTextLightNavy focus:ring-customTextLightNavy"
                                                        />
                                                        <span className="text-sm text-gray-700">
                                                            I understand and agree to the terms of each of the attached documents and have given my
                                                            consent on this date where applicable.
                                                        </span>
                                                    </label>

                                                    {
                                                        signatory.agreed &&
                                                        !signedSignatories[signatory.id || "main"] && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSignOff(signatory.id)}
                                                                className="mt-4 rounded bg-customDropdownBorder px-4 py-2 text-sm text-white hover:bg-customDropdownBorder/90"
                                                            >
                                                                Sign off
                                                            </button>
                                                        )}

                                                    {signedSignatories[signatory.id || "main"] && (
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm text-customBlack2">{signatory.role}</span>
                                                                <span className="font-signature text-lg text-customBlack1">
                                                                    {signedSignatories[signatory.id || "main"].name}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm text-customBlack2">
                                                                {signedSignatories[signatory.id || "main"].date}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={handleAddSignatory}
                                    className="relative mb-20 ml-8 flex items-center gap-2 text-sm font-medium text-customTextLightNavy hover:text-customTextLightNavy/80"
                                >
                                    <PlusCircle className="-mt-0.5 h-4 w-4" /> Add new signatory
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4">
                    <div className="mx-auto flex items-center justify-between px-6 md:px-20 xl:px-32">
                        <p className="text-sm text-gray-500">
                            {filteredDocs?.length || 0} document(s) attached / {signatureCount} signature(s)
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleBackClick}
                                className="rounded px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                                disabled={cancelling}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rounded bg-customDropdownBorder px-4 py-2 text-sm text-white disabled:bg-customDropdownBorder/50 hover:bg-customDropdownBorder/90"
                                disabled={saving || (formik.values.signatories.some((sig) => sig.agreed) && !signedSignatories[formik.values.signatories[0].id || "main"])}
                            >
                                {saving ? (
                                    <DotLoader
                                        loading={true}
                                        style="bg-white"
                                    />
                                ) : (
                                    "Save"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {isNoteModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4"
                    onClick={() => setIsNoteModalOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded bg-white p-6 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 text-sm">
                            <p className="text-sm font-medium text-customBlack1">{selectedDocForNote?.fileName}</p>
                            <p className="text-xs text-customBlack2">ID: {selectedDocForNote?.documentUniqueId}</p>
                        </div>
                        <textarea
                            value={currentNote}
                            onChange={(e) => setCurrentNote(e.target.value)}
                            className="h-32 w-full text-sm rounded text-customBlack1 border p-3 focus:outline-none focus:ring-1 "
                            placeholder="Add your note here..."
                        />
                        <div className="mt-4 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setIsNoteModalOpen(false);
                                    setSelectedDocForNote(null);
                                    setCurrentNote("");
                                }}
                                className="px-4 py-2 text-sm poppins-medium text-customBlack2 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveNote}
                                className="rounded bg-customDropdownBorder px-4 py-2 text-sm poppins-medium text-white hover:bg-customDropdownBorder/90"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={showCancelDialog}
                onClose={() => setShowCancelDialog(false)}
                onConfirm={handleCancelSigning}
                title="Are you sure you want to cancel signing?"
            />
        </div>
    );
};

export default SignDocument;
