import * as Yup from 'yup';

const clientsBaseInfoValidation = Yup.object({
    personalIdentity: Yup.object({
        ethnicity: Yup.string().nullable(),
        religion: Yup.string().nullable(),
        cultureImpact: Yup.string(),
        sex: Yup.string(),
        gender: Yup.string(),
        sexualOrientation: Yup.string(),
        sexualOrientationImpact: Yup.string(),
        jobsAndOccupations: Yup.string(),
        significantPlaces: Yup.string(),
        otherNotes: Yup.string(),
        routinesAndPreferences: Yup.string(),
        hobbiesAndInterests: Yup.string(),
        importantPeople: Yup.string(),
        dislikes: Yup.string(),
    }),
    
    clinicalDetails: Yup.object({
        nhsNumber: Yup.string(),
        medicalHistory: Yup.array(),
        medicalSupport: Yup.boolean(),
        allergiesIntolerances: Yup.string(),
        gpPracticeName: Yup.string(),
        gpPracticeIdentifier: Yup.string(),
        gpName: Yup.string(),
        gpPhoneNumber: Yup.string(),
        pharmacyName: Yup.string(),
        pharmacyPhoneNumber: Yup.string(),
        pharmacyPhoneCode: Yup.string(),
        pharmacyAddress: Yup.string(),
        pharmacyPostCode: Yup.string(),
    }),
    
    futurePlanning: Yup.object({
        healthCapacityDecision: Yup.string(),
        healthWelfareLpa: Yup.string(),
        propertyFinancialLpa: Yup.string(),
        dnacpr: Yup.string(),
        adrt: Yup.string(),
        respect: Yup.string(),
    }),
    
    keyContactsEmergencyContacts: Yup.array().of(
        Yup.object({
            firstName: Yup.string().required('First name is required'),
            lastName: Yup.string().required('Last name is required'),
            relationShip: Yup.string(),
            phoneNumber: Yup.string(),
            phoneCode: Yup.string(),
            email: Yup.string().email('Invalid email format'),
            typeOfContact: Yup.string(),
            careMattersDiscussionAgreement: Yup.string(),
        })
    ),
    
    keyContactsOtherProfessionals: Yup.array().of(
        Yup.object({
            firstName: Yup.string().required('First name is required'),
            lastName: Yup.string().required('Last name is required'),
            serviceName: Yup.string(),
            role: Yup.string(),
            phoneNumber: Yup.string(),
            phoneCode: Yup.string(),
            email: Yup.string().email('Invalid email format'),
            careMattersDiscussionAgreement: Yup.string(),
        })
    ),
    
    agencyAdmin: Yup.object({
        serviceStartDate: Yup.string(),
        currentStatus: Yup.string(),
        receivesRegulatedCare: Yup.boolean(),
        overallRiskLevel: Yup.string(),
        riskLevelDetails: Yup.string(),
        familyInvolvementLevel: Yup.string(),
        staffingCrisisPlan: Yup.string(),
        weatherConditionsPlan: Yup.string(),
        additionalDetails: Yup.string(),
        preferredContactMethod: Yup.string(),
        fundingOption: Yup.array(),
        carerPreferences: Yup.string(),
        otherPreferences: Yup.string(),
        identifiers: Yup.string(),
        localAuthorityId: Yup.string(),
    }),
});

export default clientsBaseInfoValidation;
