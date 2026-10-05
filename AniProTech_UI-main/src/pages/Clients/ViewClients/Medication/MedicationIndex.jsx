import { ChevronRight, ClipboardList, ClipboardCheck, ClipboardPlus, Book } from "lucide-react";
import { useNavigationHelpers } from "../../../../hooks/useNavigationHelpers";
import useScrollToTop from "../../../../hooks/useScrollToTop";
import { useEffect, useState } from "react";
import ClinicalAutocomplete from "../../../../components/ClinicalAutocomplete/ClinicalAutocomplete";
import MedicationPersonalDetails from "./MedicationPersonalDetails";
import { _get } from "../../../../utils/ApiService";
import APIConfig from "../../../../utils/ApiConfig";
import DotLoader from "../../../../components/Loader/DotLoader";
import { useGlobalStore } from "../../../../stores/useGlobalStore";

const MedicationIndex = () => {
    const { id, navigate } = useNavigationHelpers();
    const { clientsPersonalDetailData } = useGlobalStore();
    const clientName = clientsPersonalDetailData?.firstName || "the client";
    const [isPersonalDetails, setIsPersonalDetails] = useState(false);
    const handleNavigate = (route) => {
        navigate(`/admin/clients/${id}/medication/${route}`);
    };
    useScrollToTop();

    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchExistingData = async () => {
            try {
                    setIsLoading(true);
                const res = await _get(APIConfig.CLIENTS.MEDICATION_GET_BY_ID(id));
                if (res?.data?.error === false) {
                    setData(res.data?.results?.data);
                }
            } catch (err) {
                console.error("Error fetching medication details", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchExistingData();
    }, [id, isPersonalDetails ]);

    const handleCategorySelect = (name) => {
        navigate(`/admin/clients/${id}/medication/schedule/add`, { state: { medication: { name, description: name } } });
    };

    if(isLoading){
        return <DotLoader loading={isLoading} style="bg-white"/>;
    }

    if(data.length === 0){
        return <MedicationPersonalDetails setIsPersonalDetails={setIsPersonalDetails} />;
    }

    return (
        <div className="min-h-screen bg-customBgLightBlue px-2 pb-10 md:px-10 md:pb-20 lg:px-36">
            {/* Top Banner */}
            {!data?.isMedicineSupportProvided && (
                <div
                    onClick={() => handleNavigate("personal-details")}
                    className="poppins-semibold mb-6 flex cursor-pointer items-center justify-between border border-customTextLightNavy bg-customBgSandal p-3 px-5 text-sm text-customBlack md:px-10 xl:px-24"
                >
                    <span>We do not provide {clientName}&apos;s medicine support. Update their details to begin recording medication events</span>
                    <button className="ml-2 whitespace-nowrap text-customTextLightNavy">
                        <ChevronRight />
                    </button>
                </div>
            )}

            {/* Header */}
            <h1 className="poppins-medium mb-1 text-xl font-semibold text-customBlack">Manage {clientName}&apos;s medication</h1>
            <p className="mb-6 text-sm text-customGrey1">Select from the options below.</p>

            {/* Add Medication Search */}
            <div className="mb-6 rounded-md border border-gray-300 bg-white p-3 md:p-4 xl:p-8">
                <h2 className="poppins-medium mb-2 text-lg text-customBlack">Add medication</h2>
                <p className="text-sm text-customGrey1">Search medicine names or add one from the prescription. NHS dm+d results appear when the terminology connection is configured. Confirm the exact product, strength and directions against the dispensing label before scheduling.</p>
                <div className="mt-4">
                    <ClinicalAutocomplete kind="medicine" label="Medicine name" value="" onChange={handleCategorySelect}/>
                </div>
            </div>

            {/* Grid Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Medication Scheduling */}
                <div
                    onClick={() => handleNavigate("scheduling")}
                    className="cursor-pointer rounded-md border border-gray-300 bg-white p-3 md:p-4 xl:p-8"
                >
                    <div className="flex flex-col items-start">
                        <ClipboardList
                            className="mb-4 h-12 w-12 text-customBlack1"
                            strokeWidth={1.25}
                        />
                        <h3 className="poppins-medium text-xl text-customBlack">Medication scheduling</h3>
                        <p className="mb-2 text-sm text-customGrey1">View and update {clientName}&apos;s medications.</p>
                        <button className="cursor-pointer text-sm text-customTextLightNavy">View schedule →</button>
                    </div>
                </div>

                {/* Medication Monitoring */}
                <div
                    onClick={() => handleNavigate("monitoring")}
                    className="cursor-pointer rounded-md border border-gray-300 bg-white p-3 md:p-4 xl:p-8"
                >
                    <div className="flex flex-col items-start">
                        <ClipboardCheck
                            className="mb-4 h-12 w-12 text-customBlack1"
                            strokeWidth={1.25}
                        />
                        <h3 className="poppins-medium text-xl text-customBlack">Medication monitoring</h3>
                        <p className="mb-2 text-sm text-customGrey1">Monitor {clientName}&apos;s MAR chart in real-time.</p>
                        <button className="cursor-pointer text-sm text-customTextLightNavy">View MAR chart →</button>
                    </div>
                </div>

                {/* Personal Details */}
                <div
                    onClick={() => handleNavigate("personal-details")}
                    className="cursor-pointer rounded-md border border-gray-300 bg-white p-3 md:p-4 xl:p-8"
                >
                    <div className="flex flex-col items-start">
                        <ClipboardPlus
                            className="mb-4 h-12 w-12 text-customBlack1"
                            strokeWidth={1.25}
                        />
                        <h3 className="poppins-medium text-xl text-customBlack">Personal details</h3>
                        <p className="mb-2 text-sm text-customGrey1">Update {clientName}&apos;s medical information, including allergies.</p>
                        <button className="cursor-pointer text-sm text-customTextLightNavy">Update details →</button>
                    </div>
                </div>

                {/* Help and Support */}
                <div
                    className="cursor-pointer rounded-md border border-gray-300 bg-white p-3 md:p-4 xl:p-8"
                    onClick={() => window.open("/contact-us", "_blank")}
                >
                    <div className="flex flex-col items-start">
                        <Book
                            className="mb-4 h-12 w-12 text-customBlack1"
                            strokeWidth={1.25}
                        />
                        <h3 className="poppins-medium text-xl text-customBlack">Help and support</h3>
                        <p className="mb-2 text-sm text-customGrey1">Learn how to use medication manager.</p>
                        <button className="cursor-pointer text-sm text-customTextLightNavy">Go to help centre →</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MedicationIndex;
