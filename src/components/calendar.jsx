import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { eachMonthOfInterval } from 'date-fns/eachMonthOfInterval';
import './calendar.css';

export const Calendar = () => {

  const months = eachMonthOfInterval({
    start: new Date(2025, 0, 1),
    end: new Date(2025, 11, 31),
  });

  const days = eachDayOfInterval({
    start: new Date(2025, 0, 1),
    end: new Date(2025, 11, 31),
  });

  return <div className="calendar-container">
    <h1>Calendar</h1>
    <div className="calendar">{months.map((month) => (
      <div key={month.toISOString()} className="month-container">
        <h2>{month.toLocaleString('en-US', { month: 'long' })}</h2>
        <div className="month">{days.filter((day) => day.getMonth() === month.getMonth()).map((day) => (
          <div key={day.toISOString()} className="day">
            {/* {day.toLocaleString('en-US', { day: 'numeric' })} */}
          </div>
        ))}</div>
      </div>
    ))}</div>
  </div>;
};
