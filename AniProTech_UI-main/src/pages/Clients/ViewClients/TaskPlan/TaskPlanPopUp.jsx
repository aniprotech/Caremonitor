import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useParams } from "react-router-dom";
import { _get, _post, _put } from "../../../../utils/ApiService";
import { fetchData } from "../../../../utils/FetchData";
import { changeDayFormat } from "../../../../utils/common";
import { showSuccess } from "../../../../utils/toaster";
import APIConfig from "../../../../utils/ApiConfig";

const TIME_OPTIONS = ["Night", "Morning", "Lunch", "Afternoon", "Evening"];

const TaskPlanPopUp = ({ onClose, onSave, editTask }) => {
    const { id: userId } = useParams();
    const [step, setStep] = useState(1);
    const [categories, setCategories] = useState([]);
    const [categoriesWithTasks, setCategoriesWithTasks] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [totalTaskCount, setTotalTaskCount] = useState(0);

    const [taskDetails, setTaskDetails] = useState({
        details: "",
        isEssential: false,
        frequency: "DAILY",
        selectedDays: [],
        repeatEvery: 1,
        repeatUnit: "WEEKS",
        selectedTime: ["Morning"],
        startDate: "",
        endDate: "",
        neverEnds: true,
    });

    useEffect(() => {
        fetchCategories();
        fetchTasksByCategory([]);
    }, []);

    useEffect(() => {
        fetchTasksByCategory(selectedCategories);
    }, [selectedCategories, searchTerm]);

    useEffect(() => {
        if (editTask) {
            setStep(2);
            fetchTaskById(editTask.id);
        }
    }, [editTask]);

    const fetchCategories = async () => {
        const response = await fetchData(() => _get(APIConfig.CLIENT_TASK_PLAN.GET_CATEGORIES), null, setLoading, null, null, false);

        if (response?.data?.results?.data?.categories) {
            setCategories(response.data.results.data.categories);
        }
    };

    const fetchTasksByCategory = async (categoryIds) => {
        const payload = {
            searchString: searchTerm,
            category: categoryIds,
        };

        const response = await fetchData(
            (data) => _post(APIConfig.CLIENT_TASK_PLAN.GET_TASKS_BY_CATEGORIES, data),
            null,
            setLoading,
            null,
            payload,
            false,
        );

        if (response?.data?.results?.data?.data?.categories) {
            setCategoriesWithTasks(response.data.results.data.data.categories);
            setTotalTaskCount(response.data.results.data.data.totalTaskCount || 0);
        }
    };

    const fetchTaskById = async (taskId) => {
        const response = await fetchData(() => _get(APIConfig.CLIENT_TASK_PLAN.GET_BY_ID(taskId)), null, setLoading, null, null, false);

        if (response?.data?.results?.data) {
            const taskData = response.data.results.data;

            let selectedTime = ["Morning"];
            if (taskData.isAnyTime) {
                selectedTime = ["Anytime"];
            } else if (taskData.sessions && taskData.sessions.length > 0) {
                const sessionMap = {
                    NIGHT: "Night",
                    MORNING: "Morning",
                    LUNCH: "Lunch",
                    AFTERNOON: "Afternoon",
                    EVENING: "Evening",
                };
                selectedTime = taskData.sessions.map(session => sessionMap[session] || "Morning");
            }

            setTaskDetails({
                details: taskData.details || "",
                isEssential: taskData.isEssential || false,
                frequency: taskData.frequency || "DAILY",
                selectedDays: taskData.selectedDays || [],
                repeatEvery: taskData.repeatEvery || 1,
                repeatUnit: taskData.repeatUnit || "WEEKS",
                selectedTime: selectedTime,
                startDate: taskData.startDate || "",
                endDate: taskData.endDate || "",
                neverEnds: taskData.endDate ? false : true,
            });
        }
    };

    const handleCategoryToggle = (categoryId) => {
        setSelectedCategories((prev) => {
            if (prev.includes(categoryId)) {
                return prev.filter((id) => id !== categoryId);
            } else {
                return [...prev, categoryId];
            }
        });
    };

    const handleSelectAllCategories = () => {
        setSelectedCategories([]);
    };

    const handleFrequencyChange = (freq) => {
        const upperFreq = freq.toUpperCase();
        setTaskDetails((prev) => ({
            ...prev,
            frequency: upperFreq,
            selectedDays: upperFreq !== "DAILY" ? prev.selectedDays : [],
            repeatEvery: upperFreq === "CUSTOM" ? prev.repeatEvery : 1,
            repeatUnit: upperFreq === "CUSTOM" ? prev.repeatUnit : "WEEKS",
        }));
    };

    const handleDayToggle = (day) => {
        const fullDay = changeDayFormat[day];
        const newDays = taskDetails.selectedDays.includes(fullDay)
            ? taskDetails.selectedDays.filter((d) => d !== fullDay)
            : [...taskDetails.selectedDays, fullDay];

        const sortedDays = newDays.sort((a, b) => Object.values(changeDayFormat).indexOf(a) - Object.values(changeDayFormat).indexOf(b));

        setTaskDetails((prev) => ({
            ...prev,
            selectedDays: sortedDays,
        }));
    };

    const handleRepeatChange = (e) => {
        const num = parseInt(e.target.value, 10);
        setTaskDetails((prev) => ({
            ...prev,
            repeatEvery: num,
        }));
    };

    const handleUnitChange = (e) => {
        setTaskDetails((prev) => ({
            ...prev,
            repeatUnit: e.target.value.toUpperCase(),
        }));
    };

    const handleSave = async () => {
        const isAnyTime = taskDetails.selectedTime.includes("Anytime");
        const sessions = isAnyTime ? [] : taskDetails.selectedTime.map(time => time.toUpperCase());

        const payload = {
            taskId: selectedTask?.id || editTask?.taskId,
            userId: userId,
            details: taskDetails.details,
            isEssential: taskDetails.isEssential,
            isAnyTime: isAnyTime,
            sessions: sessions,
            frequency: taskDetails.frequency,
            selectedDays: taskDetails.frequency === "WEEKLY" || taskDetails.frequency === "CUSTOM" ? taskDetails.selectedDays : [],
            repeatEvery: taskDetails.frequency === "CUSTOM" ? taskDetails.repeatEvery : null,
            repeatUnit: taskDetails.frequency === "CUSTOM" ? taskDetails.repeatUnit : null,
            startDate: taskDetails.startDate,
            endDate: taskDetails.neverEnds ? null : taskDetails.endDate,
        };

        if (editTask) {
            payload.id = editTask.id;
            delete payload.taskId;
            delete payload.userId;
        }

        const endpoint = editTask ? APIConfig.CLIENT_TASK_PLAN.UPDATE(editTask.id) : APIConfig.CLIENT_TASK_PLAN.CREATE;

        const apiFunc = editTask ? (data) => _put(endpoint, data) : (data) => _post(endpoint, data);

        const response = await fetchData(apiFunc, null, setLoading, null, payload, false);

        if (response?.data?.error === false) {
            showSuccess(response?.data?.message);
            onSave && onSave();
            onClose();
        }
    };

    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black bg-opacity-50">
            <div className="h-full w-[500px] overflow-y-auto bg-white p-6">
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">{step === 1 ? "Add a new task" : "Task details"}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {step === 1 ? (
                    <div className="space-y-6">
                        <div>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg
                                        className="h-4 w-4 text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                        />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder={`Search ${totalTaskCount} activities`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {categories.map((category) => (
                                <button
                                    key={category.id}
                                    onClick={() => handleCategoryToggle(category.id)}
                                    className={`rounded-full px-4 py-2 text-sm font-medium ${
                                        selectedCategories.includes(category.id)
                                            ? "bg-customDropdownBorder text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                                >
                                    {category.name} +
                                </button>
                            ))}
                        </div>
                        <div className="space-y-6">
                            {loading ? (
                                <div className="py-8 text-center">Loading tasks...</div>
                            ) : categoriesWithTasks.length > 0 ? (
                                categoriesWithTasks.map((category) => (
                                    <div
                                        key={category.categoryId}
                                        className="space-y-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-gray-900">{category.categoryName}</h3>
                                            <span className="text-sm text-gray-500">{category.taskCount} tasks</span>
                                        </div>
                                        <div className="space-y-2">
                                            {category.tasks.map((task) => (
                                                <div
                                                    key={task.id}
                                                    className="group flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-3 hover:border-customNavy"
                                                    onClick={() => {
                                                        setSelectedTask({
                                                            ...task,
                                                            category_id: category.categoryId,
                                                            categoryName: category.categoryName,
                                                        });
                                                        setStep(2);
                                                    }}
                                                >
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-gray-900">{task.name}</div>
                                                        <div className="mt-1 text-xs text-gray-500">{task.description}</div>
                                                    </div>
                                                    <button className="ml-3 p-1 text-gray-400 hover:text-customNavy group-hover:text-customNavy">
                                                        <svg
                                                            className="h-5 w-5"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center text-gray-500">
                                    {selectedCategories.length > 0 ? "No tasks found for selected categories" : "Select categories to view tasks"}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <label className="mb-2 block text-sm text-gray-700">Add details (optional)</label>
                            <p className="mb-2 text-xs text-gray-500">Carers will see this each time the task is viewed</p>
                            <textarea
                                value={taskDetails.details}
                                onChange={(e) =>
                                    setTaskDetails({
                                        ...taskDetails,
                                        details: e.target.value,
                                    })
                                }
                                className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm"
                                rows={4}
                            />
                        </div>

                        <div>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={taskDetails.isEssential}
                                    onChange={(e) =>
                                        setTaskDetails({
                                            ...taskDetails,
                                            isEssential: e.target.checked,
                                        })
                                    }
                                    className="h-4 w-4 rounded border-gray-300 text-customNavy"
                                />
                                <span className="text-sm text-gray-700">Mark as essential</span>
                            </label>
                            <p className="ml-6 text-xs text-gray-500">Raise alert and receive an outcome if task is not completed.</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm text-gray-700">
                                    Select frequency <span className="text-red-500">*</span>
                                </label>
                                <div className="flex space-x-2">
                                    {["Daily", "Weekly", "Custom"].map((freq) => (
                                        <button
                                            key={freq}
                                            onClick={() => handleFrequencyChange(freq)}
                                            className={`rounded-md px-4 py-2 text-sm ${
                                                taskDetails.frequency === freq.toUpperCase()
                                                    ? "bg-customDropdownBorder text-white"
                                                    : "bg-gray-100 text-gray-700"
                                            }`}
                                        >
                                            {freq}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {taskDetails.frequency === "CUSTOM" && (
                                <div>
                                    <label className="mb-2 block text-sm text-gray-700">Repeats every</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-12 rounded border border-gray-300 px-2 py-2 text-sm"
                                            value={taskDetails.repeatEvery}
                                            onChange={handleRepeatChange}
                                        />
                                        <select
                                            value={taskDetails.repeatUnit}
                                            onChange={handleUnitChange}
                                            className="w-40 rounded border border-gray-300 px-2 py-2 text-sm"
                                        >
                                            <option value="DAYS">Days</option>
                                            <option value="WEEKS">Weeks</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                            {(taskDetails.frequency === "WEEKLY" || (taskDetails.frequency === "CUSTOM" && taskDetails.repeatUnit === "WEEKS")) && (
                                <div>
                                    <label className="mb-2 block text-sm text-gray-700">
                                        Select days <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {daysOfWeek.map((day) => {
                                            const fullDay = changeDayFormat[day];
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => handleDayToggle(day)}
                                                    className={`rounded-md px-3 py-1 text-sm ${
                                                        taskDetails.selectedDays.includes(fullDay)
                                                            ? "bg-customDropdownBorder text-white"
                                                            : "bg-gray-100 text-gray-700"
                                                    }`}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="mb-2 block text-sm text-gray-700">
                                Select time <span className="text-red-500">*</span>
                            </label>
                            <div className="space-y-2">
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        name="timeType"
                                        value="anytime"
                                        checked={taskDetails.selectedTime.includes("Anytime")}
                                        onChange={() =>
                                            setTaskDetails({
                                                ...taskDetails,
                                                selectedTime: ["Anytime"],
                                            })
                                        }
                                        className="h-4 w-4 border-gray-300 text-customNavy"
                                    />
                                    <span className="text-sm text-gray-700">Anytime</span>
                                </label>
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        name="timeType"
                                        value="sessions"
                                        checked={!taskDetails.selectedTime.includes("Anytime")}
                                        onChange={() =>
                                            setTaskDetails({
                                                ...taskDetails,
                                                selectedTime: ["Morning"],
                                            })
                                        }
                                        className="h-4 w-4 border-gray-300 text-customNavy"
                                    />
                                    <span className="text-sm text-gray-700">Sessions</span>
                                </label>
                            </div>
                            {!taskDetails.selectedTime.includes("Anytime") && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {TIME_OPTIONS.map((time) => (
                                        <button
                                            key={time}
                                            onClick={() => {
                                                const isSelected = taskDetails.selectedTime.includes(time);
                                                let newSelectedTime;
                                                if (isSelected) {
                                                    newSelectedTime = taskDetails.selectedTime.filter(t => t !== time);
                                                    if (newSelectedTime.length === 0) {
                                                        newSelectedTime = ["Morning"];
                                                    }
                                                } else {
                                                    newSelectedTime = [...taskDetails.selectedTime, time];
                                                }
                                                setTaskDetails({
                                                    ...taskDetails,
                                                    selectedTime: newSelectedTime,
                                                });
                                            }}
                                            className={`rounded-md px-3 py-1 text-sm ${
                                                taskDetails.selectedTime.includes(time) ? "bg-customDropdownBorder text-white" : "bg-gray-100 text-gray-700"
                                            }`}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="mb-2 block text-sm text-gray-700">
                                Starts <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={taskDetails.startDate}
                                onChange={(e) =>
                                    setTaskDetails({
                                        ...taskDetails,
                                        startDate: e.target.value,
                                    })
                                }
                                disabled={editTask ? true : false}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm text-gray-700">
                                Ends <span className="text-red-500">*</span>
                            </label>
                            <p className="mb-2 text-xs text-gray-500">To add a one-off task, set the end date to be the same as the start date.</p>
                            <div className="space-y-2">
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        name="endType"
                                        checked={taskDetails.neverEnds}
                                        onChange={() =>
                                            setTaskDetails({
                                                ...taskDetails,
                                                neverEnds: true,
                                                endDate: "",
                                            })
                                        }
                                        className="h-4 w-4 border-gray-300 text-customNavy"
                                    />
                                    <span className="text-sm text-gray-700">Never</span>
                                </label>
                                <label className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        name="endType"
                                        checked={!taskDetails.neverEnds}
                                        onChange={() =>
                                            setTaskDetails({
                                                ...taskDetails,
                                                neverEnds: false,
                                            })
                                        }
                                        className="h-4 w-4 border-gray-300 text-customNavy"
                                    />
                                    <span className="text-sm text-gray-700">On</span>
                                    <input
                                        type="date"
                                        value={taskDetails.endDate}
                                        onChange={(e) =>
                                            setTaskDetails({
                                                ...taskDetails,
                                                endDate: e.target.value,
                                            })
                                        }
                                        disabled={taskDetails.neverEnds}
                                        className="ml-2 rounded-md border border-gray-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={onClose}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={
                                    loading || !taskDetails.startDate || (taskDetails.frequency !== "DAILY" && taskDetails.selectedDays.length === 0)
                                }
                                className="rounded-md bg-customDropdownBorder px-4 py-2 text-sm text-white hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? "Saving..." : "Save task"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskPlanPopUp;
