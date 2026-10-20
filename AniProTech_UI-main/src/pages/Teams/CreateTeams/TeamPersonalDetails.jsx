import React, { useState } from "react";
import { useFormikContext } from "formik"; // Import useFormikContext
import TextField from "../../../components/TextInput/TextInput";
import PhoneNumberField from "../../../components/DropdownInput/PhoneNumberDropdown";
import { teamsInitialValues } from "../../../data/teams";
import { adminStatusForTeams, statusForTeams } from "../../../constants";
import StatusToggleButtonGroup from "../../../components/TextInput/StatusToggleButtonGroup";

const TeamPersonalDetails = () => {
    const { values, handleChange, errors, touched, setFieldValue } = useFormikContext();

    const [emailError, setEmailError] = useState("");

    const validateEmail = (email) => {
        const regex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!email) {
            setEmailError("");
        } else if (!regex.test(email)) {
            setEmailError("Invalid email address");
        } else {
            setEmailError("");
        }
    };

    return (
        <div className="w-full space-y-5 rounded-xl bg-white p-5">
            <TextField
                name="firstName"
                label="First Name"
                value={values?.firstName}
                valueChange={handleChange}
                error={touched?.firstName && errors?.firstName}
                required
            />
            <TextField
                name="lastName"
                label="Last Name"
                value={values?.lastName}
                valueChange={handleChange}
                error={touched?.lastName && errors?.lastName}
                required
            />

            <PhoneNumberField
                label="Mobile Number"
                phoneName="primaryPhone"
                phoneValue={values?.primaryPhone}
                phoneChange={handleChange}
                countryValue={values?.primaryPhoneCode || "+91"}
                countryChange={(val) => {
                    setFieldValue("primaryPhoneCode", val);
                }}
                phoneError={touched?.primaryPhone && errors?.primaryPhone}
                required={!values?.email}
            />

            <TextField
                name="email"
                type="email"
                label="Email address"
                value={values?.email}
                valueChange={(e) => {
                    handleChange(e);
                    validateEmail(e?.target?.value);
                }}
                error={emailError || (touched?.email && errors?.email)}
                required={!values?.primaryPhone}
            />
            <p className="-mt-3 text-xs text-slate-500">Provide either a mobile number or an email address. An invitation is sent only when an email address is available.</p>

            {/* Status Button Group */}
            <StatusToggleButtonGroup
                label="Status"
                name="isActive"
                value={values?.isActive}
                onChange={handleChange}
                options={statusForTeams}
                touched={touched?.isActive}
                error={errors?.isActive}
            />

            {/* Admin Button Group */}
            <StatusToggleButtonGroup
                label="Admin"
                name="role"
                value={values?.role}
                onChange={handleChange}
                options={adminStatusForTeams}
                touched={touched?.role}
                error={errors?.role}
            />

            <div className="pb-20">
                <label className="mb-2 block text-sm font-semibold text-customTextGrey1">Groups</label>
                {/* <select
                    name="groups"
                    multiple
                    value={values.groups}
                    onChange={(e) => {
                        const selectedOptions = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                        setFieldValue("groups", selectedOptions);
                    }}
                    className="w-full rounded-md border p-2 text-sm"
                >
                    <option value="group1">Group 1</option>
                    <option value="group2">Group 2</option>
                    <option value="group3">Group 3</option>
                </select> */}
                {/* {touched.groups && errors.groups && <p className="text-sm text-red-500">{errors.groups}</p>} */}
            </div>
        </div>
    );
};

export default TeamPersonalDetails;
