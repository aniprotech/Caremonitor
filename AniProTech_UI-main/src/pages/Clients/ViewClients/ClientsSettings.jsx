import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import useScrollToTop from "../../../hooks/useScrollToTop";
import SettingToggle from "../../../components/Section/ToggleSection";
import { showError, showSuccess } from "../../../utils/toaster";
import DotLoader from "../../../components/Loader/DotLoader";
import { _get, _put } from "../../../utils/ApiService";
import APIConfig from "../../../utils/ApiConfig";
import { useGlobalStore } from "../../../stores/useGlobalStore";

const defaultSettings = {
    lateMissedVistAlerts: false,
    visitPlanning: false,
    geoLocationCheckIn: false,
    qrCodeCheckIn: false,
};

const ClientsSettings = () => {
    const { id: clientId } = useParams();
    const [settings, setSettings] = useState(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const [showVisitPlanningModal, setShowVisitPlanningModal] = useState(false);
    const [pendingVisitPlanningValue, setPendingVisitPlanningValue] = useState(false);

    const [showQRModal, setShowQRModal] = useState(false);
    const [pendingQRCodeToggle, setPendingQRCodeToggle] = useState(false);

    const { clientsPersonalDetailData } = useGlobalStore();
    const clientName = clientsPersonalDetailData ? clientsPersonalDetailData : "Dummy";

    let firstName = clientName?.firstName;
    let lastName = clientName?.lastName;

    useScrollToTop();

    useEffect(() => {
        if (clientId) {
            fetchClientSettings();
        }
    }, [clientId]);

    const fetchClientSettings = async () => {
        setLoading(true);
        try {
            const res = await _get(APIConfig.CLIENT_SETTINGS.GET_BY_ID(clientId));
            if (res?.data?.error === false) {
                setSettings({ ...defaultSettings, ...res.data.results?.data });
            } else {
                showError(res?.data?.message || "Failed to load settings");
            }
        } catch (err) {
            showError(err?.response?.data?.message || "Network Error");
        } finally {
            setLoading(false);
        }
    };

    const updateSettingsLocally = (setting, value) => {
        setSettings((prev) => ({
            ...prev,
            [setting]: value,
        }));
    };

    const updateSettingsToServer = async (updatedSettings) => {
        setUpdating(true);
        try {
            const res = await _put(APIConfig.CLIENT_SETTINGS.UPDATE(clientId), updatedSettings);
            if (res?.data?.error === false) {
                showSuccess(res?.data?.message || "Settings updated");
            } else {
                showError(res?.data?.message || "Failed to update settings");
                fetchClientSettings(); // Re-fetch if update fails
            }
        } catch (err) {
            showError(err?.response?.data?.message || "Network Error");
            fetchClientSettings();
        } finally {
            setUpdating(false);
        }
    };

    const handleSettingToggle = (setting) => {
        if (setting === "visitPlanning") {
            const newValue = !settings.visitPlanning;
            setPendingVisitPlanningValue(newValue);
            setShowVisitPlanningModal(true);
            return;
        }

        if (setting === "qrCodeCheckIn") {
            const newValue = !settings.qrCodeCheckIn;
            if (newValue) {
                setPendingQRCodeToggle(true);
                setShowQRModal(true);
                return;
            }
        }

        const newSettings = {
            ...settings,
            [setting]: !settings[setting],
        };
        updateSettingsLocally(setting, !settings[setting]);
        updateSettingsToServer(newSettings);
    };

    const confirmQRCodeToggle = () => {
        const setting = "qrCodeCheckIn";
        const newSettings = {
            ...settings,
            [setting]: pendingQRCodeToggle,
        };
        updateSettingsLocally(setting, pendingQRCodeToggle);
        updateSettingsToServer(newSettings);
        setShowQRModal(false);
    };

    const confirmVisitPlanningToggle = () => {
        const setting = "visitPlanning";
        const newSettings = {
            ...settings,
            [setting]: pendingVisitPlanningValue,
        };
        updateSettingsLocally(setting, pendingVisitPlanningValue);
        updateSettingsToServer(newSettings);
        setShowVisitPlanningModal(false);
    };

    if (loading) return <DotLoader loading={loading} />;

    return (
        <div className="min-h-screen bg-customBgLightBlue">
            <div className="container mx-auto max-w-5xl px-4 py-8">
                <div className="space-y-2">
                    <h1 className="poppins-medium text-2xl text-customBlack">Client settings</h1>
                    <p className="poppins-medium text-sm text-customGrey1">
                        Manage Caremonitor features for this client.
                    </p>
                </div>

                <div className="mt-8 space-y-6">
                    <SettingToggle
                        title="Late and missed visit alerts"
                        description="Turn off if you do not wish to receive alerts for late or missed visits for this client"
                        enabled={settings.lateMissedVistAlerts}
                        onChange={() => handleSettingToggle("lateMissedVistAlerts")}
                        disabled={updating}
                    />
                    <SettingToggle
                        title="Visit planning"
                        description="Enables the Visits page for this client and carer app access to their visits. Disabling this feature does not remove any previously scheduled visits from the roster."
                        warningText="Note that disabling this feature will prevent all carers from accessing the client's visits in the carer app."
                        enabled={settings.visitPlanning}
                        onChange={() => handleSettingToggle("visitPlanning")}
                        disabled={updating}
                    />
                    <SettingToggle
                        title="Geo location check-in"
                        description="Confirm care workers' location when they check-in to a visit"
                        enabled={settings.geoLocationCheckIn}
                        onChange={() => handleSettingToggle("geoLocationCheckIn")}
                        disabled={updating}
                    />
                    <SettingToggle
                        title="QR code check-in"
                        subTitle="QRCode"
                        description="The carer confirms their location by scanning a QR code that is kept in the client's home. After a new QR code is generated, make sure you turn the feature off until the QR code is placed in the client's home."
                        enabled={settings.qrCodeCheckIn}
                        onChange={() => handleSettingToggle("qrCodeCheckIn")}
                        disabled={updating}
                        clientId={clientId}
                        clientName={`${firstName} ${lastName}`}
                    />
                </div>
            </div>

            {/* Visit Planning Confirmation Modal */}
            {showVisitPlanningModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="w-full max-w-3xl rounded-md bg-white p-6 shadow-lg">
                        <div className="mb-4 flex items-start justify-between border-b border-customBorder pb-4">
                            <h2 className="poppins-medium text-lg font-semibold text-customBlack">
                                {pendingVisitPlanningValue
                                    ? "Are you sure you want to turn on Visit Planning?"
                                    : "Are you sure you want to turn off Visit Planning?"}
                            </h2>
                            <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowVisitPlanningModal(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="space-y-3 text-sm text-customFeedCardGreyText1">
                            {pendingVisitPlanningValue ? (
                                <p>All medication doses need to be assigned to visits in order for them to show up with a visit on the carer app.</p>
                            ) : (
                                <>
                                    <p>Turning this feature off will mean:</p>
                                    <ul className="list-inside list-decimal space-y-2">
                                        <li>
                                            Any tasks you added in the Task Manager prior to turning Visit Planning on will display on the care plan
                                            and the mobile app – <span className="poppins-semibold">please check they are still accurate.</span>
                                        </li>
                                        <li>
                                            Carers will be able to see all tasks and medication for a given day, rather than just those assigned to
                                            the visit.
                                        </li>
                                    </ul>
                                </>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-4 border-t border-customBorder pt-4">
                            <button onClick={() => setShowVisitPlanningModal(false)} className="poppins-semibold text-sm text-customTextLightNavy hover:underline">
                                Cancel
                            </button>
                            <button onClick={confirmVisitPlanningToggle} className="poppins-semibold rounded bg-customDropdownBorder px-4 py-2 text-sm text-white hover:bg-teal-800">
                                Save changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Confirmation Modal */}
            {showQRModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="w-full max-w-2xl rounded-md bg-white px-6 py-4 shadow-lg">
                        <div className="mb-4 flex items-start justify-between border-b border-gray-200 pb-4">
                            <h2 className="poppins-medium text-lg font-semibold text-customBlack">Place QR code in client’s home</h2>
                            <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowQRModal(false)}>✕</button>
                        </div>
                        <p className="text-sm text-customFeedCardGreyText1">
                            After you have printed the QR code you should turn this feature off until the most recently generated QR code is placed in the client’s home.
                        </p>
                        <div className="mt-6 flex justify-end gap-4 border-t border-gray-200 pt-2">
                            <button onClick={() => setShowQRModal(false)} className="text-sm text-customTextLightNavy hover:underline">Cancel</button>
                            <button onClick={confirmQRCodeToggle} className="rounded bg-customDropdownBorder px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                                Ok, I understand
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsSettings;
