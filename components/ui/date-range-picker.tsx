"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { addDays, format } from "date-fns";
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

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
  align?: "center" | "start" | "end";
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
  align = "start",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className="w-full justify-start text-left font-normal bg-white hover:bg-gray-50 border-input focus:ring-2 focus:ring-primary"
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "PPP", { locale: id })} -{" "}
                  {format(dateRange.to, "PPP", { locale: id })}
                </>
              ) : (
                format(dateRange.from, "PPP", { locale: id })
              )
            ) : (
              <span>Pilih rentang tanggal</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="p-3 border-b">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const today = new Date();
                  onDateRangeChange({
                    from: today,
                    to: today,
                  });
                  setIsOpen(false);
                }}
              >
                Hari Ini
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const today = new Date();
                  const weekAgo = addDays(today, -7);
                  onDateRangeChange({
                    from: weekAgo,
                    to: today,
                  });
                  setIsOpen(false);
                }}
              >
                7 Hari Terakhir
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const today = new Date();
                  const monthAgo = addDays(today, -30);
                  onDateRangeChange({
                    from: monthAgo,
                    to: today,
                  });
                  setIsOpen(false);
                }}
              >
                30 Hari Terakhir
              </Button>
            </div>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
            locale={id}
            required={false}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}