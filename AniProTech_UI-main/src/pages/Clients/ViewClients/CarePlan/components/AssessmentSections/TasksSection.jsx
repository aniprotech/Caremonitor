import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import SearchDropdown from "../../../../../../components/SearchDropdown/SearchDropdown";
import TaskEditModal from "../TaskEditModal";
import { fetchData } from "../../../../../../utils/FetchData";
import APIConfig from "../../../../../../utils/ApiConfig";
import { _post } from "../../../../../../utils/ApiService";
import { formatDisplayName } from "../../../../../../utils/common";
import { SquarePen } from "lucide-react";

const TasksSection = ({ clientId, dataId, assessmentType, tasksPlans, fetchDataBasedOnClientId }) => {
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [loading, setLoading] = useState(false);
    const [taskData, setTaskData] = useState([]);
    const [isEdit, setIsEdit] = useState(false);
    const [selectedTaskData, setSelectedTaskData] = useState(null);


    const fetchTasksByQuery = async () => {
        const payload = {
            searchString: query,
        };

        const response = await fetchData((data) => _post(APIConfig.CLIENT_TASK_PLAN.GET_ALL_TASKS, data), null, setLoading, null, payload, false);

        const tasksFromApi = response?.data?.results?.data || [];
        setTaskData(tasksFromApi);
        setSearchResults(tasksFromApi);
    };

    useEffect(() => {
        fetchTasksByQuery();
    }, [query, clientId, dataId]);

    // Filter tasks based on query
    useEffect(() => {
        if (!query) {
            setSearchResults(taskData);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = taskData.filter(
            (task) => task?.name.toLowerCase().includes(lowerQuery) || task?.description.toLowerCase().includes(lowerQuery),
        );
        setSearchResults(filtered);
    }, [query, taskData]);

    const highlightMatch = (text, searchQuery) => {
        if (!searchQuery) return text;
        const parts = text.split(new RegExp(`(${searchQuery})`, "gi"));
        return parts.map((part, index) =>
            part.toLowerCase() === searchQuery.toLowerCase() ? (
                <span
                    key={index}
                    className="font-semibold text-customBlue"
                >
                    {part}
                </span>
            ) : (
                <span key={index}>{part}</span>
            ),
        );
    };

    const handleTaskSelect = (task) => {
        setSelectedTask(task); 
        setIsEditModalOpen(true);
        setIsEdit(false);
    };

    const handleCloseModal = () => {
        setIsEditModalOpen(false);
        setSelectedTask(null);
        setIsEdit(false);
    };

    const handleSaveTask = () => {
        fetchDataBasedOnClientId();
        handleCloseModal();
    };

    const renderOption = (task) => (
        <div className="flex flex-col gap-1">
            <span className="font-medium">{highlightMatch(task.name, query)}</span>
            <span className="text-sm text-gray-500">{highlightMatch(task?.description, query)}</span>
        </div>
    );

    return (
        <section
            id="tasks"
            className="mb-10 lg:mb-20 xl:mb-32"
        >
            <h2 className="poppins-medium text-lg text-customBlack">3. Tasks</h2>
            <p className="mb-3 text-sm text-customFeedCardGreyText1">Add tasks to support the client in achieving their outcomes.</p>

            <div className="mb-6">
                <SearchDropdown
                    options={searchResults}
                    loading={loading}
                    query={query}
                    onQueryChange={setQuery}
                    onOptionSelect={handleTaskSelect}
                    placeholder="Search for tasks to add..."
                    renderOption={renderOption}
                    showSupportText={false}
                />
            </div>

            {tasksPlans.length > 0 && (
                <div className="space-y-4">
                    {tasksPlans.map((task, index) => {
                        const formattedSessions = task.isAnyTime ? null : task.sessions?.map(formatDisplayName).join(", ");

                        const frequencyLabel =
                            task.frequency === "CUSTOM"
                                ? `${formatDisplayName(task.repeatUnit)} - ${task.selectedDays?.map(formatDisplayName).join(", ")}`
                                : task.selectedDays?.length
                                  ? `${formatDisplayName(task.frequency)} - ${task.selectedDays.map(formatDisplayName).join(", ")}`
                                  : formatDisplayName(task.frequency);

                        return (
                            <div
                                key={task.id || index}
                                className="rounded border border-customNavy/30 bg-customGrey3 p-4"
                            >
                                <div className="mb-2 flex items-start justify-between">
                                    <h3 className="font-medium text-customBlack">{task.name || "Task Name will be added"}</h3>
                                    <button
                                        onClick={() => {
                                            setIsEdit(true);
                                            setIsEditModalOpen(true);
                                            setSelectedTaskData(task);
                                        }}
                                        className="flex items-center gap-1 text-sm text-customNavy1 hover:text-customTextLightNavy/80"
                                    >
                                        <SquarePen size={16} />
                                        Edit
                                    </button>
                                </div>
                                <p className="mb-2 text-sm text-customBlack1">{task.details}</p>
                                <div className="space-y-1 text-sm text-customBlack1">
                                    {frequencyLabel && <p>{frequencyLabel}</p>}
                                    {formattedSessions && <p>{formattedSessions}</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isEditModalOpen && (selectedTask || selectedTaskData) && (
                <TaskEditModal
                    isOpen={isEditModalOpen}
                    setIsEdit={setIsEdit}
                    isEdit={isEdit}
                    onClose={handleCloseModal}
                    task={selectedTask}
                    taskData={isEdit ? selectedTaskData : []}
                    onSave={handleSaveTask}
                    title={selectedTask?.description}
                    dataId={dataId}
                    userId={clientId}
                    assessmentType={assessmentType}
                    fetchDataBasedOnClientId={fetchDataBasedOnClientId}
                />
            )}
        </section>
    );
};

TasksSection.propTypes = {
    tasks: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            title: PropTypes.string.isRequired,
            description: PropTypes.string,
            frequency: PropTypes.string,
            timing: PropTypes.string,
        }),
    ),
    clientId: PropTypes.string,
    dataId: PropTypes.string,
    assessmentType: PropTypes.string,
    tasksPlans: PropTypes.array.isRequired,
    fetchDataBasedOnClientId: PropTypes.func.isRequired,
};

export default TasksSection;
