import { useEffect, useState } from "react";
import useScrollToTop from "../../../../hooks/useScrollToTop";
import { useNavigationHelpers } from "../../../../hooks/useNavigationHelpers";
import { fetchData } from "../../../../utils/FetchData";
import { _get } from "../../../../utils/ApiService";
import APIConfig from "../../../../utils/ApiConfig";
import DotLoader from "../../../../components/Loader/DotLoader";
import { FileClock, Pencil } from "lucide-react";
import Section from "../../../../components/Section/Section";
import ArraySection from "../../../../components/Section/ArraySection";
import { isNotEmpty } from "../../../../utils/common";

const OnboardingIndex = () => {
    const { navigate, id } = useNavigationHelpers();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [readiness, setReadiness] = useState(null);

    useEffect(() => {
        fetchData(() => _get(APIConfig.TEAMS.TEAM_ONBOARDING_GET_BY_ID(id)), setData, setLoading, null);
        _get(`/api/team/${id}/readiness`).then((response) => setReadiness(response.data.results.data)).catch(() => setReadiness(null));
    }, [id]);

    useScrollToTop();

    const handleEditClick = () => {
        navigate(`/admin/teams/${id}/onboarding/edit`, {
            state: { data },
        });
    };

    if (loading) {
        return (
            <div className="z-50 flex min-h-screen items-center justify-center">
                <DotLoader loading={loading} />
            </div>
        );
    }

    if (!data || Object.keys(data).length === 0) {
        return (
            <div className="common-container">
                <div className="flex flex-col items-center justify-center space-y-4 rounded-md border border-customBorder bg-white px-5 py-10 lg:px-20 xl:px-44">
                    <FileClock className="h-6 w-6 text-customNavy" />
                    <div className="text-center text-lg text-customTextGrey1">Add onboarding information</div>
                    <button
                        className="rounded border border-customNavy px-4 py-2 text-sm font-semibold text-customTextGrey"
                        onClick={handleEditClick}
                    >
                        Add info
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="md:px-20 md:py-10 lg:py-14 xl:px-40">
            {readiness && (
                <section className={`mb-6 rounded-lg border p-5 ${readiness.status === "READY" ? "border-emerald-200 bg-emerald-50" : readiness.status === "ATTENTION" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`} aria-label="Roster readiness">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Roster readiness</h2><p className="text-sm">{readiness.status === "READY" ? "Ready for roster assignment." : readiness.status === "ATTENTION" ? "Ready for roster assignment, but credential review is due." : "Not ready for roster assignment until the required records are completed."}</p></div><span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{readiness.status.replaceAll("_", " ")}</span></div>
                    {!!readiness.missing.length && <p className="mt-3 text-sm"><b>Missing:</b> {readiness.missing.join(", ")}</p>}
                    {!!readiness.expired.length && <p className="mt-2 text-sm"><b>Expired or inactive:</b> {readiness.expired.map((item) => item.kind).join(", ")}</p>}
                    {!!readiness.expiring.length && <p className="mt-2 text-sm"><b>Due in the next 30 days:</b> {readiness.expiring.map((item) => `${item.kind} (${item.expiresAt})`).join(", ")}</p>}
                </section>
            )}
            <div>
                <Section
                    title="Employment"
                    rows={[
                        { label: "Start date", value: data?.started },
                        { label: "National Insurance No.", value: data?.niNumber },
                        { label: "Social Worker No.", value: data?.socialWorkerNumber },
                        { label: "Employee No.", value: data?.employeeNumber },
                        { label: "Role", value: data?.role, isEnum: true },
                        { label: "Contract type", value: data?.contractType, isEnum: true },
                        { label: "Weekly contracted hours", value: data?.weeklyContractedHours },
                        { label: "Employment contract", value: data?.contractFilePath, isFile: true },
                        { label: "COVID Vaccination Status", value: data?.covidVaccinationStatus, isEnum: true },
                    ]}
                    data={data}
                />
            </div>
            <div className="py-5 md:py-10">
                <Section
                    title="Right to Work"
                    rows={[
                        { label: "ID File", value: data?.idFilePath, isFile: true },
                        { label: "Driving Licence", value: data?.drivingLicenceFilePath, isFile: true },
                        { label: "Bank Statement", value: data?.bankStatementFilePath, isFile: true },
                        { label: "Utility Bill", value: data?.utilityBillFilePath, isFile: true },
                        { label: "References File", value: data?.referencesFilePath, isFile: true },
                        { label: "DBS Record", value: data?.dbsRecordFilePath, isFile: true },
                    ]}
                    data={data}
                />
            </div>

            {isNotEmpty(data?.teamOnboardingAdditionalDocuments) ? (
                <ArraySection
                    title="Additional Documents"
                    data={data}
                    stateData={data?.teamOnboardingAdditionalDocuments || []}
                />
            ) : (
                <></>
            )}
        </div>
    );
};

export default OnboardingIndex;
