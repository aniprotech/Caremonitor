export const clientsInfoConfigs = [
    {
        id: "culture-and-religion",
        componentTitle: "Culture and religion",
        fields: [
            { label: "Ethnicity", key: "ethnicity" },
            { label: "Religion", key: "religion" },
            { label: (name) => `How do culture and/or religion(s) impact ${name || 'the client'}'s care needs?`, key: "cultureImpact" },
        ],
    },
    {
        id: "sexuality",
        componentTitle: "Sexuality",
        componentDescription: "If you do not collect this information already, this section can be skipped.",
        fields: [
            { label: "Sex", key: "sex" },
            { label: "Sexual orientation", key: "sexualOrientation" },
            { label: (name) => `How does sex, gender or sexual orientation impact ${name || 'the client'}'s care needs?`, key: "sexualOrientationImpact" },
        ],
    },
    {
        id: "life-history",
        componentTitle: "Life history",
        fields: [
            { label: "Jobs and occupations", key: "jobsAndOccupations" },
            // { label: "Important people", key: "importantPeople" }, // uncomment if needed
            { label: "Significant places", key: "significantPlaces" },
            { label: "Other notes", key: "otherNotes" },
        ],
    },
    {
        id: "preferences",
        componentTitle: "Preferences",
        fields: [
            { label: "Routines and preferences", key: "routinesAndPreferences" },
            // { label: "Dislikes", key: "dislikes" }, // uncomment if needed
            { label: "Hobbies and interests", key: "hobbiesAndInterests" },
        ],
    },
];

export const personalIdentityData = (data) => ({
    ethnicity: data?.ethnicity || "",
    religion: data?.religion || "",
    cultureImpact: data?.cultureImpact || "",
    sex: data?.sex || null,
    gender: data?.gender || null,
    sexualOrientation: data?.sexualOrientation || "",
    sexualOrientationImpact: data?.sexualOrientationImpact || "",
    jobsAndOccupations: data?.jobsAndOccupations || "",
    significantPlaces: data?.significantPlaces || "",
    otherNotes: data?.otherNotes || "",
    routinesAndPreferences: data?.routinesAndPreferences || "",
    hobbiesAndInterests: data?.hobbiesAndInterests || "",
    importantPeople: data?.importantPeople || "",
    dislikes: data?.dislikes || "",
});

export const clinicalDetailsData = (data) => ({
    nhsNumber: data?.nhsNumber || "",
    medicalHistory: Array.isArray(data?.medicalHistory) ? data?.medicalHistory : [],
    hospitalName: data?.hospitalName || "",
    medicalSupport: data?.medicalSupport ?? false,
    allergiesIntolerances: data?.allergiesIntolerances || "",
    gpPracticeName: data?.gpPracticeName || "",
    gpPracticeIdentifier: data?.gpPracticeIdentifier || "",
    gpName: data?.gpName || "",
    gpPhoneNumber: data?.gpPhoneNumber || "",
    pharmacyName: data?.pharmacyName || "",
    pharmacyPhoneNumber: data?.pharmacyPhoneNumber || "",
    pharmacyPhoneCode: data?.pharmacyPhoneCode || "+44",
    pharmacyAddress: data?.pharmacyAddress || "",
    pharmacyPostCode: data?.pharmacyPostCode || "",
});

export const futurePlanningData = (data) => ({
    healthCapacityDecision: data?.healthCapacityDecision || null,
    healthWelfareLpa: data?.healthWelfareLpa || null,
    propertyFinancialLpa: data?.propertyFinancialLpa || null,
    dnacpr: data?.dnacpr || null,
    adrt: data?.adrt || null,
    respect: data?.respect || null,
});

export const keyContactsEmergencyContactsData = (data) => ({
    firstName: data?.firstName || "",
    lastName: data?.lastName || "",
    relationShip: data?.relationShip || null,
    phoneNumber: data?.phoneNumber || "",
    phoneCode: data?.phoneCode || "+44",
    email: data?.email || "",
    typeOfContact: Array.isArray(data?.typeOfContact) ? data?.typeOfContact : [],
    careMattersDiscussionAgreement: data?.careMattersDiscussionAgreement || false,
});

export const keyContactsOtherProfessionalsData = (data) => ({
    firstName: data?.firstName || "",
    lastName: data?.lastName || "",
    serviceName: data?.serviceName || "",
    role: data?.role || "",
    phoneNumber: data?.phoneNumber || "",
    phoneCode: data?.phoneCode || "+44",
    email: data?.email || "",
    careMattersDiscussionAgreement: data?.careMattersDiscussionAgreement || false,
});

export const agencyAdminData = (data) => ({
    serviceStartDate: data?.serviceStartDate || null,
    currentStatus: data?.currentStatus || "",
    receivesRegulatedCare: data?.receivesRegulatedCare ?? false,
    overallRiskLevel: data?.overallRiskLevel || null,
    riskLevelDetails: data?.riskLevelDetails || "",
    familyInvolvementLevel: data?.familyInvolvementLevel || null,
    staffingCrisisPlan: data?.staffingCrisisPlan || "",
    weatherConditionsPlan: data?.weatherConditionsPlan || "",
    additionalDetails: data?.additionalDetails || "",
    preferredContactMethod: data?.preferredContactMethod || null,
    fundingOption: Array.isArray(data?.fundingOption) ? data?.fundingOption : [],
    carerPreferences: data?.carerPreferences || null,
    otherPreferences: data?.otherPreferences || "",
    uniqueClientIdentifier: data?.uniqueClientIdentifier || "",
    localAuthorityId: data?.localAuthorityId || "",
    communicationOrInformationNeeds: data?.communicationOrInformationNeeds || [],
    
});

export const sectionHeaders = {
    personalIdentity: [
        { title: "Culture and Religion", id: "culture-religion-section" },
        { title: "Sexuality", id: "sexuality-section" },
        { title: "Life History", id: "life-history-section" },
        { title: "Preferences", id: "preferences-section" },
    ],
    clinicalDetails: [
        { title: "Health Details", id: "health-details-section" },
        { title: "Allergies and Intolerances", id: "allergies-section" },
        { title: "Doctor/GP", id: "doctor-gp-section" },
        { title: "Pharmacist", id: "pharmacist-section" },
    ],
    keyContacts: [
        { title: "Next of kin / Emergency contacts", id: "next-of-kin-section" },
        { title: "Other Professionals", id: "other-professionals-section" },
    ],
    futurePlanning: [{ title: "Capacity and Documentation", id: "capacity-documentation-section" }],
    agencyAdmin: [
        { title: "Identifiers", id: "identifiers" },
        { title: "Status", id: "status-section" },
        { title: "Regulated Care", id: "regulated-care-section" },
        { title: "Risk Management", id: "risk-management-section" },
        { title: "Accessible Information Standard", id: "accessible-info-section" },
        { title: "Funding Arrangements", id: "funding-arrangements-section" },
        { title: "Matching", id: "matching-section" },
    ],
};


export const inactivityTypes = [
    { value: "TEMPORARY", label: "Temporary" },
    { value: "PERMANENT", label: "Permanent" },
];

export const temporaryReasons = [
    { value: "ON_HOLIDAY", label: "On Holiday" },
    { value: "ADMITED_TO_HOSPITAL", label: "Admitted to Hospital" },
    { value: "RESPITE", label: "Respite" },
    { value: "TEMPORARY_OTHER", label: "Other" },
];

export const permanentReasons = [
    { value: "DESEASED", label: "Deceased" },
    { value: "LEFT_SERVICE", label: "Left Service" },
    { value: "PERMANENT_OTHER", label: "Other" },
];

export const leavingServiceReasons = [
    { value: "PRICE", label: "Price" },
    { value: "INCREASED_CARE_NEEDS", label: "Increased care needs" },
    { value: "DECREASED_CARE_NEEDS", label: "Decreased care needs" },
    { value: "RELOCATION", label: "Relocation" },
    { value: "SERVICE_QUALITY", label: "Service quality" },
    { value: "LEAVING_SERVICE_OTHER", label: "Other" },
];
