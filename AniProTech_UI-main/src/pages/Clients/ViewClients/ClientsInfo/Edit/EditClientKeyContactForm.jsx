import React from "react";
import PropTypes from "prop-types";
import { useFormikContext } from "formik";
import SharedOptionField from "../../../../../components/SharedOptionField";
import TextField from "../../../../../components/TextInput/TextInput";
import PhoneNumberField from "../../../../../components/DropdownInput/PhoneNumberDropdown";
import CheckboxButtonGroup from "../../../../../components/TextInput/CheckboxButtonGroup";
import StatusToggleButtonGroup from "../../../../../components/TextInput/StatusToggleButtonGroup";
import { teamTypeOfContactOptions } from "../../../../../constants";
import { teamsRelationshipOptions } from "../../../../../constants/teamConstants";
import { clientskeysContactOptions } from "../../../../../constants/clientConstants";
import { useGlobalStore } from "../../../../../stores/useGlobalStore";

const EditClientKeyContactForm = ({ index }) => {
    const { values, setFieldValue } = useFormikContext();
    const contact = values.keyContacts?.clientEmergencyContacts?.[index] || {};
    const { clientsPersonalDetailData } = useGlobalStore();
    const clientName = clientsPersonalDetailData ? `${clientsPersonalDetailData.firstName}` : 'the client';

    return (
        <div className="space-y-6">
            <TextField
                name={`keyContacts.clientEmergencyContacts.${index}.firstName`}
                label="First Name"
                value={contact.firstName || ""}
                valueChange={(e) => setFieldValue(`keyContacts.clientEmergencyContacts.${index}.firstName`, e.target.value)}
            />

            <TextField
                name={`keyContacts.clientEmergencyContacts.${index}.lastName`}
                label="Last Name"
                value={contact.lastName || ""}
                valueChange={(e) => setFieldValue(`keyContacts.clientEmergencyContacts.${index}.lastName`, e.target.value)}
            />

            <SharedOptionField
                label={`Relationship to ${clientName}`}
                kind="relationship"
                builtIn={teamsRelationshipOptions}
                value={contact.relationShip || ""}
                onChange={(value) => setFieldValue(`keyContacts.clientEmergencyContacts.${index}.relationShip`, value)}
            />

            <PhoneNumberField
                label="Mobile number"
                phoneName={`keyContacts.clientEmergencyContacts.${index}.phoneNumber`}
                phoneValue={contact.phoneNumber || ""}
                phoneChange={(e) => setFieldValue(`keyContacts.clientEmergencyContacts.${index}.phoneNumber`, e.target.value)}
                countryValue={contact.phoneCode || "+44"}
                countryChange={(val) => setFieldValue(`keyContacts.clientEmergencyContacts.${index}.phoneCode`, val)}
            />

            <TextField
                name={`keyContacts.clientEmergencyContacts.${index}.email`}
                label="Email address"
                value={contact.email || ""}
                valueChange={(e) => setFieldValue(`keyContacts.clientEmergencyContacts.${index}.email`, e.target.value)}
            />

            <CheckboxButtonGroup
                label={`Type of contact for ${clientName}`}
                name={`keyContacts.clientEmergencyContacts.${index}.typeOfContact`}
                value={contact.typeOfContact || []}
                options={teamTypeOfContactOptions}
                valueChange={(e) => setFieldValue(`keyContacts.clientEmergencyContacts.${index}.typeOfContact`, e.target.value)}
            />

            <StatusToggleButtonGroup
                label={`Does ${clientName} or person making a best interests decision on their behalf agree that general care matters can be discussed with this contact?`}
                name={`keyContacts.clientEmergencyContacts.${index}.careMattersDiscussionAgreement`}
                value={contact.careMattersDiscussionAgreement || false}
                options={clientskeysContactOptions}
                onChange={(e) => setFieldValue(`keyContacts.clientEmergencyContacts.${index}.careMattersDiscussionAgreement`, e.target.value)}
            />
        </div>
    );
};

EditClientKeyContactForm.propTypes = {
    index: PropTypes.number.isRequired,
};

export default EditClientKeyContactForm;
