import * as Yup from "yup";

export const loginValidationSchema = Yup.object({
    email: Yup.string().trim().email("Invalid email address.").required("Email is required."),
});

export const clientsProfileValidationSchema = Yup.object().shape({
    // title: Yup.string().required("This is a required field"),
    firstName: Yup.string().required("This is a required field."),
    lastName: Yup.string().required("This is a required field."),
    dateOfBirth: Yup.string().required("This is a required field"),
});

export const clientsProfileAddressValidationSchema = Yup.object().shape({
    accessDetails: Yup.string().required("This is a required field."),
    type: Yup.string().required("This is a required field."),
});

export const clientContactValidationSchema = Yup.object({
    email: Yup.string().trim().email("Invalid email address.").notRequired(),

    primaryPhone: Yup.string(),
    primaryPhoneType: Yup.string().when("primaryPhone", {
        is: (val) => Boolean(val?.trim()),
        then: (schema) => schema.required("Primary phone type is required."),
        otherwise: (schema) => schema.notRequired(),
    }),

    secondaryPhone: Yup.string(),
    secondaryPhoneType: Yup.string().when("secondaryPhone", {
        is: (val) => Boolean(val?.trim()),
        then: (schema) => schema.required("Secondary phone type is required."),
        otherwise: (schema) => schema.notRequired(),
    }),
});

export const generateFullValidationSchema = (initialValues, skipClientContactValidation = false) => {
    return Yup.object().shape({
        ...clientsProfileValidationSchema.fields,
        ...clientContactValidationSchema.fields,
        addresses: Yup.array().of(
            Yup.object().shape({
                searchAddress: Yup.string().nullable(),
                addressLine1: Yup.string().nullable(),
                addressLine2: Yup.string().nullable(),
                city: Yup.string().nullable(),
                county: Yup.string().nullable(),
                postalCode: Yup.string().nullable(),
                country: Yup.string().nullable(),
            }),
        ),
    });
};

// Teams Validation Schema

export const teamsValidationSchema = Yup.object({
    firstName: Yup.string().max(20, "First name must be at most 20 characters").required("This is a required field"),
    lastName: Yup.string().max(20, "Last name must be at most 20 characters").required("This is a required field"),
    primaryPhone: Yup.string()
        .nullable()
        .test("is-valid-phone", "Enter a valid phone number (up to 15 digits)", (value) => !value || /^\d{10,15}$/.test(value)),
    email: Yup.string().trim().email("Invalid email").notRequired(),
    isActive: Yup.boolean().required("This is a required field"),
    role: Yup.string().required("This is a required field"),
    // groups: Yup.array().min(1, "At least one group must be selected"),
}).test("contact-method", "Enter either an email address or a mobile number", (values) => Boolean(values?.email?.trim() || String(values?.primaryPhone || "").trim()));

export const teamsProfileEditValidationSchema = Yup.object({
    firstName: Yup.string().max(20, "First name must be at most 20 characters").required("This is a required field"),
    lastName: Yup.string().max(20, "Last name must be at most 20 characters").required("This is a required field"),
    primaryPhone: Yup.string()
        // .nullable()
        .test("is-valid-phone", "Enter a valid phone number (up to 15 digits)", (value) => !value || /^\d{10,15}$/.test(value))
        .required("This is a required field"),
    email: Yup.string().email("Invalid email").notRequired(),
}).test("contact-method", "Enter either an email address or a mobile number", (values) => Boolean(values?.email?.trim() || String(values?.primaryPhone || "").trim()));

export const teamsAdditionalDetailsEditValidationSchema = Yup.object({
    dateOfBirth: Yup.string(),
    secondaryPhone: Yup.string()
        .nullable()
        .test("valid-phone", "Phone number must be up to 15 digits", (value) => !value || /^\d{10,15}$/.test(value)),
    highlights: Yup.string(),
});

export const teamsIdentityEditValidationSchema = Yup.object({
    title: Yup.string().required("This is a required field"),
    preferredName: Yup.string().required("This is a required field"),
    referredAs: Yup.string().required("This is a required field"),
    gender: Yup.string().required("This is a required field"),
});

export const teamsKeyContactsValidationSchema = Yup.object({
    keyContacts: Yup.array().of(
        Yup.object().shape({
            phoneNumber: Yup.string()
                .nullable()
                .test("valid-phone", "Phone number must be up to 15 digits", (value) => !value || /^\d{10,15}$/.test(value)),
            phoneCode: Yup.string(),
            email: Yup.string().nullable().email("Invalid email address"),
        }),
    ),
});

export const teamsRolesStatusValidationSchema = Yup.object({
    isActive: Yup.boolean().required("This is a required field"),
    role: Yup.string().required("This is a required field"),
});
