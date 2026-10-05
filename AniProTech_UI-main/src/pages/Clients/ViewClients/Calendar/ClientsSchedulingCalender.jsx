import React, { useMemo, useState, useEffect } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../../../../src/bigCalendar.css";

const locales = {
    "en-US": enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales,
});

const ClientSchedulingCalender = ({ startDate }) => {
    const [calendarDate, setCalendarDate] = useState(startDate);

    // Ensure that when startDate changes, the calendarDate is updated
    useEffect(() => {
        setCalendarDate(startDate);
    }, [startDate]);

    const events = useMemo(
        () => [
            {
                title: "Meeting with Client A",
                start: new Date(2025, 4, 5, 3, 0), // May 5th, 03:00
                end: new Date(2025, 4, 5, 4, 0), // May 5th, 04:00
                allDay: false,
                description: "Discussing project deliverables and timelines.",
            },
            {
                title: "Meeting with Client B",
                start: new Date(2025, 4, 5, 16, 0), // May 5th, 16:00
                end: new Date(2025, 4, 5, 17, 0), // May 5th, 17:00
                allDay: false,
                description: "Negotiating terms and conditions for the contract.",
            },
            {
                title: "Team Sync",
                start: new Date(2025, 4, 9, 3, 0), // May 9th, 03:00
                end: new Date(2025, 4, 9, 4, 0), // May 9th, 04:00
                allDay: false,
                description: "Discussing project milestones and sprint planning.",
            },
            {
                title: "Team Sync with Client A",
                start: new Date(2025, 4, 9, 3, 0), // May 9th, 03:00
                end: new Date(2025, 4, 9, 4, 0), // May 9th, 04:00
                allDay: false,
                description: "Reviewing project progress and upcoming tasks with Client A.",
            },
            {
                title: "Team Sync",
                start: new Date(2025, 4, 9, 16, 0), // May 9th, 16:00
                end: new Date(2025, 4, 9, 17, 0), // May 9th, 17:00
                allDay: false,
                description: "Reviewing project progress and upcoming tasks.",
            },
            {
                title: "Team Sync",
                start: new Date(2025, 4, 9, 16, 0), // May 9th, 16:00
                end: new Date(2025, 4, 9, 17, 0), // May 9th, 17:00
                allDay: false,
                description: "Reviewing project progress and upcoming tasks.",
            },
            {
                title: "Team Sync",
                start: new Date(2025, 4, 9, 16, 0), // May 9th, 16:00
                end: new Date(2025, 4, 9, 17, 0), // May 9th, 17:00
                allDay: false,
                description: "Reviewing project progress and upcoming tasks.",
            },
            {
                title: "Team Sync",
                start: new Date(2025, 4, 9, 16, 0), // May 9th, 16:00
                end: new Date(2025, 4, 9, 17, 0), // May 9th, 17:00
                allDay: true,
                description: "Reviewing project progress and upcoming tasks.",
            },
        ],
        [calendarDate],
    );


    // Function to format the time in 24-hour format with leading zeros
    const formatTime = (date) => {
        return format(date, "HH:mm"); // HH ensures 2-digit hour format
    };

    // Ensure min/max date adjustments are based on calendarDate without mutating it
    const minDate = new Date(calendarDate);
    minDate.setHours(0, 0, 0, 0); // Reset time to start of the day

    const maxDate = new Date(calendarDate);
    maxDate.setHours(23, 59, 59, 999); // Reset time to end of the day

    return (
        <div className="react-big-calendar-container p-4 shadow">
            <Calendar
                localizer={localizer}
                events={events}
                date={calendarDate} // Set controlled `date` prop
                onNavigate={setCalendarDate} // Update calendarDate when navigating
                defaultView="week"
                views={["week"]}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
                toolbar={false} 
                min={minDate} // Ensure min date is based on calendarDate
                max={maxDate} // Ensure max date is based on calendarDate
                step={60} // 1-hour steps
                timeslots={1} // Show one time slot per hour
                components={{
                    event: ({ event }) => (
                        <div style={{ padding: "5px", border: "1px solid #ccc", borderRadius: "5px" , backgroundColor : "green" }}>
                            <strong>{event.title}</strong>
                            <p>
                                {formatTime(event.start)} - {formatTime(event.end)}
                            </p>
                            <p style={{ backgroundColor: "green", color: "white", padding: "8px" }}>{event.description}</p>
                        </div>
                    ),
                }}
                dayLayoutAlgorithm="no-overlap" // Ensures events don't overlap, can be adjusted
                formats={{
                    timeGutterFormat: "HH:mm", // This will format the time displayed in the gutter (next to the day names)
                }}
            />
        </div>
    );
};

export default ClientSchedulingCalender;
