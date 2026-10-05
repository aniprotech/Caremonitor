import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";

import { useGlobalStore } from "../../../../../stores/useGlobalStore";
import { useNavigationHelpers } from "../../../../../hooks/useNavigationHelpers";
import useScrollToTop from "../../../../../hooks/useScrollToTop";

import RiskModal from "./RiskModal";
import { getAdditionalAssessmentAPIEndpoint } from "./additionalAssessmentAPIEndpoint/assessmentAPIEndpoint";
import { _get, _post, _delete } from "../../../../../utils/ApiService";
import { showError, showSuccess } from "../../../../../utils/toaster";
import { createAdditionalAssessmentRiskAPI, deleteAdditionalAssessmentRiskAPI } from "./additionalAssessmentAPIEndpoint/riskAPIEndpoint";
import AdditionalNeedAssessment from "./AdditionalDocumentAssessmentSection/AdditionalNeedAssessment";
import RisksSection from "./AssessmentSections/RisksSection";

const AdditionalDocumentsAssessmentLayout = ({ title, description, previousAssessments = [], onReviewAssessment, assessmentType }) => {
    const navigate = useNavigate();
    const { id: clientId } = useNavigationHelpers();
    const client = useGlobalStore((s) => s.clientsPersonalDetailData);

    const [risks, setRisks] = useState([]);
    const [assessments, setAssessments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
    const [selectedRisk, setSelectedRisk] = useState(null);

    useScrollToTop();

    const fetchAssessment = async () => {
        setLoading(true);
        try {
            const { data } = await _get(getAdditionalAssessmentAPIEndpoint(assessmentType, clientId));
                const payload = data?.results?.data || {};
                setRisks(payload.risks || []);
                setAssessments(payload.assessments || []);
            
        } catch (e) {
            showError("Unable to load assessment data.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
   

    useEffect(() => {
        fetchAssessment();
    }, [assessmentType, clientId]);

    const riskEndpoint = createAdditionalAssessmentRiskAPI(assessmentType, clientId);

    const handleAddRisk = async (risk) => {
        try {
            const { data } = await _post(riskEndpoint, {
                id: risk?.id ?? null,
                risk: risk.risk,
                mitigation: risk.mitigation,
                riskLevel: risk.riskLevel,
                relatedAssessments: risk.relatedAssessments,
            });

            if (data?.error) return showError(data.error);

            showSuccess(data.message);
            fetchAssessment();
        } catch (e) {
            console.error(e);
            showError("Failed to save risk, please try again.");
        }
    };

    const handleEditRisk = (risk) => {
        setSelectedRisk(risk);
        setIsRiskModalOpen(true);
    };

    const handleDeleteRisk = async (riskId) => {
        try {
            const { data } = await _delete(deleteAdditionalAssessmentRiskAPI(assessmentType, riskId));
            if (data?.error) return showError(data.error);

            showSuccess(data.message);
            fetchAssessment();
        } catch (e) {
            console.error(e);
            showError("Failed to delete risk.");
        }
    };

    const handleBackClick = () => navigate(-1);

    return (
        <div className="relative min-h-screen bg-white">
            <header className="sticky top-[60px] z-50 border-b bg-white">
                <div className="mx-auto px-6 py-7 md:px-20 xl:px-32">
                    <button
                        type="button"
                        onClick={handleBackClick}
                        className="mb-6 flex items-center text-sm text-customFeedCardBlueText hover:text-customTextLightNavy/80"
                    >
                        <ArrowLeftIcon className="mr-1 h-5 w-5" />
                        Back to {client?.firstName}&apos;s care plan
                    </button>

                    <h1 className="poppins-medium mb-2 text-lg text-customBlack1">{title}</h1>
                    <p className="text-sm text-customFeedCardGreyText1">{description}</p>
                </div>
            </header>

            <div className="mx-auto flex gap-10 px-6 pb-40 pt-7 md:px-20 xl:px-80">
                <main className="flex-1">
                    <AdditionalNeedAssessment
                        clientName={client?.firstName}
                        previousAssessments={previousAssessments}
                        onReviewAssessment={onReviewAssessment}
                        onBackClick={handleBackClick}
                        title={title}
                        description={description}
                        assessmentData={assessments}
                        loading={loading}
                        onAssessmentUpdate={fetchAssessment}
                    />

                    <RisksSection
                        hasRisks={risks.length > 0}
                        onAddRisk={() => {
                            setSelectedRisk(null);
                            setIsRiskModalOpen(true);
                        }}
                        risks={risks}
                        onEditRisk={handleEditRisk}
                        onDeleteRisk={handleDeleteRisk}
                    />
                </main>
            </div>

            <RiskModal
                data={selectedRisk}
                isOpen={isRiskModalOpen}
                onClose={() => setIsRiskModalOpen(false)}
                onSave={handleAddRisk}
            />
        </div>
    );
};

AdditionalDocumentsAssessmentLayout.propTypes = {
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    previousAssessments: PropTypes.arrayOf(
        PropTypes.shape({
            status: PropTypes.string.isRequired,
            date: PropTypes.string.isRequired,
            submittedBy: PropTypes.string.isRequired,
        }),
    ),
    onReviewAssessment: PropTypes.func,
    assessmentType: PropTypes.string.isRequired,
};

export default AdditionalDocumentsAssessmentLayout;
