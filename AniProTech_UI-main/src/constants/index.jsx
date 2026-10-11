
import {
    UserSquare,
    Info,
    ListOrdered,
    ClipboardList,
    // CalendarCheck,
    Pill,
    MapPin,
    Calendar,
    Users,
    UserPlus,
    Share2,
    Settings,
    Download,
    ClipboardCheck,
} from "lucide-react";

export const navLinks = [
    { path: "/admin/dashboard", label: "Dashboard" },
    { path: "/admin/clients", label: "Clients" },
    { path: "/admin/teams", label: "Team" },
    { path: "/admin/rosters", label: "Roster" },
    { path: "/admin/inbox", label: "Inbox" },
    { path: "/admin/logs", label: "Log" },
    { path: "/admin/finances", label: "Finance" },
    { path: "/admin/accounting", label: "Accounting" },
    { path: "/admin/reports", label: "Reporting" },
    { path: "/admin/governance", label: "Governance" },
];

export const accountLinks = [
    { label: "Help and support", to: "/admin/account?section=support" },
    { label: "Carer app settings", to: "/admin/account?section=carer-app" },
    { label: "Carer app message", to: "/admin/account?section=carer-app" },
    { label: "Upload logo", to: "/admin/account?section=branding" },
    { label: "Upload client documents", to: "/admin/clients" },
    { label: "Manage groups", to: "/admin/teams" },
    { label: "Manage runs", to: "/admin/rosters?planning=runs" },
];

export const statusOptions = ["active", "inactive"];
// export const statusOptions = ["active", "temp_inactive", "inactive"];
// export const statusOptions = ["ACTIVE", "INACTIVE", "SUSPENDED"];

// export const statusOptionsForTeams = [true,false];

export const statusForTeams = [
    { label: "Active", value: true },
    { label: "Inactive", value: false },
];

export const statusForClients = [
    { label: "Active", value: "Active" },
    { label: "Inactive", value: "Permanent_Inactive" },
    {label : "Temporary Inactive", value: "Temporary_Inactive"}
];

export const adminStatusForTeams = [
    { label: "Yes", value: "ADMIN" },
    { label: "No", value: "CAREGIVER" },
];

export const clientSidebarItems = [
    { icon: <UserSquare size={18} />, text: "Basic Information", to: "/admin/clients/:id/basic-info", active: true },
    { icon: <Info size={18} />, text: "Client Information", to: "/admin/clients/:id/client-info" },
    { icon: <ListOrdered size={18} />, text: "Client Feed", to: "/admin/clients/:id/client-feed" },
    { icon: <ClipboardList size={18} />, text: "Care Plan", to: "/admin/clients/:id/care-plan" },
    { icon: <ClipboardCheck size={18} />, text: "Task Planner", to: "/admin/clients/:id/task-planner" },
    { icon: <Pill size={18} />, text: "Medication", to: "/admin/clients/:id/medication" },
    { icon: <MapPin size={18} />, text: "Visits", to: "/admin/clients/:id/visits" },
    { icon: <Calendar size={18} />, text: "Calendar", to: "/admin/clients/:id/calendar" },
    { icon: <Users size={18} />, text: "Care Team", to: "/admin/clients/:id/care-team" },
    { icon: <UserPlus size={18} />, text: "Care Circle", to: "/admin/clients/:id/care-circle" },
    { icon: <Share2 size={18} />, text: "Share Access", to: "/admin/clients/:id/share-access" },
    { icon: <Settings size={18} />, text: "Settings", to: "/admin/clients/:id/settings" },
    { icon: <Download size={18} />, text: "Download Info", to: "/admin/clients/:id/download-info" },
];

export const clientsProfileTitleOptions = [
    { label: "Select title", value: "" },
    { label: "Mr", value: "MR" },
    { label: "Mrs", value: "MRS" },
    { label: "Master", value: "MASTER" },
    { label: "Miss", value: "MISS" },
    { label: "Ms", value: "MS" },
    { label: "Mx", value: "MX" },
    { label: "Sir", value: "SIR" },
    { label: "Lady", value: "LADY" },
    { label: "Lord", value: "LORD" },
    { label: "Dame", value: "DAME" },
    { label: "Dr.", value: "DR" },
    { label: "Prof.", value: "PROF" },
];

export const clientsProfilePronounOptions = ["HE_HIM", "SHE_HER", "THEY_THEM"];

export const clientsProfileSections = [
    { label: "Profile", id: "ClientProfile" },
    { label: "Contact details", id: "ClientContact" },
    { label: "Addresses", id: "ClientAddress" },
    { label: "Highlights", id: "ClientHighlights" },
];

export const clientsContactPhoneTypes = [
    { label: "Select phone type", value: "" },
    { label: "Mobile", value: "MOBILE" },
    { label: "Home", value: "HOME" },
    { label: "Work", value: "WORK" },
    { label: "Temp", value: "TEMP" },
];

export const clientsContactAddressTypes = [
    { value: "", label: "Select address" },
    { value: "MAIN_BUSINESS_PREMISES", label: "Main Business Premises" },
    { value: "PERMANENT_RESIDENCE", label: "Other Permanent Residence" },
    { value: "TEMPORARY_RESIDENCE", label: "Temporary Residence" },
    { value: "INVOICE", label: "Invoice" },
    { value: "CORRESPONDENCE", label: "Correspondence (Non-Residence)" },
    { value: "OTHER_BUSINESS_PREMISES", label: "Other Business Premises" },
];

export const teamsPronounOptions = [
    { label: "He/Him", value: "HE_HIM" },
    { label: "She/Her", value: "SHE_HER" },
    { label: "They/Them", value: "THEY_THEM" },
];

export const teamsGenderOptions = [
    { label: "Female", value: "FEMALE" },
    { label: "Male", value: "MALE" },
    { label: "Non-binary", value: "NON_BINARY" },
    { label: "Rather not say", value: "NOT_SAY" },
];

export const teamTypeOfContactOptions = [
    { label: "Emergency", value: "EMERGENCY" },
    { label: "Next Of Kin", value: "NEXT_OF_KIN" },
];

export const teamCommunicationPreferredMethod = [
    { label: "Email", value: "EMAIL" },
    { label: "Phone", value: "PHONE" },
    { label: "Text", value: "TEXT" },
    { label: "App", value: "APP" },
];
