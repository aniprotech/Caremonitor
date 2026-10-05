export const clinicalDetailsConfig = [
    {
        id: "health-details",
        componentTitle: "Health details",
        fields: [
            { label: "NHS number", key: "nhsNumber" },
            { label: "Medical history", key: "medicalHistory" },
            { label: "Hospital", key: "hospitalName" },
            { label: "Medical support", key: "medicalSupport" },
        ],
    },
    {
        id: "allergies-intolerances",
        componentTitle: "Allergies and intolerances",
        fields: [{ label: "Allergies and intolerances", key: "allergiesIntolerances" }],
    },
    {
        id: "doctor-gp",
        componentTitle: "Doctor/GP",
        fields: [
            { label: "GP practice name", key: "gpPracticeName" },
            { label: "GP practice identifier", key: "gpPracticeIdentifier" },
            { label: "GP's name", key: "gpName" },
            { label: "Phone number", key: "gpPhoneNumber" },
        ],
    },
    {
        id: "pharmacist",
        componentTitle: "Pharmacist",
        fields: [
            { label: "Pharmacy name", key: "pharmacyName" },
            { label: "Phone number", key: "pharmacyPhoneNumber" },
            { label: "Phone code", key: "pharmacyPhoneCode" },
            { label: "Address", key: "pharmacyAddress" },
            { label: "Post code", key: "pharmacyPostCode" },
        ],
    },
];

export const futurePlanningConfig = [
    {
        id: "capacity-documentation",
        componentTitle: "Capacity and documentation",
        fields: [
            { label: (clientName) => `Does ${clientName} have capacity to make decisions related to their health and wellbeing?`, key: "healthCapacityDecision" },
            { label: "Health and Welfare LPA", key: "healthWelfareLpa" },
            { label: "Health and Welfare LPA / POA reference", key: "healthWelfareLpaReference" },
            { label: "Health and Welfare LPA registered date", key: "healthWelfareLpaDate" },
            { label: "Health and Welfare LPA end/revocation date", key: "healthWelfareLpaExpiry" },
            { label: "Property and Financial Affairs LPA", key: "propertyFinancialLpa" },
            { label: "Property and Financial LPA / POA reference", key: "propertyFinancialLpaReference" },
            { label: "Property and Financial LPA registered date", key: "propertyFinancialLpaDate" },
            { label: "Property and Financial LPA end/revocation date", key: "propertyFinancialLpaExpiry" },
            { label: "Do Not Attempt Cardiopulmonary Resuscitation (DNACPR)", key: "dnacpr" },
            { label: "Advance Decision to Refuse Treatment (ADRT / Living Will)", key: "adrt" },
            { label: "Recommended Summary Plan for Emergency Care and Treatment (ReSPECT)", key: "respect" },
        ],
    },
];

export const keyContactsConfig = [
    {
        id: "nok-emergency",
        componentTitle: "NoK / emergency contacts",
        fields: [
            { label: "First name", key: "firstName" },
            { label: "Last name", key: "lastName" },
            { label: "Relationship", key: "relationShip" },
            { label: "Phone number", key: "phoneNumber" },
            { label: "Phone code", key: "phoneCode" },
            { label: "Email address", key: "email" },
            { label: "Type of contact", key: "typeOfContact" },
            {
                label: (clientName) => `Does ${clientName} or person making a best interests decision on their behalf agree that general care matters can be discussed with this contact?`,
                key: "careMattersDiscussionAgreement",
            },
        ],
    },
    {
        id: "other-professionals",
        componentTitle: "Other professionals",
        fields: [
            { label: "First name", key: "firstName" },
            { label: "Last name", key: "lastName" },
            { label: "Service name", key: "serviceName" },
            { label: "Role", key: "role" },
            { label: "Phone number", key: "phoneNumber" },
            { label: "Phone code", key: "phoneCode" },
            { label: "Email address", key: "email" },
            {
                label: (clientName) => `Does ${clientName} or person making a best interests decision on their behalf agree that general care matters can be discussed with this contact?`,
                key: "careMattersDiscussionAgreement",
            },
        ],
    },
];

export const agencyAdminConfig = [
    {
        id: "status",
        componentTitle: "Status",
        fields: [
            { label: "Service start date", key: "serviceStartDate" },
            { label: "Current Status", key: "clientInactivity" },
        ],
    },
    {
        id: "regulated-care",
        componentTitle: "Regulated care",
        fields: [{ label: (clientName) => `Does ${clientName} receive regulated care?`, key: "receivesRegulatedCare" }],
    },
    {
        id: "risk-management",
        componentTitle: "Risk management",
        fields: [
            { label: (clientName) => `Assign an overall risk level to ${clientName} in line with your contingency plan.`, key: "overallRiskLevel" },
            { label: "Risk level details", key: "riskLevelDetails" },
            { label: "Family involvement level", key: "familyInvolvementLevel" },
            { label: (clientName) => `What is the contingency plan for ${clientName}'s care, in the case of a staffing crisis?`, key: "staffingCrisisPlan" },
            { label: (clientName) => `What is the contingency plan for ${clientName}'s care, in the case of adverse weather conditions?`, key: "weatherConditionsPlan" },
        ],
    },
    {
        id: "accessible-info",
        componentTitle: "Accessible Information Standard",
        fields: [
            { label: "Additional details", key: "additionalDetails" },
            { label: (clientName) => `What is ${clientName}'s preferred method of contact for admin matters?`, key: "preferredContactMethod" },
        ],
    },
    {
        id: "funding",
        componentTitle: "Funding arrangements",
        fields: [{ label: "Please select one or more funding options:", key: "fundingOption" }],
    },
    {
        id: "matching",
        componentTitle: "Matching",
        componentDescription: "If you do not collect this information already, this section can be skipped.",
        fields: [
            { label: "Carer preferences", key: "carerPreferences" },
            { label: "Other preferences", key: "otherPreferences" },
        ],
    },
];
