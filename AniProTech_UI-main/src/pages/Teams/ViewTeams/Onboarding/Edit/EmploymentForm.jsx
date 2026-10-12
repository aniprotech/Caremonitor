import React from "react";
import TextField from "../../../../../components/TextInput/TextInput";
import DropdownField from "../../../../../components/DropdownInput/Dropdown";
import { onBoardingRoleOptions, onBoardingContractTypeOptions, onBoardingVaccinationStatus } from "../../../../../data/teams";
import FileUploadField from "../../../../../components/FileUploads/FileUploadField";
import DateField from "../../../../../components/DateField/DateField";

const EmploymentForm = ({ values, handleChange, errors, setFieldValue }) => {
    return (
        <>
            <h2 className="text-base poppins-medium text-customTextColor md:text-xl">Employment</h2>

            <DateField
                name="started"
                label="Started"
                value={values?.started || ""}
                onChange={handleChange}
                error={errors?.started}
                required
                style="mt"
            />
            <TextField
                label="NI number"
                name="niNumber"
                value={values?.niNumber}
                valueChange={handleChange}
                // required
                componentName="FormikValidation"
            />

            <TextField
                label="Staff contact number"
                name="socialWorkerNumber"
                value={values?.socialWorkerNumber}
                valueChange={handleChange}
                componentName="FormikValidation"
            />

            <TextField
                label="Employee number"
                name="employeeNumber"
                value={values?.employeeNumber}
                valueChange={handleChange}
                componentName="FormikValidation"
            />

            <DropdownField
                label="Role"
                name="role"
                value={values?.role}
                valueChange={handleChange}
                options={onBoardingRoleOptions}
                componentName="FormikValidation"
            />

            <DropdownField
                label="Contract type"
                name="contractType"
                value={values?.contractType}
                valueChange={handleChange}
                options={onBoardingContractTypeOptions}
                componentName="FormikValidation"
            />

            <TextField
                label="Weekly contracted hours"
                name="weeklyContractedHours"
                type="number"
                value={values?.weeklyContractedHours}
                valueChange={handleChange}
                componentName="FormikValidation"
            />

            {/* File Upload */}
            <FileUploadField
                label="Contract"
                name="contract"
                file={values?.contract}
                setFile={(file) => setFieldValue("contract", file)}
                accept="application/pdf,image/*"
            />

            <DropdownField
                label="Vaccination Status"
                name="covidVaccinationStatus"
                value={values?.covidVaccinationStatus}
                valueChange={handleChange}
                options={onBoardingVaccinationStatus}
                componentName="FormikValidation"
            />
        </>
    );
};

export default EmploymentForm;
