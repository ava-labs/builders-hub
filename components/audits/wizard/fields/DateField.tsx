"use client";

import { CalendarIcon } from "lucide-react";
import type { Control, FieldPath } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatIsoDate,
  fromUtcCalendarDate,
  toUtcCalendarDate,
} from "@/components/audits/shared/format";
import type { AuditWizardValues } from "@/components/audits/wizard/types";

interface DateFieldProps {
  control: Control<AuditWizardValues>;
  name: FieldPath<AuditWizardValues>;
  label: string;
  required?: boolean;
  helper?: string;
  placeholder?: string;
}

export function DateField({
  control,
  name,
  label,
  required,
  helper,
  placeholder = "Pick a date",
}: DateFieldProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value = field.value instanceof Date ? field.value : null;
        return (
          <FormItem className="flex flex-col">
            <FormLabel>
              {label}
              {required ? <span className="text-brand"> *</span> : null}
            </FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-11 w-full justify-start text-left font-normal md:h-10",
                      !value && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon aria-hidden className="mr-2 h-4 w-4" />
                    {value ? formatIsoDate(value) : placeholder}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  // Shown as the local calendar day, stored as UTC midnight of
                  // that same day, so the two never drift apart.
                  selected={value ? fromUtcCalendarDate(value) : undefined}
                  onSelect={(date) => field.onChange(date ? toUtcCalendarDate(date) : null)}
                  disabled={(date) => date < today}
                />
              </PopoverContent>
            </Popover>
            {helper ? <FormDescription>{helper}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
