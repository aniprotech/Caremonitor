import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";
import { useGlobalStore } from "../../../../../stores/useGlobalStore";
import NeedsAssessment from "./AssessmentSections/NeedsAssessment";
import AssessmentSummary from "./AssessmentSections/AssessmentSummary";
import TasksSection from "./AssessmentSections/TasksSection";
import RisksSection from "./AssessmentSections/RisksSection";
import RiskModal from "./RiskModal";
import useScrollToTop from "../../../../../hooks/useScrollToTop";
import { _delete, _get, _post, _put } from "../../../../../utils/ApiService";
import { showError, showSuccess } from "../../../../../utils/toaster";
import { useNavigationHelpers } from "../../../../../hooks/useNavigationHelpers";
import { createRiskAPI, deleteRiskAPI } from "./initialAssessmentApiEndpoint/initialRiskAPI";
import { getInitialAssessmentSummaryAPI } from "./initialAssessmentApiEndpoint/initialAssessmentSummaryAPI";
import { getInitialAssessmentAPIEndpoint } from "./initialAssessmentApiEndpoint/initialAssessmentAPI";

const AssessmentLayout = ({ 
    title,
    description,
    previousAssessments = [],
    onReviewAssessment,
    assessmentType,
}) => {
    const navigate = useNavigate();
    const clientsPersonalDetailData = useGlobalStore((state) => state.clientsPersonalDetailData);
    const [risks, setRisks] = useState([]);
    const [activeSection, setActiveSection] = useState("needs");
    const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
    const [selectedRisk, setSelectedRisk] = useState(null);
    const { id: clientId } = useNavigationHelpers();
    const [assessmentSummaryOutcomes, setAssessmentSummaryOutcomes] = useState("");
    const [dataId, setDataId] = useState(null);
    const [tasksPlans, setTasksPlans] = useState([]);
    const [assessmentData, setAssessmentData] = useState([]);
    useScrollToTop();

    useEffect(() => {
        const handleScroll = () => {
            const sections = ["needs", "summary", "tasks", "risks"];
            sections.forEach((section) => {
                const element = document.getElementById(section);
                if (element) {
                    const { top, bottom } = element.getBoundingClientRect();
                    if (top <= 100 && bottom >= 100) {
                        setActiveSection(section);
                    }
                }
            });
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const fetchDataBasedOnClientId = async () => {
        try {
            const response = await _get(getInitialAssessmentAPIEndpoint(assessmentType, clientId));
            setDataId(response?.data?.results?.data?.id);
            setRisks(response?.data?.results?.data?.risks || []);
            setAssessmentSummaryOutcomes(response?.data?.results?.data?.assessmentSummaryOutcomes || "");
            setTasksPlans(response?.data?.results?.data?.taskPlans || []);
            setAssessmentData(response?.data?.results?.data?.assessments || []);
        } catch (error) {
            console.error("Error fetching assessment data:", error);
            showError("Failed to load assessment data. Please try again.");
        }
    };

    useEffect(() => {
        fetchDataBasedOnClientId();
    }, [assessmentType, clientId]);

    const handleBackClick = () => {
        navigate(`/admin/clients/${clientsPersonalDetailData?.id}/care-plan`);
    };

    const riskEndpoint = createRiskAPI(assessmentType, clientId);
    const assessmentSummaryEndpoint = getInitialAssessmentSummaryAPI(assessmentType, clientId);

    const handleAssessmentSummaryAPI = async () => {
        try {
            const response = await _put(assessmentSummaryEndpoint, {
                assessmentSummaryOutcomes: assessmentSummaryOutcomes,
            });
            if (response?.data?.error) {
                showError(response?.data?.error);
            } else {
                showSuccess(response?.data?.message);
            }
        } catch (error) {
            console.error("Error updating assessment summary:", error);
            showError("Failed to update assessment summary. Please try again.");
        }
    };

    const handleAddRisk = async (risk) => {
        try {
            const response = await _post(riskEndpoint, {    
                id: risk?.id || null,
                risk: risk.risk,
                mitigation: risk.mitigation,
                riskLevel: risk.riskLevel,
                relatedAssessments: risk.relatedAssessments,
            });

            if (response?.data?.error) {
                showError(response?.data?.error);
            } else {
                showSuccess(response?.data?.message);
                fetchDataBasedOnClientId();
            }
        } catch (error) {
            console.error("Error adding/updating risk:", error);
            showError("Failed to save risk. Please try again.");
        }
    };

    const handleEditRisk = (risk) => {
        setSelectedRisk(risk);
        setIsRiskModalOpen(true);
    };

    const handleDeleteRisk = async (riskId) => {
        try {
            const response = await _delete(deleteRiskAPI(assessmentType, riskId));
            if (response?.data?.error) {
                showError(response?.data?.error);
            } else {
                showSuccess(response?.data?.message);
                fetchDataBasedOnClientId();
            }
        } catch (error) {
            console.error("Error deleting risk:", error);
            showError("Failed to delete risk. Please try again.");
        }
    };

    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            const yOffset = -250;
            const y = element.getBoundingClientRect().top + window.scrollY + yOffset;

            window.scrollTo({ top: y, behavior: "smooth" });
        }
    };

    return (
        <div className="relative min-h-screen bg-white">
            {/* Sticky Header */}
            <div className="sticky top-[60px] z-50 border-b bg-white">
                <div className="mx-auto px-6 py-7 md:px-20 xl:px-32">
                    <button
                        onClick={handleBackClick}
                        className="mb-6 flex items-center text-sm text-customFeedCardBlueText hover:text-customTextLightNavy/80"
                    >
                        <ArrowLeftIcon className="mr-1 h-5 w-5" />
                        Back to {clientsPersonalDetailData?.firstName}&apos;s care plan
                    </button>

                    <div>
                        <h1 className="poppins-medium mb-2 text-lg text-customBlack1">{title}</h1>
                        <p className="text-sm text-customFeedCardGreyText1">{description}</p>
                    </div>
                </div>
            </div>

            {/* Main Content + Sidebar */}
            <div className="mx-auto flex gap-10 px-6 pb-40 pt-7 md:px-20 xl:px-80">
                {/* Main Sections */}
                <div className="flex-1">
                    <NeedsAssessment
                        clientName={clientsPersonalDetailData?.firstName}
                        previousAssessments={previousAssessments}
                        onReviewAssessment={onReviewAssessment}
                        onBackClick={handleBackClick}
                        title={title}
                        description={description}
                        assessmentData={assessmentData}
                        assessmentType={assessmentType}
                        onAssessmentUpdate={fetchDataBasedOnClientId}
                    />

                    <AssessmentSummary
                        assessmentSummaryOutcomes={assessmentSummaryOutcomes}
                        onSummaryChange={(e) => setAssessmentSummaryOutcomes(e.target.value)}
                        onSaveChanges={handleAssessmentSummaryAPI}
                    />

                    <TasksSection
                        tasksPlans={tasksPlans}
                        dataId={dataId}
                        clientId={clientId}
                        assessmentType={assessmentType}
                        fetchDataBasedOnClientId={fetchDataBasedOnClientId}
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
                </div>

                {/* Sidebar Navigation */}
                <div className="sticky top-60 hidden w-40 space-y-7 self-start border-l pl-4 lg:block">
                    {["needs", "summary", "tasks", "risks"].map((section) => (
                        <button
                            key={section}
                            onClick={() => scrollToSection(section)}
                            className={`block w-full text-left text-sm capitalize transition-colors ${
                                activeSection === section
                                    ? "poppins-semibold text-customFeedCardBlueText"
                                    : "text-customGrey1 hover:text-customTextLightNavy"
                            }`}
                        >
                            {section}
                        </button>
                    ))}
                </div>
            </div>

            {/* Risk Modal */}
            <RiskModal
                data={selectedRisk}
                isOpen={isRiskModalOpen}
                onClose={() => setIsRiskModalOpen(false)}
                onSave={handleAddRisk}
            />
        </div>
    );
};

AssessmentLayout.propTypes = {
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
    defaultTasks: PropTypes.arrayOf(PropTypes.shape({})),
    assessmentType: PropTypes.string,
};

export default AssessmentLayout;
