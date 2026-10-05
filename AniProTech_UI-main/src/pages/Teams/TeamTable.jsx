import React, { useState, useMemo, useRef } from "react";
import { FaSearch, FaChevronLeft, FaChevronRight, FaSpinner } from "react-icons/fa"; // FaSpinner for loading spinner
import { useClickOutside } from "../../hooks/use-click-outside";
import { teamColumns } from "../../data/teams";
import { useNavigate } from "react-router-dom";
import TableLoader from "../../components/Loader/TableLoader";

const PAGE_SIZE = 5;

const TeamTable = ({ data, setLoading, loading, page, setPage, pageSize, setPageSize, totalCount, setTotalCount ,setSearchTerm,searchTerm}) => {
    const rows = Array.isArray(data) && data.length ? data : [];
    const [showGroup, setShowGroup] = useState(false);
    const [groupFilter, setGroupFilter] = useState([]);
    const [tempGroupFilter, setTempGroupFilter] = useState([]);
    const dropdownRef = useRef(null);
    const dropdownBtnRef = useRef(null);
    const navigate = useNavigate();

    const allGroups = useMemo(() => [...new Set(rows.map((r) => r.group))], [rows]);

    const filtered = useMemo(() => {
        return rows;
        // return rows.filter((row) => {
        //     if (groupFilter.length && !groupFilter.includes(row.group)) return false;
        //     const term = searchTerm.toLowerCase();
        //     return Object.values(row).some((val) => String(val).toLowerCase().includes(term));
        // });
    }, [rows, groupFilter]);

    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    useClickOutside([dropdownRef, dropdownBtnRef], () => setShowGroup(false));

    return (
        <div className="space-y-4 rounded border border-customBorder bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-fit rounded-md border border-gray-300 px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-customBlue"
                    />
                </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-customBorder">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-100 text-customTextGrey">
                        <tr>
                            {teamColumns?.map((col) => (
                                <th
                                    key={col.accessor}
                                    className="px-4 py-3 font-semibold tracking-wider"
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr className="animate-pulse">
                                <td
                                    colSpan={teamColumns?.length}
                                    className="px-4 py-6"
                                >
                                    <TableLoader />
                                </td>
                            </tr>
                        ) : (
                            filtered?.map((row, i) => (
                                <tr
                                    key={i}
                                    className="border-t transition-colors hover:cursor-pointer hover:border hover:border-customGrey/30 hover:bg-customHoverGrey"
                                    onClick={() => navigate(`/admin/teams/${row.id}`)}
                                >
                                    {teamColumns?.map((col) => (
                                        <td
                                            key={col?.accessor}
                                            className={`px-4 py-2.5 ${col.header === "" ? "w-0 text-center" : ""}`}
                                        >
                                            {col?.render ? col?.render(row[col.accessor], row) : row[col.accessor]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                        {filtered?.length === 0 && !loading && (
                            <tr>
                                <td
                                    colSpan={teamColumns?.length}
                                    className="px-4 py-6 text-center text-gray-500"
                                >
                                    No matching records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-end gap-4">
                <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="flex items-center rounded bg-gray-100 px-3 py-1 text-sm disabled:opacity-50"
                >
                    <FaChevronLeft />
                </button>
                <span className="text-sm text-gray-600">
                    {page} / {totalPages}
                </span>
                <button
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page === totalPages}
                    className="flex items-center rounded bg-gray-100 px-3 py-1 text-sm disabled:opacity-50"
                >
                    <FaChevronRight />
                </button>
            </div>
        </div>
    );
};

export default TeamTable;
