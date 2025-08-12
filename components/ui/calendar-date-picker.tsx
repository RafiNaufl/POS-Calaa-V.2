"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  format as formatDate,
} from "date-fns";
import { id } from "date-fns/locale";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CalendarDatePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  onDateSelect: (range: { from: Date; to: Date }) => void;
  numberOfMonths?: 1 | 2;
  closeOnSelect?: boolean;
  className?: string;
}

export function CalendarDatePicker({
  date,
  onDateSelect,
  numberOfMonths = 1,
  closeOnSelect = false,
  className,
  ...props
}: CalendarDatePickerProps) {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [selectedRange, setSelectedRange] = React.useState<string | null>(
    numberOfMonths === 2 ? "Bulan Ini" : "Hari Ini"
  );

  const handleClose = () => setIsPopoverOpen(false);
  const handleTogglePopover = () => setIsPopoverOpen((prev) => !prev);

  const selectDateRange = (from: Date, to: Date, range: string) => {
    const startDate = startOfDay(from);
    const endDate = numberOfMonths === 2 ? endOfDay(to) : startDate;
    onDateSelect({ from: startDate, to: endDate });
    setSelectedRange(range);
    closeOnSelect && setIsPopoverOpen(false);
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      let from = startOfDay(range.from);
      let to = range.to ? endOfDay(range.to) : from;
      onDateSelect({ from, to });
    }
    closeOnSelect && setIsPopoverOpen(false);
  };

  // Predefined date ranges
  const dateRanges = [
    {
      label: "Hari Ini",
      onClick: () => {
        const today = new Date();
        selectDateRange(today, today, "Hari Ini");
      },
    },
    {
      label: "Kemarin",
      onClick: () => {
        const yesterday = subDays(new Date(), 1);
        selectDateRange(yesterday, yesterday, "Kemarin");
      },
    },
    {
      label: "Minggu Ini",
      onClick: () => {
        const start = startOfWeek(new Date(), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(), { weekStartsOn: 1 });
        selectDateRange(start, end, "Minggu Ini");
      },
    },
    {
      label: "Bulan Ini",
      onClick: () => {
        const start = startOfMonth(new Date());
        const end = endOfMonth(new Date());
        selectDateRange(start, end, "Bulan Ini");
      },
    },
    {
      label: "Tahun Ini",
      onClick: () => {
        const start = startOfYear(new Date());
        const end = endOfYear(new Date());
        selectDateRange(start, end, "Tahun Ini");
      },
    },
  ];

  return (
    <div className={cn("flex flex-col space-y-2", className)} {...props}>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal bg-white hover:bg-gray-50 border-input focus:ring-2 focus:ring-primary"
            onClick={handleTogglePopover}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
            {date?.from ? (
              date.to && date.to.getTime() !== date.from.getTime() ? (
                <>
                  {formatDate(date.from, "PPP", { locale: id })} -{" "}
                  {formatDate(date.to, "PPP", { locale: id })}
                </>
              ) : (
                formatDate(date.from, "PPP", { locale: id })
              )
            ) : (
              <span>Pilih tanggal</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
        >
          <div className="p-3 border-b">
            <div className="flex flex-wrap gap-1">
              {dateRanges.map((range) => (
                <Button
                  key={range.label}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "text-xs",
                    selectedRange === range.label
                      ? "bg-primary text-black hover:bg-primary hover:text-black"
                      : "bg-white"
                  )}
                  onClick={range.onClick}
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>
          {numberOfMonths === 1 ? (
            <Calendar
              mode="single"
              selected={date?.from}
              onSelect={(day) => handleDateSelect(day ? { from: day } : undefined)}
              numberOfMonths={numberOfMonths}
              locale={id}
              initialFocus
              required={false}
            />
          ) : (
            <Calendar
              mode="range"
              selected={date}
              onSelect={handleDateSelect}
              numberOfMonths={numberOfMonths}
              locale={id}
              initialFocus
              required={false}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}