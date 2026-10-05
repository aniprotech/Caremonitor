import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useGlobalStore } from "../../../../../stores/useGlobalStore";
import { 
    getAssessmentQuestions, 
    getAdditionalAssessmentQuestions, 
    getAuditQuestions,
    getAssessmentDescription,
    getAdditionalAssessmentDescription,
    getAuditingAssessmentDescription
} from "../../../../../constants/clientCarePlan";
import { additionalAssessments, initialAssessments } from "../../../../../data/clients/clientCarePlanData";
import { _get } from "../../../../../utils/ApiService";
    // import DotLoader from "../../../../../components/Loader/DotLoader";
import { showError } from "../../../../../utils/toaster";
import { ArrowLeftIcon } from "lucide-react";
import { formatCustomDate } from "../../../../../utils/dateAndTimeUtil";
import { getAdditionalAssessmentByIdAPI } from "./additionalAssessmentAPIEndpoint/assessmentAPIEndpoint";
import { getAssessmentByIdAPI } from "./initialAssessmentApiEndpoint/initialAssessmentAPI";

const AssessmentDetails = () => {
    const navigate = useNavigate();
    const { id: clientId, assessmentType } = useParams();
    const [searchParams] = useSearchParams();
    const { clientsPersonalDetailData } = useGlobalStore();
    
    const [assessmentData, setAssessmentData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const assessmentId = searchParams.get("id");
    const assessmentName = searchParams.get("name");
    const clientName = clientsPersonalDetailData?.firstName || "the client";

    const { questions, title, description, isInitialAssessment, isAdditionalAssessment, isAuditingAssessment } = getAssessmentInfo(assessmentType);

    const handleBackClick = () => {
        navigate(-1);
    };

    // Get API endpoint based on assessment type
    const getAPIEndpoint = (assessmentType, assessmentId) => {
        const normalizedType = assessmentType?.replace(/-/g, "_").toLowerCase();
        if (isInitialAssessment) {
            const endpoint = getAssessmentByIdAPI(normalizedType, assessmentId);
            return endpoint;
        } else if (isAdditionalAssessment) {
            const endpoint = getAdditionalAssessmentByIdAPI(normalizedType, assessmentId);
            return endpoint;
        } else if (isAuditingAssessment) {
            return null;
        }
        return null;
    };

    // Fetch assessment data
    useEffect(() => {
        const fetchAssessmentData = async () => {
            if (!assessmentId) {
                setError("Assessment ID is required");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const endpoint = getAPIEndpoint(assessmentType, assessmentId);
                
                if (!endpoint) {
                    setError("API endpoint not configured for this assessment type");
                    setLoading(false);
                    return;
                }

                const response = await _get(endpoint);
                
                if (response?.data?.results?.data) {
                    setAssessmentData(response.data.results.data);
                } else {
                    setError("No assessment data found");
                }
            } catch (err) {
                console.error("Error fetching assessment data:", err);
                const errorMessage = err?.response?.data?.message || "Failed to fetch assessment data";
                setError(errorMessage);
                showError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        if (clientId && assessmentType && assessmentId) {
            fetchAssessmentData();
        }
    }, [clientId, assessmentType, assessmentId]);

    // Group questions by section
    const groupQuestionsBySection = (questions) => {
        const sections = {};
        questions.forEach(question => {
            const sectionId = question.section_id || 'general';
            const sectionName = question.section || 'General';
            
            if (!sections[sectionId]) {
                sections[sectionId] = {
                    id: sectionId,
                    name: sectionName,
                    questions: []
                };
            }
            sections[sectionId].questions.push(question);
        });
        return Object.values(sections);
    };

    // Format answer for display
    const formatAnswer = (question, answerData) => {
        if (!answerData || answerData.answer === null || answerData.answer === undefined || answerData.answer === "") {
            return "-";
        }

        const { answer } = answerData;
        const { answer_type } = question;

        // Handle empty strings, null, undefined
        if (answer === "" || answer === null || answer === undefined) {
            return "-";
        }

        switch (answer_type.type) {
            case "boolean": {
                return answer ? "Yes" : "No";
            }
            
            case "single_choice": {
                if (!answer) return "-";
                const choice = answer_type.choices?.find(c => c.choice_id === answer);
                return choice ? choice.label : (answer || "-");
            }
            
            case "multiple_choice": {
                if (Array.isArray(answer) && answer.length > 0) {
                    return answer.map(ans => {
                        const choice = answer_type.choices?.find(c => c.choice_id === ans);
                        return choice ? choice.label : ans;
                    }).join(", ");
                }
                return "-";
            }
            
            case "date": {
                if (answer) {
                    try {
                        return new Date(answer).toLocaleDateString();
                    } catch {
                        return answer || "-";
                    }
                }
                return "-";
            }
            
            case "number": {
                return answer !== null && answer !== undefined && answer !== "" ? answer.toString() : "-";
            }
            
            case "weight": {
                return answer ? `${answer} kg` : "-";
            }
            
            case "free_text":
            case "multi_line":
            default: {
                return answer && answer.trim() ? answer : "-";
            }
        }
    };

    const sections = groupQuestionsBySection(questions);

    // if (loading) {
    //     return (
    //         <div className="flex min-h-screen items-center justify-center">
    //             <DotLoader loading={loading} />
    //         </div>
    //     );
    // }

    const displayReviewDetails = () => {
        if (assessmentData?.reviewOutcome === "NO_CHANGES") {
          return "No changes required"
        }
        else if (assessmentData?.reviewOutcome === "MINOR_CHANGES") {
            return "Minor changes required"
        }
        else if (assessmentData?.reviewOutcome === "MAJOR_CHANGES") {
            return "Major Changes Required"
        }
    }

    if (error) {
        return (
            <div className="min-h-screen bg-white">
                {/* Header */}
                <div className="sticky top-[60px] z-50 border-b bg-white shadow-sm">
                    <div className="mx-auto px-6 py-7 md:px-20 xl:px-32">
                        <button
                            onClick={handleBackClick}
                            className="mb-6 flex items-center text-sm text-customFeedCardBlueText transition-colors hover:text-customTextLightNavy/80"
                        >
                            <ArrowLeftIcon className="mr-1 h-5 w-5" />
                            Back
                        </button>
                        <div>
                            <h1 className="poppins-medium mb-2 text-lg text-customBlack1">
                                Assessment Details
                            </h1>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Sticky Header */}
            <div className="sticky top-[60px] z-50 border-b bg-white shadow-sm">
                <div className="mx-auto px-6 py-7 md:px-20 xl:px-32">
                    <button
                        onClick={handleBackClick}
                        className="mb-6 flex items-center text-sm text-customFeedCardBlueText transition-colors hover:text-customTextLightNavy/80"
                    >
                        <ArrowLeftIcon className="mr-1 h-5 w-5" />
                        Back
                    </button>

                    <div>
                        <h1 className="poppins-medium mb-2 text-lg text-customBlack1">
                            {clientName}&apos;s {title.toLowerCase()} assessment
                            {assessmentName && (
                                <span className="ml-2 text-customFeedCardGreyText1">({decodeURIComponent(assessmentName)})</span>
                            )}
                        </h1>
                        <p className="text-sm text-customFeedCardGreyText1 mb-4">
                            {description}
                        </p>

                        {/* Assessment Details */}
                        {assessmentData && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-customFeedCardGreyText1 mb-1">Assessment date</p>
                                    <p className="text-customBlack1 font-medium">
                                        {formatCustomDate(assessmentData.submittedAt || assessmentData.createdAt, "")}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-customFeedCardGreyText1 mb-1">Assessor</p>
                                    <p className="text-customBlack1 font-medium">
                                        {assessmentData.submittedBy?.firstName || assessmentData.createdBy?.firstName} {assessmentData.submittedBy?.lastName || assessmentData.createdBy?.lastName}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Assessment Content */}
            <div className="mx-auto max-w-5xl px-6 py-10 md:px-20 xl:px-32 text-sm">
                <div className="space-y-12">
                    {sections.map((section) => (
                        <div key={section.id} className="space-y-6">
                            {/* Section Header */}
                            <div className="border-b border-gray-200 pb-4">
                                <h2 className="poppins-medium text-lg text-customBlack capitalize">
                                    {section.name}
                                </h2>
                            </div>

                            {/* Section Questions */}
                            <div className="space-y-8">
                                {section.questions.map((question) => {
                                    const answerData = assessmentData?.[question.id];
                                    const formattedAnswer = formatAnswer(question, answerData);
                                    const hasDetails = answerData?.details && answerData.details.trim();

                                    return (
                                        <div key={question.id} className="">
                                            {/* Question */}
                                            <div className="mb-3">
                                                <h3 className="poppins-medium text-base text-customBlack">
                                                    {question.title.replace(/\{\{firstname\}\}/g, clientName)}
                                                </h3>
                                                {question.subtitle && (
                                                    <p className="mt-1 text-sm text-customFeedCardGreyText1">
                                                        {question.subtitle.replace(/\{\{firstname\}\}/g, clientName)}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Answer */}
                                            <div className="space-y-3">
                                                <div className="">
                                                    <p className="text-customBlack2">
                                                        {formattedAnswer}
                                                    </p>
                                                </div>

                                                {/* Additional Details */}
                                                {hasDetails && (
                                                    <div className="rounded-md">
                                                        {/* <p className="text-sm font-medium text-blue-700 mb-2">Additional Details:</p> */}
                                                        <p className="text-customBlack2 text-sm whitespace-pre-wrap">
                                                            {answerData.details}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Review Details Section */}
                    {assessmentData?.reviewDetails !== null && (
                        <div className="mt-12 space-y-6">
                            <div className="border-b border-gray-200 pb-4">
                                <h2 className="poppins-medium text-lg text-customBlack">
                                    Review Details
                                </h2>
                            </div>
                            
                                <div className="rounded-md bg-gray-50 p-4">
                                    <p className="text-base font-medium text-customBlack mb-2">Review Status:</p>
                                    <p className="text-customBlack2 font-medium">
                                        {assessmentData?.reviewOutcome ? "Reviewed" : "Not reviewed"}
                                        <span className="text-customBlack2 mt-1 font-medium">
                                        {" - "}{displayReviewDetails()}
                                    </span>
                                    </p>
                                  
                                    {assessmentData?.reviewDetails && (
                                    <div className="mt-4">
                                        <p className="text-base font-medium text-customBlack mb-2">Review Comments:</p>
                                        <p className="text-customBlack2 text-sm whitespace-pre-wrap">
                                            {assessmentData?.reviewDetails}
                                        </p>
                                    </div>
                                )}
                                </div>
                                
                         
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper function to get assessment information
function getAssessmentInfo(assessmentType) {
    const initialAssessmentsList = initialAssessments || [];
    const additionalAssessmentsList = additionalAssessments || [];
    
    // Check if it's an initial assessment
    const initialAssessment = initialAssessmentsList.find(a => a.path === assessmentType);
    if (initialAssessment) {
        return {
            questions: getAssessmentQuestions(assessmentType),
            title: initialAssessment.title,
            description: getAssessmentDescription(assessmentType),
            isInitialAssessment: true,
            isAdditionalAssessment: false,
            isAuditingAssessment: false
        };
    }
    
    // Check if it's an additional assessment
    const additionalAssessment = additionalAssessmentsList.find(a => a.path === assessmentType);
    if (additionalAssessment) {
        return {
            questions: getAdditionalAssessmentQuestions(assessmentType),
            title: additionalAssessment.title,
            description: getAdditionalAssessmentDescription(assessmentType),
            isInitialAssessment: false,
            isAdditionalAssessment: true,
            isAuditingAssessment: false
        };
    }
    
    // Check if it's an auditing assessment
    const auditingAssessments = [
        { id: 'client-feedback', title: 'Client Feedback', path: 'client-feedback' },
        { id: 'courtesy-call', title: 'Courtesy Call', path: 'courtesy-call' },
        { id: 'service-review', title: 'Service Review', path: 'service-review' }
    ];
    
    const auditingAssessment = auditingAssessments.find(a => a.path === assessmentType);
    if (auditingAssessment) {
        return {
            questions: getAuditQuestions(assessmentType),
            title: auditingAssessment.title,
            description: getAuditingAssessmentDescription(assessmentType),
            isInitialAssessment: false,
            isAdditionalAssessment: false,
            isAuditingAssessment: true
        };
    }
    
    // Default fallback
    return {
        questions: getAssessmentQuestions(assessmentType),
        title: assessmentType.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
        description: "Assessment details and responses",
        isInitialAssessment: true,
        isAdditionalAssessment: false,
        isAuditingAssessment: false
    };
}

export default AssessmentDetails;
