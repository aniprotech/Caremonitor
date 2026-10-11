import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/theme-context";
import Layout from "./layout";

import ClientIndex from "./pages/Clients/ClientIndex";
import TeamIndex from "./pages/Teams/TeamIndex";
import ReportIndex from "./pages/Reporting/ReportIndex";
import ReportDetail from "./pages/Reporting/ReportDetail";
import GovernanceIndex from "./pages/Governance/GovernanceIndex";
import LogIndex from "./pages/Log/LogIndex";
import RosterIndex from "./pages/Roster/RosterIndex";
import InboxIndex from "./pages/Inbox/InboxIndex";
import FinanceIndex from "./pages/Finance/FinanceIndex";
import AccountingIndex from "./pages/Accounting/AccountingIndex";
import AccountSettings from "./pages/Account/AccountSettings";
import PlatformAdmin from "./pages/Platform/PlatformAdmin";
import Settings from "./components/Settings/Settings";
import AuthIndex from "./pages/Auth/AuthIndex";
import AddClients from "./pages/Clients/AddClients";
import NotFound from "./components/Common/NotFound";
import CreateClientIndex from "./pages/Clients/CreateClients/CreateClientIndex";
import { Toaster } from "sonner";
import ProtectedRoute from "./components/Common/PrivateRoutes";
import { useEffect, useState } from "react";
import CreateTeamIndex from "./pages/Teams/CreateTeams/CreateTeamIndex";
import ClientsInfo from "./pages/Clients/ViewClients/ClientsInfo/ClientsInfo";
// import TaskPlanner from "./pages/Clients/ViewClients/TaskPlanner";
// import ClientFeed from "./pages/Clients/ViewClients/ClientFeed";
// import CarePlan from "./pages/Clients/ViewClients/CarePlan";
// import Meditation from "./pages/Clients/ViewClients/Meditation";
import ShareAccess from "./pages/Clients/ViewClients/ShareAccess";
import ClientsSettings from "./pages/Clients/ViewClients/ClientsSettings";
import DownloadInfo from "./pages/Clients/ViewClients/DownloadInfo";
import EditBaseInfo from "./pages/Clients/ViewClients/BaseInfo/EditBaseInfo";
import BaseInfoIndex from "./pages/Clients/ViewClients/BaseInfo/BaseInfoIndex";
import ViewTeamIndex from "./pages/Teams/ViewTeams/ViewTeamIndex";
import TeamsInfoIndex from "./pages/Teams/ViewTeams/TeamsInfo/TeamsInfoIndex";
import CarerFeedIndex from "./pages/Teams/ViewTeams/CarerFeed/CarerFeedIndex";
import OnboardingIndex from "./pages/Teams/ViewTeams/Onboarding/OnboardingIndex";
import SkillsIndex from "./pages/Teams/ViewTeams/Skills/SkillsIndex";
import ClientsIndex from "./pages/Teams/ViewTeams/Clients/ClientsIndex";
import CalendarIndex from "./pages/Teams/ViewTeams/Calendar/CalendarIndex";
import AvailabilityIndex from "./pages/Teams/ViewTeams/Availability/AvailabilityIndex";
import AdminIndex from "./pages/Teams/ViewTeams/Admin/AdminIndex";
import OperationIndex from "./pages/Teams/ViewTeams/Operations/OperationIndex";
import EditProfile from "./pages/Teams/ViewTeams/TeamsInfo/EditTeamsProfile/EditProfile";
import EditAdditionalDetails from "./pages/Teams/ViewTeams/TeamsInfo/EditTeamsProfile/EditAdditionalDetails";
import EditIdentity from "./pages/Teams/ViewTeams/TeamsInfo/EditTeamsProfile/EditIdentity";
import EditKeyContact from "./pages/Teams/ViewTeams/TeamsInfo/EditKeyContact/EditKeyContact";
import EditTermination from "./pages/Teams/ViewTeams/TeamsInfo/EditAgencyAdmin/EditTermination";
import EditCommunication from "./pages/Teams/ViewTeams/TeamsInfo/EditAgencyAdmin/EditCommunication";
import EditGroups from "./pages/Teams/ViewTeams/TeamsInfo/EditAgencyAdmin/EditGroups";
import EditRolesAndStatus from "./pages/Teams/ViewTeams/TeamsInfo/EditAgencyAdmin/EditRolesAndStatus";
import NotesTypeFeed from "./pages/Teams/ViewTeams/CarerFeed/NewFeedTabs/NotesTypeFeed";
import FeedDetails from "./pages/Teams/ViewTeams/CarerFeed/FeedDetails";
import ConcernType from "./pages/Teams/ViewTeams/CarerFeed/NewFeedTabs/ConcernType";
import ActionType from "./pages/Teams/ViewTeams/CarerFeed/NewFeedTabs/ActionType";
import EditRates from "./pages/Teams/ViewTeams/Operations/Edit/EditRates";
import EditTravelInfo from "./pages/Teams/ViewTeams/Operations/Edit/EditTravelInfo";
import TimeOff from "./pages/Teams/ViewTeams/TimeOff/TimeOff";
import EditOnboarding from "./pages/Teams/ViewTeams/Onboarding/Edit/EditOnboarding";
import BookAbsence from "./pages/Teams/ViewTeams/Availability/BookAbsence";
import EditPersonalIdentity from "./pages/Clients/ViewClients/ClientsInfo/Edit/EditPersonalIdentity";
import EditClinicalDetails from "./pages/Clients/ViewClients/ClientsInfo/Edit/EditClinicalDetails";
import EditClientKeyContact from "./pages/Clients/ViewClients/ClientsInfo/Edit/EditClientKeyContact";
import EditFuturePlanning from "./pages/Clients/ViewClients/ClientsInfo/Edit/EditFuturePlanning";
import EditClientAgencyAdmin from "./pages/Clients/ViewClients/ClientsInfo/Edit/EditClientAgencyAdmin";
import EditClientsInfo from "./pages/Clients/ViewClients/ClientsInfo/Edit/EditClientsInfo";
import ClientCarerFeedIndex from "./pages/Clients/ViewClients/CarerFeed/CarerFeedIndex";
import ClientsCalendarIndex from "./pages/Clients/ViewClients/Calendar/ClientsCalendarIndex";
import ClientPortal from "./pages/Portal/ClientPortal";
import PublicInfoPage from "./pages/Public/PublicInfoPage";
import RootLanding from "./components/Common/RootLanding";
import PublicPlatformPage from "./pages/Public/PublicPlatformPage";
import PublicContentPage from "./pages/Public/PublicContentPage";
import ClientsCareTeamIndex from "./pages/Clients/ViewClients/Clients/ClientsCareTeamIndex";
import CarePlanIndex from "./pages/Clients/ViewClients/CarePlan/CarePlanIndex";
import SocialSupportAssessment from "./pages/Clients/ViewClients/CarePlan/InitialAssessments/SocialSupportAssessment";
import EnvironmentalAssessment from "./pages/Clients/ViewClients/CarePlan/InitialAssessments/EnvironmentalAssessment";
import NutritionAssessment from "./pages/Clients/ViewClients/CarePlan/InitialAssessments/NutritionAssessment";
import MedicalAssessment from "./pages/Clients/ViewClients/CarePlan/InitialAssessments/MedicalAssessment";
import AdminAssessment from "./pages/Clients/ViewClients/CarePlan/InitialAssessments/AdminAssessment";
import PsychologicalAssessment from "./pages/Clients/ViewClients/CarePlan/InitialAssessments/PsychologicalAssessment";
import PersonalCareAssessment from "./pages/Clients/ViewClients/CarePlan/InitialAssessments/PersonalCareAssessment";
import EveryDayAssessment from "./pages/Clients/ViewClients/CarePlan/InitialAssessments/EveryDayAssessment";
import WaterlowAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/WaterlowAssessment";
import BehaviorAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/BehaviorAssessment";
import CommunicationAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/CommunicationAssessment";
import ConditionSpecificAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/ConditionSpecificAssessment";
import CovidAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/CovidAssessment";
import ControlSubstancesAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/ControlSubstancesAssessment";
import DrainageAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/DrainageAssessment";
import EndOfLifeAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/EndOfLifeAssessment";
import EnvironmentFireAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/EnvironmentFireAssessment";
import FinancialAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/FinancialAssessment";
import MedicationAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/MedicationAssessment";
import MentalCapacityAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/MentalCapacityAssessment";
import MovingHandlingAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/MovingHandlingAssessment";
import RestrictivePracticeAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/RestrictivePracticeAssessment";
import SeizuresAssessment from "./pages/Clients/ViewClients/CarePlan/AdditionalAssessments/SeizuresAssessment";
import TaskPlanIndex from "./pages/Clients/ViewClients/TaskPlan/TaskPlanIndex";
import MedicationIndex from "./pages/Clients/ViewClients/Medication/MedicationIndex";
import MedicationPersonalDetails from "./pages/Clients/ViewClients/Medication/MedicationPersonalDetails";
import MedicationScheduling from "./pages/Clients/ViewClients/Medication/MedicationScheduling";
import MedicationMonitoring from "./pages/Clients/ViewClients/Medication/MedicationMonitoring";
import MedicationHelp from "./pages/Clients/ViewClients/Medication/MedicationHelp";
import AssessmentPage from "./pages/Clients/ViewClients/CarePlan/components/AssessmentPage";
import AdditionalAssessmentPage from "./pages/Clients/ViewClients/CarePlan/components/AdditionalAssessmentPage";
import AuditAssessmentPage from "./pages/Clients/ViewClients/CarePlan/AuditingDocuments/AuditAssessmentPage";
import AssessmentDetails from "./pages/Clients/ViewClients/CarePlan/components/AssessmentDetails";
import ClientFeedback from "./pages/Clients/ViewClients/CarePlan/AuditingDocuments/ClientFeedback";
import CounterSign from "./pages/Clients/ViewClients/CarePlan/AuditingDocuments/CounterSign";
import ServiceReview from "./pages/Clients/ViewClients/CarePlan/AuditingDocuments/ServiceReview";
import SignatureDocument from "./pages/Clients/ViewClients/CarePlan/Documents/SignatureDocument";
import UploadDocuments from "./pages/Clients/ViewClients/CarePlan/Documents/UploadDocuments";
import DownloadDocument from "./pages/Clients/ViewClients/CarePlan/Documents/DownloadDocument";
import SignDocument from "./pages/Clients/ViewClients/CarePlan/Documents/SignDocument";
import CareCircleIndex from "./pages/Clients/ViewClients/CareCircle/CareCircleIndex";
import VisitIndex from "./pages/Clients/ViewClients/Visit/VisitIndex";
import ScheduleEdit from "./pages/Clients/ViewClients/Visit/DialogComponents/ScheduleEdit";
import CreateCareCircle from "./pages/Clients/ViewClients/CareCircle/CreateCareCircle";
import AddMedicationForm from "./pages/Clients/ViewClients/Medication/AddMedicationForm";

const router = createBrowserRouter([
    { path: "/", element: <RootLanding /> },
    { path: "/platform/:product", element: <PublicPlatformPage /> },
    { path: "/products", element: <PublicContentPage page="products" /> },
    { path: "/solutions", element: <PublicContentPage page="solutions" /> },
    { path: "/case-studies", element: <PublicContentPage page="case-studies" /> },
    { path: "/resources", element: <PublicContentPage page="resources" /> },
    { path: "/about", element: <PublicContentPage page="about" /> },
    { path: "/privacy", element: <PublicInfoPage kind="privacy" /> },
    { path: "/terms", element: <PublicInfoPage kind="terms" /> },
    { path: "/account-deletion", element: <PublicInfoPage kind="deletion" /> },
    { path: "/support", element: <PublicInfoPage kind="support" /> },
    {
        path: "/login",
        element: <AuthIndex />,
    },
    { path: "/access", element: <ClientPortal /> },
    {
        path: "*",
        element: <NotFound />,
    },
    {
        path: "/admin",
        element: (
            <ProtectedRoute>
                <Layout />
            </ProtectedRoute>
        ),
        children: [
            {
                path: "clients",
                element: <ClientIndex />,
            },
            {
                path: "clients/add-clients",
                element: <CreateClientIndex />,
            },
            {
                path: "clients/:id",
                element: <AddClients />,
                children: [
                    {
                        index: true,
                        element: (
                            <Navigate
                                to="basic-info"
                                replace
                            />
                        ),
                    },
                    {
                        path: "basic-info",
                        element: <BaseInfoIndex />,
                    },
                    {
                        path: "basic-info/edit",
                        element: <EditBaseInfo />,
                    },
                    {
                        path: "client-info",
                        element: <ClientsInfo />,
                    },
                    {
                        path: "client-info/personal-identity/edit",
                        element: <EditPersonalIdentity />,
                    },
                    {
                        path: "client-info/clinical-details/edit",
                        element: <EditClinicalDetails />,
                    },
                    {
                        path: "client-info/key-contacts/edit",
                        element: <EditClientKeyContact />,
                    },
                    {
                        path: "client-info/future-planning/edit",
                        element: <EditFuturePlanning />,
                    },
                    {
                        path: "client-info/agency-admin/edit",
                        element: <EditClientAgencyAdmin />,
                    },
                    {
                        path: "client-info/edit",
                        element: (
                            <EditClientsInfo />
                        ),
                    },
                    {
                        path: "client-feed",
                        element: <ClientCarerFeedIndex />,
                        children: [
                            {
                                index: true,
                                element: <FeedDetails />,
                            },
                            {
                                path: "notes/concern",
                                element: <ConcernType />,
                            },
                            {
                                path: "notes/action",
                                element: <ActionType />,
                            },
                            {
                                path: "notes/complaint",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="Complaint"
                                        titleDescription="complaint"
                                    />
                                ),
                            },
                            {
                                path: "notes/compliment",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="Compliment"
                                        titleDescription="compliment"
                                    />
                                ),
                            },
                            {
                                path: "notes/general-note",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="General Note"
                                        titleDescription="general note"
                                    />
                                ),
                            },
                            {
                                path: "notes/introduction",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="Introduction"
                                        titleDescription="introduction"
                                    />
                                ),
                            },
                            {
                                path: "notes/check-in-call",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="Check-in Call"
                                        titleDescription="check-in-call"
                                    />
                                ),
                            },
                            {
                                path: "notes/audit",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="Audit"
                                        titleDescription="audit"
                                    />
                                ),
                            },
                        ],
                    },
                    {
                        path: "care-plan",
                        element: <CarePlanIndex />,
                    },
                    {
                        path: "care-plan/personal-care",
                        element: <PersonalCareAssessment />,
                    },
                    {
                        path: "care-plan/everyday-activities",
                        element: <EveryDayAssessment />,
                    },
                    {
                        path: "care-plan/social-support",
                        element: <SocialSupportAssessment />,
                    },
                    {
                        path: "care-plan/environmental",
                        element: <EnvironmentalAssessment />,
                    },
                    {
                        path: "care-plan/nutrition-hydration",
                        element: <NutritionAssessment />,
                    },
                    {
                        path: "care-plan/medical",
                        element: <MedicalAssessment />,
                    },
                    {
                        path: "care-plan/administration",
                        element: <AdminAssessment />,
                    },
                    {
                        path: "care-plan/psychological",
                        element: <PsychologicalAssessment />,
                    },

                    // Additional Assessments
                    {
                        path: "care-plan/behaviour",
                        element: <BehaviorAssessment />,
                    },
                    {
                        path: "care-plan/communication",
                        element: <CommunicationAssessment />,
                    },
                    {
                        path: "care-plan/condition-specific",
                        element: <ConditionSpecificAssessment />,
                    },
                    {
                        path: "care-plan/covid",
                        element: <CovidAssessment />,
                    },
                    {
                        path: "care-plan/control-substances",
                        element: <ControlSubstancesAssessment />,
                    },
                    {
                        path: "care-plan/dysphagia",
                        element: <DrainageAssessment />,
                    },
                    {
                        path: "care-plan/end-of-life",
                        element: <EndOfLifeAssessment />,
                    },
                    {
                        path: "care-plan/environment-fire",
                        element: <EnvironmentFireAssessment />,
                    },
                    {
                        path: "care-plan/financial",
                        element: <FinancialAssessment />,
                    },
                    {
                        path: "care-plan/medication",
                        element: <MedicationAssessment />,
                    },
                    {
                        path: "care-plan/mental-capacity",
                        element: <MentalCapacityAssessment />,
                    },
                    {
                        path: "care-plan/moving-handling",
                        element: <MovingHandlingAssessment />,
                    },
                    {
                        path: "care-plan/restrictive-practice",
                        element: <RestrictivePracticeAssessment />,
                    },
                    {
                        path: "care-plan/seizures",
                        element: <SeizuresAssessment />,
                    },
                    {
                        path: "care-plan/waterlow",
                        element: <WaterlowAssessment />,
                    },

                    // Auditing Documents
                    {
                        path: "care-plan/client-feedback",
                        element: <ClientFeedback />,
                    },
                    {
                        path: "care-plan/courtesy-call",
                        element: <CounterSign />,
                    },
                    {
                        path: "care-plan/upload-documents",
                        element: <UploadDocuments />,
                    },
                    {
                        path: "care-plan/signature-document",
                        element: <SignatureDocument />,
                    },
                    {
                        path: "care-plan/signature-document/sign",
                        element: <SignDocument />,
                    },
                    {
                        path: "care-plan/download-document",
                        element: <DownloadDocument />,
                    },
                    {
                        path: "care-plan/service-review",
                        element: <ServiceReview />,
                    },
                    {
                        path: "task-planner",
                        element: <TaskPlanIndex />,
                    },
                    {
                        path: "medication",
                        element: <MedicationIndex />,
                    },
                    {
                        path: "medication/personal-details",
                        element: <MedicationPersonalDetails />,
                    },
                    {
                        path: "medication/scheduling",
                        element: <MedicationScheduling />,
                    },
                    {
                        path: "medication/monitoring",
                        element: <MedicationMonitoring />,
                    },
                    {
                        path: "medication/help",
                        element: <MedicationHelp />,
                    },
                    {
                        path: "medication/schedule/add",
                        element: <AddMedicationForm />,
                    },
                    {
                        path: "medication/schedule/edit/:scheduleId",
                        element: <AddMedicationForm />,
                    },
                    {
                        path: "visits",
                        element: <VisitIndex />,
                    },
                    {
                        path: "visits/schedule-edit/:visitId",
                        element: <ScheduleEdit />,
                    },
                    {
                        path: "calendar",
                        element: <ClientsCalendarIndex />,
                    },
                    {
                        path: "care-team",
                        element: <ClientsCareTeamIndex />,
                    },
                    {
                        path: "care-circle",
                        element: <CareCircleIndex />,
                    },
                    {
                        path: "care-circle/create",
                        element: <CreateCareCircle />,
                    },
                    {
                        path: "care-circle/edit/:memberId",
                        element: <CreateCareCircle />,
                    },
                    {
                        path: "share-access",
                        element: <ShareAccess />,
                    },
                    {
                        path: "settings",
                        element: <ClientsSettings />,
                    },
                    {
                        path: "download-info",
                        element: <DownloadInfo />,
                    },
                    {
                        path: "care-plan/:assessmentType/assessment",
                        element: <AssessmentPage />,
                    },
                    {
                        path: "care-plan/:assessmentType/additional-assessment",
                        element: <AdditionalAssessmentPage />,
                    },
                    {
                        path: "care-plan/:assessmentType/auditing-assessment",
                        element: <AuditAssessmentPage />,
                    },
                    {
                        path: "care-plan/:assessmentType/assessment-details",
                        element: <AssessmentDetails />,
                    },
                ],
            },
            {
                path: "teams",
                element: <TeamIndex />,
            },
            {
                path: "teams/add-teams",
                element: <CreateTeamIndex />,
            },
            {
                path: "teams/:id",
                element: <ViewTeamIndex />,
                children: [
                    {
                        index: true,
                        element: (
                            <Navigate
                                to="teams-info"
                                replace
                            />
                        ),
                    },
                    {
                        path: "teams-info",
                        element: <TeamsInfoIndex />,
                    },
                    {
                        path: "teams-info/edit/profile/",
                        element: <EditProfile />,
                    },
                    {
                        path: "teams-info/edit/additional-details/",
                        element: <EditAdditionalDetails />,
                    },
                    {
                        path: "teams-info/edit/personal-identity/",
                        element: <EditIdentity />,
                    },

                    {
                        path: "teams-info/edit/key-contact",
                        element: <EditKeyContact />,
                    },
                    {
                        path: "teams-info/edit/roles-and-status",
                        element: <EditRolesAndStatus />,
                    },
                    {
                        path: "teams-info/edit/groups",
                        element: <EditGroups />,
                    },
                    {
                        path: "teams-info/edit/communication",
                        element: <EditCommunication />,
                    },
                    {
                        path: "teams-info/edit/termination",
                        element: <EditTermination />,
                    },
                    {
                        path: "carer-feed",
                        element: <CarerFeedIndex />,
                        children: [
                            {
                                index: true,
                                element: <FeedDetails />,
                            },
                            {
                                path: "notes/concern",
                                element: <ConcernType />,
                            },
                            {
                                path: "notes/action",
                                element: <ActionType />,
                            },
                            {
                                path: "notes/complaint",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="Complaint"
                                        titleDescription="complaint"
                                    />
                                ),
                            },
                            {
                                path: "notes/compliment",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="Compliment"
                                        titleDescription="compliment"
                                    />
                                ),
                            },
                            {
                                path: "notes/general-note",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="General Note"
                                        titleDescription="general note"
                                    />
                                ),
                            },
                            {
                                path: "notes/introduction",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="Introduction"
                                        titleDescription="introduction"
                                    />
                                ),
                            },
                            {
                                path: "notes/check-in-call",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="Check-in Call"
                                        titleDescription="check-in-call"
                                    />
                                ),
                            },
                            {
                                path: "notes/audit",
                                element: (
                                    <NotesTypeFeed
                                        noteLabel="Audit"
                                        titleDescription="audit"
                                    />
                                ),
                            },
                        ],
                    },
                    {
                        path: "operations",
                        element: <OperationIndex />,
                    },
                    {
                        path: "operations/edit/rates",
                        element: <EditRates />,
                    },
                    {
                        path: "operations/edit/travel-info",
                        element: <EditTravelInfo />,
                    },
                    {
                        path: "onboarding",
                        element: <OnboardingIndex />,
                    },
                    {
                        path: "onboarding/edit",
                        element: <EditOnboarding />,
                    },
                    {
                        path: "skills",
                        element: <SkillsIndex />,
                    },
                    {
                        path: "clients",
                        element: <ClientsIndex />,
                    },
                    {
                        path: "calendar",
                        element: <CalendarIndex />,
                    },
                    {
                        path: "availability",
                        element: <AvailabilityIndex />,
                    },
                    {
                        path: "time-off",
                        element: <TimeOff />,
                    },
                    {
                        path: "availability/book-absence",
                        element: <BookAbsence />,
                    },
                    {
                        path: "admin",
                        element: <AdminIndex />,
                    },
                ],
            },
            {
                path: "reports",
                element: <ReportIndex />,
            },
            {
                path: "reports/:reportId",
                element: <ReportDetail />,
            },
            {
                path: "governance",
                element: <GovernanceIndex />,
            },
            {
                path: "logs",
                element: <LogIndex />,
            },
            {
                path: "rosters",
                element: <RosterIndex />,
            },
            {
                path: "inbox",
                element: <InboxIndex />,
            },
            {
                path: "finances",
                element: <FinanceIndex />,
            },
            {
                path: "accounting",
                element: <AccountingIndex />,
            },
            {
                path: "account",
                element: <AccountSettings />,
            },
            {
                path: "platform",
                element: <PlatformAdmin />,
            },
            {
                path: "settings",
                element: <Settings />,
            },
        ],
    },
]);

function App() {
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 3000); // 3 seconds

        return () => clearTimeout(timer);
    }, []);

    return (
        <ThemeProvider storageKey="theme">
            <Toaster
                position="bottom-right"
                richColors
                dismissible
            />
            {showSplash ? (
                <div className="brand-loader" role="status" aria-label="Caremonitor is loading">
                    <div className="brand-loader__halo" aria-hidden="true" />
                    <div className="brand-loader__ring brand-loader__ring--one" aria-hidden="true" />
                    <div className="brand-loader__ring brand-loader__ring--two" aria-hidden="true" />
                    <img src="/brand-mark.png" alt="Caremonitor" className="brand-loader__mark" />
                    <span className="sr-only">Loading</span>
                </div>
            ) : (
                <RouterProvider router={router} />
            )}{" "}
        </ThemeProvider>
    );
}

export default App;
