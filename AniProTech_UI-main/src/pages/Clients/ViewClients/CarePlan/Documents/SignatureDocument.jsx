import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { ArrowLeftIcon, Upload, FileText, Download, Plus, X } from "lucide-react";
import { useGlobalStore } from "../../../../../stores/useGlobalStore";
import useScrollToTop from "../../../../../hooks/useScrollToTop";
import DotLoader from "../../../../../components/Loader/DotLoader";
import ReusableTable from "../../../../../components/TableField/ReusableTable";
import APIConfig from "../../../../../utils/ApiConfig";
import { _get, _postForm, _post } from "../../../../../utils/ApiService";
import { showError, showSuccess } from "../../../../../utils/toaster";
import { isEmpty } from "lodash";
import { downloadFileFromRelativePath } from "../../../../../utils/downloadDocument";

const SignatureDocument = () => {
    const navigate = useNavigate();
    const { id: clientIdFromParams } = useParams();
    const { clientsPersonalDetailData } = useGlobalStore();
    const clientId = clientIdFromParams || clientsPersonalDetailData?.id;
    const clientName = clientsPersonalDetailData?.firstName || "the client";

    useScrollToTop();

    const [isLoading, setIsLoading] = useState(true);
    const [isUploadView, setIsUploadView] = useState(false);
    const [showDocumentSelection, setShowDocumentSelection] = useState(false);
    const [uploadedDocuments, setUploadedDocuments] = useState([]);
    const [signedDocuments, setSignedDocuments] = useState([]);
    const [selectedDocuments, setSelectedDocuments] = useState([]);
    const [tableSearch, setTableSearch] = useState("");
    const [tablePage, setTablePage] = useState(1);
    const [tablePageSize] = useState(10);
    const [uploading, setUploading] = useState(false);
    const [creatingPack, setCreatingPack] = useState(false);
    const [noteModal, setNoteModal] = useState({ isOpen: false, note: "", fileName: "", documentUniqueId: "" });

    useEffect(() => {
        fetchAll();
    }, [clientId]);

    const fetchAll = async () => {
        setIsLoading(true);
        let packRes;
        try {
            const docsRes = await _get(APIConfig.CLIENT_SIGNATURE_DOCUMENTS.GET_ALL_UPLOADED_DOCUMENTS(clientId));
            setUploadedDocuments(docsRes?.data?.results?.data || []);
            const signedRes = await _get(APIConfig.CLIENT_SIGNATURE_DOCUMENTS.GET_ALL_SIGNED_DOCUMENTS(clientId));
            setSignedDocuments(signedRes?.data?.results?.data || []);
            packRes = await _get(APIConfig.CLIENT_SIGNATURE_DOCUMENTS.GET_PACK_DETAILS(clientId));
            if (packRes?.data?.results?.data?.status === "IN_PROGRESS") {
                navigate(`/admin/clients/${clientId}/care-plan/signature-document/sign`);
                return;
            }
        } catch (err) {
            if (isEmpty(packRes)) {
                return;
            }
            showError(err?.response?.data?.message || "Failed to fetch documents");
        } finally {
            setIsLoading(false);
        }
    };

    const onDrop = useCallback(
        async (acceptedFiles) => {
            setUploading(true);
            try {
                for (const file of acceptedFiles) {
                    if (file.size > 12 * 1024 * 1024 || file.type !== "application/pdf") {
                        showError("Only PDF files up to 12MB are allowed.");
                        continue;
                    }
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("clientId", clientId);
                    await _postForm(APIConfig.CLIENT_SIGNATURE_DOCUMENTS.UPLOAD(), formData);
                }
                showSuccess("Document(s) uploaded successfully");
                fetchAll();
            } catch (err) {
                showError(err?.response?.data?.message || "Failed to upload document");
            } finally {
                setUploading(false);
            }
        },
        [clientId],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "application/pdf": [".pdf"] },
        maxSize: 12 * 1024 * 1024,
        multiple: true,
    });

    const columns = [
        {
            header: "Documents",
            accessor: "fileName",
            render: (value, row) => (
                <div className="flex flex-col gap-1 font-poppins">
                    <span className="font-medium text-customBlack1">{value || "Unnamed Document"}</span>
                    <span className="text-xs text-customBlack2">ID: {row?.documentUniqueId || "N/A"}</span>
                </div>
            ),
        },
        {
            header: "Signer",
            accessor: "signatories",
            render: (_, row) => {
                const signatories = row?.signatories || [];
                if (!Array.isArray(signatories) || signatories.length === 0) {
                    return <span className="font-poppins text-sm text-gray-500">No signatories</span>;
                }
                return (
                    <div className="flex flex-col space-y-3">
                        {signatories.map((sig, idx) => (
                            <span
                                key={idx}
                                className="text-sm font-semibold text-customBlack"
                            >
                                {sig?.name || "Unknown"}
                            </span>
                        ))}
                    </div>
                );
            },
        },
        {
            header: "Signer Role",
            accessor: "signatories",
            render: (_, row) => {
                const signatories = row?.signatories || [];
                if (!Array.isArray(signatories) || signatories.length === 0) {
                    return <span className="text-sm text-gray-500">No roles</span>;
                }
                return (
                    <div className="flex flex-col space-y-3">
                        {signatories.map((sig, idx) => (
                            <span
                                key={idx}
                                className="text-sm text-customBlack1"
                            >
                                {sig?.role || "Unknown"} {sig?.note && `- ${sig?.note}`}
                            </span>
                        ))}
                    </div>
                );
            },
        },
        {
            header: "Signature",
            accessor: "signatories",
            render: (_, row) => {
                const signatories = row?.signatories || [];
                if (!Array.isArray(signatories) || signatories.length === 0) {
                    return <span className="text-sm text-gray-500">No signatures</span>;
                }
                return (
                    <div className="flex flex-col space-y-3">
                        {signatories.map((sig, idx) => (
                            <span
                                key={idx}
                                className="font-signature text-base italic text-customBlack"
                            >
                                {sig?.name || "Unknown"}
                            </span>
                        ))}
                    </div>
                );
            },
        },
        {
            header: "Date",
            accessor: "signedAt",
            render: (value) => {
                if (!value) return "N/A";
                const dateValue = typeof value === "string" ? value : value?.toString();
                return dateValue ? dateValue.slice(0, 10) : "N/A";
            },
        },
        {
            header: "Note",
            accessor: "notes",
            render: (value, row) => (
                <button
                    onClick={() =>
                        setNoteModal({
                            isOpen: true,
                            note: value === "No Notes Available" ? "-" : value || "No note",
                            fileName: row?.fileName || "Unknown Document",
                            documentUniqueId: row?.documentUniqueId || "N/A",
                        })
                    }
                    className={`poppins-medium px-3 py-1 text-sm font-medium ${value === "No Notes Available" ? "text-customBlack2" : "text-customTextLightNavy"}`}
                >
                   {value === "No Notes Available" ? "-" : "See note"}
                </button>
            ),
        },
    ];

    const handleDocumentSelect = (docId) => {
        setSelectedDocuments((prev) => (prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]));
    };
    const handleDownload = async (docId) => {
        const doc = uploadedDocuments.find((d) => d.id === docId);
        if (!doc || !doc.fileUrl) return;
      
        await downloadFileFromRelativePath(doc.fileUrl, doc.fileName);
      };
      
    const handleSignNow = async () => {
        if (selectedDocuments.length === 0) return;
        setCreatingPack(true);
        try {
            await _post(APIConfig.CLIENT_SIGNATURE_DOCUMENTS.CREATE_PACK(), {
                clientId,
                documents: selectedDocuments,
            });
            showSuccess("Document pack created. Proceed to sign.");
            fetchAll();
        } catch (err) {
            showError(err?.response?.data?.message || "Failed to create document pack");
        } finally {
            setCreatingPack(false);
        }
    };

    const handleAddButtonClick = () => {
        setShowDocumentSelection(true);
        setSelectedDocuments([]);
    };

    const handleDownloadSummary = () => {
        window.print();
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

    if (signedDocuments.length > 0 && !isUploadView && !showDocumentSelection) {
        return (
            <div className="min-h-screen bg-white">
                <div className="sticky top-[60px] z-50 border-b bg-white shadow-sm">
                    <div className="mx-auto px-6 py-5 md:px-20 xl:px-32">
                        <button
                            onClick={() => navigate(`/admin/clients/${clientId}/care-plan`)}
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
                <div className="mx-auto px-6 py-8 md:px-20 xl:px-32">
                    <ReusableTable
                        data={signedDocuments}
                        columns={columns}
                        loading={isLoading}
                        page={tablePage}
                        setPage={setTablePage}
                        pageSize={tablePageSize}
                        totalCount={signedDocuments.length}
                        setSearchTerm={setTableSearch}
                        searchTerm={tableSearch}
                        onAdd={handleAddButtonClick}
                        onDownloadSummary={handleDownloadSummary}
                    />
                </div>

                {noteModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
                        <div className="w-full max-w-md rounded bg-white p-6 shadow-lg">
                            <div className="mb-4 border-b pb-2 border-gray-300 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-customBlack1">{noteModal.fileName}</p>
                                    <p className="text-xs text-customBlack2">ID: {noteModal.documentUniqueId}</p>
                                </div>
                                <button
                                    onClick={() => setNoteModal({ isOpen: false, note: "", fileName: "", documentUniqueId: "" })}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="mb-4 ">
                            <p className="text-sm text-customBlack">{noteModal?.note}</p>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setNoteModal({ isOpen: false, note: "", fileName: "", documentUniqueId: "" })}
                                    className="rounded bg-customDropdownBorder px-4 py-2 text-sm text-white hover:bg-customDropdownBorder/90"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <div className="sticky top-[60px] z-50 border-b bg-white shadow-sm">
                <div className="mx-auto px-6 py-5 md:px-20 xl:px-32">
                    <button
                        onClick={() => {
                            if (isUploadView) {
                                setIsUploadView(false);
                            } else if (showDocumentSelection) {
                                setShowDocumentSelection(false);
                            } else {
                                navigate(-1);
                            }
                        }}
                        className="mb-3 flex items-center text-sm text-customFeedCardBlueText transition-colors hover:text-customTextLightNavy/80"
                    >
                        <ArrowLeftIcon className="mr-1 h-5 w-5" />
                        {isUploadView ? "Back" : `Back to ${clientName}'s care plan`}
                    </button>
                    <div>
                        <h1 className="poppins-medium text-lg text-customBlack1">Signature documents</h1>
                    </div>
                </div>
            </div>
            <div className="mx-auto px-6 py-8 md:px-20 xl:px-32">
                {isUploadView ? (
                    <>
                        <div className="mb-12">
                            <h2 className="mb-2 text-lg font-medium text-customBlack1">Upload documents for signature</h2>
                            <p className="mb-6 text-sm text-customFeedCardGreyText1">
                                Upload agency standard PDF documents to make them available to all your clients for signature. You can upload multiple
                                documents at once.
                            </p>
                            <div
                                {...getRootProps()}
                                className="cursor-pointer"
                            >
                                <input {...getInputProps()} />
                                <div
                                    className={`rounded-lg border-2 border-dashed p-8 text-center ${isDragActive ? "border-customTextLightNavy bg-customTextLightNavy/5" : "border-gray-300"}`}
                                >
                                    <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                                    <p className="text-sm text-gray-500">PDF file. Max size 12MB</p>
                                    {uploading && (
                                        <DotLoader
                                            loading={uploading}
                                            style="bg-white"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>  
                        <div className="space-y-4">
                            {uploadedDocuments.length > 0 && (
                                <>
                                    <p className="text-sm text-gray-700">{uploadedDocuments.length} documents uploaded</p>
                                    {uploadedDocuments.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="flex items-center justify-between rounded-md border p-4"
                                        >
                                            <div className="flex items-center gap-4">
                                                <FileText className="h-5 w-5 text-gray-400" />
                                                <span className="text-sm text-gray-700">{doc.fileName || "Unnamed Document"}</span>
                                                <span className="text-xs text-gray-500">ID {doc.documentUniqueId}</span>
                                            </div>
                                            <button
                                                onClick={() => handleDownload(doc.id)}
                                                className="text-customTextLightNavy hover:text-customTextLightNavy/80"
                                            >
                                                <Download className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </>
                ) : showDocumentSelection ? (
                    <div className="space-y-6">
                        <div>
                            <h2 className="mb-2 text-lg font-medium text-customBlack1">
                                What documents does {clientName} or an authorised person need to sign?
                            </h2>
                            <p className="text-sm text-customFeedCardGreyText1">Select to prepare documents for signature.</p>
                        </div>
                        {uploadedDocuments.length === 0 ? (
                            <div className="py-8 text-center">
                                <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                                <p className="mb-4 text-sm text-gray-500">No documents were uploaded.</p>
                                <button
                                    onClick={() => setIsUploadView(true)}
                                    className="mx-auto flex items-center text-sm font-medium text-customTextLightNavy hover:text-customTextLightNavy/80"
                                >
                                    <Plus className="mr-1 h-4 w-4" />
                                    Upload your first document
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {uploadedDocuments.map((doc) => (
                                    <div
                                        key={doc.id}
                                        onClick={() => handleDocumentSelect(doc.id)}
                                        className="flex cursor-pointer items-center gap-4 rounded-md border p-4"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedDocuments.includes(doc.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-customTextLightNavy focus:ring-customTextLightNavy"
                                        />
                                        <span className="text-sm text-gray-700">{doc.fileName || "Unnamed Document"}</span>
                                        <span className="text-xs text-gray-500">ID {doc.documentUniqueId}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {uploadedDocuments.length > 0 && (
                            <button
                                onClick={() => setIsUploadView(true)}
                                className="flex items-center text-sm font-medium text-customTextLightNavy hover:text-customTextLightNavy/80"
                            >
                                <Plus className="mr-1 h-4 w-4" />
                                Add new document
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <h2 className="mb-2 text-lg font-medium text-customBlack1">
                                What documents does {clientName} or an authorised person need to sign?
                            </h2>
                            <p className="text-sm text-customFeedCardGreyText1">Select to prepare documents for signature.</p>
                        </div>
                        {uploadedDocuments.length === 0 ? (
                            <div className="py-8 text-center">
                                <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                                <p className="mb-4 text-sm text-gray-500">No documents were uploaded.</p>
                                <button
                                    onClick={() => setIsUploadView(true)}
                                    className="mx-auto flex items-center text-sm font-medium text-customTextLightNavy hover:text-customTextLightNavy/80"
                                >
                                    <Plus className="mr-1 h-4 w-4" />
                                    Upload your first document
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {uploadedDocuments.map((doc) => (
                                    <div
                                        key={doc.id}
                                        onClick={() => handleDocumentSelect(doc.id)}
                                        className="flex cursor-pointer items-center gap-4 rounded-md border p-4"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedDocuments.includes(doc.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-customTextLightNavy focus:ring-customTextLightNavy"
                                        />
                                        <span className="text-sm text-gray-700">{doc.fileName || "Unnamed Document"}</span>
                                        <span className="text-xs text-gray-500">ID {doc.documentUniqueId}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {uploadedDocuments.length > 0 && (
                            <button
                                onClick={() => {
                                    setIsUploadView(true);
                                }}
                                className="flex items-center text-sm font-medium text-customTextLightNavy hover:text-customTextLightNavy/80"
                            >
                                <Plus className="mr-1 h-4 w-4" />
                                Add new document
                            </button>
                        )}
                    </div>
                )}
            </div>

            {uploadedDocuments.length > 0 && !isUploadView && (
                <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4">
                    <div className="mx-auto flex items-center justify-between px-6 md:px-20 xl:px-32">
                        <p className="text-sm text-gray-500">{selectedDocuments.length} documents selected</p>
                        <button
                            onClick={handleSignNow}
                            disabled={selectedDocuments.length === 0 || creatingPack}
                            className={`rounded px-4 py-2 text-sm ${selectedDocuments.length === 0 || creatingPack ? "cursor-not-allowed bg-gray-100 text-gray-400" : "bg-customDropdownBorder text-white hover:bg-customDropdownBorder/90"}`}
                        >
                            {creatingPack ? (
                                <DotLoader
                                    loading={true}
                                    style="bg-white"
                                />
                            ) : (
                                "Sign now"
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SignatureDocument;
