"use client";

import React, { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import dayjs from "dayjs";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";

interface DatePickerProps {
  value?: string | Date;
  onChange?: (date: Date) => void;
}

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => {
  const [date, setDate] = useState<dayjs.Dayjs | null>(
    value ? dayjs(value) : null
  );
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDate(value ? dayjs(value) : null);
  }, [value]);

  const handleSelect = (day: dayjs.Dayjs) => {
    setDate(day);
    onChange?.(day.toDate());
    setOpen(false);
  };

  const previousMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, "month"));
  };

  const nextMonth = () => {
    setCurrentMonth(currentMonth.add(1, "month"));
  };

  const generateCalendarDays = () => {
    const firstDayOfMonth = currentMonth.startOf("month");
    const lastDayOfMonth = currentMonth.endOf("month");

    let calendarStart = firstDayOfMonth.startOf("week");
    let calendarEnd = lastDayOfMonth.endOf("week");

    const days = [];
    let day = calendarStart;

    while (day.isBefore(calendarEnd) || day.isSame(calendarEnd, "day")) {
      days.push(day);
      day = day.add(1, "day");
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={`inline-flex items-center justify-between h-10 rounded-md border border-[var(--default-border-color)] px-4 py-2 text-sm focus:outline-none min-w-[160px] ${
            date
              ? "text-[var(--white-text-color)]"
              : "text-[var(--secondary-text-color)]"
          } `}
          aria-label='Select date'
        >
          {date ? date.format("MMM D, YYYY") : "Select date"}
          <CalendarIcon
            className='ml-2 h-4 w-4'
            color={`${
              date ? "var(--white-text-color)" : "var(--secondary-text-color)"
            }`}
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className='bg-[#fff] dark:bg-[#000] text-[var(--white-text-color)] p-4 rounded-md shadow-xl z-50 w-[300px]'
          sideOffset={5}
          align='start'
        >
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <button
                onClick={previousMonth}
                className='p-2 hover:bg-gray-700 rounded-md focus:outline-none'
                aria-label='Previous month'
              >
                <ChevronLeft
                  className='h-4 w-4'
                  color='var(--secondary-text-color)'
                />
              </button>
              <div className='font-medium'>
                {currentMonth.format("MMMM YYYY")}
              </div>
              <button
                onClick={nextMonth}
                className='p-2 hover:bg-gray-700 rounded-md focus:outline-none'
                aria-label='Next month'
              >
                <ChevronRight
                  className='h-4 w-4'
                  color='var(--secondary-text-color)'
                />
              </button>
            </div>

            <div>
              <div className='grid grid-cols-7 mb-2'>
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className='text-center text-xs text-[var(--secondary-text-color)] py-1'
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className='grid grid-cols-7 gap-1'>
                {calendarDays.map((day) => {
                  const isCurrentMonth = day.month() === currentMonth.month();
                  const isSelected = date ? day.isSame(date, "day") : false;

                  return (
                    <button
                      key={day.format()}
                      onClick={() => handleSelect(day)}
                      className={`
                        h-8 w-8 rounded-full flex items-center justify-center text-sm
                        ${
                          isCurrentMonth
                            ? "text-[var(--white-text-color)]"
                            : "text-gray-500"
                        }
                        ${
                          isSelected
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        }
                        focus:outline-none
                      `}
                    >
                      {day.date()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <Popover.Arrow className='fill-gray-800' />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default DatePicker;
