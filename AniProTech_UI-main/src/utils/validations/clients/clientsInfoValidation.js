// Validation Schema
import * as Yup from "yup";

export const clientsKeyContactsValidationSchema = Yup.object().shape({
    firstName: Yup.string().required("First name is required"),
    lastName: Yup.string().required("Last name is required"),
    relationship: Yup.string().required("Relationship is required"),
    phoneNumber: Yup.string().required("Phone number is required"),
    emailAddress: Yup.string().email("Invalid email address").required("Email address is required"),
    contactType: Yup.string().required("Contact type is required"),
    careMattersDiscussionAgreement: Yup.string().required("Care matters discussion agreement is required"),
});

export const clientsPersonalIdentityValidationSchema = Yup.object().shape({
    ethnicity: Yup.string().nullable(),
    religion: Yup.string().nullable(),
    cultureImpact: Yup.string().nullable(),
    sex: Yup.string().nullable(),
    gender: Yup.string().nullable(),
    sexualOrientation: Yup.string().nullable(),
    sexualOrientationImpact: Yup.string().nullable(),
    jobsAndOccupations: Yup.string().nullable(),
    significantPlaces: Yup.string().nullable(),
    otherNotes: Yup.string().nullable(),
    routinesAndPreferences: Yup.string().nullable(),
    hobbiesAndInterests: Yup.string().nullable(),
});

export const clinicalDetailsValidationSchema = Yup.object().shape({
    nhsNumber: Yup.string().required("NHS number is required"),
    medicalHistory: Yup.string().nullable(),
    medicalSupport: Yup.string().nullable(),
    allergiesIntolerances: Yup.string().nullable(),
    gpPracticeName: Yup.string().required("GP practice name is required"),
    gpPracticeIdentifier: Yup.string().required("GP practice identifier is required"),
    gpsName: Yup.string().required("GP's name is required"),
    gpPhoneNumber: Yup.string().required("GP phone number is required"),
    pharmacyName: Yup.string().required("Pharmacy name is required"),
    pharmacyPhoneNumber: Yup.string().required("Pharmacy phone number is required"),
    pharmacyAddress: Yup.string().required("Pharmacy address is required"),
    pharmacyPostCode: Yup.string().required("Pharmacy post code is required"),
});

export const agencyAdminValidationSchema = Yup.object().shape({
    serviceStartDate: Yup.date().required("Service start date is required"),
    currentStatus: Yup.string().required("Current status is required"),
    receivesRegulatedCare: Yup.string().required("Regulated care status is required"),
    overallRiskLevel: Yup.string().required("Overall risk level is required"),
    riskLevelDetails: Yup.string().nullable(),
    familyInvolvementLevel: Yup.string().required("Family involvement level is required"),
    staffingCrisisPlan: Yup.string().required("Staffing crisis plan is required"),
    weatherConditionsPlan: Yup.string().required("Weather conditions plan is required"),
    additionalDetails: Yup.string().nullable(),
    preferredContactMethod: Yup.string().required("Preferred contact method is required"),
    fundingOptions: Yup.array().min(1, "At least one funding option must be selected").required("Funding options are required"),
    carerPreferences: Yup.string().nullable(),
    otherPreferences: Yup.string().nullable(),
});

export const clientsFuturePlanningValidationSchema = Yup.object().shape({
    healthCapacityDecision: Yup.string().required("Health capacity decision is required"),
    healthWelfareLpa: Yup.string().required("Health and Welfare LPA is required"),
    propertyFinancialLpa: Yup.string().required("Property and Financial Affairs LPA is required"),
    dnacpr: Yup.string().required("DNACPR is required"),
    adrt: Yup.string().required("ADRT is required"),
    respect: Yup.string().required("ReSPECT is required"),
});
