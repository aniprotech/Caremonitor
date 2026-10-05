import { useReactToPrint } from "react-to-print";
import { useRef, useEffect, useState, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { _get, _post } from "../../utils/ApiService";
import APIConfig from "../../utils/ApiConfig";
import { showError, showSuccess } from "../../utils/toaster";

const QRCodeSection = ({ clientId, clientName }) => {
    const [qrCodeId, setQrCodeId] = useState(null);
    const [generatedAt, setGeneratedAt] = useState(null);

    // ✅ useRef for contentRef (new pattern)
    const contentRef = useRef(null);

    const loadQRCode = useCallback(async () => {
        try {
            const res = await _get(APIConfig.CLIENT_SETTINGS.GET_BY_ID(clientId));
            const settings = res?.data?.results?.data || res?.data?.results || {};
            setQrCodeId(settings.qrCodeId || null);
            setGeneratedAt(settings.qrCodeChangedAt ? new Date(settings.qrCodeChangedAt) : null);
        } catch (err) {
            showError(err?.response?.data?.message || "Could not load the client's QR code");
        }
    }, [clientId]);

    useEffect(() => {
        if (clientId) void loadQRCode();
    }, [clientId, loadQRCode]);

    const regenerateQRCode = async () => {
        try {
            const res = await _post(APIConfig.CLIENT_SETTINGS.REGENERATE_QR_CODE(clientId));
            if (res?.data?.error === false) {
                setQrCodeId(res?.data?.results?.data?.qrCodeId || res?.data?.results?.qrCodeId);
                setGeneratedAt(new Date(res?.data?.results?.data?.qrCodeChangedAt || Date.now()));
                // showSuccess("QR Code generated");
            } else {
                showError(res?.data?.message || "Failed to regenerate QR code");
            }
        } catch (err) {
            showError(err?.response?.data?.message || "Network error");
        }
    };

    // ✅ Use contentRef directly (newer API)
    const handlePrint = useReactToPrint({
        contentRef,
        documentTitle: `${clientName}-QRCode`,
        removeAfterPrint: true,
    });

    return (
        <div className="mt-6">
            {!qrCodeId && <button type="button" onClick={regenerateQRCode} className="rounded bg-customTextNavy px-4 py-2 text-sm font-semibold text-white">Generate client QR code</button>}
            {qrCodeId && (
                <div className="mt-6 flex items-start gap-6 text-left">
                    <div className="rounded border p-3">
                        <QRCodeCanvas
                            value={qrCodeId}
                            size={120}
                        />
                    </div>
                    <div className="flex flex-col items-start gap-3">
                        <button
                            onClick={regenerateQRCode}
                            className="text-sm text-customTextLightNavy hover:underline"
                        >
                            Regenerate QR code
                        </button>
                        <p className="text-xs text-customGrey1">Last generated: {generatedAt?.toLocaleString()}</p>
                        <button
                            onClick={handlePrint}
                            className="text-sm text-customTextLightNavy hover:underline"
                        >
                            Print QR code
                        </button>
                    </div>
                </div>
            )}

            {/* ✅ Hidden printable section with contentRef */}
            {qrCodeId && (
                <div style={{ position: "absolute", top: 0, left: "-9999px" }}>
                    <div
                        ref={contentRef}
                        className="mx-auto w-[600px] p-12 text-center font-sans text-black"
                    >
                        {/* Header */}
                        <div className="mb-8 flex items-start justify-between">
                            <img
                                src="/brand-logo.png"
                                alt="Caremonitor"
                                className="h-6"
                            />
                            <div className="text-right">
                                <h2 className="text-xl font-semibold italic">QR Code</h2>
                                <p className="mt-1 text-base text-gray-500">
                                    printed{" "}
                                    {new Date().toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="my-5 border-t border-black" />

                        {/* Client Name */}
                        <h1 className="mb-5 text-left text-4xl font-semibold">{clientName}</h1>

                        {/* QR Code */}
                        <div className="mb-6 mt-32 flex justify-center">
                            <div className="rounded border-4 border-black p-6">
                                <QRCodeCanvas
                                    value={qrCodeId}
                                    size={180}
                                />
                            </div>
                        </div>

                        {/* Generated Date */}
                        <p className="mt-2 text-sm text-gray-500">
                            Code generated{" "}
                            {new Date().toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                            })}
                        </p>

                        {/* Instructions */}
                        <h2 className="mb-3 mt-12 text-3xl font-semibold">How to scan a QR code</h2>
                        <p className="mx-auto max-w-md text-lg leading-relaxed text-gray-600">
                            When the QR code scanner is open in the Caremonitor app, hold your phone up to the QR code so it appears in the box on the
                            screen. When your phone recognises the QR code, you will see a confirmation message.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QRCodeSection;
