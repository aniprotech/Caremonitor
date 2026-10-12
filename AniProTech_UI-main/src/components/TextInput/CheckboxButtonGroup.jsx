import React from "react";
import PropTypes from "prop-types";

const CheckboxButtonGroup = ({
  label,
  name,
  options,
  value = [],
  valueChange,
  required,
  error,
  disabled = false,
  exclusiveValue,
  style,
}) => {
  // Ensure value is always an array
  const safeValue = Array.isArray(value) ? value : [];


  const handleChange = (optionValue) => {
    let updated;
    if (optionValue === exclusiveValue) {
      updated = safeValue.includes(optionValue) ? [] : [optionValue];
    } else if (safeValue.includes(optionValue)) {
      updated = safeValue.filter((val) => val !== optionValue);
    } else {
      updated = [...safeValue.filter((val) => val !== exclusiveValue), optionValue];
    }

    // Pass the array directly in the target.value
    valueChange({ target: { name, value: updated } });
  };

  return (
    <div className="w-full">
      {label && (
        <label
          className={`block ${
            style === "textSize" ? "text-base poppins-medium text-customNavy" : "text-sm"
          } mb-3 font-medium text-customTextGrey`}
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}

      <div className="space-y-3">
        {options.map((option, idx) => {
          const isChecked = safeValue.includes(option.value);
          return (
            <label
              key={idx}
              className={`flex cursor-pointer items-center rounded border px-4 py-3 transition ${
                isChecked ? "border-customBlue bg-customHoverBlue" : "border-gray-300 hover:border-customNavy"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={isChecked}
                onChange={() => handleChange(option.value)}
                disabled={disabled}
                className="mr-3 h-4 w-4 text-customBlue"
              />
              <span className="text-sm text-customNavy">{option.label}</span>
            </label>
          );
        })}
      </div>

      {error && required && !safeValue?.length && (
        <span className="mt-1 block text-xs text-red-500">{error}</span>
      )}
    </div>
  );
};

CheckboxButtonGroup.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    })
  ).isRequired,
  value: PropTypes.array,
  valueChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  exclusiveValue: PropTypes.string,
  style: PropTypes.string,
};

export default CheckboxButtonGroup;
