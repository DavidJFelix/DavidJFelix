import { eachDayOfInterval } from 'date-fns/eachDayOfInterval';
import { getWeekOfMonth } from 'date-fns/getWeekOfMonth';
import Holidays from 'date-holidays';
import { useId } from 'react';

import './calendar.css';

interface MonthDaySlot {
  index: number;
  row: number;
  column: number;
}

const MONTH_DAY_SLOTS: MonthDaySlot[] = Array.from({ length: 7 * 6 }, (_, index) => ({index, row: Math.floor(index / 7), column: index % 7}));

interface DayDisplayState {
  index: number;
  date?: Date;
}

interface MonthDisplayState {
  monthName: string;
  slottedDays: DayDisplayState[]
}

interface CalendarDisplayState {
  months: MonthDisplayState[]
}

interface CalendarDisplayProps {
  state: CalendarDisplayState;
}

export function CalendarDisplay({ state }: CalendarDisplayProps) {
  const id = useId();

  const holidays = new Holidays('US');
  return (
  <div className="calendar">{state.months.map(({monthName, slottedDays}) => (
    <div key={monthName} className="month-container">
      <h2>{monthName}</h2>
      <div className="month">{slottedDays.map((day) => (
        <div key={getDayKey({ id, dayIndex: day.index ,monthName})} className={`day ${day.date ? 'filled' : 'absent'} ${day.date && holidays.isHoliday(day.date) ? 'holiday' : ''}`}>
          {day.date?.getDate() ?? ''}
        </div>
      ))}</div>
    </div>
  ))}</div>)
}

export const Calendar = () => {
  const id = useId();


  const days = eachDayOfInterval({
    start: new Date(2025, 0, 1),
    end: new Date(2025, 11, 31),
  });


  return <div className="calendar-container">
    <h1>Calendar</h1>
    <CalendarDisplay state={getCalendarDisplayState(days)} />
  </div>;
};

interface GetDayKeyParams {
  id: string;
  dayIndex: number;
  monthName: string;
}

function getDayKey({ id, dayIndex, monthName }: GetDayKeyParams) {
  return `${id}-month-${monthName}-day-${dayIndex}`;
}

function getCalendarDisplayState(days: Date[]): CalendarDisplayState  {
  const months = days.reduce<MonthDisplayState[]>((acc, day) => {
    const monthName = day.toLocaleString('en-US', { month: 'long' });
    if (!acc.find((month) => month.monthName === monthName)) {
      acc.push({ monthName, slottedDays: [] });
    }
    
    const dayRow = getWeekOfMonth(day);
    const dayColumn = day.getDay();
    
    
    while (acc.find((month) => month.monthName === monthName)!.slottedDays.length < dayColumn) {
      acc.find((month) => month.monthName === monthName)!.slottedDays.push({index: acc.find((month) => month.monthName === monthName)!.slottedDays.length, date: undefined});
    }
    acc.find((month) => month.monthName === monthName)!.slottedDays.push({ index: acc.find((month) => month.monthName === monthName)!.slottedDays.length, date: day });
    return acc;
  }, []);
  return { months };
}


