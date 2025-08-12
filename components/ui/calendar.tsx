"use client"

import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon
} from "lucide-react"
import { DayButton, getDefaultClassNames } from "react-day-picker"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: CalendarProps & {
  buttonVariant?: "ghost" | "link" | "default" | "destructive" | "outline" | "secondary"
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-white group/calendar p-4 rounded-xl shadow-xl border-0 [--cell-size:--spacing(8)]",
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months
        ),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-9 w-9 p-0 rounded-full bg-gray-50 hover:bg-primary hover:text-white transition-all duration-200",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-9 w-9 p-0 rounded-full bg-gray-50 hover:bg-primary hover:text-white transition-all duration-200",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-10 w-full px-4",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-10 gap-2",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative has-focus:border-ring border border-input bg-white shadow-md has-focus:ring-primary/50 has-focus:ring-2 rounded-md px-2 py-1 hover:bg-gray-50 transition-colors duration-200",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn("absolute inset-0 opacity-0 cursor-pointer", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium text-gray-800",
          captionLayout === "label"
            ? "text-base"
            : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 hover:text-primary transition-colors duration-200",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse space-y-2",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-gray-500 rounded-md w-10 font-semibold text-[0.8rem] py-2 uppercase",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        day: cn(
          "relative w-full h-full p-0 text-center text-sm rounded-full focus-within:relative focus-within:z-20 transition-all duration-200",
          defaultClassNames.day
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-medium rounded-full bg-transparent hover:bg-gray-100 transition-all duration-200 focus:ring-2 focus:ring-primary/50",
          defaultClassNames.day_button
        ),
        range_start: cn(
          "rounded-l-full bg-primary text-black font-bold shadow-md ring-2 ring-primary ring-offset-2",
          defaultClassNames.range_start
        ),
        range_middle: cn("bg-primary/30 hover:bg-primary/40 border-y-2 border-primary/20", defaultClassNames.range_middle),
        range_end: cn(
          "rounded-r-full bg-primary text-black font-bold shadow-md ring-2 ring-primary ring-offset-2",
          defaultClassNames.range_end
        ),
        today: cn(
          "bg-gray-100 text-primary font-bold rounded-full border-2 border-primary/30",
          defaultClassNames.today
        ),
        outside: cn(
          "text-gray-400 hover:bg-gray-50 hover:text-gray-500 opacity-50",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-gray-300 hover:bg-transparent hover:text-gray-300",
          defaultClassNames.disabled
        ),
        day_selected:
          "bg-primary text-black hover:bg-primary hover:text-black focus:bg-primary focus:text-black rounded-full font-bold shadow-md transform scale-110 transition-all duration-200",
        ...classNames,
      }}
      components={{
        PreviousMonthButton: () => <ChevronLeftIcon className="h-5 w-5" />,
        NextMonthButton: () => <ChevronRightIcon className="h-5 w-5" />,
        CaptionLabel: (props: React.HTMLAttributes<HTMLSpanElement>) => {
          // Menggunakan type assertion untuk mengakses properti dari DayPicker
          const captionProps = props as unknown as { date?: Date };
          const month = captionProps.date;
          
          // Fallback to empty display instead of null to satisfy TypeScript
          if (!month) {
            return <div className="flex items-center gap-1"></div>;
          }
          
          const monthName = month.toLocaleString("default", { month: "long" });
          const year = month.getFullYear();
          
          return (
            <div className="flex items-center gap-1">
              <span>{monthName}</span>
              <ChevronDownIcon className="h-4 w-4 text-primary" />
              <span>{year}</span>
              <ChevronDownIcon className="h-4 w-4 text-primary" />
            </div>
          );
        },
        ...components,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }