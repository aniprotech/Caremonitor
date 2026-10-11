import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGlobalStore } from "../../../../stores/useGlobalStore";
import AssessmentCard from "./components/AssessmentCard";
import { additionalAssessments, auditingDocuments, documents, initialAssessments } from "../../../../data/clients/clientCarePlanData";
import { UserRound, Check } from "lucide-react";
import { _get, _put } from "../../../../utils/ApiService";
// import useScrollToTop from "../../../../hooks/useScrollToTop";

const CarePlanIndex = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { clientsPersonalDetailData } = useGlobalStore();
    const clientName = clientsPersonalDetailData ? `${clientsPersonalDetailData.firstName}` : "the client";
    const [governance, setGovernance] = useState(null);
    const [savingGovernance, setSavingGovernance] = useState(false);
    useEffect(() => {
        _get(`/api/care-plan-governance/${id}`).then((response) => setGovernance(response.data.results.data)).catch(() => setGovernance(null));
    }, [id]);
    const saveGovernance = async (next = governance) => {
        if (!next || savingGovernance) return;
        setSavingGovernance(true);
        try { const response = await _put(`/api/care-plan-governance/${id}`, next); setGovernance(response.data.results.data); }
        finally { setSavingGovernance(false); }
    };

    // useScrollToTop();
    const handleNavigate = (path) => {
        if (path === "client-info") {
            navigate(`/admin/clients/${id}/client-info`);
        } else {
            navigate(path);
        }
    };

    return (
        <div className="mx-auto px-2 py-10 md:px-16 md:py-16 lg:px-28">
            <div className="">
                <h1 className="poppins-medium mb-2 text-lg text-customBlack">About {clientName}</h1>
                <p className="text-sm text-customGrey1">Capture basic information about {clientName}, including their likes and preferences.</p>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 pb-10 pt-3 md:grid-cols-2 lg:grid-cols-2">
                <div
                    onClick={() => handleNavigate("client-info")}
                    className="relative flex cursor-pointer flex-col rounded-md border border-customNavy/40 bg-white p-4 shadow transition-all hover:bg-customCarerFeedBg/50"
                >
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-customFeedCardBg1 p-2">
                            <UserRound className="h-5 w-5 text-[#1E817C]" />
                        </div>
                        <div className="flex-1">
                            <h3 className="poppins-medium mb-2 text-sm text-customBlack">Client information</h3>
                            <div className="flex items-center gap-1 text-xs">
                                <Check className="h-3.5 w-3.5 text-[#1E817C]" />
                                <span className="text-[#1E817C]">Updated {format(new Date(), "dd MMM yyyy")}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div></div>
                <div></div>
            </div>
            {governance && <section className="mb-10 rounded-lg border border-customNavy/20 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="poppins-medium text-lg text-customBlack">Care-plan governance</h2><p className="text-sm text-customGrey1">Version {governance.version} · reviewed and approved actions are recorded with the responsible user.</p></div><span className="rounded-full bg-customFeedCardBg1 px-3 py-1 text-sm font-semibold">{governance.stage.replaceAll("_", " ")}</span></div><div className="mt-4 grid gap-3 md:grid-cols-4"><label className="text-sm">Lifecycle<select value={governance.stage} onChange={(event) => setGovernance({ ...governance, stage: event.target.value })} className="mt-1 w-full rounded border p-2"><option value="DRAFT">Draft</option><option value="REVIEWED">Reviewed</option><option value="APPROVED">Approved</option><option value="RETIRED">Retired</option></select></label><label className="text-sm">Review due<input type="date" value={governance.reviewDue || ""} onChange={(event) => setGovernance({ ...governance, reviewDue: event.target.value || null })} className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">Signature<select value={governance.signatureStatus} onChange={(event) => setGovernance({ ...governance, signatureStatus: event.target.value })} className="mt-1 w-full rounded border p-2"><option value="PENDING">Pending</option><option value="SIGNED">Signed</option><option value="NOT_REQUIRED">Not required</option></select></label><div className="flex items-end"><button disabled={savingGovernance} onClick={() => saveGovernance()} className="rounded border border-customNavy px-4 py-2 text-sm font-semibold">{savingGovernance ? "Saving…" : "Save governance"}</button></div></div><textarea value={governance.notes || ""} onChange={(event) => setGovernance({ ...governance, notes: event.target.value })} maxLength={4000} placeholder="Review findings, approval rationale or version notes" className="mt-3 min-h-20 w-full rounded border p-2 text-sm" /></section>}

            <div className="space-y-16">
                {/* Initial Assessments Section */}
                <section>
                    <h2 className="poppins-medium mb-2 text-lg text-customBlack">Initial assessments</h2>
                    <p className="mb-6 text-sm text-customGrey1">Carry out a holistic initial assessment across eight key areas of care.</p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                        {initialAssessments?.map((assessment) => (
                            <AssessmentCard
                                key={assessment.id}
                                id={assessment.id}
                                title={assessment.title}
                                path={assessment.path}
                                lastUpdated={new Date().toISOString()} // Replace with actual last updated date
                                onClick={() => handleNavigate(assessment.path)}
                            />
                        ))}
                    </div>
                </section>

                {/* Additional Assessments Section */}
                <section>
                    <h2 className="poppins-medium mb-2 text-lg text-customBlack">Additional assessments</h2>
                    <p className="mb-6 text-sm text-customGrey1">
                        Select additional assessments that are relevant to {clientName}&apos;s needs and potential risks.
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                        {additionalAssessments?.map((assessment) => (
                            <AssessmentCard
                                key={assessment.id}
                                path={assessment.path}
                                id={assessment.id}
                                title={assessment.title}
                                onClick={() => handleNavigate(assessment.path)}
                            />
                        ))}
                    </div>
                </section>

                {/* Auditing Documents Section */}
                <section>
                    <h2 className="poppins-medium mb-2 text-lg text-customBlack">Auditing documents</h2>
                    <p className="mb-6 text-sm text-customGrey1">Record client involvement for the purposes of auditing and quality monitoring.</p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                        {auditingDocuments?.map((doc) => (
                            <AssessmentCard
                                key={doc.id}
                                id={doc.id}
                                title={doc.title}
                                onClick={() => handleNavigate(doc.path)}
                            />
                        ))}
                    </div>
                </section>

                {/* Documents Section */}
                <section>
                    <h2 className="poppins-medium mb-2 text-lg text-customBlack">Documents</h2>
                    <p className="mb-6 text-sm text-customGrey1">
                        Store and download care planning documents that can be shared with carers and third parties.
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                        {documents?.map((doc) => (
                            <AssessmentCard
                                key={doc.id}
                                id={doc.id}
                                title={doc.title}
                                onClick={() => handleNavigate(doc.path)}
                            />
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default CarePlanIndex;
