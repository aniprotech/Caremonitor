const AddMedicationHeader = ({ openInfo, setOpenInfo, medication }) => {
    return (
        <div>
            <div className="mb-6 rounded border border-gray-200 bg-white">
                <button
                    type="button"
                    className="flex w-full items-center justify-between border-b border-gray-200 px-6 py-4 text-left focus:outline-none"
                    onClick={() => setOpenInfo((prev) => !prev)}
                >
                    <div>
                        <div className="mb-1 text-xs text-customGrey1">Medication</div>
                        <div className="poppins-medium text-lg text-customBlack">
                            {medication?.description || "—"}
                        </div>
                    </div>
                    <svg
                        className={`ml-2 h-5 w-5 transition-transform ${openInfo ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                </button>

                {openInfo && (
                    <div className="space-y-3 px-6 py-4 text-sm">
                        <div className="poppins-medium mb-2 text-customBlack">Additional information</div>

                        {/* Dose Form */}
                        <div className="mb-1">
                            <p className="text-customGrey1">Dose form</p>
                            <p className="poppins-medium text-customBlack">
                                {medication?.doseForm || "—"}
                            </p>
                        </div>

                        {/* Manufacturer */}
                        <div className="mb-1">
                            <p className="text-customGrey1">Manufacturer</p>
                            <p className="text-customBlack">{medication?.manufacturer || "—"}</p>
                        </div>

                        {/* Routes */}
                        <div className="mb-1">
                            <p className="text-customGrey1">Intended routes of administration</p>
                            {Array.isArray(medication?.routes) && medication.routes.length > 0 ? (
                                <ul className="ml-4 list-disc text-customBlack">
                                    {medication.routes.map((route, index) => (
                                        <li key={index}>{route}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-customBlack">—</p>
                            )}
                        </div>

                        {/* Regulatory */}
                        <div className="mb-1">
                            <p className="text-customGrey1">Regulatory</p>
                            {Array.isArray(medication?.regulatory) && medication.regulatory.length > 0 ? (
                                <ul className="ml-4 list-disc text-customTextLightNavy1">
                                    {medication?.regulatory?.map((reg, index) => (
                                        <li key={index} className="poppins-medium hover:underline">
                                            {reg}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-customBlack">—</p>
                            )}
                        </div>

                        {/* External Info */}
                        <div className="mb-1 mt-2">
                            <p className="text-customGrey1">External information</p>
                            <p className="text-customBlack">{medication?.externalInfo || "—"}</p>
                        </div>

                        {/* Disclaimer */}
                        <div className="mt-2 text-sm text-customBlack1">
                            Check the medicine name, strength, formulation and directions against the current prescription and dispensing label.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddMedicationHeader;
